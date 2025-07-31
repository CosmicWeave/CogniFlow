import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Icon, { IconName } from './Icon';
import Button from './Button';

type ThemeMode = 'light' | 'dark' | 'system';

const ThemeToggle: React.FC = () => {
  const { themeMode, cycleThemeMode } = useTheme();

  const iconMap: Record<ThemeMode, IconName> = {
    light: 'sun',
    dark: 'moon',
    system: 'monitor',
  };

  const labelMap: Record<ThemeMode, string> = {
    light: 'Switch to dark mode',
    dark: 'Switch to system default',
    system: 'Switch to light mode',
  };

  return (
    <Button
      variant="ghost"
      onClick={cycleThemeMode}
      className="p-2 h-auto"
      aria-label={labelMap[themeMode]}
      title={labelMap[themeMode]}
    >
      <Icon name={iconMap[themeMode]} className="w-5 h-5" />
    </Button>
  );
};

export default ThemeToggle;
