import React, { useMemo, useState } from 'react';
import { Icon, Field, TextArea, Button } from '@grafana/ui';

export const Heading = (txt: string) => {
  return (
    <h2
      style={{
        color: '#FFFFFF',
        margin: '20px',
        backgroundColor: '#445c94',
        fontSize: '26px',
        justifyContent: 'center',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '15px 0 0 0',
        minHeight: '3em',
      }}
    >
      {txt}
    </h2>
  );
};

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
      placeholder=""
      onChange={(e: any) => onChange(e.currentTarget.value)}
    />
  );
};

type DashboardPanel = {
  id?: number;
  title?: string;
  type?: string;
  gridPos?: {
    h?: number;
    w?: number;
    x?: number;
    y?: number;
  };
  options?: {
    content?: string;
  };
};

export const GeneratorPage = () => {
  const [description, setDescription] = useState('Test Test');

  const [dashboardSource, setDashboardSource] = useState(`{
  "dashboard": {
    "title": "Sales Dashboard",
    "panels": [
      {
        "id": 1,
        "title": "Sales Over Time",
        "type": "timeseries"
      },
      {
        "id": 2,
        "title": "Total Sales",
        "type": "stat"
      },
      {
        "id": 3,
        "title": "Sales Information",
        "type": "text",
        "options": {
          "content": "Dashboard preview is working"
        }
      }
    ]
  }
}`);

  const dashboardResult = useMemo(() => {
    try {
      const parsed = JSON.parse(dashboardSource);

      const dashboard = parsed.dashboard || parsed;

      if (!dashboard) {
        return {
          valid: false,
          error: 'Dashboard is missing.',
          dashboard: null,
        };
      }

      if (!Array.isArray(dashboard.panels)) {
        return {
          valid: false,
          error: 'Dashboard must contain a panels array.',
          dashboard: null,
        };
      }

      return {
        valid: true,
        error: '',
        dashboard: dashboard,
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid JSON',
        dashboard: null,
      };
    }
  }, [dashboardSource]);

  const renderPanelContent = (panel: DashboardPanel) => {
    switch (panel.type) {
      case 'timeseries':
        return (
          <div
            style={{
              height: '100px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              padding: '15px',
            }}
          >
            <div
              style={{
                width: '20%',
                height: '30%',
                background: '#5794F2',
              }}
            />

            <div
              style={{
                width: '20%',
                height: '50%',
                background: '#5794F2',
              }}
            />

            <div
              style={{
                width: '20%',
                height: '40%',
                background: '#5794F2',
              }}
            />

            <div
              style={{
                width: '20%',
                height: '75%',
                background: '#5794F2',
              }}
            />

            <div
              style={{
                width: '20%',
                height: '90%',
                background: '#5794F2',
              }}
            />
          </div>
        );

      case 'stat':
        return (
          <div
            style={{
              height: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              fontWeight: 'bold',
            }}
          >
            No data
          </div>
        );

      case 'table':
        return (
          <div style={{ padding: '10px' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      border: '1px solid #CCCCCC',
                      padding: '5px',
                    }}
                  >
                    Column 1
                  </th>

                  <th
                    style={{
                      border: '1px solid #CCCCCC',
                      padding: '5px',
                    }}
                  >
                    Column 2
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td
                    style={{
                      border: '1px solid #CCCCCC',
                      padding: '5px',
                    }}
                  >
                    No data
                  </td>

                  <td
                    style={{
                      border: '1px solid #CCCCCC',
                      padding: '5px',
                    }}
                  >
                    No data
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      case 'text':
        return (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
            }}
          >
            {panel.options?.content || 'Text panel'}
          </div>
        );

      default:
        return (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
            }}
          >
            Unsupported panel type: {panel.type || 'unknown'}
          </div>
        );
    }
  };

  return (
    <div
      style={{
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: '1440px',
      }}
    >
      <div>
        <Icon name="check" />
        <h1>Create Dashboard</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '50px',
          alignItems: 'start',
        }}
      >
        {/* Dashboard Preview */}
        <div
          style={{
            gridColumn: '1',
            padding: '25px',
            background: '#FFFFFF',
            borderRadius: '5px',
            minWidth: 0,
          }}
        >
          {Heading('Dashboard Preview')}

          <div
            style={{
              background: '#F4F6F5',
              margin: '20px',
              padding: '10px',
              minHeight: '300px',
              minWidth: '300px',
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

            {dashboardResult.valid && dashboardResult.dashboard && (
              <>
                <h2 style={{ paddingLeft: '10px' }}>
                  {dashboardResult.dashboard.title || 'Dashboard'}
                </h2>

                {dashboardResult.dashboard.panels.length === 0 && (
                  <p
                    style={{
                      textAlign: 'center',
                      padding: '30px',
                    }}
                  >
                    No panels to display
                  </p>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                  }}
                >
                  {dashboardResult.dashboard.panels.map(
                    (panel: DashboardPanel, index: number) => (
                      <div
                        key={panel.id || index}
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
                            padding: '8px 10px',
                            borderBottom: '1px solid #DDDDDD',
                            fontWeight: 'bold',
                          }}
                        >
                          {panel.title || 'Untitled Panel'}
                        </div>

                        {renderPanelContent(panel)}
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          {/* Description */}
          <div
            style={{
              background: '#F4F6F5',
              margin: '20px',
              padding: '10px',
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
              style={{
                width: '100%',
                justifyContent: 'center',
              }}
            >
              Generate
            </Button>
          </div>
        </div>

        {/* Dashboard Source */}
        <div
          style={{
            gridColumn: '2',
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
                rows={24}
                value={dashboardSource}
                onChange={setDashboardSource}
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
                style={{
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                Save
              </Button>

              <Button
                variant="secondary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                Share
              </Button>

              <Button
                variant="secondary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
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