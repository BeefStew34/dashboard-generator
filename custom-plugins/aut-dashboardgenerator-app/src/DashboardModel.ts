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