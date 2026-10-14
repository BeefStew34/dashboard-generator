import {
  checkDataSourceAccess,
  formatSchemaFrames,
  getPostgresDataSource,
  getSchemaInformation,
  requestPostgresQuery,
} from './DataSourceInterface';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({ getBackendSrv: jest.fn(), getDataSourceSrv: jest.fn() }));
jest.mock('@grafana/data', () => ({ dateTime: jest.fn() }));

const frame = {
  schema: {
    fields: ['table_schema', 'table_name', 'column_name', 'data_type', 'is_nullable'].map((name) => ({ name })),
  },
  data: {
    values: [
      ['public', 'public'],
      ['events', 'events'],
      ['id', 'created_at'],
      ['integer', 'timestamp without time zone'],
      ['NO', 'YES'],
    ],
  },
};

it('includes schema, table, column and actual types from Grafana frames', () => {
  const result = formatSchemaFrames([frame]);
  expect(result.columns).toEqual([
    { schema: 'public', table: 'events', column: 'id', dataType: 'integer', nullable: false },
    {
      schema: 'public',
      table: 'events',
      column: 'created_at',
      dataType: 'timestamp without time zone',
      nullable: true,
    },
  ]);
  expect(result.text).toBe(
    'Table "public"."events" (relation)\n  "id" (integer) NOT NULL\n  "created_at" (timestamp without time zone) NULLABLE'
  );
});

it('uses field names rather than assuming frame column order', () => {
  const reordered = {
    schema: { fields: [...frame.schema.fields].reverse() },
    data: { values: [...frame.data.values].reverse() },
  };
  expect(formatSchemaFrames([reordered])).toEqual(formatSchemaFrames([frame]));
});

it('retains full metadata when limiting prompt text and combines frames', () => {
  const result = formatSchemaFrames(Array(300).fill(frame));
  expect(result.columns).toHaveLength(600);
  expect(result.text).toContain('schema truncated');
  expect(result.text.length).toBeLessThan(20100);
});

it('does not retry schema permission failures or execute generated SQL', async () => {
  const post = jest.fn().mockResolvedValue({ results: { A: { error: 'permission denied' } } });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  (getDataSourceSrv as jest.Mock).mockReturnValue({
    get: jest.fn().mockResolvedValue({ uid: 'postgres', type: 'postgres' }),
  });
  await expect(getSchemaInformation('postgres')).rejects.toThrow('permission denied');
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[0][1].queries[0].rawSql).toContain('pg_catalog');
  expect(post.mock.calls[1][1].queries[0].rawSql).toContain('SELECT current_user');
});

const constraints = [
  { name: 'events_pk', type: 'p', columns: ['tenant_id', 'id'] },
  { name: 'events_unique', type: 'u', columns: ['tenant_id', 'external_id'] },
  {
    name: 'events_user_fk',
    type: 'f',
    columns: ['tenant_id', 'user_id'],
    referencedSchema: 'public',
    referencedTable: 'users',
    referencedColumns: ['tenant_id', 'id'],
  },
];

const richFrame = {
  schema: {
    fields: [
      ...frame.schema.fields,
      ...['column_default', 'column_description', 'table_description', 'relation_type', 'constraints_json'].map(
        (name) => ({ name })
      ),
    ],
  },
  data: {
    values: [
      ...frame.data.values,
      ["nextval('events_seq'::regclass)", null],
      ['Event identifier', 'When the event occurred'],
      ['Application events', 'Application events'],
      ['table', 'table'],
      [JSON.stringify(constraints), JSON.stringify(constraints)],
    ],
  },
};

it('groups columns by table and includes comments, defaults, and ordered composite relationships', () => {
  const result = formatSchemaFrames([richFrame]);
  expect(result.columns[0]).toMatchObject({
    nullable: false,
    defaultExpression: "nextval('events_seq'::regclass)",
    description: 'Event identifier',
    tableDescription: 'Application events',
    relationType: 'table',
    constraints,
  });
  expect(result.text).toContain('Table "public"."events" (table)');
  expect(result.text).toContain('Table description: "Application events"');
  expect(result.text).toContain('DEFAULT "nextval(\'events_seq\'::regclass)"');
  expect(result.text).toContain('description="When the event occurred"');
  expect(result.text).toContain('PRIMARY KEY "events_pk" ("tenant_id", "id")');
  expect(result.text).toContain('UNIQUE "events_unique" ("tenant_id", "external_id")');
  expect(result.text).toContain(
    'FOREIGN KEY "events_user_fk" ("tenant_id", "user_id") REFERENCES "public"."users" ("tenant_id", "id")'
  );
  expect(result.text.split('FOREIGN KEY')).toHaveLength(2);
});

