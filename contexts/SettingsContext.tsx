import React, { createContext, useState, ReactNode, useCallback } from 'react';

interface SettingsContextType {
  disableAnimations: boolean;
  setDisableAnimations: (disabled: boolean) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
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

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [disableAnimations, setDisableAnimationsState] = useState<boolean>(() => getInitialState('cogniflow-disableAnimations', false));
  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(() => getInitialState('cogniflow-hapticsEnabled', true));

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

  const value = { disableAnimations, setDisableAnimations, hapticsEnabled, setHapticsEnabled };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};