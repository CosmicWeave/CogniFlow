import React, { useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Corrected import path for types
import { Card, Question, ReviewRating, Deck, Reviewable, QuizDeck, LearningDeck, InfoCard, SessionState, DeckType, FlashcardDeck } from '../types';
import { calculateNextReview, getEffectiveMasteryLevel } from '../services/srs';
import { saveSessionState, deleteSessionState } from '../services/db';
import Flashcard from './Flashcard';
import QuizQuestion from './QuizQuestion';
import Button from './ui/Button';
import ProgressBar from './ui/ProgressBar';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import { useStore } from '../store/store';
import InfoCardDisplay from './InfoCardDisplay';
import InfoModal from './InfoModal';
import { useSessionQueue } from '../hooks/useSessionQueue';
import SessionSummary from './SessionSummary';
import SessionControls from './SessionControls';

interface StudySessionProps {
    deck: Deck;
    onSessionEnd: (deckId: string, seriesId?: string) => void;
    onItemReviewed: (deckId: string, item: Reviewable, rating: ReviewRating | null, seriesId?: string) => Promise<void>;
    onUpdateLastOpened: (deckId: string) => void;
    sessionKeySuffix?: string;
    seriesId?: string;
    onStudyNextDeck?: (deckId: string, seriesId: string, nextDeckId: string) => Promise<void>;
}

const StudySession: React.FC<StudySessionProps> = ({ deck, onSessionEnd, onItemReviewed, onUpdateLastOpened, sessionKeySuffix = '', seriesId, onStudyNextDeck }) => {
    const [reviewedItems, setReviewedItems] = useState<Array<{ oldItem: Card | Question; newItem: Card | Question; rating: ReviewRating | null }>>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [displayIndex, setDisplayIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
    const [isReviewing, setIsReviewing] = useState(false);
    
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoForModal, setInfoForModal] = useState<InfoCard[]>([]);
    const [totalSessionItems, setTotalSessionItems] = useState(0);
    const [itemsCompleted, setItemsCompleted] = useState(0);

    const { hapticsEnabled } = useSettings();
    const { addToast } = useToast();
    const { deckSeries, seriesProgress } = useStore();
    
    const isSpecialSession = useMemo(() => deck.id === 'general-study-deck' || ['_cram', '_flip', '_reversed'].includes(sessionKeySuffix), [deck.id, sessionKeySuffix]);
    const sessionKey = `session_deck_${deck.id}${sessionKeySuffix}`;
    const isLearningDeck = deck.type === 'learning';

    const { sessionQueue, setSessionQueue, isSessionInitialized, initialIndex, readInfoCardIds, setReadInfoCardIds, unlockedQuestionIds, setUnlockedQuestionIds, initialItemsCompleted } = useSessionQueue(deck, sessionKey, isSpecialSession);
    
    useEffect(() => {
        if (!isSessionInitialized) {
            return;
        }

        let total = 0;
        if (isSpecialSession) {
            total = (deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards?.length : (deck as QuizDeck | LearningDeck).questions?.length) || 0;
        } else if (deck.type === DeckType.Learning) {
            const learningDeck = deck as LearningDeck;
            total = (learningDeck.infoCards?.length || 0) + (learningDeck.questions?.length || 0);
        } else {
            total = sessionQueue.length;
        }
        setTotalSessionItems(total);
    }, [isSessionInitialized, deck, isSpecialSession, sessionQueue]);
    
    useEffect(() => {
        if (isSessionInitialized) {
            setCurrentIndex(initialIndex);
            setDisplayIndex(initialIndex);
            setItemsCompleted(initialItemsCompleted);
        }
    }, [isSessionInitialized, initialIndex, initialItemsCompleted]);
    
    useEffect(() => { onUpdateLastOpened(deck.id); }, [deck.id, onUpdateLastOpened]);

    useEffect(() => {
        if (!isSpecialSession && isSessionInitialized && currentIndex < sessionQueue.length) {
            const sessionState: SessionState = {
                id: sessionKey, reviewQueue: sessionQueue, currentIndex,
                readInfoCardIds: Array.from(readInfoCardIds), unlockedQuestionIds: Array.from(unlockedQuestionIds),
                itemsCompleted,
            };
            saveSessionState(sessionKey, sessionState).catch(e => {
                console.error("Could not save session state to DB", e);
                addToast("Could not save session progress.", "error");
            });
        }
    }, [sessionQueue, currentIndex, readInfoCardIds, unlockedQuestionIds, sessionKey, isSpecialSession, isSessionInitialized, addToast, itemsCompleted]);

    const displayedItem = useMemo(() => sessionQueue[displayIndex], [sessionQueue, displayIndex]);
    const isHistorical = displayIndex < currentIndex;
    const isCurrent = displayIndex === currentIndex;
    const isQuiz = displayedItem && 'questionText' in displayedItem;
    const isInfoCard = displayedItem && 'content' in displayedItem && !('front' in displayedItem);
    const isAnswered = selectedAnswerId !== null;
    const originalDeckName = displayedItem && 'originalDeckName' in displayedItem ? (displayedItem as any).originalDeckName : undefined;

    const nextDeckId = useMemo(() => {
        if (!seriesId || itemsCompleted < totalSessionItems) return null;
        const series = deckSeries.find(s => s.id === seriesId);
        if (!series) return null;
        const flatDeckIds = (series.levels || []).flatMap(l => l.deckIds || []);
        const currentDeckIndex = flatDeckIds.indexOf(deck.id);
        if (currentDeckIndex > -1 && currentDeckIndex < flatDeckIds.length - 1) {
            const completedDeckIds = seriesProgress.get(seriesId) || new Set();
            const nextDeckAbsoluteIndex = currentDeckIndex + 1;
            if (nextDeckAbsoluteIndex <= completedDeckIds.size) return flatDeckIds[nextDeckAbsoluteIndex];
        }
        return null;
    }, [seriesId, deck.id, deckSeries, itemsCompleted, totalSessionItems, seriesProgress]);

    const advanceToNext = useCallback(() => {
        setIsFlipped(false);
        setSelectedAnswerId(null);
        setItemsCompleted(prev => prev + 1);
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setDisplayIndex(nextIndex);
        
        if (nextIndex >= sessionQueue.length && !isSpecialSession) {
            deleteSessionState(sessionKey).catch(e => console.error("Failed to delete session state", e));
        }
    }, [currentIndex, sessionQueue.length, isSpecialSession, sessionKey]);

    const handleReview = useCallback(async (rating: ReviewRating) => {
        // FIX: Use a type guard on a Reviewable property to correctly narrow `displayedItem` and resolve TypeScript errors.
        if (!displayedItem || !isCurrent || isReviewing || !('interval' in displayedItem)) return;

        if (sessionKeySuffix === '_cram') {
            setIsReviewing(true);
            advanceToNext();
            setIsReviewing(false);
            return;
        }

        setIsReviewing(true);
        if (hapticsEnabled && 'vibrate' in navigator) navigator.vibrate(20);

        let updatedItem = calculateNextReview(displayedItem, rating);
        if ((updatedItem.lapses || 0) >= 8 && !displayedItem.suspended) {
            updatedItem = { ...updatedItem, suspended: true };
            addToast("Item suspended due to repeated failures.", "info");
        }

        if (getEffectiveMasteryLevel(displayedItem) <= 0.85 && (updatedItem.masteryLevel || 0) > 0.85) {
            addToast('Item Mastered!', 'success');
        }
        
        setReviewedItems(prev => [...prev, { oldItem: displayedItem, newItem: updatedItem, rating }]);
        
        try {
            const originalDeckId = (displayedItem as any).originalDeckId || deck.id;
            await onItemReviewed(originalDeckId, updatedItem, rating, seriesId);
        } catch (error) {
            console.error("Failed to save review:", error);
            addToast("Failed to save review progress for this card.", "error");
        } finally {
            setSessionQueue(prev => prev.map((item, index) => index === currentIndex ? updatedItem : item));
            setTimeout(() => { advanceToNext(); setIsReviewing(false); }, 800);
        }
    }, [displayedItem, isCurrent, isReviewing, sessionKeySuffix, advanceToNext, hapticsEnabled, addToast, deck.id, onItemReviewed, seriesId, currentIndex, setSessionQueue]);

    const handleSuspend = useCallback(async () => {
        // FIX: Use a type guard on a Reviewable property to correctly narrow `displayedItem` and resolve TypeScript errors.
        if (!displayedItem || !isCurrent || isReviewing || !('interval' in displayedItem)) return;

        // Explicitly type the item after the guard clause to ensure type safety.
        const itemToSuspend = displayedItem;
        
        setIsReviewing(true);
        
        const updatedItem = { ...itemToSuspend, suspended: true };
        
        setReviewedItems(prev => [...prev, { oldItem: itemToSuspend, newItem: updatedItem, rating: null }]);

        try {
            const originalDeckId = (itemToSuspend as any).originalDeckId || deck.id;
            await onItemReviewed(originalDeckId, updatedItem, null, seriesId);
            addToast("Item suspended.", "info");
        } catch (error) {
            console.error("Failed to save suspended item:", error);
            addToast("Failed to suspend item.", "error");
        } finally {
            setSessionQueue(prev => prev.map((item, index) => index === currentIndex ? updatedItem : item));
            setTimeout(() => { advanceToNext(); setIsReviewing(false); }, 500);
        }
    }, [displayedItem, isCurrent, isReviewing, advanceToNext, addToast, deck.id, onItemReviewed, seriesId, currentIndex, setSessionQueue]);

    const handleFlip = useCallback(() => {
        if (isCurrent) setIsFlipped(true);
    }, [isCurrent]);

    const handleSelectAnswer = useCallback((optionId: string) => {
        if (isCurrent && !isAnswered) setSelectedAnswerId(optionId);
    }, [isCurrent, isAnswered]);

    const handleReadInfoCard = useCallback(() => {
        if (isCurrent && isInfoCard) {
            const infoCard = displayedItem as InfoCard;
            setReadInfoCardIds(prev => new Set(prev).add(infoCard.id));
            setUnlockedQuestionIds(prev => new Set([...prev, ...infoCard.unlocksQuestionIds]));
            
            const newlyUnlockedQuestions = (deck as LearningDeck).questions
                .filter(q => infoCard.unlocksQuestionIds.includes(q.id));

            // Prevent adding questions that might already be in the queue (e.g., as orphan questions)
            const currentQueueIds = new Set(sessionQueue.map(item => item.id));
            const questionsToAdd = newlyUnlockedQuestions.filter(q => !currentQueueIds.has(q.id));

            if (questionsToAdd.length > 0) {
                // Shuffle questions before injecting them
                questionsToAdd.sort(() => Math.random() - 0.5);
                setSessionQueue(prev => {
                    const nextQueue = [...prev];
                    // Splice them in right after the current item
                    nextQueue.splice(currentIndex + 1, 0, ...questionsToAdd);
                    return nextQueue;
                });
            }
            advanceToNext();
        }
    }, [isCurrent, isInfoCard, displayedItem, setReadInfoCardIds, setUnlockedQuestionIds, deck, setSessionQueue, currentIndex, advanceToNext, sessionQueue]);

    const handleNavigatePrevious = useCallback(() => {
        if (displayIndex > 0) setDisplayIndex(prev => prev - 1);
    }, [displayIndex]);

    const handleNavigateNext = useCallback(() => {
        // FIX: Corrected the logic to increment the display index instead of decrementing it.
        if (displayIndex < currentIndex) setDisplayIndex(prev => prev + 1);
    }, [displayIndex, currentIndex]);

    const handleReturnToCurrent = useCallback(() => setDisplayIndex(currentIndex), [currentIndex]);
    
    const handleShowInfo = useCallback(() => {
        if (isQuiz) {
            const question = displayedItem as Question;
            const relatedInfoCardIds = question.infoCardIds || [];
            if (relatedInfoCardIds.length > 0) {
                const infoCards = (deck as LearningDeck).infoCards.filter(ic => relatedInfoCardIds.includes(ic.id));
                setInfoForModal(infoCards);
                setIsInfoModalOpen(true);
            }
        }
    }, [isQuiz, displayedItem, deck]);
    
    if (!isSessionInitialized) {
        return <div className="text-center p-8">Loading session...</div>;
    }

    if (isSessionInitialized && sessionQueue.length === 0 && !isSpecialSession) {
        return (
            <div className="text-center p-8 animate-fade-in">
                <h2 className="text-2xl font-bold text-green-500">All Done!</h2>
                <p className="text-text-muted mt-2">There are no items due for study in this deck right now.</p>
                <Button onClick={() => onSessionEnd(deck.id, seriesId)} className="mt-8">Back to Deck</Button>
            </div>
        );
    }

    if (currentIndex >= sessionQueue.length) {
        return (
            <SessionSummary
                deckId={deck.id}
                seriesId={seriesId}
                reviewedItems={reviewedItems}
                nextDeckId={nextDeckId}
                onSessionEnd={onSessionEnd}
                onStudyNextDeck={onStudyNextDeck}
                isCramSession={sessionKeySuffix === '_cram'}
            />
        );
    }
    
    return (
        <div className="max-w-2xl mx-auto flex flex-col h-full animate-fade-in">
            <div className="w-full">
                <ProgressBar current={itemsCompleted} total={totalSessionItems} />
            </div>

            <div className="flex-grow flex items-center justify-center py-4">
                <div className="w-full">
                    {originalDeckName && <p className="text-center text-xs mb-2 text-text-muted uppercase tracking-wider font-semibold">{originalDeckName}</p>}
                    
                    {isInfoCard ? (
                        <InfoCardDisplay infoCard={displayedItem as InfoCard} />
                    ) : isQuiz ? (
                        <QuizQuestion
                            key={displayedItem!.id}
                            question={displayedItem as Question}
                            selectedAnswerId={selectedAnswerId}
                            onSelectAnswer={handleSelectAnswer}
                            onShowInfo={isLearningDeck ? handleShowInfo : undefined}
                        />
                    ) : (
                        <Flashcard
                            key={displayedItem!.id}
                            card={displayedItem as Card}
                            isFlipped={isFlipped}
                        />
                    )}
                </div>
            </div>

            <SessionControls
                isCurrent={isCurrent}
                isHistorical={isHistorical}
                isFlipped={isFlipped}
                isAnswered={isAnswered}
                isReviewing={isReviewing}
                isQuiz={isQuiz}
                isInfoCard={isInfoCard}
                isCramSession={sessionKeySuffix === '_cram'}
                showNavArrows={totalSessionItems > 1}
                displayIndex={displayIndex}
                currentIndex={currentIndex}
                queueLength={sessionQueue.length}
                onReview={handleReview}
                // FIX: Corrected a typo in the onSuspend prop, changing the value from 'onSuspend' to the correctly named 'handleSuspend' function.
                onSuspend={handleSuspend}
                onReadInfoCard={handleReadInfoCard}
                onFlip={handleFlip}
                onReturnToCurrent={handleReturnToCurrent}
                onNavigatePrevious={handleNavigatePrevious}
                onNavigateNext={handleNavigateNext}
                itemsCompleted={itemsCompleted}
                totalSessionItems={totalSessionItems}
            />

            <InfoModal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                infoCards={infoForModal}
            />
        </div>
    );
};

export default StudySession;
