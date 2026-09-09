import React, { useState } from 'react';
import { Icon, Field, TextArea, Button } from '@grafana/ui';

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

  return (
    <TextArea
      value={value}
      rows={rows}
      placeholder=""
      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setValue(event.currentTarget.value)} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}      />
    );

};

export const GeneratorPage = () => {

    //Dashboard Source view mode
    const [sourceMode, setSourceMode] = useState<'code' | 'simple'>('code');
    // Keep the JSON here so switching views does not erase edits.
    const [sourceText, setSourceText] = useState<string>(`{
  "dashboard": {
    "title": "Generated Dashboard",
    "panels": []
  }
}`);
    const changeToCodeVersion = () => {
      setSourceMode('code');
    };
    const changeToSimpleVersion = () => {
      setSourceMode('simple');
    };
    return (
      <div
        style={{ 
          marginLeft : 'auto', 
          marginRight: 'auto', 
          maxWidth: '1440px'
      }}
      >
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
          {/* Dashboard Description side */}
          <div
          style ={{
            background: '#F4F6F5',
            margin: '20px',
            padding: '10px',
          }}
>

<h3>Describe your new dashboard!</h3>

<Field>
  <BigTextBox rows={6} />
</Field>

<Button
type="button"
style={{
  width: '100%',
  justifyContent: 'center',

}}
>
Generate
</Button>
</div>
        </div>
      {/*Dashboard Source side */}
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
        style = {{
          background: '#F4F6F5',
          margin: '20px',
          padding: '10px',
        }}
        >
          {/* Dashboard Source view mode buttons */}
        
        <div
        style = {{
          display: 'flex',
          gap: '10px',
           marginBottom: '15px',
        }}
        >
          <Button
          type = "button"
            variant={sourceMode === 'code' ? 'primary' : 'secondary'}
            onClick={changeToCodeVersion}
            style={{
              flex: 1,
              justifyContent: 'center',
            }}
          >
            Code Version
          </Button>
          <Button
          type = "button"
             variant= {sourceMode === 'simple' 
              ? 'primary' 
              : 'secondary'
            }
            onClick={changeToSimpleVersion}
            style={{
              flex: 1,
              justifyContent: 'center',
            }}
          >
            Simple Version
          </Button>
        </div>
        {/*Change field depending on mode */}
        <Field>
          {sourceMode === 'code' ? (
            /*Code Version */
            <TextArea
                    rows={24}
                    value={sourceText}
                    aria-label="Dashboard Source"
                    spellCheck={false}
                    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setSourceText(event.currentTarget.value)} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}             />
          ) : (
            <div
            style = {{
              background: '#FFFFFF',
              padding: '20px',
              minHeight: '400px',
              border: '1px solid #CCCCCC',
              borderRadius: '3px',
            }}
            >
              <h3> Generated Dashboard </h3>
              <p>
                <strong>Dashboard Title:</strong> Generated Dashboard
              </p>
              <p>
                <strong>Panels:</strong> No panels added
              </p>
            </div>
          )}
        </Field>
        {/* Action buttons: connect their handlers separately. */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '10px',
          }}
        >
          <Button
          type = "button"
            variant="secondary"
            style={{
              width: '100%',
              justifyContent: 'center',
            }}
          >
            Save
          </Button>
          <Button
          type = "button"
            variant="secondary"
            style={{
              width: '100%',
              justifyContent: 'center',
            }}
          >
            Share
          </Button>
          <Button
          type = "button"
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
