import React, { useRef, useState } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import { LearningBlockData } from './EditLearningBlockModal';
import Spinner from './ui/Spinner';

interface LearningBlockDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: LearningBlockData | null;
  deckName: string;
  onExpandText: (topic: string, originalContent: string, selectedText: string) => Promise<string | null>;
}

const LearningBlockDetailModal: React.FC<LearningBlockDetailModalProps> = ({ isOpen, onClose, block, deckName, onExpandText }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<{ visible: boolean; top: number; left: number; text: string } | null>(null);
  const [expansion, setExpansion] = useState<{ isLoading: boolean; content: string | null } | null>(null);
  useFocusTrap(modalRef, isOpen);

  const handleClose = () => {
    setPopover(null);
    setExpansion(null);
    onClose();
  };

  const handleMouseUp = () => {
    if (expansion) return; // Don't show popover if in expansion view
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const modalRect = modalRef.current?.getBoundingClientRect();
      if (modalRect) {
        setPopover({
          visible: true,
          top: rect.top - modalRect.top + rect.height,
          left: rect.left - modalRect.left + rect.width / 2,
          text,
        });
      }
    } else {
      setPopover(null);
    }
  };

  const handleExpand = async () => {
    if (!popover?.text || !block) return;
    const { text } = popover;
    setPopover(null);
    setExpansion({ isLoading: true, content: null });
    const resultContent = await onExpandText(deckName, block.infoCard.content, text);
    setExpansion({ isLoading: false, content: resultContent });
  };
  
  const renderDetailView = () => (
    <>
      <div onMouseUp={handleMouseUp} ref={contentRef}>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">Informational Content</h3>
        <div className="p-4 bg-background rounded-lg border border-border">
          <DangerousHtmlRenderer html={block!.infoCard.content} className="prose dark:prose-invert max-w-none" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">Associated Questions ({(block!.questions || []).length})</h3>
        <ul className="space-y-3">
          {(block!.questions || []).map(q => (
            <li key={q.id} className="p-3 bg-background rounded-lg border border-border">
              <p className="font-semibold text-text" dangerouslySetInnerHTML={{ __html: q.questionText }}></p>
              <ul className="mt-2 pl-4 text-sm space-y-1">
                {(q.options || []).map(opt => (
                  <li key={opt.id} className={`flex items-start gap-2 ${opt.id === q.correctAnswerId ? 'text-green-600 dark:text-green-400 font-medium' : 'text-text-muted'}`}>
                    {opt.id === q.correctAnswerId ? <Icon name="check-circle" className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <div className="w-4 h-4 flex-shrink-0"></div>}
                    <span dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  const renderExpansionView = () => (
    <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setExpansion(null)}>
            <Icon name="chevron-left" className="w-4 h-4 mr-1"/>
            Back to Content
        </Button>
        {expansion?.isLoading ? (
            <div className="flex justify-center items-center h-48"><Spinner /></div>
        ) : expansion?.content ? (
            <div className="p-4 bg-background rounded-lg border border-border">
                <DangerousHtmlRenderer html={expansion.content} className="prose dark:prose-invert max-w-none"/>
            </div>
        ) : (
            <p className="text-center text-red-500">Failed to generate explanation.</p>
        )}
    </div>
  );

  if (!isOpen || !block) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-3xl transform transition-all relative max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="block-detail-title">
        {popover?.visible && (
          <div className="absolute z-10 p-1" style={{ top: popover.top, left: popover.left, transform: 'translateX(-50%)' }}>
            <Button size="sm" onClick={handleExpand}>
              <Icon name="zap" className="w-4 h-4 mr-1" /> Expand
            </Button>
          </div>
        )}

        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 id="block-detail-title" className="text-xl font-bold text-text">Learning Block Details</h2>
          <Button type="button" variant="ghost" onClick={handleClose} className="p-1 h-auto" aria-label="Close"><Icon name="x" /></Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
            {expansion ? renderExpansionView() : renderDetailView()}
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="primary" onClick={handleClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default LearningBlockDetailModal;