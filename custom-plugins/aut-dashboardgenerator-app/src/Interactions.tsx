 import { useCallback, useEffect, useRef, useState } from 'react';

import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

import { GenerateDashboard } from './LLMInterface';
import { parseDashboard } from './DashboardModel';

// 1. TYPES

export type DashboardPanel = {
  id: number;
  title: string;
  type: string;
  targets?: Array<{
    refId?: string;
    rawSql?: string;
    format?: string;
  }>;
  options?: {
    content?: string;
  };
};

export type Dashboard = {
  title: string;
  panels: DashboardPanel[];
};

export type QueryResult = {
  fields: Array<{
    name: string;
    type: string;
  }>;
  rows: Array<Record<string, any>>;
  error?: string;
};

// 2. CONSTANTS

const POSTGRES_TYPES = ['postgres', 'grafana-postgresql-datasource'];
const QUERY_TIME_RANGE = { from: 'now-24h', to: 'now' };

// 3. HELPERS

const errorResult = (error: string): QueryResult => ({
  fields: [],
  rows: [],
  error,
});

// Convert Grafana DataFrames into plain rows for the preview components.
function convertFramesToRows(frames: any[]): QueryResult {
  const allRows: Array<Record<string, any>> = [];
  let fields: QueryResult['fields'] = [];

  for (const frame of frames) {
    const frameFields = frame.schema?.fields ?? [];
    const values = frame.data?.values ?? [];

    if (fields.length === 0) {
      fields = frameFields.map((field: any) => ({
        name: field.name,
        type: field.type,
      }));
    }

    const rowCount = values[0]?.length ?? 0;

    for (let i = 0; i < rowCount; i++) {
      const row: Record<string, any> = {};

      frameFields.forEach((field: any, index: number) => {
        row[field.name] = values[index]?.[i];
      });

      allRows.push(row);
    }
  }

  return { fields, rows: allRows };
}

// Run the SQL for a single panel. Returns null for panels with nothing to query.
async function queryPanel(
  ds: { uid: string; type: string },
  panel: DashboardPanel
): Promise<QueryResult | null> {
  if (panel.type === 'text') {
    return null;
  }

  if ((panel.targets?.length ?? 0) > 1) {
    return errorResult(
      'This preview supports one query per panel. Open the dashboard in Grafana for multiple queries.'
    );
  }

  const sql = panel.targets?.[0]?.rawSql;

  if (!sql?.trim()) {
    return errorResult('No SQL query found in this panel.');
  }

  try {
    const response = await getBackendSrv().post('/api/ds/query', {
      queries: [
        {
          refId: 'A',
          datasource: { uid: ds.uid, type: ds.type },
          rawSql: sql,
          rawQuery: true,
          format: panel.type === 'timeseries' ? 'time_series' : 'table',
          maxDataPoints: 1000,
          intervalMs: 60000,
        },
      ],
      ...QUERY_TIME_RANGE,
    });

    const result = response.results?.A;

    if (result?.error) {
      throw new Error(result.error);
    }

    if (!result?.frames?.length) {
      return errorResult('No DataFrame returned.');
    }

    return convertFramesToRows(result.frames);
  } catch (error: any) {
    return errorResult(error?.message || 'SQL query failed.');
  }
}

// 4. EXPORT BUTTON

