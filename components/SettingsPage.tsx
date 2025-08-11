import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import ToggleSwitch from './ui/ToggleSwitch';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import * as gdrive from '../services/googleDriveService';
import Spinner from './ui/Spinner';
import { GoogleDriveFile } from '../types';
import { formatUTCToStockholmString } from '../services/time';
import { useTheme, themes } from '../contexts/ThemeContext';

interface SettingsPageProps {
  onExport: () => void;
  onRestore: () => void;
  onRestoreData: (data: gdrive.RestoreData) => Promise<void>;
  onResetProgress: () => void;
  onFactoryReset: () => void;
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
    const borderClasses = isDanger 
        ? "border border-red-500/30"
        : "border border-border";

    return (
        <div className={`rounded-lg shadow-md overflow-hidden ${borderClasses}`}>
            <button
                onClick={() => setOpenSection(isOpen ? null : id)}
                className={`w-full flex justify-between items-center text-left p-6 ${headerClasses}`}
                aria-expanded={isOpen}
            >
                <h3 className="text-xl font-semibold">{title}</h3>
                <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'} text-text-muted`} />
            </button>
            {isOpen && (
                <div className={`p-6 pt-0 animate-fade-in ${isDanger ? 'bg-red-900/10' : 'bg-surface'}`}>
                    <div className="pt-6 border-t border-border">{children}</div>
                </div>
            )}
        </div>
    );
};


