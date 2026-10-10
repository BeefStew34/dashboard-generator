import React, { useMemo, useState } from 'react';

import { Button, Field, TextArea } from '@grafana/ui';

import { useSettings } from './usersetting';
import { parseDashboard, replaceDashboard } from './DashboardModel';
import { SimpleDashboardEditor } from './SimpleDashboard';

import {
  Dashboard,
  DashboardPanel,
  QueryResult,
  downloadDashboardJson,
  useDashboardInteractions,
} from './Interactions';

// Other files may import QueryResult from here, so keep exporting it.
export type { QueryResult };

// 1. CONSTANTS

// PostgreSQL data source used for the preview.
const DATA_SOURCE_UID = '4a5KoB1Gk';

// 2. HEADING

export const Heading = (txt: string) => {
  return (
    <h2
      style={{
        color: '#FFFFFF',
        margin: '20px',
        backgroundColor: '#445c94',
        fontSize: '26px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: '15px 0 0 0',
        minHeight: '3em',
      }}
    >
      {txt}
    </h2>
  );
};

// 3. TEXT BOX

type BigTextBoxProps = {
  rows?: number;
  value: string;
  onChange: (value: string) => void;
};

export const BigTextBox = ({ rows = 6, value, onChange }: BigTextBoxProps) => {
  const TextAreaComponent = TextArea as any;

  return (
    <TextAreaComponent
      value={value}
      rows={rows}
      onChange={(e: any) => onChange(e.currentTarget.value)}
    />
  );
};

// 4. SAMPLE DASHBOARD

const initialDashboard: Dashboard = {
  title: 'Visitor Dashboard',

  panels: [
    {
      id: 1,
      title: 'Visitors Over Time',
      type: 'timeseries',

      targets: [
        {
          refId: 'A',
          format: 'time_series',

          rawSql: `
            SELECT
              NOW() - (11 - n) * INTERVAL '1 hour'
                AS time,

              (80 + n * 7 + (n % 3) * 12)
                AS visitors

            FROM generate_series(0, 11) AS n

            ORDER BY time
          `,
        },
      ],
    },

    {
      id: 2,
      title: 'Visitors by Department',
      type: 'barchart',

      targets: [
        {
          refId: 'A',
          format: 'table',

          rawSql: `
            SELECT department, visitors

            FROM (
              VALUES
                ('Medical', 150),
                ('Surgical', 100),
                ('Emergency', 220),
                ('Other', 80)
            ) AS data(department, visitors)
          `,
        },
      ],
    },

    {
      id: 3,
      title: 'Department Distribution',
      type: 'piechart',

      targets: [
        {
          refId: 'A',
          format: 'table',

          rawSql: `
            SELECT department, visitors

            FROM (
              VALUES
                ('Medical', 150),
                ('Surgical', 100),
                ('Emergency', 220),
                ('Other', 80)
            ) AS data(department, visitors)
          `,
        },
      ],
    },

    {
      id: 4,
      title: 'Waiting Time Distribution',
      type: 'histogram',

      targets: [
        {
          refId: 'A',
          format: 'table',

          rawSql: `
            SELECT
              ((n * 7) % 45 + (n % 5))
                AS waiting_time_minutes

            FROM generate_series(1, 100) AS n
          `,
        },
      ],
    },

    {
      id: 5,
      title: 'Total Visitors',
      type: 'stat',

      targets: [
        {
          refId: 'A',
          format: 'table',

          rawSql: `
            SELECT
              COUNT(*) AS total_visitors

            FROM generate_series(1, 550) AS n
          `,
        },
      ],
    },
  ],
};

// 5. DISPLAY QUERY RESULTS AS A TABLE

