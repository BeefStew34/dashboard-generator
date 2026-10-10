import { useCallback, useState } from 'react';

import { GenerateDashboard } from './LLMInterface';

export type QueryResult = {
  fields: Array<{
    name: string;
    type: string;
  }>;
  rows: Array<Record<string, any>>;
  error?: string;
};

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

export function useDashboardInteractions() {
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');

  const generate = useCallback(
    async (
      description: string,
      onGenerated: (source: string) => void,
      onSaved?: (url: string) => void,
      currentDashboard?: string
    ) => {
      if (!window.confirm('Replace the current dashboard with a newly generated dashboard?')) {
        return;
      }

      const maxAttempts = 3;
      setGenerating(true);
      setGenerateMessage('');

      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          setGenerateMessage(`Generating dashboard (attempt ${attempt} of ${maxAttempts})...`);
          try {
            const url = await GenerateDashboard(onGenerated, description, currentDashboard);
            onSaved?.(url);
            setGenerateMessage('Dashboard generated. JSON structure checked locally; SQL was not executed for validation.');
            break;
          } catch (error) {
            if (attempt >= maxAttempts) {
              throw error;
            }
          }
        }
      } catch (error) {
        setGenerateMessage(error instanceof Error ? error.message : 'Generation failed.');
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  return { generating, generateMessage, generate };
}
