
import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../contexts/ThemeContext';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import ToggleSwitch from './ui/ToggleSwitch';

interface ThemeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (theme: Theme) => void;
}

const hexToRgb = (hex: string): string => {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r} ${g} ${b}`;
};

const getContrastYIQ = (hexcolor: string) => {
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '0 0 0' : '255 255 255';
};

const ThemeBuilderModal: React.FC<ThemeBuilderModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [primary, setPrimary] = useState('#3b82f6');
  const [background, setBackground] = useState('#ffffff');
  const [surface, setSurface] = useState('#f3f4f6');
  const [text, setText] = useState('#111827');
  
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  // Defaults when switching modes
  useEffect(() => {
      if (isDark) {
          setBackground('#111827');
          setSurface('#1f2937');
          setText('#f9fafb');
      } else {
          setBackground('#f9fafb');
          setSurface('#ffffff');
          setText('#111827');
      }
  }, [isDark]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTheme: Theme = {
        id: `custom-${crypto.randomUUID()}`,
        name: name.trim(),
        isDark,
        metaColor: background,
        isCustom: true,
        palette: {
            primary: hexToRgb(primary),
            background: hexToRgb(background),
            surface: hexToRgb(surface),
            text: hexToRgb(text),
            onPrimary: getContrastYIQ(primary)
        }
    };
    onSave(newTheme);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg transform transition-all relative flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text">Create Custom Theme</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
            {/* Preview Section */}
            <div className="rounded-lg border border-border overflow-hidden" style={{ backgroundColor: background, color: text }}>
                <div className="p-4 border-b border-border flex justify-between items-center" style={{ backgroundColor: surface, borderColor: 'rgba(128,128,128,0.2)' }}>
                    <span className="font-bold">Preview</span>
                    <span className="text-xs opacity-70">10:00 AM</span>
                </div>
                <div className="p-6 space-y-4">
                    <h3 className="text-lg font-bold">Your Learning Journey</h3>
                    <p className="opacity-80">This is how your theme will look. Adjust the colors below to find your perfect style.</p>
                    <div className="p-4 rounded-lg shadow-sm border" style={{ backgroundColor: surface, borderColor: 'rgba(128,128,128,0.2)' }}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold">Flashcard</span>
                            <span className="text-xs" style={{ color: primary }}>Due Now</span>
                        </div>
                        <div className="h-2 rounded-full w-full opacity-20" style={{ backgroundColor: text }}>
                            <div className="h-2 rounded-full w-2/3" style={{ backgroundColor: primary }}></div>
                        </div>
                    </div>
                    <button className="px-4 py-2 rounded-md font-medium w-full" style={{ backgroundColor: primary, color: `rgb(${getContrastYIQ(primary)})` }}>
                        Primary Button
                    </button>
                </div>
            </div>

            <form id="theme-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Theme Name</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" 
                        placeholder="e.g., Midnight Purple"
                        required
                    />
                </div>
                
                <ToggleSwitch label="Dark Mode Base" checked={isDark} onChange={setIsDark} description="Adjusts browser UI elements." />

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Primary Color</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="h-10 w-10 p-0 border-0 rounded cursor-pointer" />
                            <span className="text-xs text-text-muted font-mono">{primary}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Background</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={background} onChange={e => setBackground(e.target.value)} className="h-10 w-10 p-0 border-0 rounded cursor-pointer" />
                            <span className="text-xs text-text-muted font-mono">{background}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Surface (Cards)</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={surface} onChange={e => setSurface(e.target.value)} className="h-10 w-10 p-0 border-0 rounded cursor-pointer" />
                            <span className="text-xs text-text-muted font-mono">{surface}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Text Color</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={text} onChange={e => setText(e.target.value)} className="h-10 w-10 p-0 border-0 rounded cursor-pointer" />
                            <span className="text-xs text-text-muted font-mono">{text}</span>
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <div className="flex justify-end p-4 bg-background/50 border-t border-border gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="theme-form" variant="primary" disabled={!name.trim()}>Save Theme</Button>
        </div>
      </div>
    </div>
  );
};

export default ThemeBuilderModal;
