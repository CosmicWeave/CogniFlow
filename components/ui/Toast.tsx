import React, { useEffect } from 'react';
import { ToastMessage } from '../../contexts/ToastContext';
import Icon from './Icon';

interface ToastProps {
  message: ToastMessage;
  onDismiss: (id: string) => void;
}

const toastIcons: Record<ToastMessage['type'], React.ReactNode> = {
  success: <Icon name="check-circle" className="w-6 h-6 text-green-500" />,
  error: <Icon name="x-circle" className="w-6 h-6 text-red-500" />,
  info: <Icon name="info" className="w-6 h-6 text-blue-500" />,
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
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden animate-fade-in-right">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {toastIcons[message.type]}
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
              {message.message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onDismiss(message.id)}
              className="bg-white dark:bg-gray-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:ring-offset-gray-800 focus:ring-blue-500"
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