it('handles absent optional fields and malformed constraint JSON without losing columns', () => {
  const minimal = {
    schema: { fields: frame.schema.fields.slice(0, 4) },
    data: { values: frame.data.values.slice(0, 4) },
  };
  expect(formatSchemaFrames([minimal]).columns[0].nullable).toBeUndefined();
  const malformed = {
    ...richFrame,
    data: {
      values: [...richFrame.data.values.slice(0, -1), ['bad JSON', [{ name: 'bad', type: 'f', columns: ['id'] }]]],
    },
  };
  const result = formatSchemaFrames([malformed]);
  expect(result.columns).toHaveLength(2);
  expect(result.text).not.toContain('FOREIGN KEY');
});

it('does not invent attributes when catalog comments or defaults are null', () => {
  const result = formatSchemaFrames([frame]);
  expect(result.text).not.toContain('DEFAULT');
  expect(result.text).not.toContain('description=');
  expect(result.text).not.toContain('PRIMARY KEY');
});

it('escapes identifiers and bounds individual comments without cutting table definitions', () => {
  const unusual = { ...richFrame, data: { values: [...richFrame.data.values] } };
  unusual.data.values[1] = ['odd"table', 'odd"table'];
  unusual.data.values[6] = ['x'.repeat(1000), 'comment\nwith newlines'];
  const result = formatSchemaFrames([unusual]);
  expect(result.text).toContain('"odd""table"');
  expect(result.text).not.toContain('x'.repeat(301));
  expect(result.text).toContain('comment\\nwith newlines');
  expect(result.text).toContain('"created_at"');
});

it('discovers catalog metadata without filtering on the plugin role or executing trial SQL', async () => {
  const post = jest.fn().mockResolvedValue({ results: { A: { frames: [richFrame] } } });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  (getDataSourceSrv as jest.Mock).mockReturnValue({
    get: jest.fn().mockResolvedValue({ uid: 'postgres', type: 'postgres' }),
  });
  const result = await getSchemaInformation('postgres');
  const sql = post.mock.calls[0][1].queries[0].rawSql;
  expect(result.text).toContain('Application events');
  expect(post).toHaveBeenCalledTimes(1);
  expect(sql).not.toMatch(/has_(?:schema|table|column)_privilege/i);
  expect(result.columns).toHaveLength(2);
  expect(sql).toContain('pg_catalog.pg_constraint');
  expect(sql).toContain('ORDER BY ck.ordinality');
  expect(sql).toContain('ORDER BY rk.ordinality');
  expect(sql).not.toMatch(/EXPLAIN|FROM public\./i);
});

it('uses the exact selected UID for discovery instead of Grafana default credentials', async () => {
  const get = jest.fn().mockResolvedValue({ uid: 'working-dashboard', type: 'postgres' });
  const post = jest.fn().mockResolvedValue({ results: { A: { frames: [richFrame] } } });
  (getDataSourceSrv as jest.Mock).mockReturnValue({ get });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  await getSchemaInformation('working-dashboard');
  expect(get).toHaveBeenCalledWith('working-dashboard');
  expect(get).not.toHaveBeenCalledWith();
  expect(post.mock.calls[0][1].queries[0].datasource).toEqual({ uid: 'working-dashboard', type: 'postgres' });
});

it('resolves Grafana default automatically and rejects non-PostgreSQL defaults or mismatched explicit UIDs', async () => {
  const get = jest.fn().mockResolvedValue({ uid: 'default-postgres', type: 'postgres' });
  (getDataSourceSrv as jest.Mock).mockReturnValue({ get });
  await expect(getPostgresDataSource()).resolves.toEqual({ uid: 'default-postgres', type: 'postgres' });
  expect(get).toHaveBeenCalledWith();
  await expect(getPostgresDataSource('expected')).rejects.toThrow('exact PostgreSQL datasource');
  get.mockResolvedValue({ uid: 'expected', type: 'mysql' });
  await expect(getPostgresDataSource()).rejects.toThrow('default datasource must be PostgreSQL');
  await expect(getPostgresDataSource('expected')).rejects.toThrow('exact PostgreSQL datasource');
});

it('reports permission errors with the selected UID and does not retry or elevate access', async () => {
  const get = jest.fn().mockResolvedValue({ uid: 'chosen', type: 'postgres' });
  const post = jest.fn().mockRejectedValue({ status: 403, data: { message: 'Forbidden' } });
  (getDataSourceSrv as jest.Mock).mockReturnValue({ get });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  await expect(requestPostgresQuery('chosen', 'SELECT id FROM public.store')).rejects.toThrow(
    'administrator must correct its access'
  );
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1].queries[0].datasource.uid).toBe('chosen');
});

it('reports login/effective database roles from a separate probe through the failed query UID without exposing connection secrets', async () => {
  const get = jest.fn().mockResolvedValue({ uid: 'default-postgres', type: 'postgres', password: 'DO_NOT_SERIALIZE' });
  const post = jest
    .fn()
    .mockResolvedValueOnce({ results: { A: { error: 'pq: permission denied for table aggregator' } } })
    .mockResolvedValueOnce({
      results: {
        A: {
          frames: [
            {
              schema: { fields: [{ name: 'database_role' }, { name: 'login_role' }, { name: 'database_name' }] },
              data: { values: [['report_reader'], ['grafana_login'], ['reports']] },
            },
          ],
        },
      },
    });
  (getDataSourceSrv as jest.Mock).mockReturnValue({ get });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  const pending = requestPostgresQuery('default-postgres', 'SELECT value FROM public.aggregator LIMIT 1');
  await expect(pending).rejects.toThrow('login role: grafana_login; effective role: report_reader');
  await expect(pending).rejects.toThrow('Database: reports');
  expect(post).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1].queries[0].datasource).toEqual({ uid: 'default-postgres', type: 'postgres' });
  expect(post.mock.calls[1][1].queries[0].datasource).toEqual({ uid: 'default-postgres', type: 'postgres' });
  expect(JSON.stringify(post.mock.calls)).not.toContain('DO_NOT_SERIALIZE');
});

it('preserves the original permission error if the identity probe fails', async () => {
  const post = jest
    .fn()
    .mockResolvedValueOnce({ results: { A: { error: 'permission denied for table aggregator' } } })
    .mockRejectedValueOnce(new Error('probe failed'));
  (getDataSourceSrv as jest.Mock).mockReturnValue({
    get: jest.fn().mockResolvedValue({ uid: 'default-postgres', type: 'postgres' }),
  });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  const pending = requestPostgresQuery('default-postgres', 'SELECT value FROM public.aggregator LIMIT 1');
  await expect(pending).rejects.toThrow('permission denied for table aggregator');
  await expect(pending).rejects.toThrow('Database identity could not be determined');
  expect(post).toHaveBeenCalledTimes(2);
});

it('checks the actual datasource database and role without assuming table grants', async () => {
  const post = jest.fn().mockResolvedValue({
    results: {
      A: {
        frames: [
          {
            schema: { fields: [{ name: 'database_role' }, { name: 'database_name' }] },
            data: { values: [['report_reader'], ['reporting']] },
          },
        ],
      },
    },
  });
  (getDataSourceSrv as jest.Mock).mockReturnValue({
    get: jest.fn().mockResolvedValue({ uid: 'chosen', type: 'postgres' }),
  });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  expect(await checkDataSourceAccess('chosen')).toContain('role: report_reader');
  expect(post.mock.calls[0][1].queries[0].rawSql).toBe(
    'SELECT current_user AS database_role, session_user AS login_role, current_database() AS database_name'
  );
});

it('caps prompt context by omitting whole table blocks while retaining complete local metadata', () => {
  const frames = Array.from({ length: 150 }, (_, index) => ({
    ...richFrame,
    data: {
      values: [
        ...richFrame.data.values.slice(0, 1),
        [`events_${index}`, `events_${index}`],
        ...richFrame.data.values.slice(2),
      ],
    },
  }));
  const result = formatSchemaFrames(frames);
  expect(result.columns).toHaveLength(300);
  expect(result.text.length).toBeLessThanOrEqual(20000);
  expect(result.text).toContain('complete table(s) omitted');
  expect(result.text.match(/^Table /gm)!.length).toEqual(result.text.match(/  "created_at"/g)!.length);
  expect(result.text.match(/^Table /gm)!.length).toEqual(result.text.match(/  "id"/g)!.length);
});

it('reports empty metadata without claiming the dashboard client lacks access', async () => {
  const post = jest.fn().mockResolvedValue({ results: { A: { frames: [] } } });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  (getDataSourceSrv as jest.Mock).mockReturnValue({
    get: jest.fn().mockResolvedValue({ uid: 'postgres', type: 'postgres' }),
  });
  await expect(getSchemaInformation('postgres')).rejects.toThrow('this does not determine dashboard query permissions');
});
