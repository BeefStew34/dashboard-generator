
import React, { useMemo, useState } from 'react';
import { GenerateDashboard } from 'LLMInterface';
import { Button, Field, TextArea } from '@grafana/ui';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
  

// 1. TYPES


type DashboardPanel = {
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

type Dashboard = {
  title: string;
  panels: DashboardPanel[];
};

export type QueryResult = {
  fields: Array<{
    name: string;
    type: string;
  }>;
  rows: Record<string, any>[];
  error?: string;
};


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

export const BigTextBox = ({
  rows = 6,
  value,
  onChange,
}: BigTextBoxProps) => {
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

// 5. CONVERT GRAFANA DATAFRAMES TO ROWS

function convertFramesToRows(frames: any[]): QueryResult {
  const allRows: Record<string, any>[] = [];

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

  return {
    fields,
    rows: allRows,
  };
}

// 6. DISPLAY QUERY RESULTS AS A TABLE

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

// 7. TIME SERIES GRAPH

function TimeSeriesGraph({ data }: { data: QueryResult }) {
  const timeField = data.fields.find(
    field =>
      field.type === 'time' ||
      field.name.toLowerCase() === 'time'
  );

  const numericField = data.fields.find(
    field =>
      field.type === 'number' &&
      field.name !== timeField?.name
  );

  if (!timeField || !numericField) {
    return (
      <p>
        A time series requires a time column and a
        numeric column.
      </p>
    );
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
    const x =
      padding +
      (index / Math.max(points.length - 1, 1)) *
        plotWidth;

    const y =
      height -
      padding -
      ((point.value - minValue) / valueRange) *
        plotHeight;

    return { x, y };
  });

  const linePoints = coordinates
    .map(point => `${point.x},${point.y}`)
    .join(' ');

  const formatTime = (value: any) => {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleTimeString();
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

        <text
          x="2"
          y={height - padding}
          fontSize="11"
          fill="#444"
        >
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
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#5794F2"
          >
            <title>
              {`${formatTime(points[index].time)}: ${points[index].value}`}
            </title>
          </circle>
        ))}

        {/* X-axis labels */}

        <text
          x={padding}
          y={height - 5}
          fontSize="11"
          fill="#444"
        >
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

// 8. BAR CHART

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

  const maxValue = Math.max(
    ...values.map(value => Math.abs(value)),
    1
  );

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
                width: `${
                  (Math.abs(value) / maxValue) * 100
                }%`,
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

// 9. PIE CHART

function PieChart({ data }: { data: QueryResult }) {
  const numericField = data.fields.find(
    field => field.type === 'number'
  );

  const categoryField = data.fields.find(
    field => field.name !== numericField?.name
  );

  if (!numericField || !categoryField) {
    return <p>Pie chart requires categories and values.</p>;
  }

  const colors = [
    '#5794F2',
    '#73BF69',
    '#FF9830',
    '#B877D9',
    '#F2495C',
    '#8AB8FF',
  ];

  const items = data.rows
    .map(row => ({
      label: String(row[categoryField.name]),
      value: Number(row[numericField.name]),
    }))
    .filter(
      item =>
        Number.isFinite(item.value) &&
        item.value > 0
    );

  const total = items.reduce(
    (sum, item) => sum + item.value,
    0
  );

  if (total <= 0) {
    return <p>No positive values available.</p>;
  }

  let currentPercentage = 0;

  const segments = items.map((item, index) => {
    const start = currentPercentage;

    currentPercentage += (item.value / total) * 100;

    return `${
      colors[index % colors.length]
    } ${start}% ${currentPercentage}%`;
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
                background:
                  colors[index % colors.length],
              }}
            />

            <span>
              {item.label}:{' '}
              {((item.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 10. HISTOGRAM

function Histogram({ data }: { data: QueryResult }) {
  const numericField = data.fields.find(
    field => field.type === 'number'
  );

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

  const bins = Array(binCount).fill(0);

  values.forEach(value => {
    const index = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
    );

    bins[index]++;
  });

  const labels = bins.map((_, index) => {
    const start = min + index * binWidth;
    const end = start + binWidth;

    return `${start.toFixed(1)} - ${end.toFixed(1)}`;
  });

  return <BarChart labels={labels} values={bins} />;
}
// 11. DISPLAY THE CORRECT GRAPH

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
        Click Save to load the graph.
      </p>
    );
  }

  if (data.error) {
    return (
      <p style={{ padding: '20px', color: '#C0392B' }}>
        {data.error}
      </p>
    );
  }

  if (data.rows.length === 0) {
    return (
      <p style={{ padding: '20px' }}>
        SQL query returned no data.
      </p>
    );
  }

  switch (panel.type) {
    case 'timeseries':
      return <TimeSeriesGraph data={data} />;

    case 'barchart': {
      const numericField = data.fields.find(
        field => field.type === 'number'
      );

      const categoryField = data.fields.find(
        field => field.name !== numericField?.name
      );

      if (!numericField || !categoryField) {
        return <p>Bar chart requires categories and values.</p>;
      }

      const labels = data.rows.map(
        row => String(row[categoryField.name])
      );

      const values = data.rows.map(
        row => Number(row[numericField.name])
      );

      return <BarChart labels={labels} values={values} />;
    }

    case 'piechart':
      return <PieChart data={data} />;

    case 'histogram':
      return <Histogram data={data} />;

    case 'stat': {
      const numericField = data.fields.find(
        field => field.type === 'number'
      );

      const value = numericField
        ? data.rows[0]?.[numericField.name]
        : null;

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
        <p style={{ padding: '20px' }}>
          Unsupported panel type: {panel.type}
        </p>
      );
  }
}
// 12. MAIN DASHBOARD GENERATOR

