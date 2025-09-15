import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import Icon from './Icon';

const OfflineIndicator: React.FC = () => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      title="You are currently offline"
      className="fixed bottom-6 right-6 z-50 bg-surface rounded-full w-12 h-12 shadow-lg flex items-center justify-center border-2 border-border animate-fade-in"
    >
      <Icon name="wifi-off" className="w-6 h-6 text-text-muted" />
    </div>
  );
};

export default OfflineIndicator;