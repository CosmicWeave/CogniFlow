

import React, { useState, useEffect, useRef } from 'react';
import { DeckSeries } from '../types.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useToast } from '../hooks/useToast.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';

interface EditSeriesModalProps {
  series: DeckSeries | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { id: string | null; name: string; description: string; scaffold?: any; }) => void;
}

const EditSeriesModal: React.FC<EditSeriesModalProps> = ({ series, isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scaffold, setScaffold] = useState<any | null>(null);
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const isNew = series === null;

  useEffect(() => {
    if (series) {
      setName(series.name);
      setDescription(series.description);
      setScaffold(null);
    } else {
      // Reset for "new series" case
      setName('');
      setDescription('');
      setScaffold(null);
    }
  }, [series]);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!isNew) return;
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(pastedText);
            if (typeof parsed.seriesName === 'string' && typeof parsed.seriesDescription === 'string' && Array.isArray(parsed.levels)) {
                e.preventDefault(); // Prevent the raw JSON from being pasted into the input
                setName(parsed.seriesName);
                setDescription(parsed.seriesDescription);
                setScaffold(parsed);
                addToast('Series details and structure populated from JSON scaffold!', 'success');
            }
        } catch (error) { /* Not a valid JSON, or not the format we want. Ignore and let the default paste happen. */ }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Series name cannot be empty.", "error");
      return;
    }
    onSave({
      id: isNew ? null : series.id,
      name: name.trim(),
      description: description.trim(),
      scaffold: isNew ? scaffold : null,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg transform transition-all relative">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">{isNew ? 'Create New Series' : 'Edit Series'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="series-name" className="block text-sm font-medium text-text-muted mb-1">Series Name</label>
              <input
                id="series-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onPaste={handlePaste}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="e.g., Introduction to Algebra"
                autoFocus
              />
               {isNew && <p className="text-xs text-text-muted mt-1">You can paste a full JSON scaffold object here to auto-populate.</p>}
            </div>
            <div>
              <label htmlFor="series-description" className="block text-sm font-medium text-text-muted mb-1">Description</label>
              <textarea
                id="series-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onPaste={handlePaste}
                rows={3}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="A collection of decks covering core concepts."
              />
            </div>
            {isNew && scaffold && (
              <div className="space-y-2 animate-fade-in">
                <h4 className="text-sm font-semibold text-text-muted">Structure Preview</h4>
                <div className="bg-background border border-border rounded-md p-3 max-h-48 overflow-y-auto text-sm">
                  <ul className="space-y-3">
                    {(scaffold.levels || []).filter((l): l is { title: string; decks: any[] } => !!l).map((level, levelIndex: number) => {
                      const decksInLevel = level.decks || [];
                      return (
                      <li key={levelIndex}>
                        <div className="flex items-center gap-2 font-medium text-text">
                          <Icon name="layers" className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          <span className="font-semibold">{level.title}</span>
                        </div>
                        <ul className="pl-6 mt-1 space-y-1">
                          {decksInLevel.map((deck: any, deckIndex: number) => (
                            <li key={deckIndex} className="flex items-center gap-2 text-text-muted">
                              <Icon name="help-circle" className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{deck.name}</span>
                            </li>
                          ))}
                           {decksInLevel.length === 0 && (
                                <li className="flex items-center gap-2 text-xs text-text-muted/70 italic">
                                    (No decks in this level)
                                </li>
                           )}
                        </ul>
                      </li>
                    )})}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">
              <Icon name="save" className="w-4 h-4 mr-2" />
              {isNew ? 'Create Series' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSeriesModal;