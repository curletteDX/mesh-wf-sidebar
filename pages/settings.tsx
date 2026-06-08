import { Button, hasPermissions, hasRole, Input, useMeshLocation } from '@uniformdev/mesh-sdk-react';
import type { NextPage } from 'next';
import { useState } from 'react';


import { IntegrationSettings } from '../lib';

const Settings: NextPage = () => {
  const { value, setValue } = useMeshLocation<'settings', IntegrationSettings>('settings');

  const [targetProjectId, setTargetProjectId] = useState(value?.targetProjectId ?? '');

  return (
    <div>
      <h1>Integration Settings</h1>
      <Input
        label="Target Project ID"
        type="text"
        value={targetProjectId}
        onChange={(e) => setTargetProjectId(e.currentTarget.value)}
        caption="The project ID where compositions will be copied to"
      />
      <Button
        type="submit"
        onClick={() => {
          setValue((previous) => ({ newValue: { ...previous, targetProjectId } }));
        }}
      >
        Save Settings
      </Button>

      <HowToUseUserMetadata />
    </div>
  );
};

export const HowToUseUserMetadata = () => {
  // Every location has a metadata object that contains information about the current user
  // and the current project. This can be used to determine if the user has permissions to
  // perform certain actions, or to display information about the user any other way.
  const { metadata } = useMeshLocation();

  return (
    <div>
      <p>Am I admin? {metadata.user.isAdmin ? 'YES' : 'NO'}</p>
      <p>
        Do I have permissions to Manage Data Sources and Data Types?{' '}
        {hasPermissions(['DATA_SOURCES_MANAGE', 'DATA_TYPES_MANAGE'], metadata.user) ? 'YES' : 'NO'}
      </p>
      <p>Do I have an Editor Role? {hasRole('Editor', metadata.user) ? 'YES' : 'NO'}</p>
      <p>My email is {metadata.user.email}</p>
      <p>My Profile ID is {metadata.user.id}</p>
    </div>
  );
};

export default Settings;
