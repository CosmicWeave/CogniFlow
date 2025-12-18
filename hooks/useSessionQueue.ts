
import { useState, useEffect } from 'react';
import { Deck, Card, Question, InfoCard, DeckType, FlashcardDeck, QuizDeck, LearningDeck } from '../types';
import { getSessionState, deleteSessionState } from '../services/db';
import { useStore } from '../store/store';

export const useSessionQueue = (deck: Deck, sessionKey: string, isSpecialSession: boolean) => {
    const [sessionQueue, setSessionQueue] = useState<(Card | Question | InfoCard)[]>([]);
    const [isSessionInitialized, setIsSessionInitialized] = useState(false);
    const [readInfoCardIds, setReadInfoCardIds] = useState<Set<string>>(new Set());
    const [unlockedQuestionIds, setUnlockedQuestionIds] = useState<Set<string>>(new Set());
    const [initialIndex, setInitialIndex] = useState(0);
    const [initialItemsCompleted, setInitialItemsCompleted] = useState(0);
    const { learningProgress } = useStore();

    useEffect(() => {
        const initializeSession = async () => {
            if (isSessionInitialized) return;

            const isLearningDeck = deck.type === DeckType.Learning;
            // Access learningMode safely
            const learningMode = isLearningDeck ? (deck as LearningDeck).learningMode : 'separate';

            if (isSpecialSession) {
                const itemsToReview = (deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : (deck as QuizDeck | LearningDeck).questions) || [];
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

                if (isLearningDeck && learningMode === 'mixed') {
                    const learningDeck = deck as LearningDeck;
                    const progress = learningProgress[deck.id];
                    const readSet = new Set(progress?.readInfoCardIds || []);
                    
                    // Mixed Mode Logic: Linear progression
                    // 1. Build full linear queue: Info -> Linked Questions -> Next Info...
                    const fullQueue: (InfoCard | Question)[] = [];
                    const questions = learningDeck.questions || [];
                    
                    // Assume InfoCards are ordered by array index
                    (learningDeck.infoCards || []).forEach(infoCard => {
                        fullQueue.push(infoCard);
                        // Find questions linked to this card
                        const linkedQuestions = questions.filter(q => q.infoCardIds?.includes(infoCard.id));
                        fullQueue.push(...linkedQuestions);
                    });

                    // 2. Find start point: First *unread* InfoCard
                    let startIndex = 0;
                    for (let i = 0; i < fullQueue.length; i++) {
                        const item = fullQueue[i];
                        if ('content' in item) { // Is InfoCard
                            if (!readSet.has(item.id)) {
                                startIndex = i;
                                break;
                            }
                        }
                    }
                    
                    // If all read, maybe we just do due questions? 
                    // For now, let's just show from the start point forward.
                    // If everything is read, this logic effectively shows nothing new,
                    // but we should check for due questions from the "past".
                    
                    const mixedQueue = fullQueue.slice(startIndex);
                    
                    // Add due questions from "read" sections if they aren't already in the remaining queue
                    const mixedIds = new Set(mixedQueue.map(i => i.id));
                    const duePastQuestions = questions.filter(q => 
                        !mixedIds.has(q.id) &&
                        !q.suspended &&
                        new Date(q.dueDate) <= today &&
                        // It must be unlocked (which it likely is if we passed its info card)
                        // But let's check unlocked set to be safe
                        (progress?.unlockedQuestionIds || []).includes(q.id)
                    );
                    
                    // Prepend due items for review before new content? Or mix in?
                    // Let's prepend them for a "Review then Learn" flow
                    setSessionQueue([...duePastQuestions, ...mixedQueue]);

                } else if (isLearningDeck) {
                    // Separate Mode (Review Only)
                    const learningDeck = deck as LearningDeck;
                    const progress = learningProgress[deck.id];
                    const unlockedSet = new Set(progress?.unlockedQuestionIds || []);
                    
                    // Filter questions: must be unlocked AND due
                    const dueQuestions = (learningDeck.questions || []).filter(
                        q => !q.suspended && 
                             new Date(q.dueDate) <= today &&
                             unlockedSet.has(q.id)
                    ).sort(() => Math.random() - 0.5);

                    setSessionQueue(dueQuestions);
                } else {
                    // Standard Quiz/Flashcard
                    const itemsToReview = (deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : (deck as QuizDeck).questions) || [];
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
    }, [deck, sessionKey, isSpecialSession, isSessionInitialized, learningProgress]);

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
