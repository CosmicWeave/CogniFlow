import React, { useState, useMemo, useRef } from 'react';
import { Deck } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ResetProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReset: (deckId: string) => void;
  decks: Deck[];
}

const ResetProgressModal: React.FC<ResetProgressModalProps> = ({ isOpen, onClose, onReset, decks }) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [confirmationText, setConfirmationText] = useState('');
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const selectedDeck = useMemo(() => decks.find(d => d.id === selectedDeckId), [decks, selectedDeckId]);
  
  const isConfirmationValid = selectedDeck ? confirmationText === selectedDeck.name : false;

  const handleReset = () => {
    if (!isConfirmationValid || !selectedDeck) {
      addToast("Confirmation text does not match.", "error");
      return;
    };
    onReset(selectedDeck.id);
    onClose();
  };

  const handleClose = () => {
    setSelectedDeckId('');
    setConfirmationText('');
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform transition-all relative">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold">Reset Deck Progress</h2>
            <Button type="button" variant="ghost" onClick={handleClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-red-700 dark:text-red-200">
                <p><strong className="font-bold">Warning:</strong> This will reset all spaced repetition data (due dates, intervals) for the selected deck. The cards themselves will not be deleted. This action cannot be undone.</p>
            </div>
            
            <div>
              <label htmlFor="deck-select" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Select Deck</label>
              <select
                id="deck-select"
                value={selectedDeckId}
                onChange={e => {
                  setSelectedDeckId(e.target.value);
                  setConfirmationText('');
                }}
                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="" disabled>-- Select a deck --</option>
                {decks.map(deck => (
                  <option key={deck.id} value={deck.id}>{deck.name}</option>
                ))}
              </select>
            </div>
            
            {selectedDeck && (
              <div className="animate-fade-in">
                <label htmlFor="confirm-text" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  To confirm, type "<strong className="text-gray-900 dark:text-gray-100">{selectedDeck.name}</strong>" below:
                </label>
                <input
                  id="confirm-text"
                  type="text"
                  value={confirmationText}
                  onChange={e => setConfirmationText(e.target.value)}
                  className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end p-4 bg-gray-100/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={handleClose} className="mr-2">Cancel</Button>
            <Button type="button" variant="danger" onClick={handleReset} disabled={!isConfirmationValid}>
              <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
              Reset Progress
            </Button>
          </div>
      </div>
    </div>
  );
};

export default ResetProgressModal;