import React, { useState } from 'react';
import { Icon, Field, TextArea, Button } from '@grafana/ui';

export const Heading = (txt: string) => {
  return (<h2 style={{color: "#FFFFFF", margin:"20px",backgroundColor:"#445c94", fontSize:"26px", justifyContent:"center", display: "flex", alignItems: "center", borderRadius:"15px 0 0 0", minHeight:"3em"}}>{txt}</h2>)
}

export const BigTextBox = () => {
  const [value, setValue] = useState<string>('Test Test');

  const TextAreaComponent = TextArea as any; // Work around for type problems

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


<div style={{margin:"0px 0px 0.45em"}}>
  <div>
    <Icon name="check" />;
    <h1>Create Dashboard</h1>
  </div>
  <div style={{display: 'grid', padding:"50px", gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr", gap:"50px"}}>
    <div style={{gridColumn:"1", padding:"25px", background:"rgb(255, 255, 255)", borderRadius: "5px"}}>
      {Heading("Dashboard Preview")}
      <div style={{background:"#F4F6F5", margin: "20px", padding: "10px", minHeight:"300px",minWidth:"300px", borderRadius: "5px"}}>

      </div>
      <div style={{background:"#F4F6F5", margin: "20px", padding: "10px"}}>
        <h3>Describe your new dashboard!</h3>
        <Field>
          {BigTextBox()}
        </Field>
        <Button style={{ width: '100%', justifyContent: "center"}}>Generate</Button>
      </div>
      <div>
        
      </div>
    </div>
    
    <div style={{gridColumn:"2", flexGrow:"1", padding:"50px"}}>
      {Heading("Dashboard Source")}
    </div>
  </div>
</div>


  );
};
