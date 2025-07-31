import React, { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export const useFocusTrap = (containerRef: React.RefObject<HTMLElement>, isOpen: boolean) => {
  const focusableElements = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      focusableElements.current = Array.from(
        containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS)
      ) as HTMLElement[];

      const firstElement = focusableElements.current[0];
      if (firstElement) {
        // Delay focus slightly to ensure modal transition is complete
        setTimeout(() => firstElement.focus(), 100);
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !containerRef.current?.contains(document.activeElement)) {
          return;
        }

        const first = focusableElements.current[0];
        const last = focusableElements.current[focusableElements.current.length - 1];

        if (e.shiftKey) { // Shift + Tab
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else { // Tab
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, containerRef]);
};
