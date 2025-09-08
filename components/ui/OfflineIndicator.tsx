import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const OfflineIndicator: React.FC = () => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed bottom-0 left-0 right-0 bg-red-600 text-white text-center p-3 z-50 animate-fade-in"
    >
      <p className="text-sm font-semibold">You are currently offline. Some features may be unavailable.</p>
    </div>
  );
};

export default OfflineIndicator;
