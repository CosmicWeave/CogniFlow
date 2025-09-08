import { useState, useEffect } from 'react';
import { Deck, Card, Question, InfoCard, DeckType, FlashcardDeck, QuizDeck, LearningDeck } from '../types';
import { getSessionState, deleteSessionState } from '../services/db';

export const useSessionQueue = (deck: Deck, sessionKey: string, isSpecialSession: boolean) => {
    const [sessionQueue, setSessionQueue] = useState<(Card | Question | InfoCard)[]>([]);
    const [isSessionInitialized, setIsSessionInitialized] = useState(false);
    const [readInfoCardIds, setReadInfoCardIds] = useState<Set<string>>(new Set());
    const [unlockedQuestionIds, setUnlockedQuestionIds] = useState<Set<string>>(new Set());
    const [initialIndex, setInitialIndex] = useState(0);
    const [initialItemsCompleted, setInitialItemsCompleted] = useState(0);

    useEffect(() => {
        const initializeSession = async () => {
            if (isSessionInitialized) return;

            const isLearningDeck = deck.type === DeckType.Learning;

            if (isSpecialSession) {
                const itemsToReview = deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : (deck as QuizDeck | LearningDeck).questions;
                setSessionQueue(itemsToReview);
                setInitialIndex(0);
                setInitialItemsCompleted(0);
                setIsSessionInitialized(true);
                return;
            }

            let sessionResumed = false;
            try {
                const savedSession = await getSessionState(sessionKey);
                if (savedSession?.reviewQueue?.length > 0 && typeof savedSession.currentIndex === 'number') {
                    setSessionQueue(savedSession.reviewQueue);
                    setInitialIndex(savedSession.currentIndex);
                    setInitialItemsCompleted(savedSession.itemsCompleted ?? savedSession.currentIndex);
                    if (isLearningDeck) {
                        setReadInfoCardIds(new Set(savedSession.readInfoCardIds || []));
                        setUnlockedQuestionIds(new Set(savedSession.unlockedQuestionIds || []));
                    }
                    sessionResumed = true;
                } else if (savedSession) {
                    await deleteSessionState(sessionKey);
                }
            } catch (e) {
                console.error("Failed to load saved session from DB", e);
            }

            if (!sessionResumed) {
                const today = new Date();
                today.setHours(23, 59, 59, 999);

                if (isLearningDeck) {
                    setSessionQueue((deck as LearningDeck).infoCards);
                    setReadInfoCardIds(new Set());
                    setUnlockedQuestionIds(new Set());
                } else {
                    const itemsToReview = deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : (deck as QuizDeck).questions;
                    const dueItems = itemsToReview
                        .filter(item => !item.suspended && new Date(item.dueDate) <= today)
                        .sort(() => Math.random() - 0.5);
                    setSessionQueue(dueItems);
                }
                setInitialIndex(0);
                setInitialItemsCompleted(0);
            }
            setIsSessionInitialized(true);
        };

        initializeSession();
    }, [deck, sessionKey, isSpecialSession, isSessionInitialized]);

    return {
        sessionQueue,
        setSessionQueue,
        isSessionInitialized,
        initialIndex,
        initialItemsCompleted,
        readInfoCardIds,
        setReadInfoCardIds,
        unlockedQuestionIds,
        setUnlockedQuestionIds,
    };
};