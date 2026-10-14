import { getDataSourceSrv, getBackendSrv } from '@grafana/runtime';

const MAX_SCHEMA_CHARS = 20000;

export type SchemaConstraint = {
  name: string;
  type: 'p' | 'u' | 'f';
  columns: string[];
  referencedSchema?: string;
  referencedTable?: string;
  referencedColumns?: string[];
};

export type SchemaColumn = {
  schema: string;
  table: string;
  column: string;
  dataType: string;
  nullable?: boolean;
  defaultExpression?: string;
  description?: string;
  tableDescription?: string;
  relationType?: string;
  constraints?: SchemaConstraint[];
};

export type SchemaInformation = {
  text: string;
  columns: SchemaColumn[];
};

const quoteIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`;
const boundedText = (text: string, limit: number) => (text.length > limit ? text.slice(0, limit) + '…' : text);

function parseConstraints(value: unknown): SchemaConstraint[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  let parsed: unknown = value;
  try {
    if (typeof value === 'string') {
      parsed = JSON.parse(value);
    }
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) {
    return undefined;
  }
  return parsed.filter(
    (constraint: any) =>
      constraint &&
      typeof constraint.name === 'string' &&
      ['p', 'u', 'f'].includes(constraint.type) &&
      Array.isArray(constraint.columns) &&
      constraint.columns.every((column: unknown) => typeof column === 'string') &&
      (constraint.type !== 'f' ||
        (typeof constraint.referencedSchema === 'string' &&
          typeof constraint.referencedTable === 'string' &&
          Array.isArray(constraint.referencedColumns) &&
          constraint.referencedColumns.every((column: unknown) => typeof column === 'string') &&
          constraint.columns.length === constraint.referencedColumns.length))
  );
}

export function formatSchemaFrames(frames: any[]): SchemaInformation {
  const columns: SchemaColumn[] = [];
  const groups = new Map<string, SchemaColumn[]>();
  for (const frame of frames) {
    const fields = frame?.schema?.fields ?? [];
    const values = frame?.data?.values ?? [];
    const fieldValues = (name: string) => values[fields.findIndex((field: any) => field.name === name)] ?? [];
    const schemas = fieldValues('table_schema');
    const tables = fieldValues('table_name');
    const names = fieldValues('column_name');
    const types = fieldValues('data_type');
    const nullable = fieldValues('is_nullable');
    const defaults = fieldValues('column_default');
    const descriptions = fieldValues('column_description');
    const tableDescriptions = fieldValues('table_description');
    const relationTypes = fieldValues('relation_type');
    const constraints = fieldValues('constraints_json');
    schemas.forEach((schema: string, index: number) => {
      if (typeof schema !== 'string' || typeof tables[index] !== 'string' || typeof names[index] !== 'string') {
        return;
      }
      const column: SchemaColumn = {
        schema,
        table: tables[index],
        column: names[index],
        dataType: types[index] ?? 'unknown',
      };
      if (nullable[index] === 'YES' || nullable[index] === 'NO') {
        column.nullable = nullable[index] === 'YES';
      }
      if (typeof defaults[index] === 'string') {
        column.defaultExpression = defaults[index];
      }
      if (typeof descriptions[index] === 'string') {
        column.description = descriptions[index];
      }
      if (typeof tableDescriptions[index] === 'string') {
        column.tableDescription = tableDescriptions[index];
      }
      if (typeof relationTypes[index] === 'string') {
        column.relationType = relationTypes[index];
      }
      const parsedConstraints = parseConstraints(constraints[index]);
      if (parsedConstraints) {
        column.constraints = parsedConstraints;
      }
      columns.push(column);
      const key = JSON.stringify([column.schema, column.table]);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(column);
    });
  }

  let text = '';
  let omittedTables = 0;
  for (const tableColumns of groups.values()) {
    const table = tableColumns[0];
    const lines = [
      `Table ${quoteIdentifier(table.schema)}.${quoteIdentifier(table.table)} (${table.relationType ?? 'relation'})`,
    ];
    if (table.tableDescription) {
      lines.push(`  Table description: ${JSON.stringify(boundedText(table.tableDescription, 300))}`);
    }
    tableColumns.forEach((column) => {
      let line = `  ${quoteIdentifier(column.column)} (${column.dataType})`;
      if (column.nullable !== undefined) {
        line += column.nullable ? ' NULLABLE' : ' NOT NULL';
      }
      if (column.defaultExpression) {
        line += ` DEFAULT ${JSON.stringify(boundedText(column.defaultExpression, 180))}`;
      }
      if (column.description) {
        line += ` description=${JSON.stringify(boundedText(column.description, 300))}`;
      }
      lines.push(line);
    });
    const keys = new Map<string, SchemaConstraint>();
    tableColumns.forEach((column) => column.constraints?.forEach((key) => keys.set(key.name, key)));
    keys.forEach((key) => {
      const label = key.type === 'p' ? 'PRIMARY KEY' : key.type === 'u' ? 'UNIQUE' : 'FOREIGN KEY';
      let line = `  ${label} ${quoteIdentifier(key.name)} (${key.columns.map(quoteIdentifier).join(', ')})`;
      if (key.type === 'f') {
        line += ` REFERENCES ${quoteIdentifier(key.referencedSchema!)}.${quoteIdentifier(key.referencedTable!)} (${key
          .referencedColumns!.map(quoteIdentifier)
          .join(', ')})`;
      }
      lines.push(line);
    });
    const block = lines.join('\n');
    if (text.length + block.length + 2 > MAX_SCHEMA_CHARS - 128) {
      omittedTables++;
      continue;
    }
    text += (text ? '\n\n' : '') + block;
  }
  if (omittedTables) {
    text += `\n…(schema truncated: ${omittedTables} complete table(s) omitted; do not invent missing tables or columns)`;
  }
  return { text, columns };
}

const SCHEMA_SQL = `
SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS data_type,
    CASE
        WHEN a.attnotnull THEN 'NO'
        ELSE 'YES'
    END AS is_nullable,
    pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
    pg_catalog.col_description(c.oid, a.attnum) AS column_description,
    pg_catalog.obj_description(c.oid, 'pg_class') AS table_description,
    CASE c.relkind
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        WHEN 'p' THEN 'partitioned table'
        ELSE 'table'
    END AS relation_type,
    keys.constraints_json
