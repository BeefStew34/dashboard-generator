import { parse } from 'pgsql-ast-parser';
import { Dashboard, DashboardPanel, parseDashboard } from './DashboardModel';
import type { SchemaColumn } from './DataSourceInterface';

export type QueryValidationError = {
  panelId?: number;
  refId?: string;
  sql?: string;
  message: string;
};

const VARIABLE = '__grafana_variable_';

// Normalize placeholders only in a validation copy; never change saved SQL.
export function normalizeGrafanaSql(sql: string): string {
  let output = '';
  let index = 0;
  while (index < sql.length) {
    const rest = sql.slice(index);
    const quoted = /^(?:'(?:''|\\.|[^'\\])*'|"(?:""|[^"])*"|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)/.exec(rest);
    const dollarQuote = /^(\$(?:[A-Za-z_][\w]*)?\$)/.exec(rest);
    if (quoted) {
      output += quoted[0];
      index += quoted[0].length;
      continue;
    }
    if (dollarQuote) {
      const end = sql.indexOf(dollarQuote[0], index + dollarQuote[0].length);
      if (end < 0) {
        throw new Error('Unterminated dollar-quoted SQL string.');
      }
      // The local parser recognizes dollar quotes as code blocks, not expression literals.
      output += `'${sql.slice(index + dollarQuote[0].length, end).replace(/'/g, "''")}'`;
      index = end + dollarQuote[0].length;
      continue;
    }
    const macro = /^\$__(\w+)/.exec(rest);
    if (macro) {
      const name = macro[1];
      index += macro[0].length;
      if (['interval_ms', 'range_s', 'from', 'to'].includes(name)) {
        output += '60000';
        continue;
      }
      if (name === 'interval') {
        output += "'1m'";
        continue;
      }
      while (/\s/.test(sql[index] ?? '') && index < sql.length) {
        index++;
      }
      if (sql[index] !== '(') {
        throw new Error(`Unsupported Grafana macro $${'__'}${name}.`);
      }
      const start = ++index;
      let depth = 1;
      while (index < sql.length && depth) {
        const quote = /^(?:'(?:''|\\.|[^'\\])*'|"(?:""|[^"])*")/.exec(sql.slice(index));
        if (quote) {
          index += quote[0].length;
          continue;
        }
        if (sql[index] === '(') {
          depth++;
        }
        if (sql[index] === ')') {
          depth--;
        }
        if (depth) {
          index++;
        }
      }
      if (depth) {
        throw new Error(`Unclosed Grafana macro $__${name}.`);
      }
      const args = sql.slice(start, index++);
      const expression = normalizeGrafanaSql(args);
      if (['timeFrom', 'timeTo'].includes(name)) {
        if (args.trim()) {
          throw new Error(`$__${name} takes no arguments.`);
        }
        output += "TIMESTAMP '2020-01-01'";
      } else if (['unixEpochFrom', 'unixEpochTo', 'unixEpochNanoFrom', 'unixEpochNanoTo'].includes(name)) {
        if (args.trim()) {
          throw new Error(`$__${name} takes no arguments.`);
        }
        output += '1577836800';
      } else if (['timeFilter', 'unixEpochFilter', 'unixEpochNanoFilter'].includes(name)) {
        output += `(${expression} BETWEEN 0 AND 1)`;
      } else if (['time', 'timeEpoch'].includes(name)) {
        output += `${expression} AS "time"`;
      } else if (['timeGroup', 'timeGroupAlias', 'unixEpochGroup', 'unixEpochGroupAlias'].includes(name)) {
        // A function preserves expression parsing and column references, including nested calls.
        const call = parse(`SELECT __grafana_group(${expression})`)[0] as any;
        const argumentsList = call.columns[0].expr.args;
        if (argumentsList.length < 2 || argumentsList.length > 3 || argumentsList[1].type !== 'string') {
          throw new Error(`$__${name} requires a column, a quoted interval, and an optional fill value.`);
        }
        const fill = argumentsList[2];
        if (
          fill &&
          !['integer', 'numeric', 'null', 'string'].includes(fill.type) &&
          !(fill.type === 'ref' && fill.name === 'previous') &&
          !(fill.type === 'unary' && fill.op === '-' && ['integer', 'numeric'].includes(fill.operand?.type))
        ) {
          throw new Error(`Invalid fill value for $__${name}.`);
        }
        output += `__grafana_group(${expression})${name.endsWith('Alias') ? ' AS "time"' : ''}`;
      } else {
        throw new Error(`Unsupported Grafana macro $__${name}.`);
      }
      continue;
    }
    const variable = /^(?:\$\{[A-Za-z_]\w*(?::[^}]+)?\}|\[\[[A-Za-z_]\w*(?::[^\]]+)?\]\]|\$[A-Za-z_]\w*)/.exec(rest);
    if (variable) {
      output += VARIABLE + index;
      index += variable[0].length;
      continue;
    }
    output += sql[index++];
  }
  return output;
}

