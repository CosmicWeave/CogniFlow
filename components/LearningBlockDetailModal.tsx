
import React, { useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import { LearningBlockData } from './EditLearningBlockModal';

interface LearningBlockDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: LearningBlockData | null;
}

const LearningBlockDetailModal: React.FC<LearningBlockDetailModalProps> = ({ isOpen, onClose, block }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  if (!isOpen || !block) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-3xl transform transition-all relative max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-detail-title"
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 id="block-detail-title" className="text-xl font-bold text-text">
            Learning Block Details
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close">
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">Informational Content</h3>
            <div className="p-4 bg-background rounded-lg border border-border">
                <DangerousHtmlRenderer
                    html={block.infoCard.content}
                    className="prose dark:prose-invert max-w-none"
                />
            </div>
          </div>
          <div>
             <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">Associated Questions ({block.questions.length})</h3>
             <ul className="space-y-3">
                {block.questions.map(q => (
                    <li key={q.id} className="p-3 bg-background rounded-lg border border-border">
                        <p className="font-semibold text-text" dangerouslySetInnerHTML={{ __html: q.questionText }}></p>
                        <ul className="mt-2 pl-4 text-sm space-y-1">
                            {q.options.map(opt => (
                                <li key={opt.id} className={`flex items-start gap-2 ${opt.id === q.correctAnswerId ? 'text-green-600 dark:text-green-400 font-medium' : 'text-text-muted'}`}>
                                    {opt.id === q.correctAnswerId 
                                        ? <Icon name="check-circle" className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        : <div className="w-4 h-4 flex-shrink-0"></div>
                                    }
                                    <span dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
             </ul>
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LearningBlockDetailModal;
