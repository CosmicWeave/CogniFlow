
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LearningDeck, InfoCard } from '../types';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import Button from './ui/Button';
import Icon from './ui/Icon';
import ProgressBar from './ui/ProgressBar';
import { useStore } from '../store/store';
import { useData } from '../contexts/DataManagementContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface ReaderSessionProps {
  deck: LearningDeck;
  onExit: () => void;
  onPractice: () => void;
}

const ReaderSession: React.FC<ReaderSessionProps> = ({ deck, onExit, onPractice }) => {
  const { learningProgress } = useStore();
  const dataHandlers = useData();
  const deckProgress = learningProgress[deck.id] || { deckId: deck.id, readInfoCardIds: [], unlockedQuestionIds: [] };
  const readSet = useMemo(() => new Set(deckProgress.readInfoCardIds), [deckProgress]);

  // Find the first unread card, or default to 0
  const firstUnreadIndex = deck.infoCards?.findIndex(c => !readSet.has(c.id));
  const initialIndex = firstUnreadIndex !== -1 ? firstUnreadIndex : 0;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isCompleted, setIsCompleted] = useState(false);
  const [textSize, setTextSize] = useState<'normal' | 'large' | 'huge'>('normal');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const currentCard = deck.infoCards?.[currentIndex];
  const totalCards = deck.infoCards?.length || 0;
  const progressPercent = ((currentIndex) / totalCards) * 100;

  // Click outside handler for settings dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
            setIsSettingsOpen(false);
        }
    };
    if (isSettingsOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  // Scroll to top when card changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex]);

  const handleMarkRead = useCallback(async () => {
    if (!currentCard) return;

    const newReadIds = Array.from(new Set([...deckProgress.readInfoCardIds, currentCard.id]));
    const newUnlockedQuestions = Array.from(new Set([...deckProgress.unlockedQuestionIds, ...currentCard.unlocksQuestionIds]));

    await dataHandlers?.handleUpdateLearningProgress({
        deckId: deck.id,
        readInfoCardIds: newReadIds,
        unlockedQuestionIds: newUnlockedQuestions,
        lastReadCardId: currentCard.id
    });
  }, [currentCard, deckProgress, deck.id, dataHandlers]);

  const handleNext = useCallback(async () => {
    await handleMarkRead();
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  }, [currentIndex, totalCards, handleMarkRead]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsCompleted(false);
    }
  };

  useKeyboardShortcuts({
      'ArrowRight': handleNext,
      'ArrowLeft': handlePrevious,
      'Space': handleNext
  });

  const contentTextSizeClass = useMemo(() => {
    switch (textSize) {
        case 'large': return 'text-xl leading-loose';
        case 'huge': return 'text-2xl leading-loose';
        case 'normal': default: return 'text-lg leading-relaxed';
    }
  }, [textSize]);

  // Comprehensive typography styles for readability and element support
  const proseClasses = `
    flex-grow prose dark:prose-invert max-w-none ${contentTextSizeClass}
    prose-p:mb-6 prose-p:mt-2
    prose-headings:font-bold prose-headings:tracking-tight prose-headings:mt-8 prose-headings:mb-4
    prose-a:text-primary hover:prose-a:text-primary-hover
    prose-img:rounded-xl prose-img:shadow-md prose-img:mx-auto prose-img:my-6
    prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-background/50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r prose-blockquote:my-6
    prose-ul:list-disc prose-ul:pl-6 prose-ul:my-6
    prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-6
    prose-li:my-4
    prose-table:w-full prose-table:my-6 prose-table:border-collapse
    prose-th:bg-background/50 prose-th:p-3 prose-th:text-left prose-th:border prose-th:border-border prose-th:font-bold
    prose-td:p-3 prose-td:border prose-td:border-border
    prose-hr:my-8 prose-hr:border-border
    prose-code:bg-background/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:text-primary
    prose-pre:bg-surface-dark prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
  `;

  if (!currentCard) {
      return (
          <div className="text-center py-20">
              <p className="text-text-muted">No content available to read.</p>
              <Button onClick={onExit} className="mt-4">Go Back</Button>
          </div>
      );
  }

  if (isCompleted) {
      return (
        <div className="max-w-2xl mx-auto py-20 text-center animate-fade-in">
            <div className="mb-6 inline-flex p-4 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                <Icon name="check-circle" className="w-16 h-16" />
            </div>
            <h2 className="text-3xl font-bold text-text mb-4">Reading Complete!</h2>
            <p className="text-text-muted mb-8 text-lg">You've finished all the material in this section.</p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="primary" size="lg" onClick={onPractice}>
                    <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
                    Practice Now
                </Button>
                <Button variant="secondary" size="lg" onClick={onExit}>
                    Back to Deck
                </Button>
            </div>
        </div>
      );
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 animate-fade-in">
      {/* Header / Progress */}
      <div className="mb-6 sticky top-16 bg-background/95 backdrop-blur-sm py-4 z-10 border-b border-border/50 transition-all">
        <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-text-muted uppercase tracking-wider">Page {currentIndex + 1} of {totalCards}</span>
            <div className="flex items-center gap-1">
                {/* Text Size Menu */}
                <div className="relative" ref={settingsRef}>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                        className="p-1 h-auto"
                        title="Text Size"
                    >
                        <Icon name="type" className="w-5 h-5 text-text-muted hover:text-text" />
                    </Button>
                    {isSettingsOpen && (
                        <div className="absolute top-8 right-0 bg-surface shadow-xl border border-border rounded-lg p-2 animate-fade-in z-50 flex gap-1">
                            <button 
                                onClick={() => setTextSize('normal')} 
                                className={`py-1 px-3 text-xs rounded transition-colors ${textSize === 'normal' ? 'bg-primary text-on-primary' : 'text-text hover:bg-border/50'}`}
                            >
                                A
                            </button>
                            <button 
                                onClick={() => setTextSize('large')} 
                                className={`py-1 px-3 text-sm font-medium rounded transition-colors ${textSize === 'large' ? 'bg-primary text-on-primary' : 'text-text hover:bg-border/50'}`}
                            >
                                A+
                            </button>
                            <button 
                                onClick={() => setTextSize('huge')} 
                                className={`py-1 px-3 text-base font-bold rounded transition-colors ${textSize === 'huge' ? 'bg-primary text-on-primary' : 'text-text hover:bg-border/50'}`}
                            >
                                A++
                            </button>
                        </div>
                    )}
                </div>
                <Button variant="ghost" size="sm" onClick={onExit}><Icon name="x" className="w-5 h-5" /></Button>
            </div>
        </div>
        <div className="w-full bg-border/30 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface shadow-sm border border-border rounded-xl p-8 md:p-12 min-h-[60vh] flex flex-col">
        <div className={proseClasses}>
            <DangerousHtmlRenderer html={currentCard.content} />
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border flex justify-between items-center md:static md:bg-transparent md:border-0 md:mt-8 z-20">
        <Button 
            variant="ghost" 
            onClick={handlePrevious} 
            disabled={currentIndex === 0}
            className="text-text-muted hover:text-text"
        >
            <Icon name="chevron-left" className="w-5 h-5 mr-1" /> Previous
        </Button>

        <span className="text-sm text-text-muted hidden md:inline">
            {readSet.has(currentCard.id) ? 'Read' : 'Unread'}
        </span>

        <Button 
            variant="primary" 
            size="lg" 
            onClick={handleNext} 
            className="px-8 shadow-md"
        >
            {currentIndex === totalCards - 1 ? 'Finish' : 'Next Page'} 
            <Icon name={currentIndex === totalCards - 1 ? 'check-circle' : 'chevron-left'} className={`w-5 h-5 ml-2 ${currentIndex !== totalCards - 1 ? 'rotate-180' : ''}`} />
        </Button>
      </div>
    </div>
  );
};

export default ReaderSession;
