import React, { useState, useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface AIResponseFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  badJson: string;
  onRetry: (fixedJson: any) => void;
  onCancel: () => void;
}

const AIResponseFixModal: React.FC<AIResponseFixModalProps> = ({ isOpen, onClose, badJson, onRetry, onCancel }) => {
  const [editedJson, setEditedJson] = useState(badJson);
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const handleRetry = () => {
    try {
      const parsed = JSON.parse(editedJson);
      onRetry(parsed);
      onClose();
    } catch (e) {
      addToast(`Still not valid JSON. ${(e as Error).message}`, 'error');
    }
  };
  
  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        target.value = target.value.substring(0, start) + "  " + target.value.substring(end);
        target.selectionStart = target.selectionEnd = start + 2;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-3xl transform transition-all relative max-h-[90vh] flex flex-col">
          <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">Fix AI Response</h2>
            <Button type="button" variant="ghost" onClick={handleCancel} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="flex-grow p-6 space-y-4 overflow-y-auto">
            <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
                <p><strong className="font-bold">Error:</strong> The AI returned malformed JSON. This can happen if the response is too long and gets cut off. You can try to fix it manually below.</p>
                <p className="mt-2">{'Common fixes include adding a missing closing quote (`"`) or bracket/brace (`]` or `}`).'}</p>
            </div>
            
            <div>
              <label htmlFor="json-fix-content" className="block text-sm font-medium text-text-muted mb-1">
                Edit JSON response:
              </label>
              <textarea
                id="json-fix-content"
                value={editedJson}
                onChange={(e) => setEditedJson(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={20}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none font-mono text-sm"
              />
          </div>
          </div>

          <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={handleCancel} className="mr-2">Cancel</Button>
            <Button type="button" variant="primary" onClick={handleRetry}>
              <Icon name="refresh-ccw" className="w-4 h-4 mr-2" />
              Retry with Fix
            </Button>
          </div>
      </div>
    </div>
  );
};

export default AIResponseFixModal;