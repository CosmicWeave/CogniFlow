import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';

interface RouterContextType {
  path: string;
  navigate: (to: string) => void;
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

  const handleHashChange = useCallback(() => {
    setPath(getPathFromHash());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', handleHashChange);

    // The initial path is already set by useState(getPathFromHash()).
    // We do not need to manually modify the history, which was causing the security error.
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [handleHashChange]);

  const navigate = useCallback((to: string) => {
    // Set the hash with the #/ prefix to make it a valid hash route
    window.location.hash = `#${to}`;
  }, []);

  const value = { path, navigate };

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
