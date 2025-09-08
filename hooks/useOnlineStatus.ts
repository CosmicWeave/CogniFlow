import { useState, useEffect } from 'react';

// Extend the Navigator interface to include the Connection API
// This is necessary because the Connection API is still experimental
interface NetworkInformation extends EventTarget {
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

export const useOnlineStatus = (): { isOnline: boolean; isMetered: boolean } => {
  const getStatus = () => {
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;
    return {
      isOnline: nav.onLine,
      // A connection is considered metered if it's cellular or if the user has enabled data saver.
      isMetered: connection ? connection.type === 'cellular' || connection.saveData === true : false,
    };
  };

  const [status, setStatus] = useState(getStatus);

  useEffect(() => {
    const handleChange = () => setStatus(getStatus());
    
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;

    window.addEventListener('online', handleChange);
    window.addEventListener('offline', handleChange);
    // The 'change' event on the connection object fires when the connection type changes.
    connection?.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('online', handleChange);
      window.removeEventListener('offline', handleChange);
      connection?.removeEventListener('change', handleChange);
    };
  }, []);

  return status;
};
