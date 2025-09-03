
import React, { useRef } from 'react';
import { InfoCard } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  infoCards: InfoCard[];
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, infoCards }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 id="info-modal-title" className="text-xl font-bold text-text">
            Related Information
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close">
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {infoCards.map((card, index) => (
            <div key={card.id}>
              <DangerousHtmlRenderer
                html={card.content}
                className="prose dark:prose-invert max-w-none"
              />
              {index < infoCards.length - 1 && <hr className="my-6 border-border" />}
            </div>
          ))}
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

export default InfoModal;