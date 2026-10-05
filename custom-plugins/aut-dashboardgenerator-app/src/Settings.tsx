import React, { useEffect, useState } from 'react';
import { Button, Field, Input, Select } from '@grafana/ui';
import {
  config,
  getBackendSrv,
  getDataSourceSrv,
} from '@grafana/runtime';

export interface Settings {
  OpenAIKey: string;
  ClaudeAIKey: string;
  SelectedAI: string;
  ViewMode: 'simple' | 'complex';
  Model: string;
  DataSourceUid: string;
}

const defaults: Settings = {
  OpenAIKey: '',
  ClaudeAIKey: '',
  SelectedAI: 'openai',
  ViewMode: 'simple',
  Model: '',
  DataSourceUid: '',
};

export const currentSettings: Settings = { ...defaults };

const listeners = new Set<() => void>();

let loaded = false;
let pending: Promise<void> | undefined;

const resource =
  '/api/plugins/aut-dashboardgenerator-app/resources/';

export function loadSettings(): Promise<void> {
  if (loaded) {
    return Promise.resolve();
  }

  if (!pending) {
    pending = getBackendSrv()
      .post(resource + 'get_key', {
        userid: String(config.bootData.user.id),
      })
      .then((response: { values?: string }) => {
        const values = (response.values || '').split(',');

        Object.assign(currentSettings, defaults, {
          OpenAIKey: values[0] || '',
          ClaudeAIKey: values[1] || '',
          SelectedAI: (values[2] || 'openai').toLowerCase(),
          ViewMode: values[3] === 'complex' ? 'complex' : 'simple',
          Model: values[4] === 'none' ? '' : values[4] || '',
          DataSourceUid: values[5] || '',
        });

        loaded = true;

        listeners.forEach(notify => notify());
      })
      .finally(() => {
        pending = undefined;
      });
  }

  return pending;
}

export async function saveSettings(settings: Settings) {
  // Keep the original first five fields.
  // The selected data-source UID is the sixth field.
  const fields = [
    settings.OpenAIKey,
    settings.ClaudeAIKey,
    settings.SelectedAI,
    settings.ViewMode,
    settings.Model,
    settings.DataSourceUid,
  ];

  if (fields.some(value => value.includes(','))) {
    throw new Error(
      'Settings cannot contain commas with the current backend format.'
    );
  }

  await getBackendSrv().post(resource + 'set_key', {
    userid: String(config.bootData.user.id),
    values: fields.join(','),
  });

  Object.assign(currentSettings, settings);

  loaded = true;

  listeners.forEach(notify => notify());
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    ...currentSettings,
  });

  const [loading, setLoading] = useState(!loaded);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const notify = () => {
      setSettings({ ...currentSettings });
    };

    listeners.add(notify);

    loadSettings()
      .catch(() => {
        if (active) {
          setError(
            'Could not load settings. Check the plugin backend and reload.'
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      listeners.delete(notify);
    };
  }, []);

  return {
    settings,
    loading,
    error,
  };
}

export const GetSettingsForm = () => {
  const state = useSettings();

  const [draft, setDraft] = useState<Settings>(state.settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDraft(state.settings);
  }, [state.settings]);

  const sources = getDataSourceSrv()
    .getList()
    .filter(
      ds =>
        ds.type === 'postgres' ||
        ds.type === 'grafana-postgresql-datasource'
    )
    .map(ds => ({
      label: ds.name,
      value: ds.uid,
    }));

  const update = (key: keyof Settings, value: string) => {
    setDraft(previous => ({
      ...previous,
      [key]: value,
    }));

    setMessage('');
  };

  return (
    <form
      onSubmit={async event => {
        event.preventDefault();

        setSaving(true);
        setMessage('');

        try {
          await saveSettings(draft);

          setMessage(
            'Settings saved. Open Create to use them.'
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not save settings.'
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      {state.error && (
        <p role="alert">{state.error}</p>
      )}

      <fieldset
        disabled={state.loading || saving || !!state.error}
        style={{ border: 0 }}
      >
        <h3>LLM</h3>

        <Field label="OpenAI key">
          <Input
            type="password"
            autoComplete="off"
            value={draft.OpenAIKey}
            onChange={event =>
              update('OpenAIKey', event.currentTarget.value)
            }
          />
        </Field>

        <Field label="Claude AI key">
          <Input
            type="password"
            autoComplete="off"
            value={draft.ClaudeAIKey}
            onChange={event =>
              update('ClaudeAIKey', event.currentTarget.value)
            }
          />
        </Field>

        <Field label="Selected AI">
          <Select
            value={draft.SelectedAI}
            options={[
              {
                label: 'OpenAI',
                value: 'openai',
              },
              {
                label: 'Claude AI (not implemented)',
                value: 'claudeai',
              },
            ]}
            onChange={option =>
              update('SelectedAI', option.value || 'openai')
            }
          />
        </Field>

        <Field
          label="Model ID"
          description="Enter a model available to your API account."
        >
          <Input
            value={draft.Model}
            onChange={event =>
              update('Model', event.currentTarget.value)
            }
          />
        </Field>

        <h3>Application</h3>

        <Field label="Dashboard source editor">
          <Select
            value={draft.ViewMode}
            options={[
              {
                label: 'Simple — editable form',
                value: 'simple',
              },
              {
                label: 'Complex — JSON code',
                value: 'complex',
              },
            ]}
            onChange={option =>
              update('ViewMode', option.value || 'simple')
            }
          />
        </Field>

        <Field
          label="PostgreSQL data source"
          description="Used by the dashboard preview. Configure the database connection in Grafana first."
        >
          <Select
            value={draft.DataSourceUid}
            options={sources}
            placeholder="Select a data source"
            onChange={option =>
              update('DataSourceUid', option.value || '')
            }
          />
        </Field>

        {sources.length === 0 && (
          <p>
            No PostgreSQL data sources are available to this user.
          </p>
        )}

        <Button type="submit">
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </fieldset>

      {message && (
        <p role="status">{message}</p>
      )}
    </form>
  );
};

export const SettingsPage = () => (
  <div
    style={{
      maxWidth: 1440,
      margin: 'auto',
      padding: 24,
    }}
  >
    <h1>Settings</h1>

    <GetSettingsForm />
  </div>
);