export function downloadDashboardJson(
  source: string,
  filename = 'dashboard.json'
) {
  const url = URL.createObjectURL(
    new Blob([source], { type: 'application/json' })
  );

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

// 5. QUERY + GENERATE BUTTONS

export function useDashboardInteractions(dataSourceUid: string) {
  const [panelResults, setPanelResults] = useState<Record<number, QueryResult>>({});
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');

  // Bumped whenever results become stale, so late responses get ignored.
  const requestVersion = useRef(0);

  // Ignore responses that arrive after the page is gone.
  useEffect(() => {
    return () => {
      requestVersion.current++;
    };
  }, []);

  // Discard any in-flight request and clear the preview data.
  const resetPreview = useCallback(() => {
    requestVersion.current++;

    setQueryLoading(false);
    setQueryError('');
    setPanelResults({});
  }, []);

  const runQueries = useCallback(
    async (dashboard: Dashboard | null): Promise<{ results: Record<number, QueryResult>; error?: string }> => {
      if (!dashboard) {
        const msg = 'Please provide valid dashboard JSON.';
        setQueryError(msg);
        return { results: {}, error: msg };
      }

      const uid = dataSourceUid.trim();

      if (!uid) {
        const msg = 'Please enter your PostgreSQL data source UID.';
        setQueryError(msg);
        return { results: {}, error: msg };
      }

      const version = ++requestVersion.current;

      setQueryLoading(true);
      setQueryError('');
      setPanelResults({});

      try {
        const ds = await getDataSourceSrv().get(uid);

        if (!POSTGRES_TYPES.includes(ds.type)) {
          throw new Error('This preview supports PostgreSQL data sources only.');
        }

        const entries = await Promise.all(
          dashboard.panels.map(
            async panel => [panel.id, await queryPanel(ds, panel)] as const
          )
        );

        const results: Record<number, QueryResult> = {};

        for (const [panelId, result] of entries) {
          if (result) {
            results[panelId] = result;
          }
        }

        // Do not show results from before the latest edit.
        if (version === requestVersion.current) {
          setPanelResults(results);
        }

        return { results };
      } catch (error: any) {
        const msg = error?.message || 'Unable to connect to the data source.';
        if (version === requestVersion.current) {
          setQueryError(msg);
        }
        return { results: {}, error: msg };
      } finally {
        if (version === requestVersion.current) {
          setQueryLoading(false);
        }
      }
    },
    [dataSourceUid]
  );

  const runDiagnostics = useCallback(
    async (dashboard: Dashboard, failingPanelIds: number[]) : Promise<Record<number, string>> => {
      const diagnostics: Record<number, string> = {};

      const uid = dataSourceUid.trim();
      if (!uid) {
        return diagnostics;
      }

      try {
        const ds = await getDataSourceSrv().get(uid);

        for (const panel of dashboard.panels) {
          if (!failingPanelIds.includes(panel.id)) continue;

          // Skip text panels
          if (panel.type === 'text') {
            diagnostics[panel.id] = 'Text panel — no SQL to diagnose.';
            continue;
          }

          const originalSql = panel.targets?.[0]?.rawSql ?? '';
          const original = originalSql.trim().replace(/;$/, '');

          // Diagnostic strategy:
          // 1) EXPLAIN with a short statement_timeout to catch parse/plan errors quickly
          // 2) Fallback to SELECT (...) LIMIT 1 to check if the query actually runs
          const diagPanel: DashboardPanel = JSON.parse(JSON.stringify(panel));
          diagPanel.targets = [
            {
              refId: 'A',
              rawSql: `SET LOCAL statement_timeout = '2000'; EXPLAIN (VERBOSE, FORMAT JSON) ${original}`,
              format: 'table',
            },
          ];

          try {
            const diagResult = await queryPanel(ds, diagPanel);

            if (diagResult?.error) {
              diagnostics[panel.id] = diagResult.error;
            } else if (diagResult && diagResult.rows.length) {
              // Summarize first few rows of the explain output.
              diagnostics[panel.id] = JSON.stringify(diagResult.rows.slice(0, 5));
            } else {
              // If EXPLAIN returned no frames, try a lightweight LIMIT 1 run.
              const limitPanel: DashboardPanel = JSON.parse(JSON.stringify(panel));

              limitPanel.targets = [
                {
                  refId: 'A',
                  rawSql: `SELECT * FROM ( ${original} ) AS _diag_tbl LIMIT 1`,
                  format: 'table',
                },
              ];

              const limitResult = await queryPanel(ds, limitPanel);

              if (limitResult?.error) {
                diagnostics[panel.id] = limitResult.error;
              } else if (limitResult && limitResult.rows.length) {
                diagnostics[panel.id] = 'Query runs (LIMIT 1 returned rows).';
              } else {
                diagnostics[panel.id] = 'No diagnostic output.';
              }
            }
          } catch (err: any) {
            diagnostics[panel.id] = err?.message ?? String(err);
          }
        }
      } catch (err) {
        return diagnostics;
      }

      return diagnostics;
    },
    [dataSourceUid]
  );

  const generate = useCallback(
    async (
      description: string,
      onGenerated: (source: string) => void,
      onSaved?: (url: string) => void
    ) => {
      if (
        !window.confirm(
          'Replace the current dashboard with a newly generated dashboard?'
        )
      ) {
        return;
      }

      const maxAttempts = 3;

      setGenerating(true);
      // Keep the small helper message empty while the button shows a loading indicator.
      setGenerateMessage('');

      try {
        let lastSource = '';
        let lastUrl = '';
        let attempt = 0;

        while (attempt < maxAttempts) {
          attempt++;
          setGenerateMessage(`Generating dashboard (attempt ${attempt} of ${maxAttempts})...`);

          try {
            lastUrl = await GenerateDashboard(value => {
              // Validate JSON early and hand the generated source back to the page.
              parseDashboard(value); // throws if the generated JSON is invalid
              onGenerated(value);
              lastSource = value;
            }, description);

            onSaved?.(lastUrl);
          } catch (err) {
            setGenerateMessage(
              err instanceof Error ? err.message : 'Generation failed.'
            );

            // Try again unless we've exhausted attempts.
            if (attempt >= maxAttempts) throw err;
            continue;
          }

          // Keep the user informed while we run a quick trial of the dashboard queries.
          setGenerateMessage('Running trial queries to validate generated SQL...');

          let trialResults: Record<number, QueryResult> = {};

          let parsed: Dashboard | null = null;

          try {
            parsed = parseDashboard(lastSource);
            const trial = await runQueries(parsed);
            trialResults = trial.results || {};

            if (trial.error) {
              // Connection or datasource error. Stop retrying and inform the user.
              setGenerateMessage(trial.error);
              break;
            }
          } catch (err: any) {
            setGenerateMessage(err?.message || 'Trial queries failed.');
            break;
          }

          // Inspect trial results for any SQL errors.
          // Only consider panels that actually have SQL (skip text panels / panels without rawSql).
          const errors: Array<{ panelId: number; error: string }> = [];

          for (const panel of (parsed?.panels ?? [])) {
            const hasSql = panel.type !== 'text' && !!panel.targets?.[0]?.rawSql?.trim();
            if (!hasSql) continue;

            const result = trialResults[panel.id];
            if (result?.error) {
              errors.push({ panelId: panel.id, error: result.error });
            }
          }

          // If there are no SQL panels or no errors on SQL panels, treat as success.
          if (errors.length === 0) {
            setGenerateMessage('Dashboard generated and validated. Preview updated.');
            break; // success
          }

          // If we have SQL errors, inform the user and retry generation.
          const first = errors[0];

          // Run specialized diagnostics to get clearer error info for the failing panels.
          setGenerateMessage(
            `Trial query failed for panel ${first.panelId}: ${first.error}. Running diagnostics...`
          );

          try {
            if (!parsed) {
              setGenerateMessage('Failed to parse generated dashboard for diagnostics. Regenerating...');
              // proceed to next attempt
            } else {
              const diagnostics = await runDiagnostics(parsed, errors.map(e => e.panelId));

              const diagMsg = diagnostics[first.panelId] || Object.values(diagnostics)[0] || 'No diagnostic output.';
                                                         
              // Inform the user and prepare to regenerate.
              setGenerateMessage(                                       
                `Panel ${first.panelId}: ${first.error} — Diagnostic: ${diagMsg}. Regenerating... (attempt ${attempt + 1} of ${maxAttempts})`
              );
            }
          } catch (diagErr) {
            // If diagnostics fail, still attempt regeneration but show the original error.
            setGenerateMessage(
              `Trial query failed for panel ${first.panelId}: ${first.error}. Diagnostics failed: ${diagErr instanceof Error ? diagErr.message : String(diagErr)}. Regenerating... (attempt ${attempt + 1} of ${maxAttempts})`
            );
          }

          // If we've exhausted attempts, stop and show final message.
          if (attempt >= maxAttempts) {
            setGenerateMessage(
              `Generation produced panels with SQL errors after ${maxAttempts} attempts. First failure: panel ${first.panelId}: ${first.error}`
            );
            break;
          }

          // Loop continues to attempt again.
        }
      } catch (error) {
        setGenerateMessage(
          error instanceof Error ? error.message : 'Generation failed.'
        );
      } finally {setGenerating(false);}    
    },
    [runQueries, runDiagnostics]
  );

  return {
    // state
    panelResults,
    queryLoading,
    queryError,
    generating,
    generateMessage,
    // actions
    runQueries,
    generate,
    resetPreview,
  };
}
