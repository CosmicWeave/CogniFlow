

import React, { useState, useRef, useMemo } from 'react';
import { DeckType, ImportedCard, ImportedQuestion } from '../types.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useToast } from '../hooks/useToast.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import { parseAndValidateItemsJSON } from '../services/importService.ts';
import Link from './ui/Link.tsx';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: ImportedCard[] | ImportedQuestion[]) => void;
  deckType: DeckType;
}

const BulkAddModal: React.FC<BulkAddModalProps> = ({ isOpen, onClose, onAddItems, deckType }) => {
  const [jsonContent, setJsonContent] = useState('');
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const placeholder = useMemo(() => {
    if (deckType === DeckType.Flashcard) {
      return `[\n  {\n    "front": "What is the capital of Japan?",\n    "back": "Tokyo"\n  },\n  {\n    "front": "What is 2 + 2?",\n    "back": "4"\n  }\n]`;
    } else {
      return `[\n  {\n    "questionText": "Which planet is known as the Red Planet?",\n    "options": [\n      { "id": "1", "text": "Earth" },\n      { "id": "2", "text": "Mars" }\n    ],\n    "correctAnswerId": "2",\n    "detailedExplanation": "Mars is called the Red Planet because of its reddish appearance."\n  }\n]`;
    }
  }, [deckType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonContent.trim()) {
      addToast("JSON content cannot be empty.", "error");
      return;
    }
    try {
      const items = parseAndValidateItemsJSON(jsonContent, deckType);
      if(items.length === 0) {
        addToast("The JSON array is empty. No items were added.", "info");
        onClose();
        return;
      }
      onAddItems(items);
      addToast(`Successfully added ${items.length} item(s).`, "success");
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
            <h2 className="text-xl font-bold">Bulk Add {deckType === DeckType.Flashcard ? 'Cards' : 'Questions'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6">
              <label htmlFor="json-content-bulk" className="block text-sm font-medium text-text-muted mb-1">
                Paste an array of items in JSON format.
              </label>
              <textarea
                id="json-content-bulk"
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={15}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none font-mono text-sm"
                placeholder={placeholder}
              />
              <Link href="/instructions/json" onClick={onClose} className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1">
                <Icon name="help-circle" className="w-4 h-4"/>
                View JSON format guide
              </Link>
          </div>

          <div className="flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">
              Add Items
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkAddModal;