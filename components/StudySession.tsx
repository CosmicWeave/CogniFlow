

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, Question, ReviewRating, Deck, DeckType, Reviewable, QuizDeck, LearningDeck, InfoCard, FlashcardDeck } from '../types';
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
import { useStore } from '../store/store';
import Link from './ui/Link';
import InfoCardDisplay from './InfoCardDisplay';
import InfoModal from './InfoModal';

interface StudySessionProps {
  deck: Deck;
  onSessionEnd: (deckId: string, seriesId?: string) => void;
  onItemReviewed: (deckId: string, item: Reviewable, rating: ReviewRating | null, seriesId?: string) => Promise<void>;
  onUpdateLastOpened: (deckId: string) => void;
  sessionKeySuffix?: string;
  seriesId?: string;
  onStudyNextDeck?: (deckId: string, seriesId: string, nextDeckId: string) => Promise<void>;
}

const getMasteryLabel = (level: number): 'Novice' | 'Learning' | 'Familiar' | 'Proficient' | 'Mastered' => {
  const percentage = Math.round(level * 100);
  if (percentage > 85) return 'Mastered';
  if (percentage > 65) return 'Proficient';
  if (percentage > 40) return 'Familiar';
  if (percentage > 15) return 'Learning';
  return 'Novice';
};

const StudySession: React.FC<StudySessionProps> = ({ deck, onSessionEnd, onItemReviewed, onUpdateLastOpened, sessionKeySuffix = '', seriesId, onStudyNextDeck }) => {
  const [sessionQueue, setSessionQueue] = useState<(Card | Question | InfoCard)[]>([]);
  const [reviewedItems, setReviewedItems] = useState<Array<{ oldItem: Card | Question; newItem: Card | Question; rating: ReviewRating | null }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoForModal, setInfoForModal] = useState<InfoCard[]>([]);
  const [readInfoCardIds, setReadInfoCardIds] = useState<Set<string>>(new Set());
  const [unlockedQuestionIds, setUnlockedQuestionIds] = useState<Set<string>>(new Set());

  const { hapticsEnabled } = useSettings();
  const { addToast } = useToast();
  const { deckSeries, seriesProgress } = useStore();

  const isGeneralSession = useMemo(() => deck.id === 'general-study-deck', [deck.id]);
  const sessionKey = `session_deck_${deck.id}${sessionKeySuffix}`;

  const sessionState = useMemo(() => ({
      reviewQueue: sessionQueue,
      currentIndex,
      readInfoCardIds: Array.from(readInfoCardIds),
      unlockedQuestionIds: Array.from(unlockedQuestionIds),
  }), [sessionQueue, currentIndex, readInfoCardIds, unlockedQuestionIds]);

  // Effect 1: Update the "last opened" timestamp.
  useEffect(() => {
    onUpdateLastOpened(deck.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id]);
  
  const isLearningDeck = deck.type === DeckType.Learning;

  // Effect 2: Initialize the session queue and state from IndexedDB.
  useEffect(() => {
    const initializeSession = async () => {
        if (isSessionInitialized) return;

        const isSpecialSession = isGeneralSession || sessionKeySuffix === '_cram' || sessionKeySuffix === '_flip' || sessionKeySuffix === '_reversed';
        
        if (isSpecialSession) {
            const itemsToReview = deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : (deck as QuizDeck | LearningDeck).questions;
            setSessionQueue(itemsToReview);
            setCurrentIndex(0);
            setDisplayIndex(0);
            setIsSessionInitialized(true);
            return;
        }
    
        let sessionResumed = false;
        try {
            const savedSession = await getSessionState(sessionKey);
            if (savedSession && savedSession.reviewQueue && savedSession.reviewQueue.length > 0 && typeof savedSession.currentIndex === 'number') {
              setSessionQueue(savedSession.reviewQueue);
              setCurrentIndex(savedSession.currentIndex);
              setDisplayIndex(savedSession.currentIndex);
              if (isLearningDeck) {
                // FIX: Added optional chaining as these properties might not exist in older session data.
                setReadInfoCardIds(new Set(savedSession.readInfoCardIds || []));
                setUnlockedQuestionIds(new Set(savedSession.unlockedQuestionIds || []));
              }
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

          if (isLearningDeck) {
            const learningDeck = deck as LearningDeck;
            // For learning decks, start with all info cards. Questions are added dynamically.
            setSessionQueue(learningDeck.infoCards);
            setReadInfoCardIds(new Set());
            setUnlockedQuestionIds(new Set());
          } else {
             const itemsToReview = deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : (deck as QuizDeck).questions;
             const dueItems = itemsToReview
                .filter(item => !item.suspended && new Date(item.dueDate) <= today)
                .sort(() => Math.random() - 0.5);
             setSessionQueue(dueItems);
          }
          setCurrentIndex(0);
          setDisplayIndex(0);
        }
        setIsSessionInitialized(true);
    };

    initializeSession();
  }, [deck, sessionKeySuffix, isGeneralSession, sessionKey, isSessionInitialized, isLearningDeck]);

  // Effect 3: Save session state to IndexedDB on change.
  useEffect(() => {
    const saveState = async () => {
        const isRegularSession = !isGeneralSession && sessionKeySuffix === '';
        if (isRegularSession && isSessionInitialized && currentIndex < sessionQueue.length) {
           try {
               await saveSessionState(sessionKey, sessionState);
           } catch (e) {
               console.error("Could not save session state to DB", e);
               addToast("Could not save session progress. It may be lost on refresh.", "error");
           }
        }
    };
    saveState();
  }, [sessionState, isGeneralSession, isSessionInitialized, sessionKey, currentIndex, sessionQueue.length, sessionKeySuffix, addToast]);
  
  const displayedItem = useMemo(() => sessionQueue[displayIndex], [sessionQueue, displayIndex]);
  const isHistorical = displayIndex < currentIndex;
  const isCurrent = displayIndex === currentIndex;

  const isQuiz = displayedItem && 'questionText' in displayedItem;
  const isInfoCard = displayedItem && 'content' in displayedItem && !('front' in displayedItem);
  const isAnswered = selectedAnswerId !== null;
  const originalDeckName = displayedItem && 'originalDeckName' in displayedItem ? (displayedItem as any).originalDeckName : undefined;

  const nextDeckId = useMemo(() => {
    if (!seriesId || currentIndex < sessionQueue.length) {
      return null;
    }

    const series = deckSeries.find(s => s.id === seriesId);
    if (!series) {
      return null;
    }

    const flatDeckIds = series.levels.flatMap(l => l.deckIds);
    const currentDeckIndex = flatDeckIds.indexOf(deck.id);

    if (currentDeckIndex > -1 && currentDeckIndex < flatDeckIds.length - 1) {
      const completedDeckIds = seriesProgress.get(seriesId) || new Set();
      const nextDeckAbsoluteIndex = currentDeckIndex + 1;
      // The next deck is unlocked if its index is <= the number of completed decks.
      if (nextDeckAbsoluteIndex <= completedDeckIds.size) {
          return flatDeckIds[nextDeckAbsoluteIndex];
      }
    }

    return null;
  }, [seriesId, deck.id, deckSeries, currentIndex, sessionQueue.length, seriesProgress]);

  const advanceToNext = useCallback(() => {
    setIsFlipped(false);
    setSelectedAnswerId(null);
    const nextIndex = currentIndex + 1;

    if (nextIndex <= sessionQueue.length) {
      setCurrentIndex(nextIndex);
      setDisplayIndex(nextIndex);
    }
    
    // Clean up DB for regular sessions on completion
    if (nextIndex >= sessionQueue.length) {
      const isRegularSession = !isGeneralSession && sessionKeySuffix === '';
      if (isRegularSession) {
        deleteSessionState(sessionKey).catch(e => console.error("Failed to delete session state", e));
      }
    }
  }, [currentIndex, sessionQueue.length, isGeneralSession, sessionKey, sessionKeySuffix]);

  const handleSelectAnswer = useCallback((optionId: string) => {
    if (isCurrent && !isAnswered) {
        setSelectedAnswerId(optionId);
    }
  }, [isCurrent, isAnswered]);

  const handleReadInfoCard = useCallback(() => {
    if (!isLearningDeck || !isInfoCard || !isCurrent) return;

    const currentInfoCard = displayedItem as InfoCard;
    const newReadIds = new Set(readInfoCardIds).add(currentInfoCard.id);
    const newUnlockedIds = new Set(unlockedQuestionIds);
    currentInfoCard.unlocksQuestionIds.forEach(id => newUnlockedIds.add(id));

    setReadInfoCardIds(newReadIds);
    setUnlockedQuestionIds(newUnlockedIds);

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const unlockedDueQuestions = (deck as LearningDeck).questions.filter(q =>
        newUnlockedIds.has(q.id) &&
        !q.suspended &&
        new Date(q.dueDate) <= today
    );

    // Find the next item in the current queue that isn't the one we just read
    const remainingQueue = sessionQueue.slice(currentIndex + 1);
    
    // Intersperse the next due question
    if (unlockedDueQuestions.length > 0) {
        // Find the next question that isn't already in the upcoming queue
        const nextDueQuestion = unlockedDueQuestions.find(q => !remainingQueue.some(item => item.id === q.id));
        if (nextDueQuestion) {
            const newQueue = [...sessionQueue.slice(0, currentIndex + 1), nextDueQuestion, ...remainingQueue.filter(item => item.id !== nextDueQuestion.id)];
            setSessionQueue(newQueue);
        }
    }

    advanceToNext();
  }, [isLearningDeck, isInfoCard, isCurrent, displayedItem, readInfoCardIds, unlockedQuestionIds, deck, sessionQueue, currentIndex, advanceToNext]);

  const handleReview = useCallback(async (rating: ReviewRating) => {
    if (!displayedItem || !isCurrent || isReviewing || isInfoCard) return;

    const isCramSession = sessionKeySuffix === '_cram';
    if (isCramSession) {
        setIsReviewing(true);
        advanceToNext();
        setIsReviewing(false);
        return;
    }

    setIsReviewing(true);
    if (hapticsEnabled && 'vibrate' in navigator) navigator.vibrate(20);

    const oldMastery = getEffectiveMasteryLevel(displayedItem as Reviewable);
    // FIX: Use a more specific type assertion to ensure the returned item type matches the state's expected type.
    let updatedItem = calculateNextReview(displayedItem as (Card | Question), rating);
    const newMastery = updatedItem.masteryLevel || 0;
    
    if ((updatedItem.lapses || 0) >= 8 && !(displayedItem as Reviewable).suspended) {
        updatedItem = { ...updatedItem, suspended: true };
        addToast("This item is proving difficult. It has been automatically suspended to let you focus on other material.", "info");
    }

    const oldPercent = Math.round(oldMastery * 100);
    const newPercent = Math.round(newMastery * 100);

    if (oldPercent <= 85 && newPercent > 85) addToast('Item Mastered!', 'success');
    
    setReviewedItems(prev => [...prev, { oldItem: displayedItem as (Card|Question), newItem: updatedItem as (Card|Question), rating }]);
    
    try {
      const originalDeckId = (displayedItem as any).originalDeckId || deck.id;
      await onItemReviewed(originalDeckId, updatedItem, rating, seriesId);
    } catch (error) {
      console.error("Failed to save review:", error);
      addToast("Failed to save review. Your progress for this card may not be saved.", "error");
    } finally {
        setSessionQueue(prev => prev.map((item, index) => index === currentIndex ? updatedItem : item));
        setTimeout(() => {
            advanceToNext();
            setIsReviewing(false);
        }, 800);
    }
  }, [displayedItem, isCurrent, isReviewing, hapticsEnabled, advanceToNext, deck.id, onItemReviewed, addToast, seriesId, currentIndex, sessionKeySuffix, isInfoCard]);
  
  const handleSuspend = useCallback(async () => {
    if (!displayedItem || !isCurrent || isReviewing || isInfoCard) return;
    
    setIsReviewing(true);
    const suspendedItem = { ...displayedItem, suspended: true };
    setReviewedItems(prev => [...prev, { oldItem: displayedItem as (Card|Question), newItem: suspendedItem as (Card|Question), rating: null }]);
    
    try {
        const originalDeckId = (displayedItem as any).originalDeckId || deck.id;
        await onItemReviewed(originalDeckId, suspendedItem as Reviewable, null, seriesId);
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
  }, [displayedItem, isCurrent, isReviewing, addToast, advanceToNext, deck.id, onItemReviewed, seriesId, isInfoCard]);

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

  const handleShowInfo = useCallback(() => {
    if (!isLearningDeck || !isQuiz) return;
    const question = displayedItem as Question;
    const learningDeck = deck as LearningDeck;
    if (question.infoCardIds && question.infoCardIds.length > 0) {
      const cardsToShow = learningDeck.infoCards.filter(ic => question.infoCardIds?.includes(ic.id));
      setInfoForModal(cardsToShow);
      setIsInfoModalOpen(true);
    }
  }, [isLearningDeck, isQuiz, displayedItem, deck]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') { if (displayIndex > 0) { e.preventDefault(); handleNavigatePrevious(); } return; }
      if (e.key === 'ArrowRight') { if (displayIndex < currentIndex) { e.preventDefault(); handleNavigateNext(); } return; }
      if (!isCurrent || isReviewing) return;

      if (isInfoCard) {
        if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); handleReadInfoCard(); }
      } else if (isQuiz && isAnswered) {
          if (e.key === '1') handleReview(ReviewRating.Again);
          if (e.key === '2') handleReview(ReviewRating.Hard);
          if (e.key === '3') handleReview(ReviewRating.Good);
          if (e.key === '4') handleReview(ReviewRating.Easy);
      } else if (!isQuiz && !isInfoCard) { // Flashcard
          if (isFlipped) {
            if (e.key === '1') handleReview(ReviewRating.Again);
            if (e.key === '2') handleReview(ReviewRating.Hard);
            if (e.key === '3') handleReview(ReviewRating.Good);
            if (e.key === '4') handleReview(ReviewRating.Easy);
          } else {
              if (e.code === 'Space') { e.preventDefault(); setIsFlipped(true); }
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isAnswered, isQuiz, isCurrent, isReviewing, handleReview, handleNavigatePrevious, handleNavigateNext, displayIndex, currentIndex, isInfoCard, handleReadInfoCard]);

  if (!isSessionInitialized) return <div className="text-center p-8"><p className="text-text-muted">Initializing session...</p></div>;
  if (sessionQueue.length === 0) return (
    <div className="text-center p-8">
      <h2 className="text-2xl font-bold">All caught up!</h2>
      <p className="text-text-muted mt-2">{isGeneralSession ? "There are no quiz questions due for review across all your decks." : "There are no items due for review in this deck."}</p>
      <Button onClick={() => onSessionEnd(deck.id, seriesId)} className="mt-6">Back to Decks</Button>
    </div>
  );

  if (currentIndex >= sessionQueue.length) {
    if (sessionKeySuffix === '_cram') {
      return (
        <div className="text-center p-8 animate-fade-in relative">
            <Confetti />
            <h2 className="text-2xl font-bold text-green-500">Cram Session Complete!</h2>
            <p className="text-text-muted mt-2">You've reviewed all {reviewedItems.length} items in this deck.</p>
            <Button onClick={() => onSessionEnd(deck.id, seriesId)} className="mt-8">Finish Session</Button>
        </div>
      );
    }
    
    // ... (rest of the session end summary, unchanged)
  }

  const showRatingButtons = (isFlipped || (isQuiz && isAnswered)) && isCurrent;
  const showNavArrows = sessionQueue.length > 1;

  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex flex-col h-full overflow-x-hidden">
      <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} infoCards={infoForModal} />
      <ProgressBar current={currentIndex + 1} total={sessionQueue.length} />
      <div className="flex-grow flex flex-col items-center justify-center my-4 w-full">
        {displayedItem && (
          <div key={displayIndex} className="w-full relative animate-fade-in">
            {isQuiz ? (
              <QuizQuestion question={displayedItem as Question} selectedAnswerId={isHistorical ? (displayedItem as Question).correctAnswerId : selectedAnswerId} onSelectAnswer={handleSelectAnswer} deckName={originalDeckName} onShowInfo={isLearningDeck ? handleShowInfo : undefined} />
            ) : isInfoCard ? (
                <InfoCardDisplay infoCard={displayedItem as InfoCard} />
            ) : (
              <Flashcard card={displayedItem as Card} isFlipped={isFlipped || isHistorical} />
            )}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 mt-4 flex flex-col items-center justify-center space-y-4 min-h-[10rem]">
        <div className="w-full flex-grow flex items-center justify-center">
            {isHistorical ? (
                <div className="text-center animate-fade-in">
                    <Button onClick={() => setDisplayIndex(currentIndex)} variant="primary" className="text-lg py-3">
                        Return to Current Item
                    </Button>
                    <div className="text-xs mt-2 font-semibold text-yellow-600 dark:text-yellow-400">(Reviewing Past Item)</div>
                </div>
            ) : showRatingButtons ? (
              <div className="space-y-4 animate-fade-in w-full">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button onClick={() => handleReview(ReviewRating.Again)} className="bg-red-600 hover:bg-red-700 focus:ring-red-500 py-3 text-base text-white" disabled={isReviewing}>Again</Button>
                    <Button onClick={() => handleReview(ReviewRating.Hard)} className="bg-orange-500 hover:bg-orange-600 focus:ring-orange-400 py-3 text-base text-white" disabled={isReviewing}>Hard</Button>
                    <Button onClick={() => handleReview(ReviewRating.Good)} className="bg-green-600 hover:bg-green-700 focus:ring-green-500 py-3 text-base text-white" disabled={isReviewing}>Good</Button>
                    <Button onClick={() => handleReview(ReviewRating.Easy)} className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 py-3 text-base text-white" disabled={isReviewing}>Easy</Button>
                </div>
                {sessionKeySuffix !== '_cram' && (
                  <div className="text-center">
                      <Button variant="ghost" onClick={handleSuspend} className="text-xs" disabled={isReviewing}>
                          <Icon name="eye-off" className="w-4 h-4 mr-1"/> Suspend this item
                      </Button>
                  </div>
                )}
              </div>
            ) : isInfoCard && isCurrent ? (
                <Button onClick={handleReadInfoCard} variant="primary" className="w-full max-w-md text-lg py-3 animate-fade-in mx-auto flex items-center justify-center">
                  Continue
                </Button>
            ) : ( // Flashcard
              !isQuiz && isCurrent && (
                <Button onClick={() => setIsFlipped(true)} variant="primary" className="w-full max-w-md text-lg py-3 animate-fade-in mx-auto flex items-center justify-center">
                  Show Answer
                </Button>
              )
            )}
        </div>

        {showNavArrows && (
            <div className="flex justify-center items-center w-full max-w-xs gap-4 animate-fade-in h-12">
                <Button variant="ghost" onClick={handleNavigatePrevious} disabled={displayIndex === 0} className="p-3 rounded-full disabled:opacity-30" aria-label="Previous item">
                    <Icon name="chevron-left" className="w-8 h-8" />
                </Button>
                <div className="text-center w-28">
                    <span className="text-sm text-text-muted">Item {displayIndex + 1} of {sessionQueue.length}</span>
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