export const GeneratorPage = () => {
  const [description, setDescription] = useState<string>('Describe your new dashboard!');
  
  const [generateMessage, _] = useState('');

  // Existing Grafana PostgreSQL data source (no UID input needed).
  const dataSourceUid = '4a5KoB1Gk';

  const [dashboardSource, setDashboardSource] = useState(
    JSON.stringify(
      { dashboard: initialDashboard },
      null,
      2
    )
  );

  const [queryLoading, setQueryLoading] = useState(false);

  const [queryError, setQueryError] = useState('');

  const [panelResults, setPanelResults] = useState<
    Record<number, QueryResult>
  >({});

  
  // 13. CHECK THE DASHBOARD JSON
  

  const dashboardResult = useMemo(() => {
    try {
      const parsed = JSON.parse(dashboardSource);

      const dashboard: Dashboard =
        parsed.dashboard || parsed;

      if (!dashboard || !Array.isArray(dashboard.panels)) {
        return {
          valid: false,
          error: 'Dashboard must contain a panels array.',
          dashboard: null as Dashboard | null,
        };
      }

      return {
        valid: true,
        error: '',
        dashboard,
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid dashboard JSON.',
        dashboard: null as Dashboard | null,
      };
    }
  }, [dashboardSource]);


  // 14. EXECUTE SQL FOR ALL PANELS
  
  const runSqlQueries = async () => {
    if (!dashboardResult.valid || !dashboardResult.dashboard) {
      setQueryError('Please provide valid dashboard JSON.');
      return;
    }

    if (!dataSourceUid.trim()) {
      setQueryError('Please enter your PostgreSQL data source UID.');
      return;
    }

    setQueryLoading(true);
    setQueryError('');
    setPanelResults({});

    try {
      // Retrieve the stored Grafana data source.
      const ds = await getDataSourceSrv().get(
        dataSourceUid.trim()
      );

      const panels = dashboardResult.dashboard.panels;

      const results = await Promise.all(
        panels.map(async panel => {
          if (panel.type === 'text') {
            return [panel.id, null] as const;
          }

          const target = panel.targets?.[0];

          if (!target?.rawSql?.trim()) {
            return [
              panel.id,
              {
                fields: [],
                rows: [],
                error: 'No SQL query found in this panel.',
              },
            ] as const;
          }

          try {
            

            const format =
              panel.type === 'timeseries'
                ? 'time_series'
                : 'table';

            const response = await getBackendSrv().post(
              '/api/ds/query',
              {
                queries: [
                  {
                    refId: 'A',

                    datasource: {
                      uid: ds.uid,
                      type: ds.type,
                    },

                    rawSql: target.rawSql,
                    format,

                    maxDataPoints: 1000,
                    intervalMs: 60000,
                  },
                ],

                from: 'now-24h',
                to: 'now',
              }
            );

            const result = response.results?.A;

            if (result?.error) {
              throw new Error(result.error);
            }

            if (!result?.frames?.length) {
              return [
                panel.id,
                {
                  fields: [],
                  rows: [],
                  error: 'No DataFrame returned.',
                },
              ] as const;
            }

            const data = convertFramesToRows(
              result.frames
            );

            console.log(
              `SQL results for panel ${panel.id}:`,
              data
            );

            return [panel.id, data] as const;
          } catch (error: any) {
            return [
              panel.id,
              {
                fields: [],
                rows: [],
                error:
                  error?.message ||
                  'SQL query failed.',
              },
            ] as const;
          }
        })
      );

     
      const newResults: Record<number, QueryResult> = {};

      results.forEach(([panelId, data]) => {
        if (data) {
          newResults[panelId] = {
            fields: [...data.fields],
            rows: [...data.rows],
            ...(data.error ? { error: data.error } : {}),
          };
        }
      });

      setPanelResults(newResults);



    } catch (error: any) {
      console.error('Data source error:', error);

      setQueryError(
        error?.message ||
        'Unable to connect to the data source.'
      );
    } finally {
      setQueryLoading(false);
    }
  };

  // 15. UPDATE DASHBOARD SOURCE

  const updateDashboardSource = (value: string) => {
    setDashboardSource(value);

    setPanelResults({});
  };

  // 16. PAGE INTERFACE

  return (
    <div
      style={{
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: '1440px',
      }}
    >
      <h1>Create Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '30px',
          alignItems: 'start',
        }}
      >
        {/* ------------------------------------ */}
        {/* DASHBOARD PREVIEW                    */}
        {/* ------------------------------------ */}

        <div
          style={{
            padding: '25px',
            background: '#FFFFFF',
            borderRadius: '5px',
            minWidth: 0,
          }}
        >
          {Heading('Dashboard Preview')}

          {/* SQL queries run when the Save button is pressed below. */}
          {queryLoading && (
            <p style={{ margin: '20px', color: '#445c94' }}>
              Running SQL queries and updating preview...
            </p>
          )}
          {queryError && (
            <p style={{ margin: '20px', color: '#C0392B' }}>
              {queryError}
            </p>
          )}

          {/* ACTUAL DASHBOARD PREVIEW */}

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
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px',
                }}
              >
                <h3>Cannot display dashboard</h3>
                <p>{dashboardResult.error}</p>
              </div>
            )}

            {dashboardResult.valid &&
              dashboardResult.dashboard && (
                <>
                  <h2 style={{ paddingLeft: '10px' }}>
                    {dashboardResult.dashboard.title ||
                      'Dashboard'}
                  </h2>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {dashboardResult.dashboard.panels.map(
                      (panel, index) => (
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
                          {/* PANEL TITLE */}

                          <div
                            style={{
                              padding: '10px',
                              borderBottom:
                                '1px solid #DDDDDD',
                              fontWeight: 'bold',
                            }}
                          >
                            {panel.title || 'Untitled Panel'}
                          </div>

                          {/* REAL SQL DATA GRAPH */}

                          <RenderGraph
                            panel={panel}
                            data={panelResults[panel.id]}
                          />
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
          </div>

          {/* DASHBOARD DESCRIPTION */}

          <div
            style={{
              background: '#F4F6F5',
              margin: '20px',
              padding: '15px',
            }}
          >
            <h3>Describe your new dashboard!</h3>

            <Field>
              <BigTextBox
                rows={6}
                value={description}
                onChange={setDescription}
              />
            </Field>

            <Button
              onClick={() => GenerateDashboard(updateDashboardSource, description)}
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
              <p style={{ color: '#445c94', fontSize: '12px', marginTop: '8px' }}>
                {generateMessage}
              </p>
            )}
          </div>
        </div>

        {/* ------------------------------------ */}
        {/* DASHBOARD SOURCE                     */}
        {/* ------------------------------------ */}

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
            <Field>
              <BigTextBox
                rows={28}
                value={dashboardSource}
                onChange={updateDashboardSource}
              />
            </Field>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '10px',
              }}
            >
              <Button
                variant="secondary"
                onClick={runSqlQueries}
                disabled={queryLoading || !dashboardResult.valid}
              >
                {queryLoading ? 'Updating Preview...' : 'Save'}
              </Button>

              <Button variant="secondary" disabled>
                Share
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  const blob = new Blob(
                    [dashboardSource],
                    { type: 'application/json' }
                  );

                  const url = URL.createObjectURL(blob);

                  const link =
                    document.createElement('a');

                  link.href = url;
                  link.download = 'dashboard.json';
                  link.click();

                  URL.revokeObjectURL(url);
                }}
              >
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};