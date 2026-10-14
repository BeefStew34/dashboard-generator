import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { GenerateDashboard } from './LLMInterface';
import { useDashboardInteractions } from './Interactions';

jest.mock('./LLMInterface', () => ({ GenerateDashboard: jest.fn() }));

it('does not retry fatal schema/permission errors or repeat automatic discovery', async () => {
  const container = document.createElement('div');
  let controls!: ReturnType<typeof useDashboardInteractions>;
  const Component = () => {
    controls = useDashboardInteractions();
    return <p>{controls.generateMessage}</p>;
  };
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  (GenerateDashboard as jest.Mock).mockRejectedValue(new Error('permission denied for table store'));
  try {
    act(() => {
      ReactDOM.render(<Component />, container);
    });
    await act(async () => {
      await controls.generate('Show storage', jest.fn());
    });
    expect(GenerateDashboard).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('permission denied');
    expect(controls.generating).toBe(false);
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    confirm.mockRestore();
  }
});

it('keeps optional discovery warnings visible after successful generation', async () => {
  const container = document.createElement('div');
  let controls!: ReturnType<typeof useDashboardInteractions>;
  const Component = () => {
    controls = useDashboardInteractions();
    return <p>{controls.generateMessage}</p>;
  };
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  const onSaved = jest.fn();
  (GenerateDashboard as jest.Mock).mockImplementation(async (_source, _description, _current, warning) => {
    warning('Optional lookup public.aggregator failed; continuing with metadata.');
    return '/d/generated';
  });
  try {
    act(() => {
      ReactDOM.render(<Component />, container);
    });
    await act(async () => {
      await controls.generate('Show storage', jest.fn(), onSaved);
    });
    expect(container.textContent).toContain('Dashboard generated');
    expect(container.textContent).toContain('Discovery warnings: Optional lookup public.aggregator failed');
    expect(onSaved).toHaveBeenCalledWith('/d/generated');
    expect(controls.generating).toBe(false);
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    confirm.mockRestore();
  }
});