type Relation = { name: string; schema?: string; columns: Set<string> | null };
const dynamic = (name: string) => name.includes(VARIABLE) || /\$|\[\[/.test(name);

function checkSchema(ast: any, schema: SchemaColumn[]): string[] {
  const errors = new Set<string>();
  const tables = new Map<string, Relation>();
  schema.forEach((column) => {
    const key = `${column.schema}.${column.table}`;
    if (!tables.has(key)) {
      tables.set(key, { name: column.table, schema: column.schema, columns: new Set() });
    }
    tables.get(key)!.columns!.add(column.column);
  });

  const inspect = (node: any, ctes = new Map<string, Relation>(), outer: Relation[] = []): Set<string> | null => {
    if (node.type === 'with recursive') {
      const local = new Map(ctes);
      const columns = node.columnNames ? new Set<string>(node.columnNames.map((c: any) => c.name)) : null;
      local.set(node.alias.name, { name: node.alias.name, columns });
      const inferred = inspect(node.bind, local, outer);
      local.set(node.alias.name, { name: node.alias.name, columns: columns ?? inferred });
      return inspect(node.in, local, outer);
    }
    if (node.type === 'with') {
      const local = new Map(ctes);
      for (const binding of node.bind ?? []) {
        const columns = inspect(binding.statement, local, outer);
        local.set(binding.alias.name, {
          name: binding.alias.name,
          columns: binding.alias.columns ? new Set(binding.alias.columns.map((c: any) => c.name ?? c)) : columns,
        });
      }
      return inspect(node.in, local, outer);
    }
    if (node.type === 'union' || node.type === 'union all' || node.type === 'intersect' || node.type === 'except') {
      const columns = inspect(node.left, ctes, outer);
      inspect(node.right, ctes, outer);
      return columns;
    }
    if (node.type !== 'select') {
      errors.add('Only a single read-only SELECT query is supported (including SELECT CTEs).');
      return null;
    }
    const relations: Relation[] = [];
    for (const source of node.from ?? []) {
      if (source.type === 'table') {
        const name = source.name;
        let relation = !name.schema ? ctes.get(name.name) : undefined;
        if (!relation && !dynamic(name.name)) {
          const candidates = [...tables.values()].filter(
            (t) => t.name === name.name && (!name.schema || t.schema === name.schema)
          );
          if (!candidates.length) {
            errors.add(`Unknown table ${name.schema ? name.schema + '.' : ''}${name.name}.`);
          }
          // Without the database search_path, overlapping table names cannot be resolved reliably.
          relation = candidates.length === 1 ? candidates[0] : undefined;
        }
        relations.push({
          name: name.alias ?? name.name,
          schema: name.alias ? undefined : name.schema,
          columns: relation?.columns ?? null,
        });
      } else if (source.type === 'statement') {
        relations.push({ name: source.alias, columns: inspect(source.statement, ctes, outer) });
      } else {
        relations.push({
          name: source.alias?.name ?? source.function?.name ?? '',
          columns: source.alias?.columns ? new Set(source.alias.columns.map((c: any) => c.name)) : null,
        });
      }
    }
    const aliases = new Set<string>((node.columns ?? []).map((c: any) => c.alias?.name).filter(Boolean));
    const mergedColumns = new Set<string>(
      (node.from ?? []).flatMap((source: any) => (source.join?.using ?? []).map((c: any) => c.name))
    );
    const available = [...relations, ...outer];
    const walk = (value: any, allowAliases = false) => {
      if (!value || typeof value !== 'object') {
        return;
      }
      if (['select', 'with', 'with recursive', 'union', 'union all', 'intersect', 'except'].includes(value.type)) {
        inspect(value, ctes, available);
        return;
      }
      if (value.type === 'call' && value.function?.name === '__grafana_group') {
        walk(value.args.slice(0, 2), allowAliases);
        return;
      }
      if (value.type === 'ref') {
        if (value.name === '*' || dynamic(value.name) || dynamic(value.table?.name ?? '')) {
          return;
        }
        if (value.table) {
          const relation = available.find(
            (r) => r.name === value.table.name && (!value.table.schema || r.schema === value.table.schema)
          );
          if (!relation) {
            errors.add(`Unknown table or alias ${value.table.name}.`);
          } else if (relation.columns && !relation.columns.has(value.name)) {
            errors.add(`Unknown column ${value.table.name}.${value.name}.`);
          }
        } else if (!(allowAliases && aliases.has(value.name)) && available.every((r) => r.columns !== null)) {
          const matches = relations.filter((r) => r.columns?.has(value.name));
          if (matches.length > 1 && !mergedColumns.has(value.name)) {
            errors.add(`Ambiguous column ${value.name}; qualify it with a table alias.`);
          } else if (!matches.length && !outer.some((r) => r.columns?.has(value.name))) {
            errors.add(`Unknown column ${value.name}.`);
          }
        }
        return;
      }
      Object.values(value).forEach((child) => {
        if (Array.isArray(child)) {
          child.forEach((item) => walk(item, allowAliases));
        } else {
          walk(child, allowAliases);
        }
      });
    };
    (node.from ?? []).forEach((source: any) => {
      walk(source.join?.on);
      if (source.type === 'call') {
        walk(source.args);
      }
    });
    (node.columns ?? []).forEach((column: any) => walk(column.expr));
    ['where', 'having', 'limit', 'offset'].forEach((key) => walk(node[key]));
    walk(node.groupBy, true);
    walk(node.orderBy, true);
    const projected = new Set<string>();
    for (const column of node.columns ?? []) {
      if (column.expr?.type === 'ref' && column.expr.name === '*') {
        const sources = column.expr.table ? relations.filter((r) => r.name === column.expr.table.name) : relations;
        if (!sources.length || sources.some((r) => r.columns === null)) {
          return null;
        }
        sources.forEach((r) => r.columns!.forEach((name) => projected.add(name)));
      } else {
        const name =
          column.alias?.name ??
          (column.expr?.type === 'ref'
            ? column.expr.name
            : column.expr?.type === 'call'
            ? column.expr.function.name
            : undefined);
        if (!name) {
          return null;
        }
        projected.add(name);
      }
    }
    return projected;
  };
  inspect(ast);
  return [...errors];
}

export function validateDashboardSql(dashboard: Dashboard, schema: SchemaColumn[]): QueryValidationError[] {
  const errors: QueryValidationError[] = [];
  const visit = (panels: DashboardPanel[]) =>
    panels.forEach((panel) => {
      for (const target of panel.targets ?? []) {
        if (target.hide || target.rawSql === undefined) {
          continue;
        }
        const context = { panelId: panel.id, refId: target.refId ?? 'A', sql: target.rawSql };
        try {
          if (!target.rawSql.trim()) {
            throw new Error('Expected exactly one SQL SELECT statement.');
          }
          const statements = parse(normalizeGrafanaSql(target.rawSql));
          if (statements.length !== 1) {
            throw new Error('Expected exactly one SQL SELECT statement.');
          }
          checkSchema(statements[0], schema).forEach((message) => errors.push({ ...context, message }));
        } catch (error) {
          errors.push({ ...context, message: error instanceof Error ? error.message.slice(0, 2000) : 'Invalid SQL.' });
        }
      }
      if (Array.isArray(panel.panels)) {
        visit(panel.panels);
      }
    });
  visit(dashboard.panels);
  return errors;
}

export async function validateAndRepairDashboard(
  initial: string,
  schema: SchemaColumn[],
  repair: (source: string, errors: QueryValidationError[]) => Promise<string>
): Promise<string> {
  let source = initial;
  for (let attempt = 0; attempt <= 2; attempt++) {
    let errors: QueryValidationError[];
    try {
      errors = validateDashboardSql(parseDashboard(source), schema);
    } catch (error) {
      errors = [{ message: error instanceof Error ? error.message : 'Invalid dashboard JSON.' }];
    }
    if (!errors.length) {
      return source;
    }
    if (attempt === 2) {
      throw new Error(
        `Dashboard validation failed after two repair attempts:\n${errors
          .map((e) => `${e.panelId !== undefined ? `Panel ${e.panelId}, target ${e.refId}: ` : ''}${e.message}`)
          .join('\n')}`
      );
    }
    source = await repair(source, errors);
  }
  throw new Error('Dashboard validation failed.');
}