FROM pg_catalog.pg_attribute AS a
JOIN pg_catalog.pg_class AS c
    ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace AS n
    ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef AS ad
    ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
        'name', con.conname,
        'type', con.contype,
        'columns', (
            SELECT array_agg(ca.attname ORDER BY ck.ordinality)
            FROM unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ordinality)
            JOIN pg_catalog.pg_attribute AS ca
                ON ca.attrelid = con.conrelid AND ca.attnum = ck.attnum
        ),
        'referencedSchema', rn.nspname,
        'referencedTable', rc.relname,
        'referencedColumns', (
            SELECT array_agg(ra.attname ORDER BY rk.ordinality)
            FROM unnest(con.confkey) WITH ORDINALITY AS rk(attnum, ordinality)
            JOIN pg_catalog.pg_attribute AS ra
                ON ra.attrelid = con.confrelid AND ra.attnum = rk.attnum
        )
    ) ORDER BY con.conname)::text AS constraints_json
    FROM pg_catalog.pg_constraint AS con
    LEFT JOIN pg_catalog.pg_class AS rc ON rc.oid = con.confrelid
    LEFT JOIN pg_catalog.pg_namespace AS rn ON rn.oid = rc.relnamespace
    WHERE con.conrelid = c.oid AND con.contype IN ('p', 'u', 'f')
) AS keys ON true
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND c.relkind IN ('r', 'v', 'm', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, c.relname, a.attnum;
`;

export async function getPostgresDataSource(uid?: string): Promise<{ uid: string; type: string }> {
  const requestedUid = uid?.trim();
  let ds;
  try {
    ds = requestedUid ? await getDataSourceSrv().get(requestedUid) : await getDataSourceSrv().get();
  } catch {
    throw new Error(
      `Grafana ${
        requestedUid ? `datasource "${requestedUid}"` : 'default datasource'
      } was not found or is not accessible.`
    );
  }
  if (ds.type !== 'postgres' || !ds.uid || (requestedUid && ds.uid !== requestedUid)) {
    throw new Error(
      requestedUid
        ? 'The requested UID must resolve to that exact PostgreSQL datasource.'
        : "Grafana's default datasource must be PostgreSQL. Configure it in Grafana datasource settings."
    );
  }
  return { uid: ds.uid, type: ds.type };
}

const IDENTITY_SQL =
  'SELECT current_user AS database_role, session_user AS login_role, current_database() AS database_name';

async function queryThroughGrafana(ds: { uid: string; type: string }, sql: string): Promise<any[]> {
  const response = await getBackendSrv().post('/api/ds/query', {
    queries: [
      {
        refId: 'A',
        datasource: ds,
        rawSql: sql,
        rawQuery: true,
        format: 'table',
        maxDataPoints: 10000,
        intervalMs: 60000,
      },
    ],
    from: 'now-1h',
    to: 'now',
  });
  const result = response?.results?.A;
  if (!result) {
    throw new Error('Grafana returned no query result.');
  }
  if (result.error) {
    throw new Error(result.error);
  }
  return result.frames ?? [];
}

function describeIdentity(frames: any[]): string {
  const frame = frames[0];
  const value = (name: string) =>
    frame?.data?.values?.[frame?.schema?.fields?.findIndex((field: any) => field.name === name)]?.[0];
  return `Database: ${value('database_name') ?? 'unknown'}; login role: ${
    value('login_role') ?? 'unknown'
  }; effective role: ${value('database_role') ?? 'unknown'}.`;
}

export async function requestPostgresQuery(uid: string, sql: string): Promise<any[]> {
  const ds = await getPostgresDataSource(uid);
  try {
    return await queryThroughGrafana(ds, sql);
  } catch (error: any) {
    const reason = error?.data?.results?.A?.error ?? error?.data?.message ?? error?.message ?? 'Unknown query error';
    let diagnostic = '';
    if (/permission denied/i.test(reason)) {
      try {
        diagnostic = ` Identity probe through the same datasource: ${describeIdentity(
          await queryThroughGrafana(ds, IDENTITY_SQL)
        )}`;
      } catch {
        diagnostic = ' Database identity could not be determined.';
      }
    }
    const denied = /permission|forbidden|not authorized|access denied/i.test(reason) || error?.status === 403;
    throw new Error(
      `Grafana datasource "${ds.uid}" query failed: ${reason}${diagnostic}${
        denied
          ? " This request uses Grafana's stored datasource connection, not separate plugin database credentials. A Grafana/database administrator must correct its access; the plugin cannot elevate permissions."
          : ''
      }`
    );
  }
}

export async function checkDataSourceAccess(uid: string): Promise<string> {
  const frames = await requestPostgresQuery(uid, IDENTITY_SQL);
  return `Connected through Grafana datasource ${uid}. ${describeIdentity(
    frames
  )} Table SELECT access is checked only when a lookup runs.`;
}

export async function getSchemaInformation(uid: string): Promise<SchemaInformation> {
  const frames = await requestPostgresQuery(uid, SCHEMA_SQL);
  const schema = formatSchemaFrames(frames);
  if (schema.columns.length === 0) {
    throw new Error(
      'Schema discovery returned no table columns. Check the selected datasource and catalog metadata visibility; this does not determine dashboard query permissions.'
    );
  }
  return schema;
}

export async function getSchemaText(uid: string): Promise<string> {
  return (await getSchemaInformation(uid)).text;
}

export async function makeSQLRequest(sql: string, uid: string): Promise<any[]> {
  return requestPostgresQuery(uid, sql);
}

export async function getDataSourceUID(uid: string): Promise<string> {
  return (await getPostgresDataSource(uid)).uid;
}

export async function getDataSourceType(uid: string): Promise<string> {
  return (await getPostgresDataSource(uid)).type;
}
