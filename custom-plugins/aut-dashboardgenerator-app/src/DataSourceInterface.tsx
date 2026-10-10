import { getDataSourceSrv,getBackendSrv } from '@grafana/runtime';
import { dateTime } from '@grafana/data';

const MAX_SCHEMA_CHARS = 20000;

const SCHEMA_SQL = `
SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS data_type,
    CASE
        WHEN a.attnotnull THEN 'NO'
        ELSE 'YES'
    END AS is_nullable
FROM pg_catalog.pg_attribute AS a
JOIN pg_catalog.pg_class AS c
    ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace AS n
    ON n.oid = c.relnamespace
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND c.relkind IN ('r', 'v', 'm', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, c.relname, a.attnum;
`;


export async function getSchemaText(): Promise<string> {
  const uid = (await getDataSourceUID())?.trim();
 
  if (!uid) {
    throw new Error('No data source UID configured. Check Settings.');
  }
 
  let ds;
  try {
    ds = await getDataSourceSrv().get(uid);
  } catch {
    throw new Error(`Data source "${uid}" was not found in Grafana.`);
  }

  const response = await getBackendSrv().post('/api/ds/query', {
    queries: [
      {
        refId: 'A',
        datasource: { uid: ds.uid, type: ds.type },
        rawSql: SCHEMA_SQL,
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
 
  if (result?.error) {
    throw new Error(`Schema query failed: ${result.error}`);
  }
 
  // Grafana frames are column-oriented: values[columnIndex][rowIndex].
  const values: any[][] = result?.frames?.[0]?.data?.values ?? [];
  const [names = [], types = [], columns = []] = values;
 
  if (names.length === 0) {
    throw new Error(
      'Schema query returned no tables. Check that the data source user has SELECT access.'
    );
  }
 
  let text = names
    .map(
      (name: string, i: number) => `${name} [${types[i]}] (${columns[i]})`
    )
    .join('\n');
 
  if (text.length > MAX_SCHEMA_CHARS) {
    text = text.slice(0, MAX_SCHEMA_CHARS) + '\n…(schema truncated)';
  }
 
  return text;
}

export async function makeSQLRequest(sql: string): Promise<any> { 
    const ds: any = await getDataSourceSrv().get();
    return ds.query({
        requestId: `sql-${Date.now()}`,
        interval: '1s',
        intervalMs: 1000,
        maxDataPoints: 500,
        scopedVars: {},
        range: { from: dateTime().subtract(1, 'h'), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
        targets: [{ refId: 'A', rawSql: sql, format: 'table', rawQuery: true }],
    }).toPromise();
}
export async function getDataSourceUID(): Promise<string> {
    const ds: any = await getDataSourceSrv().get();
    return ds.uid;
}
export async function getDataSourceType(): Promise<string> {
    const ds: any = await getDataSourceSrv().get();
    return ds.type;
}
