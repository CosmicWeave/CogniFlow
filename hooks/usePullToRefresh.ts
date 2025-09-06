import { useState, useCallback } from 'react';
import { useSettings } from './useSettings';

export const REFRESH_THRESHOLD = 120; // pixels to pull before refresh triggers

export const usePullToRefresh = () => {
  const [pullToRefreshState, setPullToRefreshState] = useState({
    startY: 0,
    pullDistance: 0,
    isRefreshing: false,
    thresholdMet: false,
  });
  const { hapticsEnabled } = useSettings();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const targetElement = e.target as HTMLElement;
    // Do not initiate pull-to-refresh if the touch starts on an interactive element.
    // This prevents blocking default behaviors like focusing an input field on tap.
    if (window.scrollY === 0 && !targetElement.closest('input, textarea, button, a[href], select, [role="button"], [role="switch"]')) {
      setPullToRefreshState(s => ({ ...s, startY: e.touches[0].clientY, pullDistance: 0, isRefreshing: false, thresholdMet: false }));
    } else {
      setPullToRefreshState(s => ({ ...s, startY: 0 }));
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullToRefreshState.startY === 0) return;
    const pullDistance = e.touches[0].clientY - pullToRefreshState.startY;
    
    // Only start preventing default and tracking pull distance after a small threshold
    // to avoid interfering with normal clicks that might have a slight drag.
    if (pullDistance > 5) {
      e.preventDefault(); 
      
      const justMetThreshold = pullDistance > REFRESH_THRESHOLD && !pullToRefreshState.thresholdMet;
      if (justMetThreshold && hapticsEnabled && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      setPullToRefreshState(s => ({ ...s, pullDistance, thresholdMet: pullDistance > REFRESH_THRESHOLD }));
    }
  }, [pullToRefreshState.startY, pullToRefreshState.thresholdMet, hapticsEnabled]);

  const handleTouchEnd = useCallback(() => {
    if (pullToRefreshState.startY === 0) return;
    if (pullToRefreshState.pullDistance > REFRESH_THRESHOLD) {
      setPullToRefreshState(s => ({ ...s, isRefreshing: true }));
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      setPullToRefreshState({ startY: 0, pullDistance: 0, isRefreshing: false, thresholdMet: false });
    }
  }, [pullToRefreshState.startY, pullToRefreshState.pullDistance]);

  return {
    pullToRefreshState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    REFRESH_THRESHOLD
  };
};