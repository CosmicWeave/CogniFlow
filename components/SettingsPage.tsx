import React, { useState, useEffect } from 'react';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import ToggleSwitch from './ui/ToggleSwitch.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import { useTheme } from '../contexts/ThemeContext.tsx';
import ThemeToggle from './ui/ThemeToggle.tsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/Accordion.tsx';
import { useToast } from '../hooks/useToast.ts';
import { getSyncLog, clearSyncLog } from '../services/syncLogService.ts';
import { SyncLogEntry } from '../types';
import ThemeBuilderModal from './ThemeBuilderModal.tsx';
import { useData } from '../contexts/DataManagementContext.tsx';
import * as aiService from '../services/aiService';
import Spinner from './ui/Spinner';

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

const getLogIcon = (type: SyncLogEntry['type']) => {
    switch (type) {
        case 'success': return <Icon name="check-circle" className="w-4 h-4 text-green-500" />;
        case 'info': return <Icon name="info" className="w-4 h-4 text-blue-500" />;
        case 'warning': return <Icon name="zap" className="w-4 h-4 text-yellow-500" />;
        case 'error': return <Icon name="x-circle" className="w-4 h-4 text-red-500" />;
    }
};


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
  const { themeId, setThemeById, addCustomTheme } = useTheme();
  const [hasRevertBackup, setHasRevertBackup] = useState(false);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [isThemeBuilderOpen, setIsThemeBuilderOpen] = useState(false);
  const [shiftDays, setShiftDays] = useState(1);
  const { addToast } = useToast();
  const dataHandlers = useData();
  
  // AI Service State
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ type: 'idle' | 'ok' | 'error', message?: string }>({ type: 'idle' });
  const [hasAiStudioKey, setHasAiStudioKey] = useState<boolean | null>(null);

  // Local state for password input to allow typing without constant re-renders/commits
  const [passwordInput, setPasswordInput] = useState(settings.encryptionPassword);

  useEffect(() => {
    if (localStorage.getItem('cogniflow-pre-fetch-backup')) {
        setHasRevertBackup(true);
    }
    setSyncLog(getSyncLog());
    
    // Check AI Studio state
    if ((window as any).aistudio?.hasSelectedApiKey) {
        (window as any).aistudio.hasSelectedApiKey().then(setHasAiStudioKey);
    }
  }, []);

  const handleTestApi = async () => {
      setIsTestingApi(true);
      setApiStatus({ type: 'idle' });
      try {
          const result = await aiService.testConnectivity();
          setApiStatus({ type: result.status === 'ok' ? 'ok' : 'error', message: result.message });
      } catch (e) {
          setApiStatus({ type: 'error', message: 'Failed to initiate connectivity test.' });
      } finally {
          setIsTestingApi(false);
      }
  };

  const handleOpenAiStudioKey = async () => {
      if ((window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setHasAiStudioKey(hasKey);
      }
  };

  const handleClearLog = () => {
    clearSyncLog();
    setSyncLog([]);
    addToast('sync log cleared.', 'success');
  };
  
  const handlePasswordBlur = () => {
      settings.setEncryptionPassword(passwordInput);
      if (passwordInput && passwordInput !== settings.encryptionPassword) {
          addToast('Encryption password saved.', 'success');
      }
  };

  const handleShiftSchedule = () => {
      if (dataHandlers?.handleShiftSchedule) {
          dataHandlers.handleShiftSchedule(shiftDays);
      }
  };
  
  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-8">
      <h1 className="text-3xl font-bold text-text border-b border-border pb-4">Settings</h1>

      <Accordion type="multiple" defaultValue={['srs', 'appearance', 'ai-engine', 'general', 'cloud-sync', 'gdrive-backup', 'data-management', 'cache-management']} className="w-full space-y-4">
        
        <AccordionItem value="srs" className="border border-border rounded-lg overflow-hidden">
            <AccordionTrigger>
                <h2 className="text-2xl font-semibold text-text">Spaced Repetition</h2>
            </AccordionTrigger>
            <AccordionContent className="bg-surface p-6 space-y-6">
                <div>
                    <h3 className="text-base font-semibold text-text mb-2">Leech Handling</h3>
                    <p className="text-sm text-text-muted mb-4">"Leeches" are cards you repeatedly forget. Configure how the app handles them.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Leech Threshold (Lapses)</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="99" 
                                value={settings.leechThreshold} 
                                onChange={(e) => settings.setLeechThreshold(Math.max(1, parseInt(e.target.value) || 8))}
                                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Action on Leech</label>
                            <select 
                                value={settings.leechAction} 
                                onChange={(e) => settings.setLeechAction(e.target.value as any)}
                                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                            >
                                <option value="suspend">Suspend Card</option>
                                <option value="tag">Tag as "Leech"</option>
                                <option value="warn">Just Warn Me</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-border">
                    <h3 className="text-base font-semibold text-text mb-2">Vacation Mode / Schedule Shift</h3>
                    <p className="text-sm text-text-muted mb-4">Push all due dates forward by a set number of days. Useful if you missed studying or plan to take a break.</p>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-text-muted">Shift by:</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="365"
                            value={shiftDays}
                            onChange={(e) => setShiftDays(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                        <span className="text-sm text-text-muted">days</span>
                        <Button variant="secondary" onClick={handleShiftSchedule}>
                            <Icon name="calendar" className="w-4 h-4 mr-2" /> Shift Schedule
                        </Button>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ai-engine" className="border border-border rounded-lg overflow-hidden">
            <AccordionTrigger>
                <h2 className="text-2xl font-semibold text-text">AI Engine & Quota</h2>
            </AccordionTrigger>
            <AccordionContent className="bg-surface p-6 space-y-6">
                <div>
                    <h3 className="text-base font-semibold text-text mb-2">Gemini Service Status</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-background rounded-lg border border-border">
                        <div className={`p-3 rounded-full ${apiStatus.type === 'ok' ? 'bg-green-100 text-green-600' : apiStatus.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Icon name={apiStatus.type === 'ok' ? 'check-circle' : apiStatus.type === 'error' ? 'x-circle' : 'zap'} className="w-8 h-8" />
                        </div>
                        <div className="flex-grow text-center sm:text-left">
                            <p className="font-bold text-text">
                                {apiStatus.type === 'ok' ? 'Service Connected' : apiStatus.type === 'error' ? 'Connection Error' : 'Ready to Test'}
                            </p>
                            <p className="text-xs text-text-muted mt-1 leading-relaxed">
                                {apiStatus.message || 'The Gemini API handles course synthesis, factual grounding, and diagram generation.'}
                            </p>
                            {hasAiStudioKey !== null && (
                                <p className="text-[10px] uppercase font-bold mt-2 tracking-widest text-primary">
                                    {hasAiStudioKey ? 'Personal API Key Selected' : 'Using Global Shared Key'}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                            <Button variant="primary" size="sm" onClick={handleTestApi} disabled={isTestingApi}>
                                {isTestingApi ? <Spinner size="sm" /> : 'Verify Connection'}
                            </Button>
                            {(window as any).aistudio?.openSelectKey && (
                                <Button variant="secondary" size="sm" onClick={handleOpenAiStudioKey}>
                                    Change API Key
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-border">
                    <h3 className="text-base font-semibold text-text mb-4">Standard Rate Limits (Free Tier)</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="pb-2 font-bold text-text-muted uppercase tracking-tighter">Model / Feature</th>
                                    <th className="pb-2 font-bold text-text-muted uppercase tracking-tighter">RPM</th>
                                    <th className="pb-2 font-bold text-text-muted uppercase tracking-tighter">TPM</th>
                                    <th className="pb-2 font-bold text-text-muted uppercase tracking-tighter">RPD</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                <tr>
                                    <td className="py-2 pr-4 font-semibold text-text">Gemini 3 Flash (Core Engine)</td>
                                    <td className="py-2 pr-4 text-text-muted">15</td>
                                    <td className="py-2 pr-4 text-text-muted">1M</td>
                                    <td className="py-2 text-text-muted">1,500</td>
                                </tr>
                                <tr>
                                    <td className="py-2 pr-4 font-semibold text-text">Gemini 3 Pro (Hyper-Reasoning)</td>
                                    <td className="py-2 pr-4 text-text-muted">2</td>
                                    <td className="py-2 pr-4 text-text-muted">32K</td>
                                    <td className="py-2 text-text-muted">50</td>
                                </tr>
                                <tr>
                                    <td className="py-2 pr-4 font-semibold text-text">Imagen / Grounded Media</td>
                                    <td className="py-2 pr-4 text-text-muted">5</td>
                                    <td className="py-2 pr-4 text-text-muted">-</td>
                                    <td className="py-2 text-text-muted">1,500</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[10px] text-text-muted mt-3 italic leading-relaxed">
                        RPM: Requests Per Minute. TPM: Tokens Per Minute. RPD: Requests Per Day. 
                        Limits apply per API key. If you hit these, CogniFlow will pause and retry automatically.
                    </p>
                </div>
            </AccordionContent>
        </AccordionItem>

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
              
              <div className="pt-2 border-t border-border mt-4">
                 <h3 className="text-sm font-semibold text-text-muted mb-2">Encryption (Optional)</h3>
                 <label htmlFor="encryption-password" className="block text-sm font-medium text-text-muted mb-1">
                    Encryption Password
                 </label>
                 <div className="flex gap-2">
                     <input
                      id="encryption-password"
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      onBlur={handlePasswordBlur}
                      className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                      disabled={!settings.backupEnabled}
                      placeholder="Enter a password to encrypt your cloud backups"
                    />
                 </div>
                 <p className="text-xs text-text-muted mt-1">If set, your data will be encrypted on your device before uploading. You MUST use the same password on all devices to decrypt your data.</p>
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
        
        <AccordionItem value="sync-history" className="border border-border rounded-lg overflow-hidden">
          <AccordionTrigger>
             <h2 className="text-2xl font-semibold text-text">Sync History</h2>
          </AccordionTrigger>
          <AccordionContent className="bg-surface p-6 space-y-4">
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={handleClearLog}>Clear Log</Button>
              </div>
              {syncLog.length > 0 ? (
                <ul className="space-y-2 max-h-64 overflow-y-auto bg-background p-3 rounded-md border border-border">
                  {syncLog.map(log => (
                    <li key={log.timestamp} className="flex items-start gap-3 text-sm">
                      <div className="flex-shrink-0 mt-0.5">{getLogIcon(log.type)}</div>
                      <div className="flex-grow">
                          <p className="text-text">{log.message}</p>
                          <p className="text-xs text-text-muted">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-text-muted py-4">No sync history yet.</p>
              )}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="appearance" className="border border-border rounded-lg overflow-hidden">
          <AccordionTrigger>
            <h2 className="text-2xl font-semibold text-text">Appearance</h2>
          </AccordionTrigger>
          <AccordionContent className="bg-surface p-6 space-y-6">
            <ThemeToggle 
                selectedTheme={themeId} 
                onThemeChange={setThemeById} 
                onOpenBuilder={() => setIsThemeBuilderOpen(true)}
            />
            
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text-muted">Font Style</label>
                <div className="flex bg-background rounded-md p-1 border border-border">
                    {(['sans', 'serif', 'mono'] as const).map(font => (
                        <button
                            key={font}
                            onClick={() => settings.setFontFamily(font)}
                            className={`flex-1 py-1.5 px-3 text-sm rounded transition-colors ${settings.fontFamily === font ? 'bg-primary text-on-primary shadow-sm' : 'text-text hover:bg-border/50'}`}
                        >
                            <span className={`font-${font} capitalize`}>{font}</span>
                        </button>
                    ))}
                </div>
            </div>

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
              label="Daily Notifications"
              description="Receive local reminders when you have cards due."
              checked={settings.notificationsEnabled}
              onChange={settings.setNotificationsEnabled}
            />
            
            <div className="pt-4 border-t border-border">
                <ToggleSwitch
                label="Enable AI Features"
                description="Allows basic content generation using the Gemini API."
                checked={settings.aiFeaturesEnabled}
                onChange={settings.setAiFeaturesEnabled}
                />
                
                {settings.aiFeaturesEnabled && (
                    <div className="mt-6 space-y-4 pl-4 border-l-2 border-primary/20 animate-fade-in">
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Hyper-Course Advanced Features</h3>
                        <ToggleSwitch
                            label="Process Visualization Loops (Veo)"
                            description="Use Veo 3.1 to generate educational cinematic loops for complex transformations."
                            checked={settings.veoEnabled}
                            onChange={settings.setVeoEnabled}
                        />
                        <ToggleSwitch
                            label="Grounded Fidelity Images"
                            description="Use Search-grounded image agents for historically and scientifically accurate illustrations."
                            checked={settings.groundedImagesEnabled}
                            onChange={settings.setGroundedImagesEnabled}
                        />
                        <ToggleSwitch
                            label="Epistemic Search Audits"
                            description="Use Agentic Search to verify every technical and scientific claim made during course synthesis."
                            checked={settings.searchAuditsEnabled}
                            onChange={settings.setSearchAuditsEnabled}
                        />
                    </div>
                )}
            </div>
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
        
        <AccordionItem value="developer-tools" className="border border-border rounded-lg overflow-hidden">
            <AccordionTrigger>
                <h2 className="text-2xl font-semibold text-text">Developer Tools</h2>
            </AccordionTrigger>
            <AccordionContent className="bg-surface p-6 flex flex-wrap gap-4 justify-center">
                <Button 
                variant="secondary" 
                onClick={() => {
                    if (typeof (window as any).runBackupServiceTests === 'function') {
                        addToast('Running backup service tests... Check the console for results.', 'info');
                        (window as any).runBackupServiceTests();
                    } else {
                        addToast('Test runner function not found.', 'error');
                    }
                }}
                >
                <Icon name="terminal" className="mr-2"/> Run API Tests
                </Button>
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
      
      {isThemeBuilderOpen && (
          <ThemeBuilderModal 
            isOpen={isThemeBuilderOpen}
            onClose={() => setIsThemeBuilderOpen(false)}
            onSave={addCustomTheme}
          />
      )}
    </div>
  );
};
