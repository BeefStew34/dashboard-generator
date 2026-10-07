import React from 'react';
import {
  Button,
  Field,
  Input,
  Select,
  TextArea,
} from '@grafana/ui';

import {
  Dashboard,
  DashboardPanel,
} from './dashboardModel';

const types = [
  ['timeseries', 'Line chart'],
  ['barchart', 'Bar chart'],
  ['piechart', 'Pie chart'],
  ['histogram', 'Histogram'],
  ['stat', 'Single value'],
  ['table', 'Table'],
  ['text', 'Text'],
].map(([value, label]) => ({
  value,
  label,
}));

export function SimpleDashboardEditor({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (value: Dashboard) => void;
}) {
  const patchPanel = (
    index: number,
    patch: Partial<DashboardPanel>
  ) => {
    onChange({
      ...dashboard,

      panels: dashboard.panels.map((panel, i) =>
        i === index
          ? { ...panel, ...patch }
          : panel
      ),
    });
  };

  const nextId = () =>
    Math.max(
      0,
      ...dashboard.panels.map(panel => panel.id)
    ) + 1;

  const move = (index: number, offset: number) => {
    const panels = [...dashboard.panels];

    [panels[index], panels[index + offset]] = [
      panels[index + offset],
      panels[index],
    ];

    onChange({
      ...dashboard,
      panels,
    });
  };

  return (
    <div>
      <Field label="Dashboard title">
        <Input
          value={dashboard.title}
          onChange={event =>
            onChange({
              ...dashboard,
              title: event.currentTarget.value,
            })
          }
        />
      </Field>

      <p>
        Edit the fields below without writing code.
        Existing data queries are preserved.
        Use the description and Generate button to create new data panels.
      </p>

      {dashboard.panels.map((panel, index) => (
        <section
          key={panel.id}
          style={{
            border: '1px solid #aaa',
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h4>Panel {index + 1}</h4>

          <Field label="Panel title">
            <Input
              value={panel.title}
              onChange={event =>
                patchPanel(index, {
                  title: event.currentTarget.value,
                })
              }
            />
          </Field>

          <Field label="Display as">
            <Select
              value={panel.type}
              options={
                types.some(type => type.value === panel.type)
                  ? types
                  : [
                      ...types,
                      {
                        value: panel.type,
                        label: panel.type,
                      },
                    ]
              }
              onChange={option =>
                patchPanel(index, {
                  type: option.value || 'table',
                })
              }
            />
          </Field>

          {panel.type === 'text' && (
            <Field label="Text">
              <TextArea
                rows={4}
                value={panel.options?.content || ''}
                onChange={event =>
                  patchPanel(index, {
                    options: {
                      ...panel.options,
                      content: event.currentTarget.value,
                    },
                  })
                }
              />
            </Field>
          )}

          {panel.type !== 'text' && !panel.targets?.length && (
            <p>
              This panel needs a data query.
              Generate a data panel from a description,
              or configure it in Code mode.
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Button
              type="button"
              variant="secondary"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              Move up
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={index === dashboard.panels.length - 1}
              onClick={() => move(index, 1)}
            >
              Move down
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onChange({
                  ...dashboard,

                  panels: [
                    ...dashboard.panels,
                    {
                      ...JSON.parse(JSON.stringify(panel)),
                      id: nextId(),
                      title: panel.title + ' (copy)',
                    },
                  ],
                })
              }
            >
              Duplicate
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onChange({
                  ...dashboard,

                  panels: dashboard.panels.filter(
                    (_, i) => i !== index
                  ),
                })
              }
            >
              Remove
            </Button>
          </div>
        </section>
      ))}

      <Button
        type="button"
        onClick={() =>
          onChange({
            ...dashboard,

            panels: [
              ...dashboard.panels,
              {
                id: nextId(),
                title: 'New text panel',
                type: 'text',
                options: {
                  content: '',
                },
              },
            ],
          })
        }
      >
        Add text panel
      </Button>
    </div>
  );
}