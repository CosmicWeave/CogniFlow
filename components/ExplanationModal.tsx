import React, { useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  explanation: string;
}

const ExplanationModal: React.FC<ExplanationModalProps> = ({ isOpen, onClose, title, explanation }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 animate-fade-in">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-lg transform transition-all relative flex flex-col max-h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="explanation-title"
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 id="explanation-title" className="text-xl font-bold text-text flex items-center gap-2">
            <Icon name="bot" className="w-6 h-6 text-primary" />
            Explain Like I'm 5
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close">
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto">
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Concept</h3>
                <p className="text-text font-medium">{title}</p>
            </div>
            <div>
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-2">Explanation</h3>
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                    <DangerousHtmlRenderer html={explanation} className="prose dark:prose-invert max-w-none text-text" />
                </div>
            </div>
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="primary" onClick={onClose}>
            Got it!
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExplanationModal;