import { bindDashboardDataSource, saveDashboardFromJson } from './DashboardModel';
import { getBackendSrv } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({ getBackendSrv: jest.fn(), locationService: { push: jest.fn() } }));

it('binds SQL panels, nested targets, query variables and SQL annotations to the selected datasource', () => {
  const source = JSON.stringify({
    dashboard: {
      title: 'Test',
      panels: [
        {
          id: 1,
          title: 'Row',
          type: 'row',
          panels: [
            {
              id: 2,
              title: 'Data',
              type: 'table',
              datasource: { uid: 'wrong' },
              targets: [{ rawSql: 'SELECT 1', datasource: { uid: '${DS_POSTGRESQL}' } }],
            },
          ],
        },
      ],
      templating: { list: [{ name: 'store', type: 'query', datasource: { uid: 'wrong' } }] },
      annotations: {
        list: [
          { rawSql: 'SELECT 1', datasource: { uid: 'wrong' } },
          { builtIn: 1, datasource: { type: 'grafana' } },
        ],
      },
    },
  });
  const bound = JSON.parse(bindDashboardDataSource(source, { uid: 'selected', type: 'postgres' })).dashboard;
  expect(bound.panels[0].panels[0].targets[0].datasource).toEqual({ uid: 'selected', type: 'postgres' });
  expect(bound.panels[0].panels[0].datasource.uid).toBe('selected');
  expect(bound.templating.list[0].datasource.uid).toBe('selected');
  expect(bound.annotations.list[0].datasource.uid).toBe('selected');
  expect(bound.annotations.list[1].datasource).toEqual({ type: 'grafana' });
});

it('does not inject a datasource selector for concrete-UID dashboards', async () => {
  const post = jest.fn().mockResolvedValue({ url: '/d/test' });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  await saveDashboardFromJson(
    JSON.stringify({ title: 'Test', panels: [{ datasource: { uid: 'selected', type: 'postgres' } }] })
  );
  expect(post.mock.calls[0][1].dashboard.templating.list).toEqual([]);
});

it('retains legacy datasource-variable support without duplicating the variable', async () => {
  const post = jest.fn().mockResolvedValue({ url: '/d/test' });
  (getBackendSrv as jest.Mock).mockReturnValue({ post });
  const dashboard = { title: 'Test', panels: [{ datasource: { uid: '${DS_POSTGRESQL}' } }] };
  await saveDashboardFromJson(JSON.stringify(dashboard));
  expect(post.mock.calls[0][1].dashboard.templating.list).toHaveLength(1);
  await saveDashboardFromJson(
    JSON.stringify({ ...dashboard, templating: { list: [{ name: 'DS_POSTGRESQL', type: 'datasource' }] } })
  );
  expect(post.mock.calls[1][1].dashboard.templating.list).toHaveLength(1);
});
