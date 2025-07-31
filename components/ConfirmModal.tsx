import React, { useState, useRef, useEffect } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
}) => {
  const [inputText, setInputText] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    // Reset input text when modal is reopened
    if (isOpen) {
      setInputText('');
    }
  }, [isOpen]);

  const isConfirmationValid = !confirmText || inputText === confirmText;

  const handleConfirm = () => {
    if (isConfirmationValid) {
      onConfirm();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md transform transition-all relative"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="confirm-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close">
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <p id="confirm-message" className="text-gray-600 dark:text-gray-400">
            {message}
          </p>
          {confirmText && (
            <div>
              <label htmlFor="confirm-input" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                To confirm, type "<strong className="text-gray-900 dark:text-gray-100">{confirmText}</strong>" below:
              </label>
              <input
                id="confirm-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 bg-gray-100/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose} className="mr-2">
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirm} disabled={!isConfirmationValid}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;