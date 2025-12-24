
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Deck, DeckAnalysisSuggestion, DeckType, LearningDeck, QuizDeck, FlashcardDeck } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Spinner from './ui/Spinner';
import { analyzeDeckContent, applyDeckImprovements } from '../services/aiService';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { stripHtml } from '../services/utils';

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

  const groupedSuggestions = useMemo(() => {
      const groups: Record<string, { label: string, icon: any, items: DeckAnalysisSuggestion[] }> = {
          'general': { label: 'General Improvements', icon: 'zap', items: [] },
          'chapters': { label: 'Chapters (InfoCards)', icon: 'book-open', items: [] },
          'questions': { label: 'Questions & Quizzes', icon: 'help-circle', items: [] },
      };

      suggestions.forEach(s => {
          if (!s.targetId) {
              groups.general.items.push(s);
              return;
          }

          if (deck.type === DeckType.Learning) {
              const isInfoCard = (deck as LearningDeck).infoCards.some(ic => ic.id === s.targetId);
              if (isInfoCard) {
                  groups.chapters.items.push(s);
                  return;
              }
          }
          
          groups.questions.items.push(s);
      });

      return Object.entries(groups).filter(([_, group]) => group.items.length > 0);
  }, [suggestions, deck]);

  const getItemLabel = (targetId: string | undefined): string | null => {
      if (!targetId) return null;
      
      if (deck.type === DeckType.Learning) {
          const ic = (deck as LearningDeck).infoCards.find(i => i.id === targetId);
          if (ic) return `Chapter: ${stripHtml(ic.content).substring(0, 40)}...`;
      }
      
      const q = (deck as QuizDeck | LearningDeck).questions?.find(i => i.id === targetId);
      if (q) return `Question: ${stripHtml(q.questionText).substring(0, 40)}...`;

      const c = (deck as FlashcardDeck).cards?.find(i => i.id === targetId);
      if (c) return `Card: ${stripHtml(c.front).substring(0, 40)}...`;

      return null;
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
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close"><Icon name="x" /></Button>
        </header>

        <main className="flex-grow p-6 overflow-y-auto no-scrollbar">
            {step === 'analyzing' && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Spinner size="lg" />
                    <p className="mt-4 text-lg font-medium text-text">Analyzing deck content...</p>
                    <p className="text-sm text-text-muted">Checking for pedagogical alignment, accuracy, and clarity.</p>
                </div>
            )}

            {step === 'applying' && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Spinner size="lg" />
                    <p className="mt-4 text-lg font-medium text-text">Applying improvements...</p>
                    <p className="text-sm text-text-muted">Rewriting content and refining instructional flow.</p>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-background p-3 rounded-lg border border-border">
                        <p className="text-sm text-text-muted">Pedagogical Review for <b>{deck.name}</b></p>
                        <div className="text-xs space-x-3">
                            <button onClick={() => setSelectedIds(new Set(suggestions.map(s => s.id)))} className="text-primary font-semibold hover:underline">Select All</button>
                            <button onClick={() => setSelectedIds(new Set())} className="text-text-muted font-semibold hover:underline">Clear</button>
                        </div>
                    </div>
                    
                    {suggestions.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
                            <Icon name="check-circle" className="w-12 h-12 text-green-500 mx-auto mb-2" />
                            <p className="text-text font-medium">No pedagogical issues found!</p>
                            <p className="text-text-muted text-sm">Your learning deck is structured perfectly.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {groupedSuggestions.map(([key, group]) => (
                                <section key={key} className="animate-fade-in">
                                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Icon name={group.icon} className="w-4 h-4" />
                                        {group.label}
                                    </h3>
                                    <ul className="space-y-3">
                                        {group.items.map(suggestion => {
                                            const itemLabel = getItemLabel(suggestion.targetId);
                                            return (
                                                <li key={suggestion.id} className="p-4 bg-background rounded-lg border border-border flex gap-4 transition-all hover:border-primary/50 group">
                                                    <div className="pt-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedIds.has(suggestion.id)} 
                                                            onChange={() => handleToggle(suggestion.id)}
                                                            className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex-grow min-w-0">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h4 className="font-bold text-text leading-tight">{suggestion.title}</h4>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border font-bold uppercase tracking-tighter text-text-muted whitespace-nowrap ml-2">
                                                                {suggestion.category}
                                                            </span>
                                                        </div>
                                                        {itemLabel && <p className="text-[10px] font-semibold text-primary/80 mb-2 truncate italic">{itemLabel}</p>}
                                                        <p className="text-sm text-text leading-relaxed">{suggestion.description}</p>
                                                        <div className="mt-2 flex items-start gap-1 text-xs text-text-muted bg-primary/5 p-2 rounded italic">
                                                            <Icon name="info" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary" />
                                                            <span>{suggestion.rationale}</span>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            ))}
                        </div>
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
