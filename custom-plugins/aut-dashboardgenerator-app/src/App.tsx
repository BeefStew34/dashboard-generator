import React from 'react';
import { AppRootProps } from '@grafana/data';
import { GeneratorPage } from './Generator';
import { SettingsPage } from 'Settings';

export const App = (props: AppRootProps) => {
  const { path } = props;

  if (path.endsWith('/creator')) return <GeneratorPage />;
  if (path.endsWith('/settings')) return <SettingsPage />;

  return (
    <div>
      <h1>How to Use Instructions/Plugin Infomation/Plugin Configs</h1>
    </div>
  );
};