import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    const [itemsCompleted, setItemsCompleted] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
    const [isReviewing, setIsReviewing] = useState(false);
    
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoForModal, setInfoForModal] = useState<InfoCard[]>([]);

    const { hapticsEnabled } = useSettings();
    const { addToast } = useToast();
    const { deckSeries, seriesProgress } = useStore();
    
    const isSpecialSession = useMemo(() => deck.id === 'general-study-deck' || ['_cram', '_flip', '_reversed'].includes(sessionKeySuffix), [deck.id, sessionKeySuffix]);
    const sessionKey = `session_deck_${deck.id}${sessionKeySuffix}`;
    const isLearningDeck = deck.type === 'learning';

    const { sessionQueue, setSessionQueue, isSessionInitialized, initialIndex, readInfoCardIds, setReadInfoCardIds, unlockedQuestionIds, setUnlockedQuestionIds, initialItemsCompleted } = useSessionQueue(deck, sessionKey, isSpecialSession);
    
    const totalSessionItems = useMemo(() => {
        if (isSpecialSession) {
            return deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards.length : (deck as QuizDeck | LearningDeck).questions.length;
        }

        if (isLearningDeck) {
            const learningDeck = deck as LearningDeck;
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const dueQuestionsCount = learningDeck.questions.filter(
                q => !q.suspended && new Date(q.dueDate) <= today
            ).length;
            return learningDeck.infoCards.length + dueQuestionsCount;
        }
        
        // For regular decks, the initial queue is all due items
        const itemsToReview = deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : (deck as QuizDeck).questions;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return itemsToReview.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
    }, [deck, isLearningDeck, isSpecialSession]);
    
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
        const flatDeckIds = series.levels.flatMap(l => l.deckIds);
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
        if (!displayedItem || !isCurrent || isReviewing || isInfoCard) return;

        if (sessionKeySuffix === '_cram') {
            setIsReviewing(true);
            advanceToNext();
            setIsReviewing(false);
            return;
        }

        setIsReviewing(true);
        if (hapticsEnabled && 'vibrate' in navigator) navigator.vibrate(20);

        let updatedItem = calculateNextReview(displayedItem as (Card | Question), rating);
        if ((updatedItem.lapses || 0) >= 8 && !(displayedItem as Reviewable).suspended) {
            updatedItem = { ...updatedItem, suspended: true };
            addToast("Item suspended due to repeated failures.", "info");
        }

        if (getEffectiveMasteryLevel(displayedItem as Reviewable) <= 0.85 && (updatedItem.masteryLevel || 0) > 0.85) {
            addToast('Item Mastered!', 'success');
        }
        
        setReviewedItems(prev => [...prev, { oldItem: displayedItem as (Card|Question), newItem: updatedItem as (Card|Question), rating }]);
        
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
    }, [displayedItem, isCurrent, isReviewing, isInfoCard, sessionKeySuffix, advanceToNext, hapticsEnabled, addToast, deck.id, onItemReviewed, seriesId, currentIndex, setSessionQueue]);

    const handleSuspend = useCallback(async () => {
        if (!displayedItem || !isCurrent || isReviewing || isInfoCard) return;
        
        setIsReviewing(true);
        const suspendedItem = { ...displayedItem, suspended: true };
        setReviewedItems(prev => [...prev, { oldItem: displayedItem as (Card|Question), newItem: suspendedItem as (Card|Question), rating: null }]);
        
        try {
            const originalDeckId = (displayedItem as any).originalDeckId || deck.id;
            await onItemReviewed(originalDeckId, suspendedItem as Reviewable, null, seriesId);
            addToast("Card suspended.", "info");
        } catch (error) {
            addToast("Failed to suspend card.", "error");
        } finally {
            setTimeout(() => { advanceToNext(); setIsReviewing(false); }, 300);
        }
    }, [displayedItem, isCurrent, isReviewing, isInfoCard, advanceToNext, addToast, deck.id, onItemReviewed, seriesId]);

    const handleReadInfoCard = useCallback(() => {
        if (!isLearningDeck || !isInfoCard || !isCurrent) return;

        const currentInfoCard = displayedItem as InfoCard;
        const newReadIds = new Set(readInfoCardIds).add(currentInfoCard.id);
        setReadInfoCardIds(newReadIds);
        const newUnlockedIds = new Set(unlockedQuestionIds);
        currentInfoCard.unlocksQuestionIds.forEach(id => newUnlockedIds.add(id));
        setUnlockedQuestionIds(newUnlockedIds);

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const questionsToInject = (deck as LearningDeck).questions.filter(q =>
            currentInfoCard.unlocksQuestionIds.includes(q.id) && !q.suspended && new Date(q.dueDate) <= today
        );

        const newQueue = [...sessionQueue];
        newQueue.splice(currentIndex, 1, ...questionsToInject);
        setSessionQueue(newQueue);
        setItemsCompleted(prev => prev + 1);
    }, [isLearningDeck, isInfoCard, isCurrent, displayedItem, readInfoCardIds, unlockedQuestionIds, deck, sessionQueue, currentIndex, setReadInfoCardIds, setUnlockedQuestionIds, setSessionQueue]);

    const handleShowInfo = useCallback(() => {
        if (!isLearningDeck || !isQuiz) return;
        const question = displayedItem as Question;
        const learningDeck = deck as LearningDeck;
        if (question.infoCardIds?.length) {
            setInfoForModal(learningDeck.infoCards.filter(ic => question.infoCardIds?.includes(ic.id)));
            setIsInfoModalOpen(true);
        }
    }, [isLearningDeck, isQuiz, displayedItem, deck]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'ArrowLeft' && displayIndex > 0) { e.preventDefault(); setDisplayIndex(d => d - 1); return; }
            if (e.key === 'ArrowRight' && displayIndex < currentIndex) { e.preventDefault(); setDisplayIndex(d => d + 1); return; }
            if (!isCurrent || isReviewing) return;
            if (isInfoCard && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); handleReadInfoCard(); }
            else if (isQuiz && isAnswered) {
                if (e.key === '1') handleReview(ReviewRating.Again); if (e.key === '2') handleReview(ReviewRating.Hard);
                if (e.key === '3') handleReview(ReviewRating.Good); if (e.key === '4') handleReview(ReviewRating.Easy);
            } else if (!isQuiz && !isInfoCard) {
                if (isFlipped) {
                    if (e.key === '1') handleReview(ReviewRating.Again); if (e.key === '2') handleReview(ReviewRating.Hard);
                    if (e.key === '3') handleReview(ReviewRating.Good); if (e.key === '4') handleReview(ReviewRating.Easy);
                } else if (e.code === 'Space') { e.preventDefault(); setIsFlipped(true); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFlipped, isAnswered, isQuiz, isCurrent, isReviewing, handleReview, displayIndex, currentIndex, isInfoCard, handleReadInfoCard]);

    if (!isSessionInitialized) return <div className="text-center p-8"><p className="text-text-muted">Initializing session...</p></div>;
    
    if (isSessionInitialized && totalSessionItems === 0) return (
        <div className="text-center p-8">
            <h2 className="text-2xl font-bold">All caught up!</h2>
            <p className="text-text-muted mt-2">{isSpecialSession ? "No items to review." : "No items due for review in this deck."}</p>
            <Button onClick={() => onSessionEnd(deck.id, seriesId)} className="mt-6">Back</Button>
        </div>
    );

    const isSessionOver = isSessionInitialized && totalSessionItems > 0 && (itemsCompleted >= totalSessionItems || currentIndex >= sessionQueue.length);

    if (isSessionOver) {
        return <SessionSummary deckId={deck.id} seriesId={seriesId} reviewedItems={reviewedItems} nextDeckId={nextDeckId} onSessionEnd={onSessionEnd} onStudyNextDeck={onStudyNextDeck} isCramSession={sessionKeySuffix === '_cram'} />;
    }

    return (
        <div className="w-full max-w-3xl mx-auto p-4 flex flex-col h-full overflow-x-hidden">
            <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} infoCards={infoForModal} />
            <ProgressBar current={itemsCompleted} total={totalSessionItems} />
            
            <div className="flex-grow flex flex-col items-center justify-center my-4 w-full">
                {displayedItem && (
                    <div key={displayIndex} className="w-full relative animate-fade-in">
                        {isQuiz ? <QuizQuestion question={displayedItem as Question} selectedAnswerId={isHistorical ? (displayedItem as Question).correctAnswerId : selectedAnswerId} onSelectAnswer={(id) => isCurrent && !isAnswered && setSelectedAnswerId(id)} deckName={originalDeckName} onShowInfo={isLearningDeck ? handleShowInfo : undefined} />
                        : isInfoCard ? <InfoCardDisplay infoCard={displayedItem as InfoCard} />
                        : <Flashcard card={displayedItem as Card} isFlipped={isFlipped || isHistorical} />}
                    </div>
                )}
            </div>
            
            <SessionControls
                isCurrent={isCurrent} isHistorical={isHistorical} isFlipped={isFlipped} isAnswered={isAnswered} isReviewing={isReviewing}
                isQuiz={!!isQuiz} isInfoCard={!!isInfoCard} isCramSession={sessionKeySuffix === '_cram'} showNavArrows={sessionQueue.length > 1}
                displayIndex={displayIndex} currentIndex={currentIndex} queueLength={sessionQueue.length}
                onReview={handleReview} onSuspend={handleSuspend} onReadInfoCard={handleReadInfoCard}
                onFlip={() => setIsFlipped(true)} onReturnToCurrent={() => setDisplayIndex(currentIndex)}
                onNavigatePrevious={() => setDisplayIndex(d => d - 1)} onNavigateNext={() => setDisplayIndex(d => d + 1)}
                itemsCompleted={itemsCompleted} totalSessionItems={totalSessionItems}
            />
        </div>
    );
};

export default StudySession;