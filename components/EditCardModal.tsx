import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../types';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useToast } from '../hooks/useToast.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';

interface EditCardModalProps {
  card: Card | null; // null for creating a new card
  onClose: () => void;
  onSave: (card: Pick<Card, 'front' | 'back' | 'id' | 'css'>) => void;
}

const EditCardModal: React.FC<EditCardModalProps> = ({ card, onClose, onSave }) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [css, setCss] = useState('');
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);

  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
      setCss(card.css || '');
    }
  }, [card]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      addToast("Both front and back fields are required.", "error");
      return;
    }
    onSave({
      id: card?.id || '', // id is only used for editing
      front: front.trim(),
      back: back.trim(),
      css: css.trim(),
    });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow tab navigation within textareas
    if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        target.value = target.value.substring(0, start) + "\t" + target.value.substring(end);
        target.selectionStart = target.selectionEnd = start + 1;
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">{card ? 'Edit Card' : 'Add New Card'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label htmlFor="card-front" className="block text-sm font-medium text-text-muted mb-1">Front (Supports HTML)</label>
              <textarea id="card-front" value={front} onChange={(e) => setFront(e.target.value)} onKeyDown={handleKeyDown} rows={5} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none font-mono text-sm" />
            </div>
            <div>
              <label htmlFor="card-back" className="block text-sm font-medium text-text-muted mb-1">Back (Supports HTML)</label>
              <textarea id="card-back" value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={handleKeyDown} rows={5} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none font-mono text-sm" />
            </div>
            <div>
              <label htmlFor="card-css" className="block text-sm font-medium text-text-muted mb-1">Custom CSS (Optional)</label>
              <textarea id="card-css" value={css} onChange={(e) => setCss(e.target.value)} onKeyDown={handleKeyDown} rows={5} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none font-mono text-sm" placeholder=".card { font-family: 'Arial'; }" />
            </div>
          </div>

          <div className="flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">
              {card ? 'Save Changes' : 'Add Card'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// FIX: Add default export to make the component importable.
export default EditCardModal;
