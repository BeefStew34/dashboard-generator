import { getBackendSrv, locationService } from '@grafana/runtime';

export async function saveTestDashboard(options: { openAfterSave?: boolean } = {}) {
  const { openAfterSave = false } = options;

  const dashboard = {
    id: null, // null = new dashboard
    uid: 'plugin-test-dash', // stable ID so re-running updates instead of duplicating
    title: 'Plugin Test Dashboard',
    tags: ['generated', 'plugin-test'],
    timezone: 'browser',
    schemaVersion: 36,
    version: 0,
    refresh: '',
    time: { from: 'now-6h', to: 'now' },
    templating: { list: [] },
    annotations: { list: [] },
    panels: [
      {
        id: 1,
        type: 'text', // text panels need no data source, so this works on any install
        title: 'Hello from my plugin',
        gridPos: { x: 0, y: 0, w: 12, h: 6 },
        options: {
          mode: 'markdown',
          content: '# It works\nThis dashboard was created by my plugin.',
        },
      },
      {
        id: 2,
        type: 'text',
        title: 'Second panel',
        gridPos: { x: 12, y: 0, w: 12, h: 6 },
        options: { mode: 'markdown', content: 'Add more panels by pushing objects into `panels`.' },
      },
    ],
  };

  try {
    const res = await getBackendSrv().post('/api/dashboards/db', {
      dashboard,
      folderId: 0, // 0 = General folder
      overwrite: true, // replace the dashboard if the uid already exists
      message: 'Created by plugin test',
    });

    console.log('Dashboard saved:', res); // { id, uid, url, status: 'success', version, slug }

    if (openAfterSave) {
      locationService.push(res.url);
    }
    return res;
  } catch (err) {
    console.error('Failed to save dashboard:', err);
    throw err;
  }
}




export type DashboardPanel = {
  id: number;
  title: string;
  type: string;

  targets?: Array<{
    refId?: string;
    rawSql?: string;
    format?: string;
    [key: string]: any;
  }>;

  options?: {
    content?: string;
    [key: string]: any;
  };

  [key: string]: any;
};

export type Dashboard = {
  title: string;
  panels: DashboardPanel[];
  [key: string]: any;
};

export function parseDashboard(source: string): Dashboard {
  const parsed = JSON.parse(source);

  const dashboard = parsed?.dashboard ?? parsed;

  if (
    !dashboard ||
    typeof dashboard !== 'object' ||
    typeof dashboard.title !== 'string' ||
    !Array.isArray(dashboard.panels)
  ) {
    throw new Error(
      'Dashboard must contain a title and a panels array.'
    );
  }

  const ids = new Set<number>();

  dashboard.panels.forEach((panel: DashboardPanel) => {
    if (
      !panel ||
      !Number.isInteger(panel.id) ||
      ids.has(panel.id) ||
      typeof panel.title !== 'string' ||
      typeof panel.type !== 'string'
    ) {
      throw new Error(
        'Each panel needs a unique integer ID, title, and type.'
      );
    }

    if (
      panel.targets !== undefined &&
      (
        !Array.isArray(panel.targets) ||
        panel.targets.some(
          target =>
            !target ||
            (
              target.rawSql !== undefined &&
              typeof target.rawSql !== 'string'
            )
        )
      )
    ) {
      throw new Error(
        'Panel targets must be an array with SQL stored as text.'
      );
    }

    ids.add(panel.id);
  });

  return dashboard;
}

// Preserve wrapper fields and properties not exposed by the form.
export function replaceDashboard(
  source: string,
  dashboard: Dashboard
): string {
  const parsed = JSON.parse(source);

  return JSON.stringify(
    parsed.dashboard
      ? { ...parsed, dashboard }
      : dashboard,
    null,
    2
  );
}