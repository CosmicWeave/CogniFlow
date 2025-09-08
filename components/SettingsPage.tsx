import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import ToggleSwitch from './ui/ToggleSwitch';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './ui/ThemeToggle';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/Accordion';

interface SettingsPageProps {
  onExport: () => void;
  onRestore: () => void;
  onResetProgress: () => void;
  onFactoryReset: () => void;
  onSync: () => void;
  onForceFetch: () => void;
  onForceUpload: () => void;
  onCreateServerBackup: () => void;
  onManageServerBackups: () => void;
  isSyncing: boolean;
  lastSyncStatus: string;
  // GDrive Props
  isGapiReady: boolean;
  isGapiSignedIn: boolean;
  gapiUser: any;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onBackupToDrive: () => void;
  onRestoreFromDrive: () => void;
  // Cache Props
  onClearAppCache: () => void;
  onClearCdnCache: () => void;
  onRevertLastFetch: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onExport,
  onRestore,
  onResetProgress,
  onFactoryReset,
  onSync,
  onForceFetch,
  onForceUpload,
  onCreateServerBackup,
  onManageServerBackups,
  isSyncing,
  lastSyncStatus,
  // GDrive Props
  isGapiReady,
  isGapiSignedIn,
  gapiUser,
  onGoogleSignIn,
  onGoogleSignOut,
  onBackupToDrive,
  onRestoreFromDrive,
  // Cache Props
  onClearAppCache,
  onClearCdnCache,
  onRevertLastFetch,
}) => {
  const settings = useSettings();
  const { themeId, setThemeById } = useTheme();
  const [hasRevertBackup, setHasRevertBackup] = useState(false);
  
  useEffect(() => {
    if (localStorage.getItem('cogniflow-pre-fetch-backup')) {
        setHasRevertBackup(true);
    }
  }, []);
  
  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-8">
      <h1 className="text-3xl font-bold text-text border-b border-border pb-4">Settings</h1>

      <Accordion type="multiple" defaultValue={['appearance', 'general', 'cloud-sync', 'gdrive-backup', 'data-management', 'cache-management']} className="w-full space-y-4">
        
        <AccordionItem value="data-management" className="border border-border rounded-lg overflow-hidden">
          <AccordionTrigger>
             <h2 className="text-2xl font-semibold text-text">Data Management</h2>
          </AccordionTrigger>
           <AccordionContent className="bg-surface p-6 flex flex-wrap gap-4 justify-center">
            <Button variant="secondary" onClick={onExport}><Icon name="download" className="mr-2"/> Export All Data</Button>
            <Button variant="secondary" onClick={onRestore}><Icon name="upload-cloud" className="mr-2"/> Restore from File</Button>
            <Button variant="secondary" onClick={onResetProgress}><Icon name="refresh-ccw" className="mr-2"/> Reset Progress</Button>
            {hasRevertBackup && <Button variant="secondary" onClick={onRevertLastFetch}><Icon name="refresh-ccw" className="mr-2"/> Revert Last Fetch</Button>}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cloud-sync" className="border border-border rounded-lg overflow-hidden">
          <AccordionTrigger>
             <h2 className="text-2xl font-semibold text-text">Cloud Sync</h2>
          </AccordionTrigger>
          <AccordionContent className="bg-surface p-6 space-y-6">
              <ToggleSwitch
                label="Enable Cloud Sync"
                description="Automatically sync your data to the server."
                checked={settings.backupEnabled}
                onChange={settings.setBackupEnabled}
              />
              <ToggleSwitch
                label="Sync on Cellular Data"
                description="Allow auto-sync when on a mobile network."
                checked={settings.syncOnCellular}
                onChange={settings.setSyncOnCellular}
                disabled={!settings.backupEnabled}
              />
              <div>
                <label htmlFor="backup-api-key" className="block text-sm font-medium text-text-muted mb-1">
                    Server Backup API Key
                </label>
                <input
                  id="backup-api-key"
                  type="password"
                  value={settings.backupApiKey}
                  onChange={(e) => settings.setBackupApiKey(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  disabled={!settings.backupEnabled}
                />
              </div>
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-2 items-center justify-between">
                  <p className="text-sm text-text-muted">{isSyncing ? 'Syncing...' : lastSyncStatus}</p>
                  <div className="flex gap-2 flex-wrap justify-end">
                      <Button variant="primary" onClick={onSync} disabled={!settings.backupEnabled || isSyncing}>
                          <Icon name="refresh-ccw" className="w-4 h-4 mr-2" /> Sync Now
                      </Button>
                  </div>
              </div>
               <div className="pt-4 border-t border-border">
                  <h3 className="text-lg font-semibold text-text-muted">Advanced Sync Options</h3>
                  <p className="text-sm text-text-muted mt-1 mb-4">Use these options to resolve sync conflicts manually. These are destructive actions and should be used with caution.</p>
                  <div className="flex flex-wrap gap-4 justify-start">
                      <Button variant="secondary" onClick={onForceUpload} disabled={!settings.backupEnabled || isSyncing}>
                          <Icon name="upload-cloud" className="w-4 h-4 mr-2" /> Force Upload to Server
                      </Button>
                      <Button variant="secondary" onClick={onForceFetch} disabled={!settings.backupEnabled || isSyncing}>
                          <Icon name="download" className="w-4 h-4 mr-2" /> Force Fetch from Server
                      </Button>
                  </div>
              </div>
              <div className="pt-4 border-t border-border flex flex-wrap gap-2 justify-center">
                   <Button variant="secondary" onClick={onCreateServerBackup} disabled={!settings.backupEnabled || isSyncing}>
                      <Icon name="plus" className="w-4 h-4 mr-2" /> Create Manual Backup
                  </Button>
                   <Button variant="secondary" onClick={onManageServerBackups} disabled={!settings.backupEnabled || isSyncing}>
                      <Icon name="settings" className="w-4 h-4 mr-2" /> Manage Backups
                  </Button>
              </div>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="appearance" className="border border-border rounded-lg overflow-hidden">
          <AccordionTrigger>
            <h2 className="text-2xl font-semibold text-text">Appearance</h2>
          </AccordionTrigger>
          <AccordionContent className="bg-surface p-6 space-y-6">
            <ThemeToggle selectedTheme={themeId} onThemeChange={setThemeById} />
            <ToggleSwitch
              label="Disable Animations"
              description="Reduces motion for a faster experience."
              checked={settings.disableAnimations}
              onChange={settings.setDisableAnimations}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="general" className="border border-border rounded-lg overflow-hidden">
          <AccordionTrigger>
            <h2 className="text-2xl font-semibold text-text">General</h2>
          </AccordionTrigger>
          <AccordionContent className="bg-surface p-6 space-y-6">
            <ToggleSwitch
              label="Enable Haptic Feedback"
              description="Provides physical feedback on supported devices."
              checked={settings.hapticsEnabled}
              onChange={settings.setHapticsEnabled}
            />
            <ToggleSwitch
              label="Enable AI Features"
              description="Allows content generation using the Gemini API."
              checked={settings.aiFeaturesEnabled}
              onChange={settings.setAiFeaturesEnabled}
            />
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="gdrive-backup" className="border border-border rounded-lg overflow-hidden">
          <AccordionTrigger>
             <h2 className="text-2xl font-semibold text-text">Google Drive Backup</h2>
          </AccordionTrigger>
          <AccordionContent className="bg-surface p-6 space-y-6">
            {!isGapiReady ? (
                <p className="text-text-muted text-center">Loading Google Drive services...</p>
            ) : isGapiSignedIn ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-background rounded-md">
                        <img src={gapiUser?.picture} alt="User profile" className="w-12 h-12 rounded-full" />
                        <div>
                            <p className="font-semibold text-text">{gapiUser?.name}</p>
                            <p className="text-sm text-text-muted">{gapiUser?.email}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 justify-center">
                        <Button variant="secondary" onClick={onBackupToDrive}><Icon name="upload-cloud" className="mr-2"/> Backup to Drive</Button>
                        <Button variant="secondary" onClick={onRestoreFromDrive}><Icon name="download" className="mr-2"/> Restore from Drive</Button>
                        <Button variant="danger" onClick={onGoogleSignOut}>Sign Out</Button>
                    </div>
                </div>
            ) : (
                <div className="text-center">
                    <p className="text-text-muted mb-4">Sign in with your Google account to back up and restore your data to a private folder in your Google Drive.</p>
                    <Button variant="primary" onClick={onGoogleSignIn} className="inline-flex items-center gap-2">
                        <Icon name="google" className="w-5 h-5" />
                        Sign in with Google
                    </Button>
                </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cache-management" className="border border-border rounded-lg overflow-hidden">
          <AccordionTrigger>
             <h2 className="text-2xl font-semibold text-text">Cache Management</h2>
          </AccordionTrigger>
           <AccordionContent className="bg-surface p-6 space-y-4">
             <p className="text-sm text-text-muted text-center w-full">Clearing the cache can resolve issues by forcing the app to download the latest files. This does not affect your saved data.</p>
             <div className="flex flex-wrap gap-4 justify-center">
              <Button variant="secondary" onClick={onClearAppCache}><Icon name="refresh-ccw" className="mr-2"/> Clear App Cache</Button>
              <Button variant="secondary" onClick={onClearCdnCache}><Icon name="download" className="mr-2"/> Clear CDN Cache</Button>
             </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-400 dark:text-red-300">Danger Zone</h2>
        <p className="text-red-500/80 dark:text-red-300/80 mb-4">
          This will permanently delete all your decks, folders, and progress. This action cannot be undone.
        </p>
        <Button variant="danger" onClick={onFactoryReset}><Icon name="broom" className="mr-2"/> Factory Reset</Button>
      </div>
    </div>
  );
};