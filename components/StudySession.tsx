
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
// FIX: Corrected import path for types
import { Card, Question, ReviewRating, Deck, Reviewable, QuizDeck, LearningDeck, InfoCard, SessionState, DeckType, FlashcardDeck } from '../types';
import { calculateNextReview, getEffectiveMasteryLevel } from '../services/srs.ts';
import { saveSessionState, deleteSessionState } from '../services/db.ts';
import Flashcard from './Flashcard.tsx';
import QuizQuestion from './QuizQuestion.tsx';
import Button from './ui/Button.tsx';
import ProgressBar from './ui/ProgressBar.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import { useToast } from '../hooks/useToast.ts';
import { useStore } from '../store/store.ts';
import InfoCardDisplay from './InfoCardDisplay.tsx';
import InfoModal from './InfoModal.tsx';
import { useSessionQueue } from '../hooks/useSessionQueue.ts';
import SessionSummary from './SessionSummary.tsx';
import SessionControls from './SessionControls.tsx';
import Link from './ui/Link.tsx';
import { useData } from '../contexts/DataManagementContext.tsx';
import { explainConcept } from '../services/aiService.ts';
import ExplanationModal from './ExplanationModal.tsx';
import Icon from './ui/Icon.tsx';
import Spinner from './ui/Spinner.tsx';
import { stripHtml } from '../services/utils.ts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.ts';

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

    // Explanation State
    const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);
    const [explanationText, setExplanationText] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);

    // Settings & Zen Mode State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [textSize, setTextSize] = useState<'normal' | 'large' | 'huge'>('normal');
    const [isZenMode, setIsZenMode] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    const { hapticsEnabled, aiFeaturesEnabled, leechThreshold, leechAction } = useSettings();
    const { addToast } = useToast();
    const { deckSeries, seriesProgress } = useStore();
    const dataHandlers = useData();
    const series = seriesId ? deckSeries[seriesId] : null;
    
    const isSpecialSession = useMemo(() => deck.id === 'general-study-deck' || ['_cram', '_flip', '_reversed'].includes(sessionKeySuffix), [deck.id, sessionKeySuffix]);
    const sessionKey = `session_deck_${deck.id}${sessionKeySuffix}`;
    const isLearningDeck = deck.type === 'learning';

    const { sessionQueue, setSessionQueue, isSessionInitialized, initialIndex, readInfoCardIds, setReadInfoCardIds, unlockedQuestionIds, setUnlockedQuestionIds, initialItemsCompleted } = useSessionQueue(deck, sessionKey, isSpecialSession);
    
    useEffect(() => {
        if (isSessionInitialized) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
    }, [currentIndex, isSessionInitialized]);

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

    const displayedItem = useMemo(() => sessionQueue[displayIndex], [sessionQueue, displayIndex]);
    const isHistorical = displayIndex < currentIndex;
    const isCurrent = displayIndex === currentIndex;
    const isQuiz = displayedItem && 'questionText' in displayedItem;
    const isInfoCard = displayedItem && 'content' in displayedItem && !('front' in displayedItem);
    const isAnswered = selectedAnswerId !== null;

    const { title, subtitle, titleLink } = useMemo(() => {
        const itemDeckName = displayedItem && 'originalDeckName' in displayedItem ? (displayedItem as any).originalDeckName : undefined;
        const itemDeckId = displayedItem && 'originalDeckId' in displayedItem ? (displayedItem as any).originalDeckId : deck.id;
        const itemSeriesName = displayedItem && 'originalSeriesName' in displayedItem ? (displayedItem as any).originalSeriesName : undefined;
        const itemSeriesId = displayedItem && 'originalSeriesId' in displayedItem ? (displayedItem as any).originalSeriesId : undefined;

        if (deck.id === 'general-study-deck') {
            const title = itemSeriesName || itemDeckName || "General Study";
            const titleLink = itemSeriesId ? `/series/${itemSeriesId}` : `/decks/${itemDeckId}`;
            const subtitle = itemSeriesName ? itemDeckName : undefined;
            return { title, subtitle, titleLink };
        } else {
            // Regular session
            const title = deck.name;
            const titleLink = `/decks/${deck.id}${seriesId ? `?seriesId=${seriesId}` : ''}`;
            return { title, subtitle: undefined, titleLink };
        }
    }, [displayedItem, deck.id, deck.name, seriesId, series]);


    const nextDeckId = useMemo(() => {
        if (!seriesId || itemsCompleted < totalSessionItems) return null;
        const series = deckSeries[seriesId];
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
        
        // Leech Handling Logic
        const threshold = leechThreshold || 8;
        if ((updatedItem.lapses || 0) >= threshold && !displayedItem.suspended) {
            if (leechAction === 'suspend') {
                updatedItem = { ...updatedItem, suspended: true };
                addToast("Item suspended (Leech).", "info");
            } else if (leechAction === 'tag') {
                const currentTags = (updatedItem as Question).tags || (updatedItem as Card).tags || [];
                if (!currentTags.includes('leech')) {
                    (updatedItem as any).tags = [...currentTags, 'leech'];
                    addToast("Item tagged as Leech.", "info");
                }
            } else if (leechAction === 'warn') {
                addToast("Warning: You are struggling with this item.", "warning");
            }
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
    }, [displayedItem, isCurrent, isReviewing, sessionKeySuffix, advanceToNext, hapticsEnabled, addToast, deck.id, onItemReviewed, seriesId, currentIndex, setSessionQueue, leechThreshold, leechAction]);

    const handleSuspend = useCallback(async () => {
        if (!displayedItem || !isCurrent || isReviewing || !('interval' in displayedItem)) return;

        const itemToSuspend = displayedItem;
        setIsReviewing(true);
        const updatedItem = { ...itemToSuspend, suspended: true };
        
        setReviewedItems(prev => [...prev, { oldItem: itemToSuspend, newItem: updatedItem, rating: null }]);

        try {
            const originalDeckId = (itemToSuspend as any).originalDeckId || deck.id;
            await onItemReviewed(originalDeckId, updatedItem, null, seriesId);
            addToast("Item suspended.", "info");
        } catch (error) {
            console.error("Failed to suspend item:", error);
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
        if (isCurrent && !isAnswered) {
            setSelectedAnswerId(optionId);
            setSessionQueue(prevQueue => {
                const newQueue = [...prevQueue];
                const currentItem = newQueue[currentIndex];
                if (currentItem && 'questionText' in currentItem) {
                    newQueue[currentIndex] = { ...currentItem, userSelectedAnswerId: optionId };
                }
                return newQueue;
            });
        }
    }, [isCurrent, isAnswered, currentIndex, setSessionQueue]);

    const handleReadInfoCard = useCallback(() => {
        if (isCurrent && isInfoCard) {
            const infoCard = displayedItem as InfoCard;
            setReadInfoCardIds(prev => new Set(prev).add(infoCard.id));
            setUnlockedQuestionIds(prev => new Set([...prev, ...infoCard.unlocksQuestionIds]));
            
            const newlyUnlockedQuestions = (deck as LearningDeck).questions
                .filter(q => infoCard.unlocksQuestionIds.includes(q.id));

            const currentQueueIds = new Set(sessionQueue.map(item => item.id));
            const questionsToAdd = newlyUnlockedQuestions.filter(q => !currentQueueIds.has(q.id));

            if (questionsToAdd.length > 0) {
                questionsToAdd.sort(() => Math.random() - 0.5);
                setSessionQueue(prev => {
                    const nextQueue = [...prev];
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

    const handleGenerateAudioForCard = useCallback(async (card: Card, side: 'front' | 'back') => {
        const actualDeckId = (card as any).originalDeckId || deck.id;
        const audio = await dataHandlers?.handleGenerateAudioForCard(actualDeckId, card, side);
        
        if (audio) {
            setSessionQueue(prev => prev.map(item => {
                if (item.id === card.id) {
                    return {
                        ...item,
                        [side === 'front' ? 'frontAudio' : 'backAudio']: audio
                    };
                }
                return item;
            }));
        }
        return audio;
    }, [deck.id, dataHandlers, setSessionQueue]);

    const handleExplain = async () => {
        if (!displayedItem) return;
        
        setIsExplaining(true);
        try {
            let concept = '';
            let context = '';
            
            if ('questionText' in displayedItem) {
                const q = displayedItem as Question;
                const correctAnswer = q.options.find(o => o.id === q.correctAnswerId)?.text || '';
                concept = `${q.questionText} Answer: ${correctAnswer}`;
                context = `The user is studying a quiz about "${deck.name}".`;
            } else if ('front' in displayedItem) {
                const c = displayedItem as Card;
                concept = `${c.front} = ${c.back}`;
                context = `The user is studying flashcards about "${deck.name}".`;
            }

            const cleanConcept = stripHtml(concept);
            
            const explanation = await explainConcept(cleanConcept, context);
            setExplanationText(explanation);
            setIsExplanationModalOpen(true);
        } catch (error) {
            addToast("Failed to generate explanation.", "error");
        } finally {
            setIsExplaining(false);
        }
    };

    // Keyboard Shortcuts Configuration
    const shortcuts = useMemo(() => ({
        'Space': (e: KeyboardEvent) => {
            if (!isCurrent || isReviewing) return;
            e.preventDefault();
            if (!isQuiz && !isFlipped) {
                handleFlip();
            } else if (isInfoCard) {
                handleReadInfoCard();
            }
        },
        'Digit1': (e: KeyboardEvent) => {
            if (!isCurrent || isReviewing) return;
            const canRate = isFlipped || (isQuiz && isAnswered);
            if (canRate) {
                e.preventDefault();
                handleReview(ReviewRating.Again);
            }
        },
        'Digit2': (e: KeyboardEvent) => {
            if (!isCurrent || isReviewing) return;
            const canRate = isFlipped || (isQuiz && isAnswered);
            if (canRate) {
                e.preventDefault();
                handleReview(ReviewRating.Hard);
            }
        },
        'Digit3': (e: KeyboardEvent) => {
            if (!isCurrent || isReviewing) return;
            const canRate = isFlipped || (isQuiz && isAnswered);
            if (canRate) {
                e.preventDefault();
                handleReview(ReviewRating.Good);
            }
        },
        'Digit4': (e: KeyboardEvent) => {
            if (!isCurrent || isReviewing) return;
            const canRate = isFlipped || (isQuiz && isAnswered);
            if (canRate) {
                e.preventDefault();
                handleReview(ReviewRating.Easy);
            }
        }
    }), [isCurrent, isReviewing, isFlipped, isQuiz, isInfoCard, isAnswered, handleFlip, handleReadInfoCard, handleReview]);

    useKeyboardShortcuts(shortcuts);
    
    // Tailwind class mapping for text size
    const contentTextSizeClass = useMemo(() => {
        switch (textSize) {
            case 'large': return 'text-lg md:text-xl';
            case 'huge': return 'text-xl md:text-2xl';
            case 'normal': default: return 'text-base md:text-lg';
        }
    }, [textSize]);

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
    
    // Improved container styling - single column layout for all sizes
    const containerClasses = isZenMode 
        ? "fixed inset-0 z-[100] bg-background flex flex-col p-4 overflow-y-auto"
        : "flex flex-col h-full animate-fade-in pb-20 relative mx-auto max-w-3xl px-4 lg:pb-12 lg:h-auto";

    return (
        <div className={containerClasses}>
            {/* Main Content Area */}
            <div className="flex-grow w-full flex flex-col relative z-10">
                {/* Top Bar Area: Progress */}
                {!isZenMode && (
                    <div className="w-full relative flex items-start justify-between min-h-[1rem] mb-2 lg:mb-6">
                        <div className="w-full mt-1">
                            <ProgressBar current={itemsCompleted} total={totalSessionItems} />
                        </div>
                    </div>
                )}

                {/* Title & Subtitle (Hidden in Zen Mode) */}
                {!isZenMode && (
                    <div className="text-center mt-2 mb-2 px-4 relative lg:mb-6">
                        {deck.id !== 'general-study-deck' && series && (
                            <div className="mb-1">
                                <span className="text-xs text-text-muted mr-1">in</span>
                                <Link href={`/series/${series.id}`} className="text-xs font-semibold text-text-muted hover:underline break-words">
                                    {series.name}
                                </Link>
                            </div>
                        )}
                        <Link href={titleLink} className="text-lg font-bold text-text hover:underline break-words">
                            {title}
                        </Link>
                    </div>
                )}

                {/* Main Content Area */}
                <div className={`flex-grow flex flex-col items-center justify-center pb-4 ${isZenMode ? 'w-full max-w-4xl mx-auto' : ''}`}>
                    <div className="w-full relative">
                        {!isZenMode && subtitle && <p className="text-center text-xs mb-2 text-text-muted uppercase tracking-wider font-semibold">{subtitle}</p>}
                        
                        {isInfoCard ? (
                            <InfoCardDisplay 
                                infoCard={displayedItem as InfoCard} 
                                textSize={contentTextSizeClass}
                            />
                        ) : isQuiz ? (
                            <QuizQuestion
                                key={displayedItem!.id}
                                question={displayedItem as Question}
                                selectedAnswerId={isCurrent ? selectedAnswerId : (displayedItem as Question).userSelectedAnswerId || null}
                                onSelectAnswer={handleSelectAnswer}
                                onShowInfo={isLearningDeck ? handleShowInfo : undefined}
                                textSize={contentTextSizeClass}
                            />
                        ) : (
                            <Flashcard
                                key={displayedItem!.id}
                                card={displayedItem as Card}
                                isFlipped={isFlipped}
                                onGenerateAudio={handleGenerateAudioForCard}
                                deckId={(displayedItem as any).originalDeckId || deck.id}
                                onReview={handleReview}
                                textSize={contentTextSizeClass}
                            />
                        )}
                    </div>
                    
                    {aiFeaturesEnabled && isCurrent && (isFlipped || (isQuiz && isAnswered)) && (
                        <div className="mt-4 animate-fade-in">
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={handleExplain} 
                                disabled={isExplaining}
                                className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 border-transparent"
                            >
                                {isExplaining ? <Spinner size="sm" /> : <Icon name="bot" className="w-4 h-4 mr-2" />}
                                {isExplaining ? 'Thinking...' : "Explain Like I'm 5"}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Controls Area - Always below content */}
            <div className={isZenMode ? "w-full max-w-2xl mx-auto pb-4" : "mt-6 w-full max-w-2xl mx-auto pb-4"}>
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
                    onSuspend={handleSuspend}
                    onReadInfoCard={handleReadInfoCard}
                    onFlip={handleFlip}
                    onReturnToCurrent={handleReturnToCurrent}
                    onNavigatePrevious={handleNavigatePrevious}
                    onNavigateNext={handleNavigateNext}
                    itemsCompleted={itemsCompleted}
                    totalSessionItems={totalSessionItems}
                />
                
                {/* Footer Controls (Zen, Settings) */}
                <div className="mt-6 flex justify-center items-center gap-4 relative z-20" ref={settingsRef}>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsZenMode(!isZenMode)} 
                        className="text-text-muted hover:text-primary rounded-full p-2"
                        title={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
                    >
                        <Icon name={isZenMode ? "minimize" : "maximize"} className="w-5 h-5" />
                    </Button>
                    
                    <div className="relative">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                            className="text-text-muted hover:text-primary rounded-full p-2"
                            aria-label="Session Settings"
                        >
                            <Icon name="settings" className="w-5 h-5" />
                        </Button>

                        {isSettingsOpen && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-surface shadow-xl border border-border rounded-lg p-4 animate-fade-in text-left z-50">
                                <h4 className="text-sm font-semibold text-text mb-3 border-b border-border pb-1">Session Settings</h4>
                                
                                <div className="mb-4">
                                    <label className="flex items-center text-xs font-semibold text-text-muted mb-2">
                                        <Icon name="type" className="w-3 h-3 mr-1" /> Text Size
                                    </label>
                                    <div className="flex bg-background rounded-md p-1 border border-border">
                                        <button 
                                            onClick={() => setTextSize('normal')} 
                                            className={`flex-1 py-1 px-2 text-xs rounded transition-colors ${textSize === 'normal' ? 'bg-primary text-on-primary shadow-sm' : 'text-text hover:bg-border/50'}`}
                                        >
                                            A
                                        </button>
                                        <button 
                                            onClick={() => setTextSize('large')} 
                                            className={`flex-1 py-1 px-2 text-sm font-medium rounded transition-colors ${textSize === 'large' ? 'bg-primary text-on-primary shadow-sm' : 'text-text hover:bg-border/50'}`}
                                        >
                                            A+
                                        </button>
                                        <button 
                                            onClick={() => setTextSize('huge')} 
                                            className={`flex-1 py-1 px-2 text-base font-bold rounded transition-colors ${textSize === 'huge' ? 'bg-primary text-on-primary shadow-sm' : 'text-text hover:bg-border/50'}`}
                                        >
                                            A++
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="flex items-center text-xs font-semibold text-text-muted mb-2">
                                        <Icon name="keyboard" className="w-3 h-3 mr-1" /> Shortcuts
                                    </label>
                                    <ul className="text-xs text-text space-y-1 bg-background p-2 rounded-md border border-border">
                                        <li className="flex justify-between"><span>Flip / Next</span> <kbd className="font-mono bg-border px-1 rounded">Space</kbd></li>
                                        <li className="flex justify-between"><span>Rate Answer</span> <kbd className="font-mono bg-border px-1 rounded">1 - 4</kbd></li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <InfoModal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                infoCards={infoForModal}
            />
            
            <ExplanationModal
                isOpen={isExplanationModalOpen}
                onClose={() => setIsExplanationModalOpen(false)}
                title={displayedItem && 'questionText' in displayedItem ? stripHtml((displayedItem as Question).questionText) : (displayedItem && 'front' in displayedItem ? stripHtml((displayedItem as Card).front) : 'Concept')}
                explanation={explanationText}
            />
        </div>
    );
};

export default StudySession;
