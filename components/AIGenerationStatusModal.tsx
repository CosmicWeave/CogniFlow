import React, { useRef } from 'react';
import { useStore } from '../store/store';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Spinner from './ui/Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface AIGenerationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void;
}

const AIGenerationStatusModal: React.FC<AIGenerationStatusModalProps> = ({ isOpen, onClose, onCancel }) => {
  const { isGenerating, statusText } = useStore(state => state.aiGenerationStatus);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-lg transform transition-all relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-status-title"
      >
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 id="ai-status-title" className="text-xl font-bold text-text">
            AI Generation Status
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close">
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-8 text-center">
          {isGenerating ? (
            <>
              <Spinner size="lg" />
              <p className="mt-4 text-text-muted">{statusText || 'Processing your request...'}</p>
            </>
          ) : (
            <p className="text-text-muted">No AI tasks are currently running.</p>
          )}
        </div>

        <div className="flex justify-between p-4 bg-background/50 border-t border-border">
           {isGenerating ? (
              <Button type="button" variant="danger" onClick={handleCancel}>
                Cancel Generation
              </Button>
            ) : (
                <div></div> // Placeholder to keep Close button on the right
            )}
          <Button type="button" variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIGenerationStatusModal;