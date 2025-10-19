import React, { useState, useRef, useEffect } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Spinner from './ui/Spinner';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
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
  const [isConfirming, setIsConfirming] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    // Reset state when modal is reopened
    if (isOpen) {
      setIsConfirming(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await Promise.resolve(onConfirm());
      // If the onConfirm action (like restoring data) reloads the page,
      // this onClose will not be called, which is fine.
      // If it's a simple async action that completes, we close the modal.
      if (modalRef.current) { // Check if component is still mounted
          onClose();
      }
    } catch (error) {
      // The error should be handled and toasted by the onConfirm function itself.
      // We just need to stop the loading state here.
      console.error("Confirmation action failed:", error);
    } finally {
      if (modalRef.current) { // Check if component is still mounted
          setIsConfirming(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-md transform transition-all relative"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 id="confirm-title" className="text-xl font-bold text-text">
            {title}
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close" disabled={isConfirming}>
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <p id="confirm-message" className="text-text-muted">
            {message}
          </p>
        </div>

        <div className="flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose} className="mr-2" disabled={isConfirming}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirm} disabled={isConfirming}>
            {isConfirming ? <Spinner size="sm" /> : (confirmText || 'Confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;