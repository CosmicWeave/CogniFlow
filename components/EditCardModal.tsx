import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface EditCardModalProps {
  card: Card | null; // null for creating a new card
  onClose: () => void;
  onSave: (card: Pick<Card, 'front' | 'back' | 'id'>) => void;
}

const EditCardModal: React.FC<EditCardModalProps> = ({ card, onClose, onSave }) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);

  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
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
    });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold">{card ? 'Edit Card' : 'Add New Card'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="card-front" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Front</label>
              <textarea
                id="card-front"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={5}
                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter front content (question, term, etc.)"
              />
            </div>
            <div>
              <label htmlFor="card-back" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Back</label>
              <textarea
                id="card-back"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={5}
                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter back content (answer, definition, etc.)"
              />
            </div>
          </div>

          <div className="flex justify-end p-4 bg-gray-100/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
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

export default EditCardModal;