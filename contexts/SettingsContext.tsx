import React, { createContext, useState, ReactNode, useCallback } from 'react';

interface SettingsContextType {
  disableAnimations: boolean;
  setDisableAnimations: (disabled: boolean) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  aiFeaturesEnabled: boolean;
  setAiFeaturesEnabled: (enabled: boolean) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const getInitialState = (key: string, defaultValue: boolean): boolean => {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) === true : defaultValue;
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

  const value = { disableAnimations, setDisableAnimations, hapticsEnabled, setHapticsEnabled, aiFeaturesEnabled, setAiFeaturesEnabled };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
