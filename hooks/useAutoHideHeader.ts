
import { useState, useEffect, useRef, useCallback } from 'react';

const HIDE_THRESHOLD = 10; // Pixels to scroll down before hiding header

export const useAutoHideHeader = (): boolean => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    
    // Always show header at the top of the page
    if (currentScrollY <= 0) {
      setIsVisible(true);
    } 
    // Show header when scrolling up
    else if (currentScrollY < lastScrollY.current) {
      setIsVisible(true);
    } 
    // Hide header when scrolling down past the threshold
    else if (currentScrollY > lastScrollY.current && currentScrollY > HIDE_THRESHOLD) {
      setIsVisible(false);
    }

    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  return isVisible;
};
