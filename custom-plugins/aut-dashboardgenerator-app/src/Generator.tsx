import React from 'react';
import { Icon } from '@grafana/ui';

export const Heading = (txt: string) => {
  return (<h2 style={{color: "#FFFFFF", backgroundColor:"#445c94", fontSize:"26px", textAlign:"center"}}>{txt}</h2>)
}

export const GeneratorPage = () => {
  return (


<div style={{margin:"0px 0px 0.45em"}}>
  <div>
    <Icon name="check" />;
    <h1>Create Dashboard</h1>
  </div>
  <div style={{display: 'grid', padding:"10px", gridTemplateColumns:"1fr 1fr", gap:"50px", background:"0xFFFFFF"}}>
    <div style={{gridColumn:"1", padding:"50px", background:"rgb(244, 245, 245)"}}>
      {Heading("Dashboard Preview")}
    </div>
    
    <div style={{gridColumn:"2", flexGrow:"1", padding:"50px"}}>
      {Heading("Dashboard Source")}
    </div>
  </div>
</div>


  );
};
