
import React, { useState, useEffect, useRef } from 'react';
import { Deck, DeckAnalysisSuggestion } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Spinner from './ui/Spinner';
import { analyzeDeckContent, applyDeckImprovements } from '../services/aiService';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface DeckAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: Deck;
  onUpdateDeck: (deck: Deck, options?: { silent?: boolean, toastMessage?: string }) => void;
}

const DeckAnalysisModal: React.FC<DeckAnalysisModalProps> = ({ isOpen, onClose, deck, onUpdateDeck }) => {
  const [step, setStep] = useState<'analyzing' | 'review' | 'applying'>('analyzing');
  const [suggestions, setSuggestions] = useState<DeckAnalysisSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen && step === 'analyzing') {
        const runAnalysis = async () => {
            try {
                const result = await analyzeDeckContent(deck);
                setSuggestions(result);
                setSelectedIds(new Set(result.map(s => s.id))); // Select all by default
                setStep('review');
            } catch (error) {
                addToast("Analysis failed. Please try again.", "error");
                onClose();
            }
        };
        runAnalysis();
    }
  }, [isOpen, deck, addToast, onClose, step]);

  const handleToggle = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleApply = async () => {
      setStep('applying');
      try {
          const selectedSuggestions = suggestions.filter(s => selectedIds.has(s.id));
          const updatedDeck = await applyDeckImprovements(deck, selectedSuggestions);
          onUpdateDeck(updatedDeck, { toastMessage: "Deck improvements applied successfully!" });
          onClose();
      } catch (error) {
          addToast("Failed to apply improvements.", "error");
          setStep('review');
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative flex flex-col max-h-[90vh]">
        <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="zap" className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-text">AI Deck Analyzer</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </header>

        <main className="flex-grow p-6 overflow-y-auto">
            {step === 'analyzing' && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Spinner size="lg" />
                    <p className="mt-4 text-lg font-medium text-text">Analyzing deck content...</p>
                    <p className="text-sm text-text-muted">Checking for accuracy, clarity, and formatting.</p>
                </div>
            )}

            {step === 'applying' && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Spinner size="lg" />
                    <p className="mt-4 text-lg font-medium text-text">Applying improvements...</p>
                    <p className="text-sm text-text-muted">Rewriting content based on your selection.</p>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-text-muted">Found {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}.</p>
                        <div className="text-sm space-x-2">
                            <button onClick={() => setSelectedIds(new Set(suggestions.map(s => s.id)))} className="text-primary hover:underline">Select All</button>
                            <button onClick={() => setSelectedIds(new Set())} className="text-text-muted hover:underline">Deselect All</button>
                        </div>
                    </div>
                    
                    {suggestions.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
                            <Icon name="check-circle" className="w-12 h-12 text-green-500 mx-auto mb-2" />
                            <p className="text-text font-medium">No issues found!</p>
                            <p className="text-text-muted text-sm">Your deck looks great.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {suggestions.map(suggestion => (
                                <li key={suggestion.id} className="p-4 bg-background rounded-lg border border-border flex gap-4">
                                    <div className="pt-1">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.has(suggestion.id)} 
                                            onChange={() => handleToggle(suggestion.id)}
                                            className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-text">{suggestion.title}</h4>
                                            <span className="text-xs px-2 py-1 rounded-full bg-surface border border-border font-medium uppercase tracking-wider text-text-muted">{suggestion.category}</span>
                                        </div>
                                        <p className="text-sm text-text mt-1">{suggestion.description}</p>
                                        <p className="text-xs text-text-muted mt-2 italic">"{suggestion.rationale}"</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </main>

        <footer className="flex-shrink-0 p-4 border-t border-border flex justify-end gap-2 bg-background/50">
            {step === 'review' && (
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleApply} disabled={selectedIds.size === 0}>
                        Apply {selectedIds.size} Improvement{selectedIds.size !== 1 ? 's' : ''}
                    </Button>
                </>
            )}
        </footer>
      </div>
    </div>
  );
};

export default DeckAnalysisModal;
