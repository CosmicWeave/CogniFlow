
import React, { useState, useRef } from 'react';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useToast } from '../hooks/useToast.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import { parseAndValidateImportData } from '../services/importService.ts';
import { Deck, DeckType, QuizDeck } from '../types.ts';

interface AddDeckToSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDeck: (newDeck: QuizDeck) => void;
}

const AddDeckToSeriesModal: React.FC<AddDeckToSeriesModalProps> = ({ isOpen, onClose, onAddDeck }) => {
  const [jsonContent, setJsonContent] = useState('');
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const placeholder = `{
  "name": "New Quiz Deck Name",
  "description": "A description for the new deck.",
  "questions": [
    {
      "questionText": "What is 2+2?",
      "options": [{"id":"1","text":"4"}, {"id":"2","text":"3"}],
      "correctAnswerId": "1",
      "detailedExplanation": "It's basic math.",
      "tags": []
    }
  ]
}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonContent.trim()) {
      addToast("JSON content cannot be empty.", "error");
      return;
    }
    try {
      const parsed = parseAndValidateImportData(jsonContent);
      if (parsed.type !== DeckType.Quiz) {
        addToast("The provided JSON is not a valid Quiz Deck format.", "error");
        return;
      }
      
      const newDeck: QuizDeck = {
        id: crypto.randomUUID(),
        name: parsed.data.name,
        description: parsed.data.description,
        type: DeckType.Quiz,
        questions: parsed.data.questions.map(q => ({
            ...q,
            id: crypto.randomUUID(),
            questionType: 'multipleChoice',
            dueDate: new Date().toISOString(),
            interval: 0,
            easeFactor: 2.5,
            suspended: false,
        }))
      };

      onAddDeck(newDeck);
      addToast(`Successfully created and added deck: "${newDeck.name}"`, "success");
      onClose();

    } catch (error) {
      addToast(error instanceof Error ? error.message : "Invalid JSON format.", "error");
    }
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">Add New Deck to Series</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6">
              <label htmlFor="json-content" className="block text-sm font-medium text-text-muted mb-1">
                Paste a complete quiz deck object in JSON format.
              </label>
              <textarea
                id="json-content"
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={15}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none font-mono text-sm"
                placeholder={placeholder}
              />
          </div>

          <div className="flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">
              Create & Add Deck
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDeckToSeriesModal;