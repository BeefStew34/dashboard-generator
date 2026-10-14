import React from 'react';
import { SimpleDashboardEditor } from './SimpleDashboard';
import { Dashboard } from './DashboardModel';

jest.mock('@grafana/ui', () => ({
  Button: 'button',
  Field: 'label',
  Input: 'input',
  TextArea: 'textarea',
}));
jest.mock('@grafana/runtime', () => ({}));

function elements(node: React.ReactNode): React.ReactElement[] {
  if (Array.isArray(node)) {
    return node.reduce<React.ReactElement[]>((all, child) => [...all, ...elements(child)], []);
  }
  if (!React.isValidElement(node)) {
    return [];
  }
  return [node, ...elements(node.props.children)];
}

const dashboard: Dashboard = {
  title: 'Dashboard',
  panels: [
    {
      id: 1,
      title: 'Original panel',
      description: 'Original description',
      type: 'table',
      targets: [{ refId: 'A', rawSql: 'SELECT 1', format: 'table' }],
      options: { showHeader: true },
      fieldConfig: { defaults: { unit: 'short' } },
    },
  ],
};

describe('Simple dashboard editing', () => {
  it('edits common panel fields without changing queries or visualization configuration', () => {
    const onChange = jest.fn();
    const tree = elements(SimpleDashboardEditor({ dashboard, onChange }));
    const input = tree.find((element) => element.props.value === 'Original panel')!;
    input.props.onChange({ currentTarget: { value: 'Edited panel' } });
    expect(onChange.mock.calls[0][0].panels[0]).toEqual({ ...dashboard.panels[0], title: 'Edited panel' });
    const description = tree.find((element) => element.props.value === 'Original description')!;
    description.props.onChange({ currentTarget: { value: 'Edited description' } });
    expect(onChange.mock.calls[1][0].panels[0]).toEqual({ ...dashboard.panels[0], description: 'Edited description' });
  });

  it('does not expose query, variant, format, or visualization switching controls', () => {
    const tree = elements(SimpleDashboardEditor({ dashboard, onChange: jest.fn() }));
    const labels = tree.map((element) => element.props.label).filter(Boolean);
    expect(labels).toEqual(['Dashboard title', 'Panel title', 'Panel description']);
    expect(tree.some((element) => element.props.children === 'Add data panel')).toBe(false);
  });

  it('adds a text panel with a valid layout and markdown mode', () => {
    const onChange = jest.fn();
    const tree = elements(SimpleDashboardEditor({ dashboard, onChange }));
    tree.find((element) => element.props.children === 'Add text panel')!.props.onClick();
    const added = onChange.mock.calls[0][0].panels[1];
    expect(added).toMatchObject({
      id: 2,
      type: 'text',
      gridPos: { w: 24, h: 4 },
      options: { mode: 'markdown', content: '' },
    });
    expect(onChange.mock.calls[0][0].panels[0]).toEqual(dashboard.panels[0]);
  });
});
