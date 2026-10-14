import { loadSettings } from './usersetting';
import { getBackendSrv } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({ config: { bootData: { user: { id: 1 } } }, getBackendSrv: jest.fn() }));
jest.mock('./Settings', () => ({ currentSettings: {} }));

it.each(['test-key,,openai,simple,test-model', 'test-key,,openai,simple,test-model,working-uid'])(
  'loads settings while ignoring any previously saved datasource override: %s',
  async (values) => {
    (getBackendSrv as jest.Mock).mockReturnValue({
      fetch: () => ({ toPromise: () => Promise.resolve({ data: { values } }) }),
    });
    const settings = await loadSettings();
    expect(settings).not.toHaveProperty('DataSourceUID');
    expect(settings.Model).toBe('test-model');
  }
);
