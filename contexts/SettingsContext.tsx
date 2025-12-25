import React, { createContext, useState, ReactNode, useCallback } from 'react';

export type LeechAction = 'suspend' | 'tag' | 'warn';

interface SettingsContextType {
  disableAnimations: boolean;
  setDisableAnimations: (disabled: boolean) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  aiFeaturesEnabled: boolean;
  setAiFeaturesEnabled: (enabled: boolean) => void;
  veoEnabled: boolean;
  setVeoEnabled: (enabled: boolean) => void;
  groundedImagesEnabled: boolean;
  setGroundedImagesEnabled: (enabled: boolean) => void;
  searchAuditsEnabled: boolean;
  setSearchAuditsEnabled: (enabled: boolean) => void;
  backupEnabled: boolean;
  setBackupEnabled: (enabled: boolean) => void;
  backupApiKey: string;
  setBackupApiKey: (key: string) => void;
  encryptionPassword: string;
  setEncryptionPassword: (password: string) => void;
  syncOnCellular: boolean;
  setSyncOnCellular: (enabled: boolean) => void;
  fontFamily: 'sans' | 'serif' | 'mono';
  setFontFamily: (font: 'sans' | 'serif' | 'mono') => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  // SRS Settings
  leechThreshold: number;
  setLeechThreshold: (threshold: number) => void;
  leechAction: LeechAction;
  setLeechAction: (action: LeechAction) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const getInitialState = (key: string, defaultValue: any): any => {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error reading ${key} from localStorage`, error);
        return defaultValue;
    }
};

const getInitialAiState = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        const item = window.localStorage.getItem('cogniflow-aiFeaturesEnabled');
        // If a value is explicitly saved in localStorage, respect it.
        if (item !== null) {
            return JSON.parse(item) === true;
        }
        // Otherwise, determine the default based on the hostname.
        if (window.location.origin.endsWith('aistudio.google.com') || window.location.origin.endsWith('scf.usercontent.goog')) {
            return true;
        }
        // Default for all other hostnames.
        return false;
    } catch (error) {
        console.error(`Error reading cogniflow-aiFeaturesEnabled from localStorage`, error);
        // Fallback in case of error.
        return false;
    }
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [disableAnimations, setDisableAnimationsState] = useState<boolean>(() => getInitialState('cogniflow-disableAnimations', false));
  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(() => getInitialState('cogniflow-hapticsEnabled', true));
  const [aiFeaturesEnabled, setAiFeaturesEnabledState] = useState<boolean>(getInitialAiState);
  
  // Advanced AI Features - Off by default
  const [veoEnabled, setVeoEnabledState] = useState<boolean>(() => getInitialState('cogniflow-veoEnabled', false));
  const [groundedImagesEnabled, setGroundedImagesEnabledState] = useState<boolean>(() => getInitialState('cogniflow-groundedImagesEnabled', false));
  const [searchAuditsEnabled, setSearchAuditsEnabledState] = useState<boolean>(() => getInitialState('cogniflow-searchAuditsEnabled', false));

  const [backupEnabled, setBackupEnabledState] = useState<boolean>(() => getInitialState('cogniflow-backupEnabled', true));
  const [backupApiKey, setBackupApiKeyState] = useState<string>(() => {
    try {
        return window.localStorage.getItem('cogniflow-backupApiKey') || 'qRt+gU/57GHKhxTZeRnRi+dfT274iSkKKq2UnTr9Bxs=';
    } catch (e) {
        return 'qRt+gU/57GHKhxTZeRnRi+dfT274iSkKKq2UnTr9Bxs=';
    }
  });
  const [encryptionPassword, setEncryptionPasswordState] = useState<string>(() => {
      try {
          return window.localStorage.getItem('cogniflow-encryptionPassword') || '';
      } catch (e) {
          return '';
      }
  });
  const [syncOnCellular, setSyncOnCellularState] = useState<boolean>(() => getInitialState('cogniflow-syncOnCellular', true));
  const [fontFamily, setFontFamilyState] = useState<'sans' | 'serif' | 'mono'>(() => {
      try {
          return (window.localStorage.getItem('cogniflow-fontFamily') as 'sans' | 'serif' | 'mono') || 'sans';
      } catch (e) {
          return 'sans';
      }
  });
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() => getInitialState('cogniflow-notificationsEnabled', false));
  
  // SRS Settings
  const [leechThreshold, setLeechThresholdState] = useState<number>(() => getInitialState('cogniflow-leechThreshold', 8));
  const [leechAction, setLeechActionState] = useState<LeechAction>(() => getInitialState('cogniflow-leechAction', 'suspend'));


  const setDisableAnimations = useCallback((disabled: boolean) => {
    setDisableAnimationsState(disabled);
    try {
      window.localStorage.setItem('cogniflow-disableAnimations', JSON.stringify(disabled));
    } catch (error) {
      console.error('Error writing animation setting to localStorage', error);
    }
  }, []);

  const setHapticsEnabled = useCallback((enabled: boolean) => {
    setHapticsEnabledState(enabled);
    try {
        window.localStorage.setItem('cogniflow-hapticsEnabled', JSON.stringify(enabled));
    } catch (error) {
        console.error('Error writing haptics setting to localStorage', error);
    }
  }, []);
  
  const setAiFeaturesEnabled = useCallback((enabled: boolean) => {
    setAiFeaturesEnabledState(enabled);
    try {
        window.localStorage.setItem('cogniflow-aiFeaturesEnabled', JSON.stringify(enabled));
    } catch (error) {
        console.error('Error writing AI features setting to localStorage', error);
    }
  }, []);

  const setVeoEnabled = useCallback((enabled: boolean) => {
    setVeoEnabledState(enabled);
    try {
        window.localStorage.setItem('cogniflow-veoEnabled', JSON.stringify(enabled));
    } catch (error) {
        console.error('Error writing veo setting to localStorage', error);
    }
  }, []);

  const setGroundedImagesEnabled = useCallback((enabled: boolean) => {
    setGroundedImagesEnabledState(enabled);
    try {
        window.localStorage.setItem('cogniflow-groundedImagesEnabled', JSON.stringify(enabled));
    } catch (error) {
        console.error('Error writing groundedImages setting to localStorage', error);
    }
  }, []);

  const setSearchAuditsEnabled = useCallback((enabled: boolean) => {
    setSearchAuditsEnabledState(enabled);
    try {
        window.localStorage.setItem('cogniflow-searchAuditsEnabled', JSON.stringify(enabled));
    } catch (error) {
        console.error('Error writing searchAudits setting to localStorage', error);
    }
  }, []);
  
  const setBackupEnabled = useCallback((enabled: boolean) => {
    setBackupEnabledState(enabled);
    try {
        window.localStorage.setItem('cogniflow-backupEnabled', JSON.stringify(enabled));
    } catch (error) {
        console.error('Error writing backup enabled setting to localStorage', error);
    }
  }, []);

  const setBackupApiKey = useCallback((key: string) => {
    setBackupApiKeyState(key);
    try {
        window.localStorage.setItem('cogniflow-backupApiKey', key);
    } catch (error) {
        console.error('Error writing backup API key to localStorage', error);
    }
  }, []);

  const setEncryptionPassword = useCallback((password: string) => {
      setEncryptionPasswordState(password);
      try {
          if (password) {
              window.localStorage.setItem('cogniflow-encryptionPassword', password);
          } else {
              window.localStorage.removeItem('cogniflow-encryptionPassword');
          }
      } catch (error) {
          console.error('Error writing encryption password to localStorage', error);
      }
  }, []);

  const setSyncOnCellular = useCallback((enabled: boolean) => {
    setSyncOnCellularState(enabled);
    try {
        window.localStorage.setItem('cogniflow-syncOnCellular', JSON.stringify(enabled));
    } catch (error) {
        console.error('Error writing syncOnCellular setting to localStorage', error);
    }
  }, []);

  const setFontFamily = useCallback((font: 'sans' | 'serif' | 'mono') => {
      setFontFamilyState(font);
      try {
          window.localStorage.setItem('cogniflow-fontFamily', font);
      } catch (error) {
          console.error('Error writing fontFamily setting to localStorage', error);
      }
  }, []);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
      setNotificationsEnabledState(enabled);
      try {
          window.localStorage.setItem('cogniflow-notificationsEnabled', JSON.stringify(enabled));
          if (enabled && 'Notification' in window && Notification.permission !== 'granted') {
              Notification.requestPermission().then(permission => {
                  if (permission !== 'granted') {
                      setNotificationsEnabledState(false);
                      window.localStorage.setItem('cogniflow-notificationsEnabled', JSON.stringify(false));
                  }
              });
          }
      } catch (error) {
          console.error('Error writing notifications setting to localStorage', error);
      }
  }, []);

  const setLeechThreshold = useCallback((threshold: number) => {
      setLeechThresholdState(threshold);
      try {
          window.localStorage.setItem('cogniflow-leechThreshold', JSON.stringify(threshold));
      } catch (error) {
          console.error('Error writing leechThreshold to localStorage', error);
      }
  }, []);

  const setLeechAction = useCallback((action: LeechAction) => {
      setLeechActionState(action);
      try {
          window.localStorage.setItem('cogniflow-leechAction', JSON.stringify(action));
      } catch (error) {
          console.error('Error writing leechAction to localStorage', error);
      }
  }, []);


  const value = { 
      disableAnimations, setDisableAnimations, 
      hapticsEnabled, setHapticsEnabled, 
      aiFeaturesEnabled, setAiFeaturesEnabled, 
      veoEnabled, setVeoEnabled,
      groundedImagesEnabled, setGroundedImagesEnabled,
      searchAuditsEnabled, setSearchAuditsEnabled,
      backupEnabled, setBackupEnabled, 
      backupApiKey, setBackupApiKey, 
      encryptionPassword, setEncryptionPassword,
      syncOnCellular, setSyncOnCellular, 
      fontFamily, setFontFamily,
      notificationsEnabled, setNotificationsEnabled,
      leechThreshold, setLeechThreshold,
      leechAction, setLeechAction
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
