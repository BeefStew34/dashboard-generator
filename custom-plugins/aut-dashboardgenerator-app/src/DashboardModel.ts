import { getBackendSrv, locationService } from '@grafana/runtime';

export type SaveDashboardOptions = {
  folderId?: number; // 0 = General folder
  overwrite?: boolean; // replace an existing dashboard with the same uid
  openAfterSave?: boolean; // navigate to the saved dashboard
  message?: string; // version-history note
};
 
function parseDashboardJson(json: string): Record<string, any> {
  const cleaned = json
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
 
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
 
  const dashboard = parsed?.dashboard ?? parsed;
 
  if (!dashboard || typeof dashboard !== 'object' || Array.isArray(dashboard)) {
    throw new Error('Expected a dashboard object (or { "dashboard": { ... } }).');
  }
  if (typeof dashboard.title !== 'string' || !dashboard.title.trim()) {
    throw new Error('Dashboard needs a non-empty "title".');
  }
  if (dashboard.panels !== undefined && !Array.isArray(dashboard.panels)) {
    throw new Error('"panels" must be an array.');
  }
 
  return dashboard;
}
 
export async function saveDashboardFromJson(json: string, options: SaveDashboardOptions = {}) {
  const {
    folderId = 0,
    overwrite = true,
    openAfterSave = false,
    message = 'Created by plugin',
  } = options;
 
  const parsed = parseDashboardJson(json);
  const dashboard = {
    schemaVersion: 36,
    version: 0,
    panels: [],
    ...parsed,

    templating: {
      ...parsed.templating,
      list: [
        ...(parsed.templating?.list ?? []),
        {
          name: "DS_POSTGRESQL",
          label: "Data source",
          type: "datasource",
          query: "postgres",
          refresh: 1,
          regex: "",
          current: {
            selected: false,
            text: "",
            value: "",
          },
          options: [],
          multi: false,
          includeAll: false,
          hide: 0,
        },
      ],
    },

    id: null,
  };
 
  try {
    const res = await getBackendSrv().post('/api/dashboards/db', {
      dashboard,
      folderId,
      overwrite,
      message,
    });
 
    if (openAfterSave) {
      locationService.push(res.url);
    }
    return res; // { id, uid, url, status: 'success', version, slug }
  } catch (err: any) {
    const reason = err?.data?.message ?? err?.message ?? 'Unknown error';
    throw new Error(`Failed to save dashboard: ${reason}`);
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