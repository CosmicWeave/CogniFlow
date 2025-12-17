
import { useEffect, useRef } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface ShortcutConfig {
  [key: string]: KeyHandler;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutConfig) => {
  const shortcutsRef = useRef(shortcuts);

  // Update the ref whenever shortcuts change, so the listener always has the latest closures
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key presses when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
      ) {
        return;
      }

      const handler = shortcutsRef.current[e.code];
      if (handler) {
        handler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
