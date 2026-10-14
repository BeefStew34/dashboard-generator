import { normalizeGrafanaSql, validateAndRepairDashboard, validateDashboardSql } from './SqlValidation';
import type { Dashboard } from './DashboardModel';

jest.mock('@grafana/runtime', () => ({}));

const schema = [
  { schema: 'public', table: 'events', column: 'id', dataType: 'integer' },
  { schema: 'public', table: 'events', column: 'created_at', dataType: 'timestamp' },
  { schema: 'public', table: 'events', column: 'amount', dataType: 'numeric' },
  { schema: 'public', table: 'users', column: 'id', dataType: 'integer' },
  { schema: 'public', table: 'users', column: 'name', dataType: 'text' },
  { schema: 'Sales', table: 'Orders', column: 'Total', dataType: 'numeric' },
];
const dashboard = (rawSql: string): Dashboard => ({
  title: 'Test',
  panels: [{ id: 1, title: 'Events', type: 'table', targets: [{ refId: 'B', rawSql }] }],
});
const errors = (sql: string) => validateDashboardSql(dashboard(sql), schema);

it.each([
  'SELECT id, amount::numeric FROM public.events WHERE amount > 0',
  'SELECT e.id, u.name FROM events e JOIN users u ON e.id = u.id ORDER BY u.name',
  'SELECT id FROM events JOIN users USING (id)',
  'WITH x AS (SELECT * FROM events) SELECT x.id FROM x',
  'SELECT x.count FROM (SELECT count(*) FROM events) x',
  'SELECT count(*) AS total FROM events ORDER BY total',
  'WITH x AS (SELECT id AS event_id FROM events) SELECT x.event_id FROM x',
  'SELECT x.event_id FROM (SELECT id AS event_id FROM events) x',
  'WITH RECURSIVE x(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM x WHERE n<3) SELECT n FROM x',
  'SELECT id FROM events UNION ALL SELECT id FROM users',
  'SELECT e.id FROM events e WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = e.id)',
  'SELECT "Total" FROM "Sales"."Orders"',
  'SELECT t.n FROM generate_series(1, 5) AS t(n)',
  "SELECT $__timeGroupAlias(created_at, '1h', previous), SUM(amount) FROM events WHERE $__timeFilter(created_at) GROUP BY 1",
  'SELECT $__time(created_at), amount FROM events',
  'SELECT $__timeEpoch(id), amount FROM events',
  'SELECT id FROM events WHERE $__unixEpochFilter(id) AND id > $__unixEpochFrom()',
  'SELECT id FROM events WHERE created_at > $__timeFrom() AND created_at < $__timeTo()',
  'SELECT id FROM events WHERE id IN (${ids:csv}) AND amount > $amount',
  'SELECT id FROM events WHERE id IN ([[ids:csv]])',
  "SELECT '$__unknown(id)' AS value, $$${not_a_variable}$$ AS literal",
  'SELECT id FROM events -- $__unknown(id)\n WHERE id > 0',
])('accepts supported SQL: %s', (sql) => {
  expect(errors(sql)).toEqual([]);
});

it.each([
  ['SELECT FROM WHERE', ''],
  ['', 'exactly one'],
  ['WITH x AS (SELECT * FROM events) SELECT x.missing FROM x', 'Unknown column x.missing'],
  ['SELECT id FROM events UNION ALL SELECT missing FROM users', 'Unknown column missing'],
  ["SELECT $__timeGroup(created_at, '1h', bogus) FROM events", 'Invalid fill value'],
  ['SELECT missing FROM events WHERE id IN ($ids)', 'Unknown column missing'],
  ['SELECT missing FROM "Sales"."Orders"', 'Unknown column missing'],
  ['SELECT ID FROM "Sales"."Orders"', 'Unknown column id'],
  ['SELECT id FROM events ORDER BY missing', 'Unknown column missing'],
  ['SELECT id FROM events GROUP BY missing', 'Unknown column missing'],
  ['SELECT id FROM events GROUP BY id HAVING SUM(missing) > 0', 'Unknown column missing'],
  ['SELECT e.id FROM events e JOIN users u ON e.id=u.missing', 'Unknown column u.missing'],
  ['WITH x AS (SELECT missing FROM events) SELECT * FROM x', 'Unknown column missing'],
  ['SELECT x.id FROM (SELECT missing AS id FROM events) x', 'Unknown column missing'],
  ['SELECT id FROM invented', 'Unknown table invented'],
  ['SELECT missing FROM events', 'Unknown column missing'],
  ['SELECT e.missing FROM events e', 'Unknown column e.missing'],
  ['SELECT x.id FROM events e', 'Unknown table or alias x'],
  ['SELECT id FROM events e JOIN users u ON e.id=u.id', 'Ambiguous column id'],
  ['SELECT amount FROM events WHERE missing > 0', 'Unknown column missing'],
  ['WITH x AS (SELECT id FROM events) SELECT missing FROM x', 'Unknown column missing'],
  ['SELECT id FROM events; SELECT id FROM users', 'exactly one'],
  ['DELETE FROM events', 'read-only SELECT'],
  ['WITH x AS (DELETE FROM events RETURNING id) SELECT id FROM x', 'read-only SELECT'],
  ['SELECT $__timeGroup(created_at) FROM events', 'quoted interval'],
  ['SELECT $__unknown(created_at) FROM events', 'Unsupported Grafana macro'],
  ["SELECT $__timeGroup(created_at, '1h' FROM events", 'Unclosed Grafana macro'],
])('reports invalid SQL: %s', (sql, message) => {
  const result = errors(sql);
  expect(result.length).toBeGreaterThan(0);
  expect(result[0]).toMatchObject({ panelId: 1, refId: 'B', sql });
  expect(result.map((e) => e.message).join('\n')).toContain(message);
});