function DataTable({ data }: { data: QueryResult }) {
  if (data.rows.length === 0) {
    return <p>No data returned.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          color: '#222222',
        }}
      >
        <thead>
          <tr>
            {data.fields.map((field, index) => (
              <th
                key={index}
                style={{
                  border: '1px solid #CCCCCC',
                  padding: '8px',
                  textAlign: 'left',
                }}
              >
                {field.name}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.rows.map((row, index) => (
            <tr key={index}>
              {data.fields.map((field, i) => (
                <td
                  key={i}
                  style={{
                    border: '1px solid #CCCCCC',
                    padding: '8px',
                  }}
                >
                  {String(row[field.name] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 6. TIME SERIES GRAPH

function TimeSeriesGraph({ data }: { data: QueryResult }) {
  const timeField = data.fields.find(
    field => field.type === 'time' || field.name.toLowerCase() === 'time'
  );

  const numericField = data.fields.find(
    field => field.type === 'number' && field.name !== timeField?.name
  );

  if (!timeField || !numericField) {
    return <p>A time series requires a time column and a numeric column.</p>;
  }

  const points = data.rows
    .map(row => ({
      time: row[timeField.name],
      value: Number(row[numericField.name]),
    }))
    .filter(point => Number.isFinite(point.value));

  if (points.length === 0) {
    return <p>No numeric data available.</p>;
  }

  const width = 500;
  const height = 200;
  const padding = 30;

  const values = points.map(point => point.value);

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const valueRange = maxValue - minValue || 1;

  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const coordinates = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * plotWidth;

    const y =
      height - padding - ((point.value - minValue) / valueRange) * plotHeight;

    return { x, y };
  });

  const linePoints = coordinates.map(point => `${point.x},${point.y}`).join(' ');

  const formatTime = (value: any) => {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString();
  };

  return (
    <div style={{ padding: '10px' }}>
      <svg
        viewBox="0 0 500 200"
        style={{
          width: '100%',
          height: '220px',
        }}
      >
        {/* X and Y axes */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#999999"
        />

        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#999999"
        />

        {/* Y-axis labels */}
        <text x="2" y={padding} fontSize="11" fill="#444">
          {maxValue.toFixed(0)}
        </text>

        <text x="2" y={height - padding} fontSize="11" fill="#444">
          {minValue.toFixed(0)}
        </text>

        {/* Graph line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#5794F2"
          strokeWidth="3"
        />

        {/* Data points */}
        {coordinates.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="4" fill="#5794F2">
            <title>
              {`${formatTime(points[index].time)}: ${points[index].value}`}
            </title>
          </circle>
        ))}

        {/* X-axis labels */}
        <text x={padding} y={height - 5} fontSize="11" fill="#444">
          {formatTime(points[0].time)}
        </text>

        <text
          x={width - padding}
          y={height - 5}
          fontSize="11"
          textAnchor="end"
          fill="#444"
        >
          {formatTime(points[points.length - 1].time)}
        </text>
      </svg>

      <p style={{ textAlign: 'center', fontSize: '12px' }}>
        {numericField.name}
      </p>
    </div>
  );
}

// 7. BAR CHART

function BarChart({
  labels,
  values,
}: {
  labels: string[];
  values: number[];
}) {
  if (values.length === 0) {
    return <p>No numeric data available.</p>;
  }

  const maxValue = Math.max(...values.map(value => Math.abs(value)), 1);

  return (
    <div style={{ padding: '15px' }}>
      {values.map((value, index) => (
        <div key={index} style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
              gap: '8px',
            }}
          >
            <span>{labels[index]}</span>
            <span>{value.toLocaleString()}</span>
          </div>

          <div
            style={{
              height: '18px',
              background: '#E5E7EB',
              borderRadius: '3px',
            }}
          >
            <div
              style={{
                width: `${(Math.abs(value) / maxValue) * 100}%`,
                height: '100%',
                background: '#5794F2',
                borderRadius: '3px',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// 8. PIE CHART

function PieChart({ data }: { data: QueryResult }) {
  const numericField = data.fields.find(field => field.type === 'number');

  const categoryField = data.fields.find(
    field => field.name !== numericField?.name
  );

  if (!numericField || !categoryField) {
    return <p>Pie chart requires categories and values.</p>;
  }

  const colors = ['#5794F2', '#73BF69', '#FF9830', '#B877D9', '#F2495C', '#8AB8FF'];

  const items = data.rows
    .map(row => ({
      label: String(row[categoryField.name]),
      value: Number(row[numericField.name]),
    }))
    .filter(item => Number.isFinite(item.value) && item.value > 0);

  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return <p>No positive values available.</p>;
  }

  let currentPercentage = 0;

  const segments = items.map((item, index) => {
    const start = currentPercentage;

    currentPercentage += (item.value / total) * 100;

    return `${colors[index % colors.length]} ${start}% ${currentPercentage}%`;
  });

  return (
    <div
      style={{
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '20px',
      }}
    >
      <div
        style={{
          width: '170px',
          height: '170px',
          borderRadius: '50%',
          background: `conic-gradient(${segments.join(', ')})`,
          flexShrink: 0,
        }}
      />

      <div>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              fontSize: '12px',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                background: colors[index % colors.length],
              }}
            />

            <span>
              {item.label}: {((item.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 9. HISTOGRAM

function Histogram({ data }: { data: QueryResult }) {
  const numericField = data.fields.find(field => field.type === 'number');

  if (!numericField) {
    return <p>Histogram requires numeric data.</p>;
  }

  const values = data.rows
    .map(row => Number(row[numericField.name]))
    .filter(value => Number.isFinite(value));

  if (values.length === 0) {
    return <p>No numeric data available.</p>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  const binCount = 8;
  const binWidth = (max - min || 1) / binCount;

  const bins: number[] = Array(binCount).fill(0);

  values.forEach(value => {
    const index = Math.min(Math.floor((value - min) / binWidth), binCount - 1);

    bins[index]++;
  });

  const labels = bins.map((_, index) => {
    const start = min + index * binWidth;
    const end = start + binWidth;

    return `${start.toFixed(1)} - ${end.toFixed(1)}`;
  });

  return <BarChart labels={labels} values={bins} />;
}

// 10. PICK THE RIGHT GRAPH FOR A PANEL

function RenderGraph({
  panel,
  data,
}: {
  panel: DashboardPanel;
  data?: QueryResult;
}) {
  if (panel.type === 'text') {
    return (
      <div style={{ padding: '20px' }}>
        {panel.options?.content || 'Text panel'}
      </div>
    );
  }

  if (!data) {
    return (
      <p style={{ padding: '20px', color: '#666666' }}>
        Click Update preview to load the graph.
      </p>
    );
  }

  if (data.error) {
    return <p style={{ padding: '20px', color: '#C0392B' }}>{data.error}</p>;
  }

  if (data.rows.length === 0) {
    return <p style={{ padding: '20px' }}>SQL query returned no data.</p>;
  }

  switch (panel.type) {
    case 'timeseries':
      return <TimeSeriesGraph data={data} />;

    case 'barchart': {
      const numericField = data.fields.find(field => field.type === 'number');

      const categoryField = data.fields.find(
        field => field.name !== numericField?.name
      );

      if (!numericField || !categoryField) {
        return <p>Bar chart requires categories and values.</p>;
      }

      const labels = data.rows.map(row => String(row[categoryField.name]));
      const values = data.rows.map(row => Number(row[numericField.name]));

      return <BarChart labels={labels} values={values} />;
    }

    case 'piechart':
      return <PieChart data={data} />;

    case 'histogram':
      return <Histogram data={data} />;

    case 'stat': {
      const numericField = data.fields.find(field => field.type === 'number');

      const value = numericField ? data.rows[0]?.[numericField.name] : null;

      return (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            fontSize: '36px',
            fontWeight: 'bold',
          }}
        >
          {typeof value === 'number'
            ? value.toLocaleString()
            : String(value ?? 'No data')}
        </div>
      );
    }

    case 'table':
      return <DataTable data={data} />;

    default:
      return (
        <p style={{ padding: '20px' }}>Unsupported panel type: {panel.type}</p>
      );
  }
}

// 11. DRAFT

// Keep the draft when navigating between Create and Settings.
// A full browser reload resets this draft.
let dashboardDraft = JSON.stringify({ dashboard: initialDashboard }, null, 2);

// 12. MAIN DASHBOARD GENERATOR

export const GeneratorPage = () => {
  const [description, setDescription] = useState('Describe your new dashboard!');
  const [dashboardSource, setDashboardSource] = useState(dashboardDraft);
  const [viewOnly, setViewOnly] = useState(false);

  const { settings, loading: settingsLoading, error: settingsError } = useSettings();

  const {
    panelResults,
    queryLoading,
    queryError,
    generating,
    generateMessage,
    runQueries,
    generate,
    resetPreview,
  } = useDashboardInteractions(DATA_SOURCE_UID);

  // The Settings "View Mode" decides which editor is shown.
  const useSimpleEditor = settings.ViewMode !== 'complex';
  const settingsBlocked = settingsLoading || !!settingsError;

  // Check the dashboard JSON whenever it changes.
  const dashboardResult = useMemo(() => {
    try {
      return {
        valid: true,
        error: '',
        dashboard: parseDashboard(dashboardSource) as Dashboard | null,
      };
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : 'Invalid dashboard JSON.',
        dashboard: null as Dashboard | null,
      };
    }
  }, [dashboardSource]);

  // Any edit makes the previewed data stale, so clear it.
  const updateDashboardSource = (value: string) => {
    dashboardDraft = value;

    setDashboardSource(value);
    resetPreview();
  };

  // 13. PAGE INTERFACE

  return (
    <div
      style={{
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: '1440px',
      }}
    >
      <h1>{viewOnly ? 'View Dashboard' : 'Create Dashboard'}</h1>

      {settingsLoading && <p>Loading settings…</p>}

      {settingsError && <p role="alert">{settingsError}</p>}

      <Button variant="secondary" onClick={() => setViewOnly(current => !current)}>
        {viewOnly ? 'Edit dashboard' : 'View dashboard'}
      </Button>

      {viewOnly && (
        <Button
          disabled={queryLoading || settingsBlocked}
          onClick={() => runQueries(dashboardResult.dashboard)}
        >
          Refresh preview
        </Button>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewOnly
            ? '1fr'
            : 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '30px',
          alignItems: 'start',
        }}
      >
        {/* DASHBOARD PREVIEW */}

        <div
          style={{
            padding: '25px',
            background: '#FFFFFF',
            borderRadius: '5px',
            minWidth: 0,
          }}
        >
          {Heading('Dashboard Preview')}

          {queryLoading && (
            <p style={{ margin: '20px', color: '#445c94' }}>
              Running SQL queries and updating preview...
            </p>
          )}

          {queryError && (
            <p style={{ margin: '20px', color: '#C0392B' }}>{queryError}</p>
          )}

          <div
            style={{
              background: '#F4F6F5',
              margin: '20px',
              padding: '10px',
              minHeight: '300px',
              borderRadius: '5px',
            }}
          >
            {!dashboardResult.valid && (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <h3>Cannot display dashboard</h3>
                <p>{dashboardResult.error}</p>
              </div>
            )}

            {dashboardResult.valid && dashboardResult.dashboard && (
              <>
                <h2 style={{ paddingLeft: '10px' }}>
                  {dashboardResult.dashboard.title || 'Dashboard'}
                </h2>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {dashboardResult.dashboard.panels.map((panel, index) => (
                    <div
                      key={panel.id ?? index}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CCCCCC',
                        borderRadius: '3px',
                        minHeight: '150px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '10px',
                          borderBottom: '1px solid #DDDDDD',
                          fontWeight: 'bold',
                        }}
                      >
                        {panel.title || 'Untitled Panel'}
                      </div>

                      <RenderGraph panel={panel} data={panelResults[panel.id]} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* DASHBOARD DESCRIPTION */}

          {!viewOnly && (
            <div
              style={{
                background: '#F4F6F5',
                margin: '20px',
                padding: '15px',
              }}
            >
              <h3>Describe your new dashboard!</h3>

              <Field>
                <BigTextBox rows={6} value={description} onChange={setDescription} />
              </Field>

              <Button
                disabled={generating || settingsBlocked || !description.trim()}
                onClick={() => generate(description, updateDashboardSource)}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: '#3267D5',
                  color: '#FFFFFF',
                }}
              >
                Generate
              </Button>

              {generateMessage && (
                <p
                  style={{
                    color: '#445c94',
                    fontSize: '12px',
                    marginTop: '8px',
                  }}
                >
                  {generateMessage}
                </p>
              )}
            </div>
          )}
        </div>

        {/* DASHBOARD SOURCE */}

        {!viewOnly && (
          <div
            style={{
              padding: '25px',
              background: '#FFFFFF',
              borderRadius: '5px',
              minWidth: 0,
            }}
          >
            {Heading('Dashboard Source')}

            <div
              style={{
                background: '#F4F6F5',
                margin: '20px',
                padding: '10px',
              }}
            >
              <fieldset
                disabled={generating || settingsLoading}
                style={{ border: 0, padding: 0, minWidth: 0 }}
              >
                {useSimpleEditor && dashboardResult.dashboard ? (
                  <SimpleDashboardEditor
                    dashboard={dashboardResult.dashboard}
                    onChange={dashboard =>
                      updateDashboardSource(
                        replaceDashboard(dashboardSource, dashboard)
                      )
                    }
                  />
                ) : (
                  <Field label="Dashboard JSON">
                    <BigTextBox
                      rows={28}
                      value={dashboardSource}
                      onChange={updateDashboardSource}
                    />
                  </Field>
                )}
              </fieldset>

              {!dashboardResult.valid && (
                <p role="alert">
                  {dashboardResult.error} Fix the JSON before using Simple mode.
                </p>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '10px',
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => runQueries(dashboardResult.dashboard)}
                  disabled={
                    queryLoading ||
                    generating ||
                    settingsBlocked ||
                    !dashboardResult.valid
                  }
                >
                  {queryLoading ? 'Updating Preview...' : 'Update preview'}
                </Button>

                <Button variant="secondary" disabled>
                  Share
                </Button>

                <Button
                  variant="secondary"
                  disabled={!dashboardResult.valid || generating}
                  onClick={() => downloadDashboardJson(dashboardSource)}
                >
                  Export
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
