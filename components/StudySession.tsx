

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, Question, ReviewRating, Deck, DeckType, Reviewable, QuizDeck } from '../types';
import { calculateNextReview, getEffectiveMasteryLevel } from '../services/srs';
import { getSessionState, saveSessionState, deleteSessionState } from '../services/db';
import Flashcard from './Flashcard';
import QuizQuestion from './QuizQuestion';
import Button from './ui/Button';
import ProgressBar from './ui/ProgressBar';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import Icon from './ui/Icon';
import Confetti from './ui/Confetti';

interface StudySessionProps {
  deck: Deck;
  onSessionEnd: (deckId: string, seriesId?: string) => void;
  onItemReviewed: (deckId: string, item: Reviewable, rating: ReviewRating | null, seriesId?: string) => Promise<void>;
  onUpdateLastOpened: (deckId: string) => void;
  sessionKeySuffix?: string;
  seriesId?: string;
}

const getMasteryLabel = (level: number): 'Novice' | 'Learning' | 'Familiar' | 'Proficient' | 'Mastered' => {
  const percentage = Math.round(level * 100);
  if (percentage > 85) return 'Mastered';
  if (percentage > 65) return 'Proficient';
  if (percentage > 40) return 'Familiar';
  if (percentage > 15) return 'Learning';
  return 'Novice';
};

