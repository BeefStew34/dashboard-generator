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

export function downloadDashboardJson(source: string, filename = 'dashboard.json') {
  const url = URL.createObjectURL(new Blob([source], { type: 'application/json' }));

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

      setGenerating(true);
      setGenerateMessage('Discovering schema and planning bounded lookups...');

      try {
        const warnings: string[] = [];
        const url = await GenerateDashboard(onGenerated, description, currentDashboard, (warning) => {
          warnings.push(warning);
          setGenerateMessage(`Continuing generation with a discovery warning: ${warning}`);
        });
        onSaved?.(url);
        setGenerateMessage(
          `Dashboard generated using Grafana's default datasource. Generated SQL was checked locally.${
            warnings.length
              ? ` Discovery warnings: ${warnings.join('\n')}`
              : ' Bounded discovery lookups completed automatically.'
          }`
        );
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
