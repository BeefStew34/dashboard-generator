import {
  useEffect,
  useState,
} from 'react';

import {
  config,
  getBackendSrv,
} from '@grafana/runtime';

import { currentSettings } from './Settings';

export async function loadSettings() {
  const result = await getBackendSrv()
    .fetch({
      url:
        '/api/plugins/aut-dashboardgenerator-app/resources/get_key',

      method: 'POST',

      data: {
        userid: String(config.bootData.user.id),
      },
    })
    .toPromise();

  if (!result) {
    throw new Error('Could not load settings.');
  }

  const values = (
    (result.data as { values?: string }).values || ''
  ).split(',');

  Object.assign(currentSettings, {
    OpenAIKey: values[0] || '',
    ClaudeAIKey: values[1] || '',
    SelectedAI: values[2] || 'OpenAI',

    ViewMode:
      values[3] === 'complex'
        ? 'complex'
        : 'simple',

    Model: values[4] || 'none',
  });

  return { ...currentSettings };
}

export function useSettings() {
  const [settings, setSettings] = useState({
    ...currentSettings,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    loadSettings()
      .then(value => {
        if (active) {
          setSettings(value);
        }
      })
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
    };
  }, []);

  return {
    settings,
    loading,
    error,
  };
}