it('skips hidden queries and validates nested row panels', () => {
  const model = dashboard('invalid SQL');
  model.panels[0].targets![0].hide = true;
  expect(validateDashboardSql(model, schema)).toEqual([]);
  model.panels[0].panels = dashboard('SELECT missing FROM events').panels;
  expect(validateDashboardSql(model, schema)[0].message).toContain('Unknown column missing');
});

it('does not resolve search_path or dynamic identifiers by guessing', () => {
  expect(
    validateDashboardSql(dashboard('SELECT other_column FROM events'), [
      ...schema,
      { schema: 'archive', table: 'events', column: 'other_column', dataType: 'text' },
    ])
  ).toEqual([]);
  expect(errors('SELECT id FROM ${table_name:raw}')).toEqual([]);
});

it('leaves strings, identifiers, and comments intact in the validation copy', () => {
  const sql = `SELECT '$ids' AS "\${alias}" /* $ids */ FROM events WHERE id IN (\${ids:csv})`;
  expect(normalizeGrafanaSql(sql)).toContain(`SELECT '$ids' AS "\${alias}" /* $ids */`);
  expect(normalizeGrafanaSql(sql)).toContain('__grafana_variable_');
});

it('does not call repair for valid SQL or alter the source', async () => {
  const source = JSON.stringify({ dashboard: dashboard('SELECT id FROM events') });
  const repair = jest.fn();
  expect(await validateAndRepairDashboard(source, schema, repair)).toBe(source);
  expect(repair).not.toHaveBeenCalled();
});

it('passes actionable errors and revalidates the repaired dashboard', async () => {
  const source = JSON.stringify(dashboard('SELECT missing FROM events'));
  const fixed = JSON.stringify(dashboard('SELECT id FROM events'));
  const repair = jest.fn().mockResolvedValue(fixed);
  expect(await validateAndRepairDashboard(source, schema, repair)).toBe(fixed);
  expect(repair).toHaveBeenCalledWith(
    source,
    expect.arrayContaining([
      expect.objectContaining({
        panelId: 1,
        refId: 'B',
        sql: 'SELECT missing FROM events',
        message: 'Unknown column missing.',
      }),
    ])
  );
});

it('stops after two repairs and exposes remaining errors', async () => {
  const source = JSON.stringify(dashboard('SELECT missing FROM events'));
  const repair = jest.fn().mockResolvedValue(source);
  await expect(validateAndRepairDashboard(source, schema, repair)).rejects.toThrow(
    'Panel 1, target B: Unknown column missing'
  );
  expect(repair).toHaveBeenCalledTimes(2);
});

it('repairs invalid JSON as well as invalid SQL', async () => {
  const repair = jest.fn().mockResolvedValue(JSON.stringify(dashboard('SELECT id FROM events')));
  await validateAndRepairDashboard('not json', schema, repair);
  expect(repair).toHaveBeenCalledTimes(1);
  expect(repair.mock.calls[0][1][0].message).toBeTruthy();
});

it('propagates repair service errors without further retries', async () => {
  const repair = jest.fn().mockRejectedValue(new Error('Permission denied by model service'));
  await expect(validateAndRepairDashboard(JSON.stringify(dashboard('bad SQL')), schema, repair)).rejects.toThrow(
    'Permission denied'
  );
  expect(repair).toHaveBeenCalledTimes(1);
});
