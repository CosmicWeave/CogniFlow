import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, Question, ReviewRating, Deck, DeckType, Reviewable, QuizDeck } from '../types';
import { calculateNextReview, getEffectiveMasteryLevel } from '../services/srs';
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
  onItemReviewed: (deckId: string, item: Reviewable, seriesId?: string) => Promise<void>;
  onUpdateLastOpened: (deckId: string) => void;
  sessionKeySuffix?: string;
  seriesId?: string;
}

const StudySession: React.FC<StudySessionProps> = ({ deck, onSessionEnd, onItemReviewed, onUpdateLastOpened, sessionKeySuffix = '', seriesId }) => {
  const [reviewQueue, setReviewQueue] = useState<(Card | Question)[]>([]);
  const [reviewedItems, setReviewedItems] = useState<Array<{ item: Card | Question; rating: ReviewRating | null }>>([]);
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
  // This should only run once when the session for a specific deck is initiated.
  useEffect(() => {
    // We call onUpdateLastOpened to mark this deck as recently used.
    onUpdateLastOpened(deck.id);

    // This is a one-time action. We disable the exhaustive-deps lint rule
    // for onUpdateLastOpened because including it would cause an infinite loop:
    // 1. This effect runs.
    // 2. onUpdateLastOpened updates the deck in the parent state.
    // 3. The parent state change causes a new onUpdateLastOpened function to be created.
    // 4. The new function reference would trigger this effect again.
    // By only depending on deck.id (which is stable for a session), we break the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id]);

  // Effect 2: Initialize the session queue and state.
  // This effect synchronizes the study queue with the deck's properties.
  useEffect(() => {
    const isSpecialSession = isGeneralSession || sessionKeySuffix === '_cram' || sessionKeySuffix === '_flip';
    
    if (isSpecialSession) {
        // For general, cram, or flip sessions, the deck is pre-configured by AppRouter.
        // We just need to load the items from it and reset state.
        const itemsToReview = deck.type === DeckType.Flashcard ? (deck as any).cards : (deck as any).questions;
        setReviewQueue(itemsToReview);
        setCurrentIndex(0);
        setDisplayIndex(0);
        setIsSessionInitialized(true);
        return; // Don't try to load from localStorage for these special sessions
    }

    const savedSessionJSON = localStorage.getItem(sessionKey);
    let sessionResumed = false;
    if (savedSessionJSON) {
      try {
        const savedSession = JSON.parse(savedSessionJSON);
        if (savedSession.reviewQueue && savedSession.reviewQueue.length > 0 && typeof savedSession.currentIndex === 'number') {
          setReviewQueue(savedSession.reviewQueue);
          setCurrentIndex(savedSession.currentIndex);
          setDisplayIndex(savedSession.currentIndex);
          sessionResumed = true;
        } else {
          localStorage.removeItem(sessionKey); // Clean up invalid session
        }
      } catch (e) {
        console.error("Failed to parse saved session", e);
        localStorage.removeItem(sessionKey);
      }
    }

    if (!sessionResumed) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const itemsToReview = deck.type === DeckType.Quiz ? deck.questions : deck.cards;
      const dueItems = itemsToReview
        .filter(item => !item.suspended && new Date(item.dueDate) <= today)
        .sort(() => Math.random() - 0.5);
      setReviewQueue(dueItems);
      // Always reset indices for a brand new session
      setCurrentIndex(0);
      setDisplayIndex(0);
    }
    setIsSessionInitialized(true);
  }, [deck, deck.type, sessionKeySuffix, isGeneralSession, sessionKey]);


  useEffect(() => {
    // Only save state for regular sessions
    const isRegularSession = !isGeneralSession && sessionKeySuffix === '';
    if (isRegularSession && isSessionInitialized && currentIndex < reviewQueue.length) {
       try { localStorage.setItem(sessionKey, JSON.stringify(sessionState)); } catch (e) { console.error("Could not save session state", e); }
    }
  }, [sessionState, isGeneralSession, isSessionInitialized, sessionKey, currentIndex, reviewQueue.length, sessionKeySuffix]);
  
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
    
    // Clean up local storage for regular sessions
    if (nextIndex >= reviewQueue.length) {
      const isRegularSession = !isGeneralSession && sessionKeySuffix === '';
      if (isRegularSession) {
        localStorage.removeItem(sessionKey);
      }
    }
  }, [currentIndex, reviewQueue.length, isGeneralSession, sessionKey, sessionKeySuffix]);

  const handleReview = useCallback(async (rating: ReviewRating) => {
    if (!displayedItem || !isCurrent || isReviewing) return;

    const isCramSession = sessionKeySuffix === '_cram';
    if (isCramSession) {
        // For cramming, just advance immediately without any SRS logic or delay.
        setIsReviewing(true);
        advanceToNext();
        setIsReviewing(false);
        return;
    }

    setIsReviewing(true);
    if (hapticsEnabled && 'vibrate' in navigator) navigator.vibrate(20);

    const oldMastery = getEffectiveMasteryLevel(displayedItem);
    const updatedItem = calculateNextReview(displayedItem, rating);
    const newMastery = updatedItem.masteryLevel || 0;

    const oldPercent = Math.round(oldMastery * 100);
    const newPercent = Math.round(newMastery * 100);

    if (oldPercent <= 85 && newPercent > 85) addToast('Item Mastered!', 'success');
    
    setReviewedItems(prev => [...prev, { item: updatedItem, rating }]);

    // Update the item in the queue to show mastery change before advancing
    setReviewQueue(prev => prev.map((item, index) => index === currentIndex ? updatedItem : item));

    const originalDeckId = (displayedItem as any).originalDeckId || deck.id;
    await onItemReviewed(originalDeckId, updatedItem, seriesId);

    // Delay advancing to see the change
    setTimeout(() => {
        advanceToNext();
        setIsReviewing(false);
    }, 800);
  }, [displayedItem, isCurrent, isReviewing, hapticsEnabled, advanceToNext, deck.id, onItemReviewed, addToast, seriesId, currentIndex, sessionKeySuffix]);
  
  const handleIgnore = useCallback(async () => {
    if (!displayedItem || !isCurrent || isReviewing) return;
    
    setIsReviewing(true);
    const ignoredItem = { ...displayedItem, suspended: true };
    setReviewedItems(prev => [...prev, { item: ignoredItem, rating: null }]);
    const originalDeckId = (displayedItem as any).originalDeckId || deck.id;

    await onItemReviewed(originalDeckId, ignoredItem, seriesId);

    addToast("Card ignored for future sessions.", "info");

    setTimeout(() => {
        advanceToNext();
        setIsReviewing(false);
    }, 300);
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

      // Arrow key navigation takes priority
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
      
      // Controls for the current item only
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

  if (!isSessionInitialized) return <div className="text-center p-8"><p className="text-gray-500 dark:text-gray-400">Initializing session...</p></div>;
  if (reviewQueue.length === 0) return (
    <div className="text-center p-8">
      <h2 className="text-2xl font-bold">All caught up!</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2">{isGeneralSession ? "There are no quiz questions due for review across all your decks." : "There are no items due for review in this deck."}</p>
      <Button onClick={() => onSessionEnd(deck.id, seriesId)} className="mt-6">Back to Decks</Button>
    </div>
  );

  if (currentIndex >= reviewQueue.length) {
    if (sessionKeySuffix === '_cram') {
      return (
        <div className="text-center p-8 animate-fade-in relative">
            <Confetti />
            <h2 className="text-2xl font-bold text-green-500 dark:text-green-400">Cram Session Complete!</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">You've reviewed all {reviewQueue.length} items in this deck.</p>
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

    reviewedItems.forEach(({ item }) => {
        if (item.suspended) return;
        const dueDate = new Date(item.dueDate);
        if (dueDate.getTime() > today.getTime() && dueDate.getTime() <= tomorrow.getTime()) dueTomorrowCount++;
        if (dueDate.getTime() > tomorrow.getTime() && dueDate.getTime() <= nextWeek.getTime()) dueNextWeekCount++;
    });
    
    const mostDifficultItems = reviewedItems
      .filter(reviewed => reviewed.rating === ReviewRating.Again || reviewed.rating === ReviewRating.Hard)
      .sort((a, b) => (a.rating ?? 5) - (b.rating ?? 5))
      .slice(0, 5)
      .map(reviewed => reviewed.item);

    return (
      <div className="text-center p-8 animate-fade-in relative">
        <Confetti />
        <h2 className="text-2xl font-bold text-green-500 dark:text-green-400">Congratulations!</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You've completed this study session.</p>
        <div className="mt-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg p-4 max-w-sm mx-auto space-y-2">
            <div className="flex justify-between items-center text-gray-700 dark:text-gray-300"><span>Due tomorrow:</span><span className="font-bold">{dueTomorrowCount} items</span></div>
            <div className="flex justify-between items-center text-gray-700 dark:text-gray-300"><span>Due in the next 7 days:</span><span className="font-bold">{dueNextWeekCount} items</span></div>
        </div>

        {mostDifficultItems.length > 0 && (
            <div className="mt-6 bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4 max-w-sm mx-auto space-y-3">
            <h4 className="font-bold text-orange-800 dark:text-orange-200 text-left flex items-center gap-2">
                <Icon name="zap" className="w-5 h-5" />
                Challenging Items
            </h4>
            <ul className="text-left text-sm space-y-2">
                {mostDifficultItems.map(item => (
                <li key={item.id} className="text-orange-700 dark:text-orange-300 border-l-2 border-orange-400 pl-3">
                    <p className="font-semibold truncate">
                    {'questionText' in item ? item.questionText : item.front}
                    </p>
                </li>
                ))}
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
                    <Button onClick={() => handleReview(ReviewRating.Again)} className="bg-red-600 hover:bg-red-700 dark:bg-red-800 dark:hover:bg-red-700 focus:ring-red-500 py-3 text-base text-white" disabled={isReviewing}>Again <span className="hidden sm:inline">(1)</span></Button>
                    <Button onClick={() => handleReview(ReviewRating.Hard)} className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-700 dark:hover:bg-orange-600 focus:ring-orange-400 py-3 text-base text-white" disabled={isReviewing}>Hard <span className="hidden sm:inline">(2)</span></Button>
                    <Button onClick={() => handleReview(ReviewRating.Good)} className="bg-green-600 hover:bg-green-700 dark:bg-green-800 dark:hover:bg-green-700 focus:ring-green-500 py-3 text-base text-white" disabled={isReviewing}>Good <span className="hidden sm:inline">(3)</span></Button>
                    <Button onClick={() => handleReview(ReviewRating.Easy)} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 focus:ring-blue-500 py-3 text-base text-white" disabled={isReviewing}>Easy <span className="hidden sm:inline">(4)</span></Button>
                </div>
                {sessionKeySuffix !== '_cram' && (
                  <div className="text-center">
                      <Button variant="ghost" onClick={handleIgnore} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" disabled={isReviewing}>
                          <Icon name="eye-off" className="w-4 h-4 mr-1"/> Ignore this card
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
                    <span className="text-sm text-gray-500 dark:text-gray-400">Item {displayIndex + 1} of {reviewQueue.length}</span>
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
