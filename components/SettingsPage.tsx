import React, { useState, useEffect, useCallback } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import ToggleSwitch from './ui/ToggleSwitch';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import * as gdrive from '../services/googleDriveService';
import Spinner from './ui/Spinner';
import { GoogleDriveFile } from '../types';
import { formatUTCToStockholmString } from '../services/time';

interface SettingsPageProps {
  onExport: () => void;
  onRestore: () => void;
  onRestoreData: (data: gdrive.RestoreData) => Promise<void>;
  onResetProgress: () => void;
  onFactoryReset: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onExport, onRestore, onRestoreData, onResetProgress, onFactoryReset }) => {
  const { disableAnimations, setDisableAnimations, hapticsEnabled, setHapticsEnabled } = useSettings();
  const { addToast } = useToast();

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
          gdrive.attemptSilentSignIn();
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

  return (
    <>
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-4">Settings</h2>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Appearance</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Customize the look and feel of the application.
        </p>
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
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Data Management</h3>
        
        <div className="space-y-6">
            {/* Local Backup */}
            <div>
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">Local File Backup</h4>
              <p className="text-gray-600 dark:text-gray-400 my-2">
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

            <div className="border-t border-gray-200 dark:border-gray-700/60 pt-6">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">Google Drive Cloud Backup</h4>
              <p className="text-gray-600 dark:text-gray-400 my-2">
                Securely back up and restore your data to a private folder in your Google Drive.
              </p>
              {!gdriveState.isReady ? (
                <div className="h-10 flex items-center">
                  <Spinner size="sm" /> 
                  <span className="ml-2 text-gray-500 dark:text-gray-400">Initializing Google Drive...</span>
                </div>
              ) : gdriveState.isSignedIn ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <img src={gdriveState.user?.picture} alt="User profile" className="w-10 h-10 rounded-full"/>
                        <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">{gdriveState.user?.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{gdriveState.user?.email}</p>
                        </div>
                        <Button variant="ghost" onClick={handleDriveSignOut} className="ml-auto">Sign Out</Button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button onClick={handleDriveBackup} variant="secondary" className="w-full sm:w-auto" disabled={gdriveState.isProcessing}>
                        <Icon name="upload-cloud" className="w-5 h-5 mr-2" />
                        {gdriveState.isProcessing ? 'Backing up...' : 'Backup to Drive Now'}
                      </Button>
                    </div>

                    <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700/50">
                        <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Available Backups</h5>
                        {isListingFiles ? (
                            <div className="flex items-center text-gray-500 dark:text-gray-400">
                                <Spinner size="sm" />
                                <span className="ml-2">Loading backups...</span>
                            </div>
                        ) : driveFiles.length > 0 ? (
                           <ul className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2">
                            {driveFiles.map(file => (
                                <li key={file.id} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                    <div className="min-w-0 mr-2">
                                        <p className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate" title={file.name}>{file.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatUTCToStockholmString(file.modifiedTime)}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                        <Button size="sm" variant="secondary" onClick={() => handleConfirmRestore(file)} disabled={gdriveState.isProcessing}>
                                            <Icon name="download" className="w-4 h-4 mr-1"/> Restore
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDriveDelete(file)}
                                            disabled={gdriveState.isProcessing}
                                            aria-label={`Delete backup file ${file.name}`}
                                            className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-2 h-auto"
                                            title="Delete backup"
                                        >
                                            <Icon name="trash-2" className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                           </ul>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No backups found in Google Drive.</p>
                        )}
                    </div>
                </div>
              ) : (
                <Button onClick={handleManualSignIn} variant="secondary" disabled={gdriveState.isProcessing}>
                  <Icon name="google" className="w-5 h-5 mr-2" />
                  {gdriveState.isProcessing ? 'Signing in...' : 'Sign in with Google'}
                </Button>
              )}
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Cache Management</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          If you are experiencing issues, clearing the cache can help. You must reload the page afterwards for changes to take full effect.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={() => handleClearCache('APP')} variant="secondary" className="w-full sm:w-auto">
            <Icon name="broom" className="w-5 h-5 mr-2" />
            Clear App Cache
          </Button>
          <Button onClick={() => handleClearCache('CDN')} variant="secondary" className="w-full sm-w-auto">
            <Icon name="broom" className="w-5 h-5 mr-2" />
            Clear CDN & Library Cache
          </Button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            "App Cache" stores the main interface files. "CDN Cache" stores third-party libraries like React.
        </p>
         <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
            <Button variant="danger" onClick={handleHardReload} className="w-full">
                <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
                Hard Reload (Clear All Caches & Refresh)
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Use this if you are still experiencing issues after clearing individual caches. This is the most forceful option.
            </p>
        </div>
      </div>

      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-red-400 dark:text-red-300 mb-2">Danger Zone</h3>
        <div>
            <h4 className="font-semibold text-red-400 dark:text-red-300">Reset Deck Progress</h4>
            <p className="text-sm text-red-500/80 dark:text-red-300/80 mt-2 mb-4">
            This will reset the spaced repetition data (due dates, intervals) for all items in a selected deck, without deleting the cards themselves.
            </p>
            <Button variant="danger" onClick={onResetProgress}>
            <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
            Reset Deck Progress...
            </Button>
        </div>
        <div className="mt-6 pt-6 border-t border-red-500/30">
            <h4 className="font-semibold text-red-400 dark:text-red-300">Factory Reset</h4>
            <p className="text-sm text-red-500/80 dark:text-red-300/80 mt-2 mb-4">
                This will permanently delete all local data, including all decks, folders, series, and settings. The application will be restored to its original state.
            </p>
            <Button variant="danger" onClick={onFactoryReset}>
                <Icon name="trash-2" className="w-5 h-5 mr-2" />
                Reset Application Data
            </Button>
        </div>
      </div>
    </div>
    </>
  );
};

export default SettingsPage;