import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { GetSettingsForm } from './Settings';
import { getBackendSrv } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({
  config: {
    bootData: { user: { id: 1 } },
    datasources: { reporting: { uid: 'chosen', name: 'Reporting', type: 'postgres' } },
  },
  getBackendSrv: jest.fn(),
}));
jest.mock('@grafana/ui', () => ({
  Form: ({ children }: any) => children({ register: jest.fn(), errors: {} }),
  Field: ({ children }: any) => <div>{children}</div>,
  Label: 'label',
  Input: 'input',
  Button: 'button',
  Select: ({ options, value, onChange }: any) => (
    <select value={value} onChange={(event) => onChange({ value: event.currentTarget.value })}>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

it('offers and persists the user-supplied GPT-6 Luna model ID with an availability caveat', async () => {
  const fetch = jest.fn().mockImplementation(({ url }) => ({
    toPromise: () =>
      Promise.resolve({
        data: { values: url.endsWith('get_key') ? 'test-key,,openai,simple,gpt-5.5' : '' },
      }),
  }));
  (getBackendSrv as jest.Mock).mockReturnValue({ fetch });
  const container = document.createElement('div');
  document.body.appendChild(container);
  try {
    await act(async () => {
      ReactDOM.render(<GetSettingsForm />, container);
    });
    const modelSelect = Array.from(container.querySelectorAll('select')).find((select) =>
      select.querySelector('option[value="gpt-6-luna"]')
    )!;
    expect(modelSelect).toBeTruthy();
    expect(container.textContent).not.toContain('availability is not verified');
    expect(container.textContent).not.toContain('The selected model ID must be available');
    expect(container.textContent).toContain('GPT-5 Mini');
    act(() => {
      modelSelect.value = 'gpt-6-luna';
      Simulate.change(modelSelect);
    });
    expect(container.textContent).not.toContain('PostgreSQL datasource');
    expect(container.querySelectorAll('select')).toHaveLength(3);
    expect(container.textContent).not.toContain('Check datasource connection');
    expect(container.textContent).not.toContain('Select the same datasource as a working dashboard');
    expect(container.querySelectorAll('button')).toHaveLength(1);
    await act(async () => {
      Simulate.click(
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save Settings')!
      );
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/plugins/aut-dashboardgenerator-app/resources/set_key',
        data: { values: 'test-key,,openai,simple,gpt-6-luna', userid: '1' },
      })
    );
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  }
});
