import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { GeneratorPage } from './Generator';
import { saveDashboardFromJson } from './DashboardModel';

jest.mock('@grafana/ui', () => ({
  Button: ({ variant, ...props }: any) => <button {...props} />,
  Field: ({ label, children }: any) => (
    <label>
      {label}
      {children}
    </label>
  ),
  Input: 'input',
  TextArea: 'textarea',
}));
jest.mock('@grafana/runtime', () => ({}));
let mockViewMode = 'simple';
jest.mock('./usersetting', () => ({
  useSettings: () => ({ settings: { ViewMode: mockViewMode }, loading: false, error: '' }),
}));
jest.mock('./DashboardModel', () => ({
  ...jest.requireActual('./DashboardModel'),
  saveDashboardFromJson: jest.fn(),
}));
const mockRunQueries = jest.fn().mockResolvedValue({ results: {} });
jest.mock('./Interactions', () => ({
  useDashboardInteractions: () => ({
    runQueries: mockRunQueries,
    resetPreview: jest.fn(),
    generate: jest.fn(),
    queryLoading: false,
    queryError: '',
    generating: false,
    generateMessage: '',
  }),
  downloadDashboardJson: jest.fn(),
}));

afterEach(() => {
  mockViewMode = 'simple';
});

it('pretty prints valid JSON in the dashboard source on blur', () => {
  mockViewMode = 'complex';
  const container = document.createElement('div');
  document.body.appendChild(container);
  try {
    act(() => {
      ReactDOM.render(<GeneratorPage />, container);
    });
    const textarea = container.querySelector('#dashboard-json') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    act(() => {
      textarea.value = '{"dashboard":{"title":"Compact","panels":[]}}';
      Simulate.change(textarea);
    });
    expect(textarea.value).toBe('{"dashboard":{"title":"Compact","panels":[]}}');
    act(() => {
      Simulate.blur(textarea);
    });
    expect(textarea.value).toBe(JSON.stringify({ dashboard: { title: 'Compact', panels: [] } }, null, 2));
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  }
});

it('saves edited panel titles and reloads the iframe even when the preview URL is unchanged', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const save = saveDashboardFromJson as jest.Mock;
  save.mockResolvedValue({ url: '/d/preview/dashboard' });
  const button = (text: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent === text)!;
  try {
    act(() => {
      ReactDOM.render(<GeneratorPage />, container);
    });
    act(() => {
      Simulate.click(button('Add text panel'));
    });
    const title = Array.from(container.querySelectorAll('input')).find((input) => input.value === 'New text panel')!;
    act(() => {
      title.value = 'Edited title';
      Simulate.change(title);
    });
    await act(async () => {
      Simulate.click(button('Update preview'));
    });
    expect(JSON.parse(save.mock.calls[0][0]).dashboard.panels[0].title).toBe('Edited title');
    expect(mockRunQueries).not.toHaveBeenCalled();
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    await act(async () => {
      Simulate.click(button('Update preview'));
    });
    expect(container.querySelector('iframe')).not.toBe(iframe);

    const editorScroll = title.closest('fieldset')!;
    expect(editorScroll.style.overflow).toBe('auto');
    expect(editorScroll.contains(button('Update preview'))).toBe(false);
    const layout = Array.from(container.querySelectorAll('div')).find((div) => div.style.gridTemplateColumns.includes('repeat'))!;
    expect(layout.style.overflow).not.toBe('hidden');
    expect(layout.style.height).toBe('');
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  }
});
