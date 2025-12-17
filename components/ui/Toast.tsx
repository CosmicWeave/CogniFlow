import React, { useEffect } from 'react';
import { ToastMessage } from '../../contexts/ToastContext.tsx';
import Icon from './Icon.tsx';

interface ToastProps {
  message: ToastMessage;
  onDismiss: (id: string) => void;
}

const toastIcons: Record<ToastMessage['type'], React.ReactNode> = {
  success: <Icon name="check-circle" className="w-6 h-6 text-green-500" />,
  error: <Icon name="x-circle" className="w-6 h-6 text-red-500" />,
  info: <Icon name="info" className="w-6 h-6 text-blue-500" />,
  warning: <Icon name="info" className="w-6 h-6 text-yellow-500" />,
};

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(message.id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [message.id, onDismiss]);

  return (
    <div className="bg-surface shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden animate-fade-in-right">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {toastIcons[message.type]}
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-text break-words">
              {message.message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onDismiss(message.id)}
              className="bg-surface rounded-md inline-flex text-text-muted hover:text-text focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-primary"
            >
              <span className="sr-only">Close</span>
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;