import React, { useMemo, useState } from 'react';

import { Button, Field, TextArea } from '@grafana/ui';

import { useSettings } from './usersetting';
import { parseDashboard, replaceDashboard, saveDashboardFromJson } from './DashboardModel';
import { SimpleDashboardEditor } from './SimpleDashboard';

import { QueryResult, downloadDashboardJson, useDashboardInteractions } from './Interactions';
import { Dashboard } from './DashboardModel';

// Other files may import QueryResult from here, so keep exporting it.
export type { QueryResult };

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

type BigTextBoxProps = {
  rows?: number;
  value: string;
  onChange: (value: string) => void;
};

export const BigTextBox = ({ rows = 6, value, onChange }: BigTextBoxProps) => {
  const TextAreaComponent = TextArea as any;

  return <TextAreaComponent value={value} rows={rows} onChange={(e: any) => onChange(e.currentTarget.value)} />;
};

const initialDashboard = {
  title: 'My Dashboard',
  panels: [],
};

let dashboardDraft = JSON.stringify({ dashboard: initialDashboard }, null, 2);
let lastGeneratedDashboardUrl = '';

export const GeneratorPage = () => {
  const [description, setDescription] = useState('Describe your new dashboard!');
  const [dashboardSource, setDashboardSource] = useState(dashboardDraft);
  const [viewOnly, setViewOnly] = useState(false);
  const [dashboardUrl, setDashboardUrl] = useState(lastGeneratedDashboardUrl);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewUpdating, setPreviewUpdating] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const { settings, loading: settingsLoading, error: settingsError } = useSettings();

  const { generating, generateMessage, generate } = useDashboardInteractions();

  const useSimpleEditor = settings.ViewMode !== 'complex';
  const settingsBlocked = settingsLoading || !!settingsError;

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
        error: error instanceof Error ? error.message : 'Invalid dashboard JSON.',
        dashboard: null as Dashboard | null,
      };
    }
  }, [dashboardSource]);

  const updateDashboardSource = (value: string) => {
    dashboardDraft = value;

    setDashboardSource(value);
    setPreviewError('');
  };

  const updateDashboardFromObject = (dashboard: Dashboard) => {
    updateDashboardSource(replaceDashboard(dashboardSource, dashboard));
  };

  const updatePreview = async () => {
    setPreviewUpdating(true);
    setPreviewError('');
    try {
      parseDashboard(dashboardSource);
      const saved = await saveDashboardFromJson(dashboardSource, {
        overwrite: true,
        message: 'Updated from dashboard generator preview',
      });
      lastGeneratedDashboardUrl = saved.url;
      setDashboardUrl(saved.url);
      // The URL can remain unchanged after saving; remount to load the latest JSON.
      setPreviewRevision((current) => current + 1);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Unable to update preview.');
    } finally {
      setPreviewUpdating(false);
    }
  };

  // 13. PAGE INTERFACE

  return (
    <div style={{ marginLeft: 'auto', marginRight: 'auto', maxWidth: '1440px' }}>
      <h1>{viewOnly ? 'View Dashboard' : 'Create Dashboard'}</h1>

      {settingsLoading && <p>Loading settings…</p>}
      {settingsError && <p role="alert">{settingsError}</p>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <Button variant="secondary" onClick={() => setViewOnly((c) => !c)}>
          {viewOnly ? 'Edit dashboard' : 'View dashboard'}
        </Button>

        {viewOnly && (
          <Button disabled={previewUpdating || generating || settingsBlocked || !dashboardResult.valid} onClick={updatePreview}>
            Refresh preview
          </Button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewOnly ? '1fr' : 'repeat(auto-fit, minmax(360px, 1fr))',
          gridAutoRows: '1fr',
          gap: '30px',
          alignItems: 'stretch',
          height: 'calc(100vh - 120px)',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Preview column */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '25px', background: '#FFFFFF', borderRadius: '5px', minWidth: 0, height: '100%', boxSizing: 'border-box' }}>
          {Heading('Dashboard Preview')}

          {previewUpdating && <p style={{ margin: '20px', color: '#445c94' }}>Saving dashboard and updating preview...</p>}
          {previewError && <p role="alert" style={{ margin: '20px', color: '#C0392B' }}>{previewError}</p>}

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <div style={{ background: '#F4F6F5', margin: '20px', padding: '10px', borderRadius: '5px', minHeight: '240px' }}>
              {dashboardUrl && (
                <iframe key={previewRevision} title="Generated dashboard preview" src={`${dashboardUrl}${dashboardUrl.includes('?') ? '&' : '?'}kiosk`} style={{ display: 'block', width: '100%', height: '480px', border: 0 }} />
              )}
            </div>

            {!viewOnly && (
              <div style={{ background: '#F4F6F5', margin: '20px', padding: '15px' }}>
                <h3>Describe your new dashboard!</h3>
                <Field>
                  <BigTextBox rows={6} value={description} onChange={setDescription} />
                </Field>

                <Button
                  disabled={generating || previewUpdating || settingsBlocked || !description.trim()}
                  onClick={() =>
                    generate(
                      description,
                      updateDashboardSource,
                      (url) => {
                        lastGeneratedDashboardUrl = url;
                        setDashboardUrl(url);
                      },
                      dashboardSource
                    )
                  }
                  style={{ width: '100%', justifyContent: 'center', background: '#3267D5', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {generating ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <circle cx="25" cy="25" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                        <path fill="#FFFFFF" d="M43 25a18 18 0 0 1-18 18V7a18 18 0 0 1 18 18z">
                          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                        </path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    'Generate'
                  )}
                </Button>

                {generateMessage && <p style={{ color: '#445c94', fontSize: '12px', marginTop: '8px' }}>{generateMessage}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Source column */}
        {!viewOnly && (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '25px', background: '#FFFFFF', borderRadius: '5px', minWidth: 0, height: '100%', boxSizing: 'border-box' }}>
            {Heading('Dashboard Source')}

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#F4F6F5', margin: '20px', padding: '10px', borderRadius: '5px' }}>
              <fieldset disabled={generating || previewUpdating || settingsLoading} style={{ border: 0, padding: 0, minWidth: 0 }}>
                {useSimpleEditor && dashboardResult.dashboard ? (
                  <SimpleDashboardEditor dashboard={dashboardResult.dashboard} onChange={(dashboard) => updateDashboardFromObject(dashboard)} />
                ) : (
                  <Field label="Dashboard JSON">
                    <BigTextBox rows={28} value={dashboardSource} onChange={updateDashboardSource} />
                  </Field>
                )}
              </fieldset>

              {!dashboardResult.valid && <p role="alert">{dashboardResult.error} Fix the JSON before using Simple mode.</p>}
            </div>

            <div style={{ margin: '0 20px 20px 20px', display: 'flex', flexWrap: 'wrap', flexShrink: 0, gap: '10px' }}>
              <Button variant="secondary" onClick={() => updatePreview()} disabled={previewUpdating || generating || settingsBlocked || !dashboardResult.valid}>
                {previewUpdating ? 'Updating Preview...' : 'Update preview'}
              </Button>

              <Button
                variant="secondary"
                disabled={!dashboardResult.valid || generating || previewUpdating}
                onClick={() => {
                  let filename = 'dashboard.json';

                  try {
                    const parsed = parseDashboard(dashboardSource);
                    const safe = parsed.title.replace(/[^a-z0-9\-_\.]/gi, '_');
                    filename = `${safe}.json`;
                  } catch (e) {
                    // fall back to default
                  }

                  downloadDashboardJson(dashboardSource, filename);
                }}
              >
                Export
              </Button>

              <Button
                variant="secondary"
                disabled={!dashboardResult.valid || generating || previewUpdating}
                onClick={async () => {
                  try {
                    const parsed = parseDashboard(dashboardSource);
                    const name = window.prompt('Save dashboard as:', parsed.title || 'My Dashboard');

                    if (name === null) return; // user cancelled

                    const trimmed = String(name).trim();
                    if (!trimmed) {
                      window.alert('Dashboard name cannot be empty.');
                      return;
                    }

                    const newDashboard = { ...parsed, title: trimmed };
                    const newSource = replaceDashboard(dashboardSource, newDashboard);

                    setDashboardSource(newSource);

                    const res = await saveDashboardFromJson(newSource, {
                      overwrite: true,
                      openAfterSave: true,
                      message: 'Saved from dashboard generator',
                    });

                    if (res?.url) {
                      lastGeneratedDashboardUrl = res.url;
                      setDashboardUrl(res.url);
                      window.alert(`Saved dashboard "${trimmed}".`);
                    } else {
                      window.alert('Dashboard saved.');
                    }
                  } catch (err: any) {
                    window.alert(err?.message ?? 'Failed to save dashboard.');
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
