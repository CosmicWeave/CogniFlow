import React, { useState, useMemo } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import ToggleSwitch from './ui/ToggleSwitch';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import { useTheme, themes } from '../contexts/ThemeContext';
import Spinner from './ui/Spinner';

interface SettingsPageProps {
  onExport: () => void;
  onRestore: () => void;
  onResetProgress: () => void;
  onFactoryReset: () => void;
  onTriggerSync: () => void;
  onFetchFromServer: () => void;
  isSyncing: boolean;
  lastSyncStatus: string;
  onManageServerBackups: () => void;
  onCreateServerBackup: () => void;
}

const AccordionSection: React.FC<{
    id: string;
    title: string;
    children: React.ReactNode;
    openSection: string | null;
    setOpenSection: (id: string | null) => void;
    isDanger?: boolean;
}> = ({ id, title, children, openSection, setOpenSection, isDanger = false }) => {
    const isOpen = openSection === id;
    
    const headerClasses = isDanger 
        ? "bg-red-900/20 text-red-400 dark:text-red-300" 
        : "bg-surface";
    const contentBgClasses = isDanger
        ? 'bg-red-900/10'
        : 'bg-surface';
    const borderClasses = isDanger 
        ? "border border-red-500/30"
        : "border border-border";

    return (
        <div className={`rounded-lg shadow-sm overflow-hidden ${borderClasses}`}>
            <button
                onClick={() => setOpenSection(isOpen ? null : id)}
                className={`w-full flex justify-between items-center text-left p-4 sm:p-6 ${headerClasses}`}
                aria-expanded={isOpen}
            >
                <h3 className="text-xl font-semibold">{title}</h3>
                <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'} text-text-muted`} />
            </button>
            {isOpen && (
                <div className={`p-4 sm:p-6 pt-0 animate-fade-in ${contentBgClasses}`}>
                    <div className="pt-4 sm:pt-6 border-t border-border/50">{children}</div>
                </div>
            )}
        </div>
    );
};

const SyncStatusIndicator: React.FC<{ isSyncing: boolean; statusText: string }> = ({ isSyncing, statusText }) => {
    if (isSyncing) {
        return (
            <div className="flex items-center gap-2 text-sm text-blue-500">
                <Spinner size="sm" />
                <span className="font-semibold">{statusText}</span>
            </div>
        );
    }
    const isError = statusText.toLowerCase().startsWith('error');
    const isSuccess = statusText.toLowerCase().startsWith('last synced');

    return (
        <div className={`flex items-center gap-2 text-sm ${isError ? 'text-red-500' : 'text-text-muted'}`}>
            {isSuccess && <Icon name="check-circle" className="w-4 h-4 text-green-500 flex-shrink-0" />}
            {isError && <Icon name="x-circle" className="w-4 h-4 flex-shrink-0" />}
            <span>{statusText}</span>
        </div>
    );
};


export const SettingsPage: React.FC<SettingsPageProps> = ({ onExport, onRestore, onResetProgress, onFactoryReset, onTriggerSync, onFetchFromServer, isSyncing, lastSyncStatus, onManageServerBackups, onCreateServerBackup }) => {
  const { disableAnimations, setDisableAnimations, hapticsEnabled, setHapticsEnabled, aiFeaturesEnabled, setAiFeaturesEnabled, backupEnabled, setBackupEnabled, backupApiKey, setBackupApiKey } = useSettings();
  const { addToast } = useToast();
  const { themeId, setThemeById } = useTheme();
  const [openSection, setOpenSection] = useState<string | null>('data');

  const [localApiKey, setLocalApiKey] = useState(backupApiKey);

  const handleSaveApiKey = () => {
    setBackupApiKey(localApiKey);
    addToast('API Key saved!', 'success');
  };
  
  const handleHardReload = () => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CDN_CACHE' });
      addToast('Caches cleared. Reloading...', 'info');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      addToast('Could not clear caches. Service worker not available.', 'error');
    }
  };

  const lightThemes = themes.filter(t => !t.isDark);
  const darkThemes = themes.filter(t => t.isDark);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <h2 className="text-3xl font-bold mb-6 text-text border-b border-border pb-4">Settings</h2>
      
      <AccordionSection id="data" title="Data Management" openSection={openSection} setOpenSection={setOpenSection}>
          <div className="space-y-6">
              <div id="settings-server-sync">
                <h4 className="font-semibold text-text">Live Server Sync</h4>
                <p className="text-text-muted my-2 text-sm">
                  Synchronize your data with a single live file on the server. "Sync Now" uploads your local data, while "Fetch" downloads the server version, overwriting local changes.
                </p>
                <div className="space-y-4 p-4 bg-background rounded-lg border border-border">
                  <ToggleSwitch
                    label="Enable Server Sync & Backups"
                    checked={backupEnabled}
                    onChange={setBackupEnabled}
                  />
                  <div>
                    <label htmlFor="api-key-input" className="block text-sm font-medium text-text-muted mb-1">Backup API Key</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="api-key-input"
                        type="password"
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        className="flex-grow p-2 bg-surface border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                        placeholder="Enter your API key"
                      />
                      <Button onClick={handleSaveApiKey} variant="secondary">Save Key</Button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
                      <Button onClick={onTriggerSync} disabled={isSyncing || !backupEnabled}>
                          <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
                          Sync Now
                      </Button>
                       <Button onClick={onFetchFromServer} variant="secondary" disabled={isSyncing || !backupEnabled}>
                          <Icon name="download" className="w-5 h-5 mr-2" />
                          Fetch from Server
                       </Button>
                      <SyncStatusIndicator isSyncing={isSyncing} statusText={lastSyncStatus} />
                  </div>
                </div>
              </div>

              <div id="settings-server-backup" className="border-t border-border pt-6">
                <h4 className="font-semibold text-text">Server Backups</h4>
                <p className="text-text-muted my-2 text-sm">
                  Create timestamped backups of your live sync file on the server. You can restore your live data from one of these backups at any time.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={onCreateServerBackup} variant="secondary" disabled={isSyncing || !backupEnabled}>
                    <Icon name="save" className="w-5 h-5 mr-2" />
                    Create Server Backup
                  </Button>
                  <Button onClick={onManageServerBackups} variant="secondary" disabled={isSyncing || !backupEnabled}>
                    <Icon name="list" className="w-5 h-5 mr-2" />
                    Manage & Restore Backups
                  </Button>
                </div>
              </div>

              <div id="settings-local-backup" className="border-t border-border pt-6">
                <h4 className="font-semibold text-text">Local File Backup</h4>
                <p className="text-text-muted my-2 text-sm">
                  Manually backup all your data to a JSON file on your device.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={onExport} variant="secondary">
                    <Icon name="download" className="w-5 h-5 mr-2" />
                    Backup to File
                  </Button>
                  <Button onClick={onRestore} variant="secondary">
                    <Icon name="upload-cloud" className="w-5 h-5 mr-2" />
                    Restore from File
                  </Button>
                </div>
              </div>
          </div>
      </AccordionSection>
      
      <AccordionSection id="appearance" title="Appearance" openSection={openSection} setOpenSection={setOpenSection}>
          <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-text mb-3">Color Theme</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {lightThemes.map(theme => (
                    <button key={theme.id} onClick={() => setThemeById(theme.id)} className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors ${themeId === theme.id ? 'border-primary' : 'border-border hover:border-text-muted'}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(${theme.palette.surface})`, border: `2px solid rgb(${theme.palette.primary})` }}>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `rgb(${theme.palette.primary})` }}></div>
                      </div>
                      <span className="font-medium">{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-text mb-3">Dark Themes</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {darkThemes.map(theme => (
                    <button key={theme.id} onClick={() => setThemeById(theme.id)} className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors ${themeId === theme.id ? 'border-primary' : 'border-border hover:border-text-muted'}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(${theme.palette.surface})`, border: `2px solid rgb(${theme.palette.primary})` }}>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `rgb(${theme.palette.primary})` }}></div>
                      </div>
                      <span className="font-medium">{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>
          </div>
      </AccordionSection>
      
      <AccordionSection id="general" title="General Preferences" openSection={openSection} setOpenSection={setOpenSection}>
          <div className="space-y-6 divide-y divide-border">
              <ToggleSwitch
                  label="Enable Haptic Feedback"
                  checked={hapticsEnabled}
                  onChange={setHapticsEnabled}
                  description="Provides physical feedback on actions (on supported devices)."
              />
              <div className="pt-6">
                <ToggleSwitch
                    label="Disable UI Animations"
                    checked={disableAnimations}
                    onChange={setDisableAnimations}
                    description="Reduces motion for a simpler experience."
                />
              </div>
          </div>
      </AccordionSection>
      
      <AccordionSection id="ai" title="AI Features" openSection={openSection} setOpenSection={setOpenSection}>
          <ToggleSwitch
              label="Enable AI Content Generation"
              checked={aiFeaturesEnabled}
              onChange={setAiFeaturesEnabled}
              description="Allows using AI to generate series and questions."
          />
      </AccordionSection>
      
      <AccordionSection id="danger" title="Danger Zone" openSection={openSection} setOpenSection={setOpenSection} isDanger>
        <div className="space-y-6">
            <div>
                <h4 className="font-semibold text-text">Reset Deck Progress</h4>
                <p className="text-text-muted my-2 text-sm">
                  This will reset all spaced repetition data (due dates, intervals) for one or more decks. The cards themselves will not be deleted.
                </p>
                <Button variant="danger" onClick={onResetProgress}>
                    <Icon name="refresh-ccw" className="w-4 h-4 mr-2"/>
                    Reset Progress...
                </Button>
            </div>
             <div className="border-t border-red-500/30 pt-6">
                <h4 className="font-semibold text-text">Factory Reset</h4>
                <p className="text-text-muted my-2 text-sm">
                  Permanently delete all of your decks, folders, series, and settings. This action cannot be undone.
                </p>
                <Button variant="danger" onClick={onFactoryReset}>
                    <Icon name="trash-2" className="w-4 h-4 mr-2"/>
                    Factory Reset...
                </Button>
            </div>
            <div className="border-t border-red-500/30 pt-6">
                <h4 className="font-semibold text-text">Hard Reload & Clear Cache</h4>
                <p className="text-text-muted my-2 text-sm">
                  Force a full reload of the application and clear all cached data. Use this if you are experiencing display issues or outdated content.
                </p>
                <Button variant="danger" onClick={handleHardReload}>
                    <Icon name="zap" className="w-4 h-4 mr-2"/>
                    Clear Cache & Reload
                </Button>
            </div>
        </div>
      </AccordionSection>

      <div className="text-center text-xs text-text-muted pt-4 pb-2">
        <p>CogniFlow v1.2.0</p>
      </div>
    </div>
  );
};