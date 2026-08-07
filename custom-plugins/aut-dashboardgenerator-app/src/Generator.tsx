import React, { useState } from 'react';
import { Icon, Field, TextArea, Button } from '@grafana/ui';
import { getBackendSrv, config  } from '@grafana/runtime';

const user = config.bootData.user;

async function SetKey(key: string, value: string) {
  const result = await getBackendSrv().fetch({
    url: '/api/plugins/aut-dashboardgenerator-app/resources/set_key',
    method: 'POST',
    data: {'key': key, 'value': value, 'userid' : String(user.id)}
  }).toPromise();
  return result;
}
async function GetKey(key : string) {
  const result = await getBackendSrv().fetch({
    url: '/api/plugins/aut-dashboardgenerator-app/resources/get_key',
    method: 'POST',
    data: {'key': key, 'userid' : String(user.id) }
  }).toPromise();
  return result;
}

const onTestClick = async () => {
  try {
    const result = await SetKey('openai_apikey', 'test_value');
    const result2 = await GetKey('openai_apikey');
    console.log(result);
    console.log(result2);
  } catch (err) {
    console.error(err);
  }
};


export const Heading = (txt: string) => {
  return (
    <h2
      style={{
        color: '#FFFFFF',
        margin: '20px',
        backgroundColor: '#445c94',
        fontSize: '26px',
        justifyContent: 'center',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '15px 0 0 0',
        minHeight: '3em',
      }}
    >
      {txt}
    </h2>
  );
};

type BigTextBoxProps = {
  rows?: number;
  initialValue?: string;
};

export const BigTextBox = ({
  rows = 6,
  initialValue = 'Test Test',
}: BigTextBoxProps) => {
  const [value, setValue] = useState<string>(initialValue);

  const TextAreaComponent = TextArea as any;

  return (
    <TextAreaComponent
      value={value}
      rows={6}
      placeholder=""
      onChange={(e: any) => setValue(e.currentTarget.value)}
    />
  );
};

export const GeneratorPage = () => {
  return (
    <div style={
      { marginLeft : 'auto', marginRight: 'auto',  
        maxWidth: '1440px'
      }
      }>
      <div>
        <Icon name="check" />
        <h1>Create Dashboard</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '50px',
          alignItems: 'start',
        }}
      >
        {/* Dashboard Preview side */}
        <div
          style={{
            gridColumn: '1',
            padding: '25px',
            background: 'rgb(255, 255, 255)',
            borderRadius: '5px',
            minWidth: 0,
          }}
        >
          {Heading('Dashboard Preview')}

          <div
            style={{
              background: '#F4F6F5',
              margin: '20px',
              padding: '10px',
              minHeight: '300px',
              minWidth: '300px',
              borderRadius: '5px',
            }}
          />

          <div
            style={{
              background: '#F4F6F5',
              margin: '20px',
              padding: '10px',
            }}
          >
            <h3>Describe your new dashboard!</h3>

            <Field>
              <BigTextBox rows={6} />
            </Field>

            <Button onClick={onTestClick}
              style={{
                width: '100%',
                justifyContent: 'center',
              }}
            >
              Generate
            </Button>
          </div>
        </div>

        {/* Dashboard Source side */}
        <div
          style={{
            gridColumn: '2',
            padding: '25px',
            background: 'rgb(255, 255, 255)',
            borderRadius: '5px',
            minWidth: 0,
          }}
        >
          {Heading('Dashboard Source')}

          <div
            style={{
              background: '#F4F6F5',
              margin: '20px',
              padding: '10px',
            }}
          >
            <Field>
              <BigTextBox
                rows={24}
                initialValue={`{
  "dashboard": {
    "title": "Generated Dashboard",
    "panels": []
  }
}`}
              />
            </Field>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '10px',
              }}
            >
              <Button
                variant="secondary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                Save
              </Button>

              <Button
                variant="secondary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                Share
              </Button>

              <Button
                variant="secondary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
