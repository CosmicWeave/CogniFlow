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
  const { learningProgress, aiGenerationStatus } = useStore();
  const dataHandlers = useData();
  const deckProgress = learningProgress[deck.id] || { deckId: deck.id, readInfoCardIds: [], unlockedQuestionIds: [] };
  const readSet = useMemo(() => new Set(deckProgress.readInfoCardIds), [deckProgress]);

  // Check if this deck is currently being synthesized by the AI
  const isGenerating = aiGenerationStatus.currentTask?.deckId === deck.id || deck.generationStatus === 'generating';

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
  
  // For total count in progress bar, we use the curriculum count if generating
  const totalTargetCount = deck.curriculum?.chapters?.length || totalCards;
  const progressPercent = ((currentIndex) / (totalTargetCount || 1)) * 100;

  // DAG Prerequisite Check
  const isCardLocked = useMemo(() => {
      if (!currentCard) return false;
      const prerequisites = currentCard.prerequisiteIds || [];
      return prerequisites.some(id => !readSet.has(id));
  }, [currentCard, readSet]);

  const lockedByTitles = useMemo(() => {
      if (!currentCard || !isCardLocked) return [];
      const prerequisites = currentCard.prerequisiteIds || [];
      return prerequisites
          .filter(id => !readSet.has(id))
          .map(id => deck.infoCards.find(ic => ic.id === id)?.content || "Foundational Topic")
          .map(html => html.replace(/<[^>]+>/g, '').substring(0, 50) + "...");
  }, [currentCard, isCardLocked, readSet, deck.infoCards]);

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
    if (!currentCard || isCardLocked) return;

    const newReadIds = Array.from(new Set([...deckProgress.readInfoCardIds, currentCard.id]));
    const newUnlockedQuestions = Array.from(new Set([...deckProgress.unlockedQuestionIds, ...currentCard.unlocksQuestionIds]));

    await dataHandlers?.handleUpdateLearningProgress({
        deckId: deck.id,
        readInfoCardIds: newReadIds,
        unlockedQuestionIds: newUnlockedQuestions,
        lastReadCardId: currentCard.id
    });
  }, [currentCard, deckProgress, deck.id, dataHandlers, isCardLocked]);

  const handleNext = useCallback(async () => {
    if (!isCardLocked) {
        await handleMarkRead();
    }
    
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  }, [currentIndex, totalCards, handleMarkRead, isCardLocked]);

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
    prose-video:rounded-xl prose-video:shadow-2xl prose-video:my-10
  `;

  if (!currentCard && !isGenerating) {
      return (
          <div className="text-center py-20">
              <p className="text-text-muted">No content available to read.</p>
              <Button onClick={onExit} className="mt-4">Go Back</Button>
          </div>
      );
  }

  if (isCompleted && !isGenerating) {
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
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-muted uppercase tracking-wider">Page {currentIndex + 1} of {totalTargetCount}</span>
                {isGenerating && (
                    <span className="flex items-center text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold animate-pulse">
                        LIVE SYNTHESIS
                    </span>
                )}
            </div>
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
        <div className="w-full bg-border/30 rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface shadow-sm border border-border rounded-xl p-8 md:p-12 min-h-[60vh] flex flex-col relative overflow-hidden">
        {isCardLocked ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                <div className="p-6 bg-red-100 dark:bg-red-900/20 rounded-full text-red-500 mb-6">
                    <Icon name="lock" className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-bold text-text mb-4">Chapter Locked</h3>
                <p className="text-text-muted mb-6">You need to complete the prerequisite chapters first:</p>
                <div className="space-y-2 w-full max-w-sm">
                    {lockedByTitles.map((title, i) => (
                        <div key={i} className="p-3 bg-background border border-border rounded-lg text-sm text-text font-medium flex items-center gap-2">
                            <Icon name="book-open" className="w-4 h-4 text-primary" />
                            <span className="truncate">{title}</span>
                        </div>
                    ))}
                </div>
                <Button variant="secondary" onClick={handlePrevious} className="mt-8">
                    <Icon name="chevron-left" className="w-4 h-4 mr-2" /> Back to foundational material
                </Button>
            </div>
        ) : currentCard ? (
            <div className={proseClasses}>
                <DangerousHtmlRenderer html={currentCard.content} />
            </div>
        ) : isGenerating ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-primary rounded-full blur-2xl opacity-20 animate-pulse"></div>
                    <div className="relative bg-surface p-6 rounded-full shadow-lg border border-border">
                        <Icon name="bot" className="w-16 h-16 text-primary" />
                    </div>
                </div>
                <h3 className="text-3xl font-extrabold text-text mb-4">Architecting Chapter {currentIndex + 1}...</h3>
                <p className="text-lg text-text-muted max-w-md mb-8">The Hyper-Course engine is currently synthesizing and auditing the next part of your curriculum. This will appear here in moments.</p>
                <div className="w-full max-w-xs bg-border/30 rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full w-1/2 animate-[progress-indefinite_2s_ease-in-out_infinite]"></div>
                </div>
            </div>
        ) : null}

        {isGenerating && currentCard && currentIndex === totalCards - 1 && (
            <div className="mt-16 p-8 bg-primary/5 border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center text-center animate-pulse">
                <div className="p-3 bg-surface rounded-full shadow-sm mb-4">
                    <Icon name="bot" className="w-10 h-10 text-primary" />
                </div>
                <h4 className="text-xl font-bold text-text mb-2">Synthesizing Next Chapters</h4>
                <p className="text-sm text-text-muted max-w-md">Our Epistemic Integrity Layer is currently verifying claims and generating visualizations for the upcoming chapters. Feel free to re-read or practice what you've learned so far.</p>
            </div>
        )}
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
            {currentCard ? (readSet.has(currentCard.id) ? 'Read' : (isCardLocked ? 'Locked' : 'Unread')) : 'Preparing...'}
        </span>

        <Button 
            variant="primary" 
            size="lg" 
            onClick={handleNext} 
            disabled={!currentCard || (isGenerating && currentIndex === totalCards - 1)}
            className="px-8 shadow-md"
        >
            {currentIndex === totalCards - 1 && !isGenerating ? 'Finish' : 'Next Page'} 
            <Icon name={currentIndex === totalCards - 1 && !isGenerating ? 'check-circle' : 'chevron-left'} className={`w-5 h-5 ml-2 ${currentIndex !== totalCards - 1 || isGenerating ? 'rotate-180' : ''}`} />
        </Button>
      </div>
      <style>{`
          @keyframes progress-indefinite {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
          }
      `}</style>
    </div>
  );
};

export default ReaderSession;
