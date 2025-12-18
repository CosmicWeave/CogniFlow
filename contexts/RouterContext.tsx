
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';

interface RouterContextType {
  path: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  goBack: () => void;
  canGoBack: boolean;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

// Helper to get the path from the hash, defaulting to '/'
const getPathFromHash = () => {
    if (window.location.hash.startsWith('#/')) {
        return window.location.hash.substring(1); // e.g., #/settings -> /settings
    }
    return '/';
};


export const RouterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [path, setPath] = useState(getPathFromHash());
  // We use a ref for the history stack to access the latest value inside the event listener
  // without needing to recreate the listener constantly.
  const historyStackRef = useRef<string[]>([getPathFromHash()]);
  // We sync the ref to state so components can re-render when history changes (e.g. to show/hide back button)
  const [historyLength, setHistoryLength] = useState(1);

  const handleHashChange = useCallback(() => {
    const newPath = getPathFromHash();
    setPath(newPath);

    const currentStack = historyStackRef.current;
    const lastPath = currentStack[currentStack.length - 1];
    const secondLastPath = currentStack[currentStack.length - 2];

    let newStack = currentStack;

    // Detection logic:
    // If the new path is the same as the previous entry in our stack, assume it's a "Back" action.
    if (newPath === secondLastPath) {
        newStack = currentStack.slice(0, -1);
    } else if (newPath !== lastPath) {
        // Otherwise, it's a forward navigation
        newStack = [...currentStack, newPath];
    }
    // If newPath === lastPath, do nothing (duplicate event or replace)

    historyStackRef.current = newStack;
    setHistoryLength(newStack.length);
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', handleHashChange);
    // The initial path is already set by useState(getPathFromHash()).
    // We do not need to manually modify the history, which could cause security errors.
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [handleHashChange]);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const newHash = `#${to}`;
    
    // Optimistically update stack for 'replace' to prevent jitter, 
    // though the hashchange listener handles the append.
    if (options?.replace) {
        const currentStack = historyStackRef.current;
        if (currentStack.length > 0) {
            // Replace the last item in our internal ref immediately so the hashchange logic 
            // (which sees newPath !== lastPath) doesn't treat it as a push if we can avoid it.
            // However, strictly speaking, hashchange is the source of truth.
            // For a replace, we effectively want the history length to stay same.
            // The simplest way with hash routing is just `location.replace`.
            const url = new URL(window.location.href);
            url.hash = newHash;
            window.location.replace(url.toString());
            
            // Manually update internal stack to reflect replacement before the event fires
            // This prevents the "Push" logic in handleHashChange from adding a duplicate or new entry
            const newStack = [...currentStack];
            newStack[newStack.length - 1] = to;
            historyStackRef.current = newStack;
            // setPath will happen on hashchange
            return; 
        }
    }
    
    window.location.hash = newHash;
  }, []);

  const goBack = useCallback(() => {
      const currentStack = historyStackRef.current;
      if (currentStack.length > 1) {
          const previousPath = currentStack[currentStack.length - 2];
          // Setting the hash will trigger handleHashChange, which detects the "Back" action
          // because previousPath === secondLastPath.
          window.location.hash = `#${previousPath}`;
      } else {
          // Fallback if history is empty (e.g. refresh), go home
          navigate('/');
      }
  }, [navigate]);

  const value = { 
      path, 
      navigate, 
      goBack, 
      canGoBack: historyLength > 1 
  };

  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextType => {
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
