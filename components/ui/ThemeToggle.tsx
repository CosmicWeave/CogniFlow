
import React from 'react';
import { themes, ThemeId, useTheme, Theme } from '../../contexts/ThemeContext.tsx';
import Icon from './Icon.tsx';

interface ThemeToggleProps {
  selectedTheme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
  onOpenBuilder: () => void;
}

const ThemeSwatch: React.FC<{ theme: Theme, isSelected: boolean, onClick: () => void, onDelete?: () => void }> = ({ theme, isSelected, onClick, onDelete }) => {
    const isSystem = theme.id === 'system';
    const isDark = theme.isDark;
    const lightPalette = isSystem ? theme.palette : theme.palette;
    const darkPalette = isSystem ? theme.paletteDark : (isDark ? theme.palette : null);

    const swatchClass = `w-full h-24 rounded-lg border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between p-2 text-left relative ${isSelected ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border hover:border-text-muted'}`;

    // Helper to format rgb string for css
    const bgStyle = (color: string) => `rgb(${color})`;

    return (
        <div className="relative group">
            <button onClick={onClick} className={swatchClass} aria-pressed={isSelected} aria-label={`Select ${theme.name} theme`}>
                <div className="w-full h-full absolute top-0 left-0 overflow-hidden rounded-[5px]">
                    {isSystem ? (
                        <>
                           <div className="w-1/2 h-full absolute top-0 left-0" style={{ backgroundColor: bgStyle(lightPalette.surface) }}></div>
                           <div className="w-1/2 h-full absolute top-0 right-0" style={{ backgroundColor: bgStyle(darkPalette!.surface) }}></div>
                        </>
                    ) : (
                         <div className="w-full h-full absolute top-0 left-0" style={{ backgroundColor: bgStyle(lightPalette.surface) }}></div>
                    )}
                </div>

                <div className="relative flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs backdrop-blur-sm" style={{ backgroundColor: `rgba(${lightPalette.background.replace(/ /g, ',')}, 0.6)`}}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bgStyle(lightPalette.primary) }}></div>
                        <span style={{ color: bgStyle(lightPalette.text) }}>Aa</span>
                    </div>

                    {isSelected && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary">
                            <Icon name="check-circle" className="w-4 h-4 text-on-primary" />
                        </div>
                    )}
                </div>
                 <div className="relative flex items-center gap-2">
                    {isSystem && (
                        <>
                           <Icon name="monitor" className="w-4 h-4" style={{ color: bgStyle(lightPalette.text) }} />
                        </>
                    )}
                    {!isSystem && isDark && (
                         <Icon name="moon" className="w-4 h-4" style={{ color: bgStyle(lightPalette.text) }} />
                    )}
                     {!isSystem && !isDark && (
                         <Icon name="sun" className="w-4 h-4" style={{ color: bgStyle(lightPalette.text) }} />
                    )}
                 </div>
            </button>
            <p className={`text-center text-sm font-medium mt-2 transition-colors ${isSelected ? 'text-primary' : 'text-text'}`}>{theme.name}</p>
            {onDelete && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Delete Theme"
                >
                    <Icon name="x" className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};


const ThemeToggle: React.FC<ThemeToggleProps> = ({ selectedTheme, onThemeChange, onOpenBuilder }) => {
  const { customThemes, deleteCustomTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">Preset Themes</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {themes.map(theme => (
            <ThemeSwatch
                key={theme.id}
                theme={theme}
                isSelected={selectedTheme === theme.id}
                onClick={() => onThemeChange(theme.id)}
            />
            ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">Custom Themes</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {customThemes.map(theme => (
                <ThemeSwatch
                    key={theme.id}
                    theme={theme}
                    isSelected={selectedTheme === theme.id}
                    onClick={() => onThemeChange(theme.id)}
                    onDelete={() => deleteCustomTheme(theme.id as string)}
                />
            ))}
            <button 
                onClick={onOpenBuilder}
                className="w-full h-24 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-surface/50 transition-all duration-200 flex flex-col items-center justify-center text-text-muted hover:text-primary group"
            >
                <div className="w-10 h-10 rounded-full bg-surface border border-border group-hover:border-primary flex items-center justify-center mb-2">
                    <Icon name="plus" className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">Create New</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeToggle;
