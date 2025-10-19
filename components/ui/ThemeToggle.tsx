import React from 'react';
import { themes, ThemeId } from '../../contexts/ThemeContext.tsx';
import Icon from './Icon.tsx';

interface ThemeToggleProps {
  selectedTheme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
}

const ThemeSwatch: React.FC<{ themeId: ThemeId, isSelected: boolean, onClick: () => void }> = ({ themeId, isSelected, onClick }) => {
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return null;

    const isSystem = theme.id === 'system';
    const isDark = theme.isDark;
    const lightPalette = isSystem ? theme.palette : theme.palette;
    const darkPalette = isSystem ? theme.paletteDark : (isDark ? theme.palette : null);

    const swatchClass = `w-full h-24 rounded-lg border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between p-2 text-left relative ${isSelected ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border hover:border-text-muted'}`;

    return (
        <div>
            <button onClick={onClick} className={swatchClass} aria-pressed={isSelected} aria-label={`Select ${theme.name} theme`}>
                <div className="w-full h-full absolute top-0 left-0 overflow-hidden rounded-[5px]">
                    {isSystem ? (
                        <>
                           <div className="w-1/2 h-full absolute top-0 left-0" style={{ backgroundColor: `rgb(${lightPalette.surface})` }}></div>
                           <div className="w-1/2 h-full absolute top-0 right-0" style={{ backgroundColor: `rgb(${darkPalette!.surface})` }}></div>
                        </>
                    ) : (
                         <div className="w-full h-full absolute top-0 left-0" style={{ backgroundColor: `rgb(${lightPalette.surface})` }}></div>
                    )}
                </div>

                <div className="relative flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs backdrop-blur-sm" style={{ backgroundColor: `rgba(${lightPalette.background}, 0.6)`}}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `rgb(${lightPalette.primary})`}}></div>
                        <span style={{ color: `rgb(${lightPalette.text})`}}>Aa</span>
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
                           <Icon name="monitor" className="w-4 h-4" style={{ color: `rgb(${lightPalette.text})`}} />
                        </>
                    )}
                    {!isSystem && isDark && (
                         <Icon name="moon" className="w-4 h-4" style={{ color: `rgb(${lightPalette.text})`}} />
                    )}
                     {!isSystem && !isDark && (
                         <Icon name="sun" className="w-4 h-4" style={{ color: `rgb(${lightPalette.text})`}} />
                    )}
                 </div>
            </button>
            <p className={`text-center text-sm font-medium mt-2 transition-colors ${isSelected ? 'text-primary' : 'text-text'}`}>{theme.name}</p>
        </div>
    );
};


const ThemeToggle: React.FC<ThemeToggleProps> = ({ selectedTheme, onThemeChange }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">Theme</label>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
        {themes.map(theme => (
          <ThemeSwatch
            key={theme.id}
            themeId={theme.id}
            isSelected={selectedTheme === theme.id}
            onClick={() => onThemeChange(theme.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default ThemeToggle;