const StudySession: React.FC<StudySessionProps> = ({ deck, onSessionEnd, onItemReviewed, onUpdateLastOpened, sessionKeySuffix = '', seriesId }) => {
  const [reviewQueue, setReviewQueue] = useState<(Card | Question)[]>([]);
  const [reviewedItems, setReviewedItems] = useState<Array<{ oldItem: Card | Question; newItem: Card | Question; rating: ReviewRating | null }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const { hapticsEnabled } = useSettings();
  const { addToast } = useToast();

  const isGeneralSession = useMemo(() => deck.id === 'general-study-deck', [deck.id]);
  const sessionKey = `session_deck_${deck.id}${sessionKeySuffix}`;

  const sessionState = useMemo(() => ({
      reviewQueue,
      currentIndex,
  }), [reviewQueue, currentIndex]);

  // Effect 1: Update the "last opened" timestamp.
  useEffect(() => {
    onUpdateLastOpened(deck.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id]);

  // Effect 2: Initialize the session queue and state from IndexedDB.
  useEffect(() => {
    const initializeSession = async () => {
        const isSpecialSession = isGeneralSession || sessionKeySuffix === '_cram' || sessionKeySuffix === '_flip';
        
        if (isSessionInitialized && !isSpecialSession) {
          return;
        }
        
        if (isSpecialSession) {
            const itemsToReview = deck.type === DeckType.Flashcard ? (deck as any).cards : (deck as any).questions;
            setReviewQueue(itemsToReview);
            setCurrentIndex(0);
            setDisplayIndex(0);
            setIsSessionInitialized(true);
            return;
        }
    
        let sessionResumed = false;
        try {
            const savedSession = await getSessionState(sessionKey);
            if (savedSession && savedSession.reviewQueue && savedSession.reviewQueue.length > 0 && typeof savedSession.currentIndex === 'number') {
              setReviewQueue(savedSession.reviewQueue);
              setCurrentIndex(savedSession.currentIndex);
              setDisplayIndex(savedSession.currentIndex);
              sessionResumed = true;
            } else if (savedSession) {
              await deleteSessionState(sessionKey); // Clean up invalid session
            }
        } catch (e) {
            console.error("Failed to load saved session from DB", e);
        }
    
        if (!sessionResumed) {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          const itemsToReview = deck.type === DeckType.Quiz ? deck.questions : deck.cards;
          const dueItems = itemsToReview
            .filter(item => !item.suspended && new Date(item.dueDate) <= today)
            .sort(() => Math.random() - 0.5);
          setReviewQueue(dueItems);
          setCurrentIndex(0);
          setDisplayIndex(0);
        }
        setIsSessionInitialized(true);
    };

    initializeSession();
  }, [deck, deck.type, sessionKeySuffix, isGeneralSession, sessionKey, isSessionInitialized]);

  // Effect 3: Save session state to IndexedDB on change.
  useEffect(() => {
    const saveState = async () => {
        const isRegularSession = !isGeneralSession && sessionKeySuffix === '';
        if (isRegularSession && isSessionInitialized && currentIndex < reviewQueue.length) {
           try {
               await saveSessionState(sessionKey, sessionState);
           } catch (e) {
               console.error("Could not save session state to DB", e);
               addToast("Could not save session progress. It may be lost on refresh.", "error");
           }
        }
    };
    saveState();
  }, [sessionState, isGeneralSession, isSessionInitialized, sessionKey, currentIndex, reviewQueue.length, sessionKeySuffix, addToast]);
  
  const displayedItem = useMemo(() => reviewQueue[displayIndex], [reviewQueue, displayIndex]);
  const isHistorical = displayIndex < currentIndex;
  const isCurrent = displayIndex === currentIndex;

  const isQuiz = displayedItem && 'questionText' in displayedItem && deck.type === DeckType.Quiz;
  const isAnswered = selectedAnswerId !== null;
  const originalDeckName = displayedItem ? (displayedItem as any).originalDeckName : undefined;

  const handleSelectAnswer = useCallback((optionId: string) => {
    if (!isCurrent || isAnswered) return;
    setSelectedAnswerId(optionId);
    if (hapticsEnabled && 'vibrate' in navigator) {
        const isCorrect = (displayedItem as Question)?.correctAnswerId === optionId;
        navigator.vibrate(isCorrect ? 50 : [100, 50, 100]);
    }
  }, [isCurrent, isAnswered, displayedItem, hapticsEnabled]);

  const advanceToNext = useCallback(() => {
    setIsFlipped(false);
    setSelectedAnswerId(null);
    const nextIndex = currentIndex + 1;

    if (nextIndex <= reviewQueue.length) {
      setCurrentIndex(nextIndex);
      setDisplayIndex(nextIndex);
    }
    
    // Clean up DB for regular sessions on completion
    if (nextIndex >= reviewQueue.length) {
      const isRegularSession = !isGeneralSession && sessionKeySuffix === '';
      if (isRegularSession) {
        deleteSessionState(sessionKey).catch(e => console.error("Failed to delete session state", e));
      }
    }
  }, [currentIndex, reviewQueue.length, isGeneralSession, sessionKey, sessionKeySuffix]);

  const handleReview = useCallback(async (rating: ReviewRating) => {
    if (!displayedItem || !isCurrent || isReviewing) return;

    const isCramSession = sessionKeySuffix === '_cram';
    if (isCramSession) {
        setIsReviewing(true);
        advanceToNext();
        setIsReviewing(false);
        return;
    }

    setIsReviewing(true);
    if (hapticsEnabled && 'vibrate' in navigator) navigator.vibrate(20);

    const oldMastery = getEffectiveMasteryLevel(displayedItem);
    let updatedItem = calculateNextReview(displayedItem, rating);
    const newMastery = updatedItem.masteryLevel || 0;
    
    // Leech detection
    if ((updatedItem.lapses || 0) >= 8 && !displayedItem.suspended) {
        updatedItem = { ...updatedItem, suspended: true };
        addToast("This item is proving difficult. It has been automatically suspended to let you focus on other material.", "info");
    }

    const oldPercent = Math.round(oldMastery * 100);
    const newPercent = Math.round(newMastery * 100);

    if (oldPercent <= 85 && newPercent > 85) addToast('Item Mastered!', 'success');
    
    setReviewedItems(prev => [...prev, { oldItem: displayedItem, newItem: updatedItem, rating }]);
    
    try {
      const originalDeckId = (displayedItem as any).originalDeckId || deck.id;
      await onItemReviewed(originalDeckId, updatedItem, rating, seriesId);
    } catch (error) {
      console.error("Failed to save review:", error);
      addToast("Failed to save review. Your progress for this card may not be saved.", "error");
    } finally {
        setReviewQueue(prev => prev.map((item, index) => index === currentIndex ? updatedItem : item));
        setTimeout(() => {
            advanceToNext();
            setIsReviewing(false);
        }, 800);
    }
  }, [displayedItem, isCurrent, isReviewing, hapticsEnabled, advanceToNext, deck.id, onItemReviewed, addToast, seriesId, currentIndex, sessionKeySuffix]);
  
  const handleSuspend = useCallback(async () => {
    if (!displayedItem || !isCurrent || isReviewing) return;
    
    setIsReviewing(true);
    const suspendedItem = { ...displayedItem, suspended: true };
    setReviewedItems(prev => [...prev, { oldItem: displayedItem, newItem: suspendedItem, rating: null }]);
    
    try {
        const originalDeckId = (displayedItem as any).originalDeckId || deck.id;
        await onItemReviewed(originalDeckId, suspendedItem, null, seriesId);
        addToast("Card suspended for future sessions.", "info");
    } catch (error) {
        console.error("Failed to suspend card:", error);
        addToast("Failed to save suspended state. Please try again.", "error");
    } finally {
        setTimeout(() => {
            advanceToNext();
            setIsReviewing(false);
        }, 300);
    }
  }, [displayedItem, isCurrent, isReviewing, addToast, advanceToNext, deck.id, onItemReviewed, seriesId]);

  const handleNavigatePrevious = useCallback(() => {
    if (displayIndex > 0) {
      setDisplayIndex(d => d - 1);
    }
  }, [displayIndex]);

  const handleNavigateNext = useCallback(() => {
    if (displayIndex < currentIndex) {
      setDisplayIndex(d => d + 1);
    }
  }, [displayIndex, currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        if (displayIndex > 0) {
          e.preventDefault();
          handleNavigatePrevious();
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        if (displayIndex < currentIndex) {
          e.preventDefault();
          handleNavigateNext();
        }
        return;
      }
      
      if (!isCurrent || isReviewing) return;

      if (isQuiz && isAnswered) {
          if (e.key === '1') handleReview(ReviewRating.Again);
          if (e.key === '2') handleReview(ReviewRating.Hard);
          if (e.key === '3') handleReview(ReviewRating.Good);
          if (e.key === '4') handleReview(ReviewRating.Easy);
      } else if (!isQuiz) {
          if (isFlipped) {
            if (e.key === '1') handleReview(ReviewRating.Again);
            if (e.key === '2') handleReview(ReviewRating.Hard);
            if (e.key === '3') handleReview(ReviewRating.Good);
            if (e.key === '4') handleReview(ReviewRating.Easy);
          } else {
              if (e.code === 'Space') {
                  e.preventDefault();
                  setIsFlipped(true);
              }
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isAnswered, isQuiz, isCurrent, isReviewing, handleReview, handleNavigatePrevious, handleNavigateNext, displayIndex, currentIndex]);

  if (!isSessionInitialized) return <div className="text-center p-8"><p className="text-text-muted">Initializing session...</p></div>;
  if (reviewQueue.length === 0) return (
    <div className="text-center p-8">
      <h2 className="text-2xl font-bold">All caught up!</h2>
      <p className="text-text-muted mt-2">{isGeneralSession ? "There are no quiz questions due for review across all your decks." : "There are no items due for review in this deck."}</p>
      <Button onClick={() => onSessionEnd(deck.id, seriesId)} className="mt-6">Back to Decks</Button>
    </div>
  );

  if (currentIndex >= reviewQueue.length) {
    if (sessionKeySuffix === '_cram') {
      return (
        <div className="text-center p-8 animate-fade-in relative">
            <Confetti />
            <h2 className="text-2xl font-bold text-green-500">Cram Session Complete!</h2>
            <p className="text-text-muted mt-2">You've reviewed all {reviewQueue.length} items in this deck.</p>
            <Button onClick={() => onSessionEnd(deck.id, seriesId)} className="mt-8">Finish Session</Button>
        </div>
      );
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    let dueTomorrowCount = 0;
    let dueNextWeekCount = 0;

    reviewedItems.forEach(({ newItem }) => {
        if (newItem.suspended) return;
        const dueDate = new Date(newItem.dueDate);
        if (dueDate.getTime() > today.getTime() && dueDate.getTime() <= tomorrow.getTime()) dueTomorrowCount++;
        if (dueDate.getTime() > tomorrow.getTime() && dueDate.getTime() <= nextWeek.getTime()) dueNextWeekCount++;
    });

    const masteryTransitions: Record<string, number> = {};
    reviewedItems.forEach(({ oldItem, newItem, rating }) => {
        if (rating !== null) { // Only count items that were actually reviewed, not suspended
            const oldMasteryLevel = getEffectiveMasteryLevel(oldItem);
            const newMasteryLevel = newItem.masteryLevel || 0;
            
            const oldLabel = getMasteryLabel(oldMasteryLevel);
            const newLabel = getMasteryLabel(newMasteryLevel);
    
            if (oldLabel !== newLabel) {
                const transitionKey = `${oldLabel} → ${newLabel}`;
                masteryTransitions[transitionKey] = (masteryTransitions[transitionKey] || 0) + 1;
            }
        }
    });
    const sortedTransitions = Object.entries(masteryTransitions).sort(([, a], [, b]) => b - a);
    const maxTransitionCount = Math.max(...Object.values(masteryTransitions), 1);
    
    const mostDifficultItems = reviewedItems
      .filter(reviewed => reviewed.rating === ReviewRating.Again || reviewed.rating === ReviewRating.Hard)
      .sort((a, b) => (a.rating ?? 5) - (b.rating ?? 5))
      .slice(0, 5)
      .map(reviewed => reviewed.newItem);

    return (
      <div className="text-center p-8 animate-fade-in relative">
        <Confetti />
        <h2 className="text-2xl font-bold text-green-500">Congratulations!</h2>
        <p className="text-text-muted mt-2">You've completed this study session.</p>
        <div className="mt-6 bg-surface rounded-lg p-4 max-w-sm mx-auto space-y-2 border border-border">
            <div className="flex justify-between items-center text-text"><span>Due tomorrow:</span><span className="font-bold">{dueTomorrowCount} items</span></div>
            <div className="flex justify-between items-center text-text"><span>Due in the next 7 days:</span><span className="font-bold">{dueNextWeekCount} items</span></div>
        </div>

        {sortedTransitions.length > 0 && (
            <div className="mt-6 bg-surface rounded-lg p-4 max-w-sm mx-auto space-y-3 border border-border">
                <h4 className="font-bold text-text text-left flex items-center gap-2">
                    <Icon name="trending-up" className="w-5 h-5" />
                    Session Impact
                </h4>
                <ul className="text-left text-sm space-y-3">
                    {sortedTransitions.map(([transitionKey, count]) => (
                        <li key={transitionKey}>
                            <div className="flex justify-between items-center mb-1 text-xs text-text-muted">
                                <span className="font-medium">{transitionKey}</span>
                                <span className="font-semibold">{count} item{count > 1 ? 's' : ''}</span>
                            </div>
                            <div className="w-full bg-border/30 rounded-full h-2">
                                <div
                                    className="bg-primary h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${(count / maxTransitionCount) * 100}%` }}
                                ></div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {mostDifficultItems.length > 0 && (
            <div className="mt-6 bg-orange-500/10 rounded-lg p-4 max-w-sm mx-auto space-y-3 border border-orange-500/20">
            <h4 className="font-bold text-orange-800 dark:text-orange-200 text-left flex items-center gap-2">
                <Icon name="zap" className="w-5 h-5" />
                Challenging Items
            </h4>
            <ul className="text-left text-sm space-y-2">
                {mostDifficultItems.map(item => {
                    const isQuestion = 'questionText' in item;
                    const promptText = (isQuestion ? (item as Question).questionText : (item as Card).front).replace(/<[^>]+>/g, '').trim();
                    
                    let answerText: string;
                    if (isQuestion) {
                        const question = item as Question;
                        const correctOption = question.options.find(opt => opt.id === question.correctAnswerId);
                        answerText = (correctOption?.text ?? 'N/A').replace(/<[^>]+>/g, '').trim();
                    } else {
                        answerText = (item as Card).back.replace(/<[^>]+>/g, '').trim();
                    }

                    return (
                        <li key={item.id} className="text-orange-700 dark:text-orange-300 border-l-2 border-orange-400 pl-3">
                            <p className="font-semibold break-words">
                                {promptText}
                            </p>
                            <p className="text-sm opacity-80 pl-2 break-words">
                                <span className="font-semibold mr-1">Answer:</span> {answerText}
                            </p>
                        </li>
                    );
                })}
            </ul>
            </div>
        )}

        <Button onClick={() => onSessionEnd(deck.id, seriesId)} className="mt-8">Finish Session</Button>
      </div>
    );
  }

  const showRatingButtons = (isFlipped || isAnswered) && isCurrent;
  const showNavArrows = reviewQueue.length > 1;

  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex flex-col h-full overflow-x-hidden">
      <ProgressBar current={currentIndex + 1} total={reviewQueue.length} />
      <div
        className="flex-grow flex flex-col items-center justify-center my-4 w-full"
      >
        {displayedItem && (
          <div
            key={displayIndex}
            className="w-full relative animate-fade-in"
          >
            {isQuiz ? (
              <QuizQuestion question={displayedItem as Question} selectedAnswerId={isHistorical ? (displayedItem as Question).correctAnswerId : selectedAnswerId} onSelectAnswer={handleSelectAnswer} deckName={originalDeckName} />
            ) : (
              <Flashcard card={displayedItem as Card} isFlipped={isFlipped || isHistorical} />
            )}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 mt-4 flex flex-col items-center justify-center space-y-4 min-h-[10rem]">
        {/* Action Area */}
        <div className="w-full flex-grow flex items-center justify-center">
            {isHistorical ? (
                <div className="text-center animate-fade-in">
                    <Button onClick={() => setDisplayIndex(currentIndex)} variant="primary" className="text-lg py-3">
                        Return to Current Card
                    </Button>
                    <div className="text-xs mt-2 font-semibold text-yellow-600 dark:text-yellow-400">(Reviewing Past Item)</div>
                </div>
            ) : showRatingButtons ? (
              <div className="space-y-4 animate-fade-in w-full">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button onClick={() => handleReview(ReviewRating.Again)} className="bg-red-600 hover:bg-red-700 focus:ring-red-500 py-3 text-base text-white" disabled={isReviewing}>Again <span className="hidden sm:inline">(1)</span></Button>
                    <Button onClick={() => handleReview(ReviewRating.Hard)} className="bg-orange-500 hover:bg-orange-600 focus:ring-orange-400 py-3 text-base text-white" disabled={isReviewing}>Hard <span className="hidden sm:inline">(2)</span></Button>
                    <Button onClick={() => handleReview(ReviewRating.Good)} className="bg-green-600 hover:bg-green-700 focus:ring-green-500 py-3 text-base text-white" disabled={isReviewing}>Good <span className="hidden sm:inline">(3)</span></Button>
                    <Button onClick={() => handleReview(ReviewRating.Easy)} className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 py-3 text-base text-white" disabled={isReviewing}>Easy <span className="hidden sm:inline">(4)</span></Button>
                </div>
                {sessionKeySuffix !== '_cram' && (
                  <div className="text-center">
                      <Button variant="ghost" onClick={handleSuspend} className="text-xs" disabled={isReviewing}>
                          <Icon name="eye-off" className="w-4 h-4 mr-1"/> Suspend this card
                      </Button>
                  </div>
                )}
              </div>
            ) : (
              !isQuiz && isCurrent && (
                <Button onClick={() => setIsFlipped(true)} variant="primary" className="w-full max-w-md text-lg py-3 animate-fade-in mx-auto flex items-center justify-center">
                  Show Answer <span className="hidden sm:inline ml-2">(Space)</span>
                </Button>
              )
            )}
        </div>

        {/* Navigation Area */}
        {showNavArrows && (
            <div className="flex justify-center items-center w-full max-w-xs gap-4 animate-fade-in h-12">
                <Button variant="ghost" onClick={handleNavigatePrevious} disabled={displayIndex === 0} className="p-3 rounded-full disabled:opacity-30" aria-label="Previous item">
                    <Icon name="chevron-left" className="w-8 h-8" />
                </Button>
                <div className="text-center w-28">
                    <span className="text-sm text-text-muted">Item {displayIndex + 1} of {reviewQueue.length}</span>
                </div>
                <Button variant="ghost" onClick={handleNavigateNext} disabled={displayIndex >= currentIndex} className="p-3 rounded-full disabled:opacity-30" aria-label="Next item">
                    <Icon name="chevron-left" className="w-8 h-8 rotate-180" />
                </Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default StudySession;
