import React, { } from 'react';
import { Form, Field, Input, Label, Select, Button } from '@grafana/ui';
import { getBackendSrv, config  } from '@grafana/runtime';
//import { SelectableValue } from '@grafana/data/types/select';

const user = config.bootData.user;

async function SetKeys(value: string) {
  const result = await getBackendSrv().fetch({
    url: '/api/plugins/aut-dashboardgenerator-app/resources/set_key',
    method: 'POST',
    data: {'values': value, 'userid' : String(user.id)}
  }).toPromise();
  return result;
}
async function GetUserSettings() {
  const result = await getBackendSrv().fetch({
    url: '/api/plugins/aut-dashboardgenerator-app/resources/get_key',
    method: 'POST',
    data: {'userid' : String(user.id) }
  }).toPromise();
  return result;
}

interface Settings {
    'OpenAIKey': string;
    'ClaudeAIKey': string;
    'SelectedAI': string;
    'ViewMode': string;
}

const defaultSettings: Settings = {
  'OpenAIKey': '',
  'ClaudeAIKey': '',
  'SelectedAI': 'OpenAI',
  'ViewMode': 'simple'
}

export const UpdateTextSetting = (e: React.FormEvent<HTMLInputElement>, name: keyof Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>>) => {
    setSettings(prev => ({ ...prev, [name]: e.currentTarget.value }));
}

interface NetMessage {
  values: string;
}

export const GetSettingsForm = () => {
    const [settings, setSettings] = React.useState<Settings>(defaultSettings);
    React.useEffect(() => {
        GetUserSettings().then((result) => {
            if (result == null) return;
            let values = (result.data as NetMessage).values.split(',');
            setSettings(prev => ({
                ...prev,
                'OpenAIKey': values[0],
                'ClaudeAIKey': values[1],
                'SelectedAI': values[2],
                'ViewMode': values[3]
            }));
        });
    }, []);
    return (
        <Form 
            defaultValues={defaultSettings}
            onSubmit={(data) => {}}>   
            {({register, errors}) => {
                return (
                    <div>
                        <h3>LLM </h3>
                        <Label>OpenAI Key</Label>
                        <Field>
                            <Input value={settings.OpenAIKey} onChange={(e) => {UpdateTextSetting(e, 'OpenAIKey', setSettings)}} />
                        </Field>
                        <Label>Claude AI Key</Label>
                        <Field>
                            <Input value={settings.ClaudeAIKey} onChange={(e) => {UpdateTextSetting(e, 'ClaudeAIKey', setSettings)}} />
                        </Field>
                        
                        <Label>Selected AI</Label>
                        <Field>
                            <Select
                                options={[
                                    { label: 'OpenAI', value: 'openai' },
                                    { label: 'Claude AI', value: 'claudeai' }
                                ]}
                                value={settings.SelectedAI}  
                                 onChange={(e) => {
                                    setSettings(prev => ({
                                        ...prev,
                                        SelectedAI: e.value ?? 'openai'
                                    }));
                                }}
                            />
                        </Field>
                        
                        <h3>Application</h3>
                        <Label>View Mode</Label>
                        <Field>
                            <Select
                                options={[
                                    { label: 'Simple', value: 'simple' },
                                    { label: 'Complex', value: 'complex' }
                                ]}
                                value={settings.ViewMode}
                                 onChange={(e) => {
                                    setSettings(prev => ({
                                        ...prev,
                                        ViewMode: e.value ?? 'simple'
                                    }));
                                }}
                            />
                        </Field>
                        <Button onClick={() => {
                            let values = `${settings.OpenAIKey},${settings.ClaudeAIKey},${settings.SelectedAI},${settings.ViewMode}`;
                            SetKeys(values);
                        }}>Save Settings</Button>
                    </div>
                )
            }}
        </Form>
    )
}

export const SettingsPage = () => { 
    return (

<div
style={{
marginLeft: 'auto',
marginRight: 'auto',
maxWidth: '1440px',
}}
>
    <div>
        <br></br>
        <h1>Settings</h1>
         <div
          style={{
            gridColumn: '1',
            padding: '25px',
            background: '#FFFFFF',
            borderRadius: '5px',
            minWidth: 0,
          }}
        >
        {GetSettingsForm()}
        </div>
    </div>
</div>

    )
}