export const SettingsPage: React.FC<SettingsPageProps> = ({ onExport, onRestore, onRestoreData, onResetProgress, onFactoryReset }) => {
  const { disableAnimations, setDisableAnimations, hapticsEnabled, setHapticsEnabled } = useSettings();
  const { addToast } = useToast();
  const { themeId, setThemeById } = useTheme();
  const [openSection, setOpenSection] = useState<string | null>('data');

  const [gdriveState, setGdriveState] = useState({
    isReady: false,
    isSignedIn: false,
    isProcessing: false,
    user: null as any,
  });
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isListingFiles, setIsListingFiles] = useState(false);

  const fetchDriveFiles = useCallback(async () => {
    setIsListingFiles(true);
    try {
        const files = await gdrive.listFiles();
        setDriveFiles(files);
    } catch (e: any) {
        addToast(`Could not list files: ${e.message || 'Unknown error'}`, 'error');
        setDriveFiles([]); // Clear files on error
    } finally {
        setIsListingFiles(false);
    }
  }, [addToast]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        await gdrive.initGoogleDriveService();
        if (isMounted) {
          const previouslySignedIn = localStorage.getItem('gdrive-previously-signed-in') === 'true';
          if (previouslySignedIn) {
            gdrive.attemptSilentSignIn();
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to initialize Google Drive service", error);
          addToast("Could not initialize Google Drive.", "error");
          setGdriveState(s => ({ ...s, isReady: false, isProcessing: false }));
        }
      }
    };

    initialize();
    
    const readySub = gdrive.onGapiReady((isReady) => {
        if (isMounted) setGdriveState(s => ({ ...s, isReady }));
    });
    
    const authSub = gdrive.onAuthStateChanged((isSignedIn, user) => {
        if(isMounted) {
          setGdriveState(s => ({ ...s, isSignedIn, user, isProcessing: false }));
          if (isSignedIn) {
              fetchDriveFiles();
          } else {
              setDriveFiles([]);
          }
        }
    });

    return () => {
        isMounted = false;
        readySub();
        authSub();
    };
  }, [addToast, fetchDriveFiles]);

  const handleManualSignIn = () => {
    setGdriveState(s => ({ ...s, isProcessing: true }));
    gdrive.requestManualSignIn();
  };
  
  const handleDriveSignOut = () => {
    gdrive.signOut();
  };
  
  const handleDriveBackup = async () => {
    setGdriveState(s => ({ ...s, isProcessing: true }));
    try {
        const newFile = await gdrive.backup();
        addToast('Successfully backed up data to Google Drive.', 'success');
        setDriveFiles(prevFiles => [newFile, ...prevFiles]);
    } catch (e: any) {
        console.error("Google Drive Backup failed", e);
        addToast(`Backup failed: ${e.message || 'Unknown error'}`, 'error');
    } finally {
        setGdriveState(s => ({ ...s, isProcessing: false }));
    }
  };
  
  const handleDriveRestore = async (fileId: string) => {
    setGdriveState(s => ({ ...s, isProcessing: true }));
    try {
      const data = await gdrive.downloadFile(fileId);
      await onRestoreData(data);
    } catch (e: any) {
      addToast(`Restore failed: ${e.message || 'Unknown error'}`, 'error');
    } finally {
      setGdriveState(s => ({ ...s, isProcessing: false }));
    }
  };
  
  const handleConfirmRestore = (file: GoogleDriveFile) => {
    if (window.confirm(`Are you sure you want to restore from "${file.name}"? This will merge and overwrite existing data.`)) {
        handleDriveRestore(file.id);
    }
  };

  const handleDriveDelete = async (file: GoogleDriveFile) => {
    if (!window.confirm(`Are you sure you want to permanently delete the backup "${file.name}"? This action cannot be undone.`)) {
        return;
    }

    setGdriveState(s => ({ ...s, isProcessing: true }));
    try {
        await gdrive.deleteFile(file.id);
        addToast(`Backup "${file.name}" deleted.`, 'success');
        setDriveFiles(prevFiles => prevFiles.filter(f => f.id !== file.id));
    } catch (e: any) {
        console.error("Google Drive Delete failed", e);
        addToast(`Delete failed: ${e.message || 'Unknown error'}`, 'error');
    } finally {
        setGdriveState(s => ({ ...s, isProcessing: false }));
    }
  };

  const handleClearCache = (cacheType: 'APP' | 'CDN') => {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      addToast("Service worker is not active. Please reload the page and try again.", "error");
      return;
    }
    
    const message = {
        type: cacheType === 'APP' ? 'CLEAR_APP_CACHE' : 'CLEAR_CDN_CACHE'
    };
    
    navigator.serviceWorker.controller.postMessage(message);

    addToast(
      `${cacheType} cache cleared. Please reload the page to apply changes.`,
      "success"
    );
  };
  
  const handleHardReload = () => {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      addToast("Service worker is not active. Please reload the page and try again.", "error");
      return;
    }

    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CDN_CACHE' });

    addToast("All caches cleared. The application will now reload.", "info");

    setTimeout(() => {
        window.location.reload();
    }, 1500);
  };
  
  // Memoize to prevent re-render on every state change
  const isSystemDark = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)').matches, []);


  return (
    <>
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <h2 className="text-3xl font-bold mb-6 text-text border-b border-border pb-4">Settings</h2>
      
      <AccordionSection id="data" title="Data Management" openSection={openSection} setOpenSection={setOpenSection}>
          <div className="space-y-6">
              {/* Local Backup */}
              <div id="settings-local-backup">
                <h4 className="font-semibold text-text">Local File Backup</h4>
                <p className="text-text-muted my-2">
                  Backup all your decks and study progress to a JSON file on your device.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={onExport} variant="secondary" className="w-full sm:w-auto">
                    <Icon name="download" className="w-5 h-5 mr-2" />
                    Backup to File
                  </Button>
                  <Button onClick={onRestore} variant="secondary" className="w-full sm:w-auto">
                    <Icon name="upload-cloud" className="w-5 h-5 mr-2" />
                    Restore from File
                  </Button>
                </div>
              </div>

              <div id="google-drive-backup" className="border-t border-border pt-6">
                <h4 className="font-semibold text-text">Google Drive Cloud Backup</h4>
                <p className="text-text-muted my-2">
                  Securely back up and restore your data to a private folder in your Google Drive.
                </p>
                {!gdriveState.isReady ? (
                  <div className="h-10 flex items-center">
                    <Spinner size="sm" /> 
                    <span className="ml-2 text-text-muted">Initializing Google Drive...</span>
                  </div>
                ) : gdriveState.isSignedIn ? (
                  <div className="space-y-4">
                      <div className="flex items-center gap-4">
                          <img src={gdriveState.user?.picture} alt="User profile" className="w-10 h-10 rounded-full"/>
                          <div>
                              <p className="font-semibold text-text">{gdriveState.user?.name}</p>
                              <p className="text-sm text-text-muted">{gdriveState.user?.email}</p>
                          </div>
                          <Button variant="ghost" onClick={handleDriveSignOut} className="ml-auto">Sign Out</Button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={handleDriveBackup} variant="secondary" className="w-full sm:w-auto" disabled={gdriveState.isProcessing}>
                          <Icon name="upload-cloud" className="w-5 h-5 mr-2" />
                          {gdriveState.isProcessing ? 'Backing up...' : 'Backup to Drive Now'}
                        </Button>
                      </div>

                      <div className="pt-4 mt-4 border-t border-border/50">
                          <h5 className="font-semibold text-text mb-2">Available Backups</h5>
                          {isListingFiles ? (
                              <div className="flex items-center text-text-muted">
                                  <Spinner size="sm" />
                                  <span className="ml-2">Loading backups...</span>
                              </div>
                          ) : driveFiles.length > 0 ? (
                             <ul className="space-y-2 max-h-60 overflow-y-auto border border-border rounded-md p-2">
                              {driveFiles.map(file => (
                                  <li key={file.id} className="flex justify-between items-center p-2 rounded-md hover:bg-border/20">
                                      <div className="min-w-0 mr-2">
                                          <p className="font-medium text-sm text-text truncate" title={file.name}>{file.name}</p>
                                          <p className="text-xs text-text-muted">
                                              {formatUTCToStockholmString(file.modifiedTime)}
                                          </p>
                                      </div>
                                      <div className="flex-shrink-0 flex items-center gap-1">
                                          <Button variant="ghost" size="sm" onClick={() => handleConfirmRestore(file)} disabled={gdriveState.isProcessing}>Restore</Button>
                                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDriveDelete(file)} disabled={gdriveState.isProcessing}>Delete</Button>
                                      </div>
                                  </li>
                              ))}
                              </ul>
                          ) : (
                              <p className="text-text-muted text-sm">No backups found in your Google Drive.</p>
                          )}
                          <Button variant="ghost" size="sm" className="mt-2" onClick={fetchDriveFiles} disabled={isListingFiles}>
                            <Icon name="refresh-ccw" className={`w-4 h-4 mr-2 ${isListingFiles ? 'animate-spin' : ''}`} /> Refresh list
                          </Button>
                      </div>
                  </div>
                ) : (
                   <div className="flex flex-col sm:flex-row gap-4">
                      <Button onClick={handleManualSignIn} variant="secondary" disabled={gdriveState.isProcessing}>
                        <Icon name="google" className="w-5 h-5 mr-2" />
                        {gdriveState.isProcessing ? 'Signing in...' : 'Sign in with Google'}
                      </Button>
                    </div>
                )}
              </div>
          </div>
      </AccordionSection>
      
      <AccordionSection id="cache-management" title="Cache Management" openSection={openSection} setOpenSection={setOpenSection}>
           <div id="settings-cache-management" className="space-y-4">
                <p className="text-text-muted">
                    If you are experiencing issues, clearing the cache can help. "Hard Reload" clears all caches and reloads the application, which is the strongest reset option.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="secondary" onClick={() => handleClearCache('APP')}>
                      <Icon name="broom" className="w-5 h-5 mr-2" /> Clear App Cache
                    </Button>
                    <Button variant="secondary" onClick={() => handleClearCache('CDN')}>
                      <Icon name="broom" className="w-5 h-5 mr-2" /> Clear CDN Cache
                    </Button>
                     <Button variant="danger" onClick={handleHardReload}>
                      <Icon name="refresh-ccw" className="w-5 h-5 mr-2" /> Hard Reload
                    </Button>
                </div>
            </div>
      </AccordionSection>
      
      <AccordionSection id="appearance" title="Appearance" openSection={openSection} setOpenSection={setOpenSection}>
          <div className="border-b border-border pb-6 mb-6">
              <h4 className="font-semibold text-text">Theme</h4>
               <p className="text-text-muted my-2">
                  Select a theme to change the application's color scheme. The "System" theme will automatically match your device's light or dark mode.
               </p>
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {themes.map(theme => {
                      const isSelected = themeId === theme.id;
                      const palette = theme.id === 'system' && isSystemDark ? theme.paletteDark! : theme.palette;
                      
                      return (
                          <button
                              key={theme.id}
                              onClick={() => setThemeById(theme.id)}
                              className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                                  isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-border hover:border-primary/70'
                              }`}
                               aria-pressed={isSelected}
                               aria-label={`Select ${theme.name} theme`}
                          >
                              {isSelected && <Icon name="check-circle" className="absolute top-2 right-2 w-5 h-5 text-primary" />}
                              <div className="flex items-center justify-center gap-1.5 mb-2">
                                  <div className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: `rgb(${palette.background})` }}></div>
                                  <div className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: `rgb(${palette.surface})` }}></div>
                                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: `rgb(${palette.primary})` }}></div>
                                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: `rgb(${palette.text})` }}></div>
                              </div>
                              <p className="text-center text-sm font-medium text-text">{theme.name}</p>
                          </button>
                      );
                  })}
               </div>
          </div>
          <div className="space-y-4">
            <ToggleSwitch
              label="Disable card flip animation"
              checked={disableAnimations}
              onChange={setDisableAnimations}
              description="For a faster, no-frills study session."
            />
            <ToggleSwitch
              label="Haptic feedback"
              checked={hapticsEnabled}
              onChange={setHapticsEnabled}
              description="Provides physical feedback on supported devices."
            />
          </div>
      </AccordionSection>

      <AccordionSection id="danger-zone" title="Danger Zone" openSection={openSection} setOpenSection={setOpenSection} isDanger>
          <div className="space-y-6">
              <div id="settings-reset-progress">
                  <h4 className="font-semibold text-red-300">Reset Deck Progress</h4>
                  <p className="text-red-300/80 my-2">
                    This will reset the spaced repetition data (due dates, intervals) for a single deck. The cards themselves will not be deleted.
                  </p>
                  <Button onClick={onResetProgress} variant="danger">
                    <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
                    Reset Deck Progress...
                  </Button>
              </div>

              <div id="settings-factory-reset" className="border-t border-red-500/30 pt-6">
                 <h4 className="font-semibold text-red-300">Factory Reset</h4>
                  <p className="text-red-300/80 my-2">
                    This will permanently delete ALL of your data, including decks, folders, series, and settings. This action cannot be undone.
                  </p>
                  <Button onClick={onFactoryReset} variant="danger">
                    <Icon name="trash-2" className="w-5 h-5 mr-2" />
                    Factory Reset...
                  </Button>
              </div>
          </div>
      </AccordionSection>
    </div>
    </>
  );
};