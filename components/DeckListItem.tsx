import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Deck, DeckType, FlashcardDeck, QuizDeck, LearningDeck } from '../types.ts';
import Button from './ui/Button.tsx';
import Link from './ui/Link.tsx';
import { getEffectiveMasteryLevel, getDueItemsCount } from '../services/srs.ts';
import MasteryBar from './ui/MasteryBar.tsx';
import Icon, { IconName } from './ui/Icon.tsx';
import { useRouter } from '../contexts/RouterContext.tsx';
import { stripHtml } from '../services/utils.ts';
import { useStore } from '../store/store.ts';
import Spinner from './ui/Spinner.tsx';
import { useSettings } from '../hooks/useSettings.ts';

interface DeckListItemProps {
  deck: Deck;
  sessionsToResume: Set<string>;
  onUpdateLastOpened: (deckId: string) => void;
  draggedDeckId: string | null;
  onDragStart: (deckId: string) => void;
  onDragEnd: () => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onDeleteDeck: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
  handleGenerateQuestionsForDeck?: (deck: QuizDeck) => void;
  handleGenerateContentForLearningDeck?: (deck: LearningDeck) => void;
}

// FIX: Changed to named export to resolve module resolution issues across multiple files.
export const DeckListItem: React.FC<DeckListItemProps> = ({ deck, sessionsToResume, onUpdateLastOpened, draggedDeckId, onDragStart, onDragEnd, onUpdateDeck, onDeleteDeck, openConfirmModal, handleGenerateQuestionsForDeck, handleGenerateContentForLearningDeck }) => {
    const { navigate } = useRouter();
    const { aiGenerationStatus } = useStore();
    const { aiFeaturesEnabled } = useSettings();
    
    const dueCount = getDueItemsCount(deck);
    const canResume = sessionsToResume.has(deck.id);
    const items = (deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : 
                  deck.type === DeckType.Learning ? (deck as LearningDeck).questions : 
                  (deck as FlashcardDeck).cards) || [];

    const itemCount = items?.length || 0;
    
    let itemLabel: string;
    let iconName: IconName;
    if (deck.type === DeckType.Quiz || deck.type === DeckType.Learning) {
        itemLabel = itemCount === 1 ? 'question' : 'questions';
        iconName = deck.type === DeckType.Learning ? 'book-open' : 'help-circle';
    } else {
        itemLabel = itemCount === 1 ? 'card' : 'cards';
        iconName = 'laptop';
    }

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const relevantTask = useMemo(() => {
        const { currentTask, queue } = aiGenerationStatus;
        if (currentTask?.deckId === deck.id) {
            return currentTask;
        }
        const deckQueue = Array.isArray(queue) ? queue : [];
        return deckQueue.find(task => task.deckId === deck.id);
    }, [aiGenerationStatus, deck.id]);

    const isTaskRunningForThisDeck = !!relevantTask;
    const isAnyTaskRunning = aiGenerationStatus.currentTask !== null || (aiGenerationStatus.queue?.length || 0) > 0;

    const isActionableEmptyDeck = (deck.type === DeckType.Quiz || deck.type === DeckType.Learning) && itemCount === 0;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const effectiveMastery = useMemo(() => {
        if (items.length === 0) return 0;
        const activeItems = items.filter(item => !item.suspended);
        if (activeItems.length === 0) return 0;
        const totalMastery = activeItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0);
        return totalMastery / activeItems.length;
    }, [items]);
    
    const studyButtonText = useMemo(() => {
        if (deck.locked) return "Locked";
        if (isActionableEmptyDeck && !isAnyTaskRunning) return "Generate";
        if (canResume) return "Resume";
        return `Study (${dueCount})`;
    }, [deck.locked, isActionableEmptyDeck, isAnyTaskRunning, canResume, dueCount]);

    const handlePrimaryAction = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (deck.locked) return;
        if (isActionableEmptyDeck && !isAnyTaskRunning) {
            if (deck.type === DeckType.Quiz && handleGenerateQuestionsForDeck) {
                handleGenerateQuestionsForDeck(deck as QuizDeck);
            } else if (deck.type === DeckType.Learning && handleGenerateContentForLearningDeck) {
                handleGenerateContentForLearningDeck(deck as LearningDeck);
            }
            return;
        }
        if (itemCount > 0) {
            navigate(`/decks/${deck.id}/study`);
        }
    };
    
    return (
        <Link 
            href={`/decks/${deck.id}`}
            draggable="true"
            onDragStart={(e: React.DragEvent) => {
                e.dataTransfer.setData('text/plain', deck.id);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(deck.id);
            }}
            onDragEnd={onDragEnd}
            onClick={() => onUpdateLastOpened(deck.id)}
            className={`block bg-surface rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-transparent hover:border-primary ${draggedDeckId === deck.id ? 'opacity-30' : ''}`}
        >
             <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center mb-1">
                            <Icon name={iconName} className="w-5 h-5 mr-2 text-text-muted flex-shrink-0" />
                            <h3 className="text-xl font-bold text-text break-words">{deck.name}</h3>
                        </div>
                        {deck.description && (
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none text-text-muted mt-1 truncate"
                                title={stripHtml(deck.description)}
                                dangerouslySetInnerHTML={{ __html: deck.description }}
                            />
                        )}
                    </div>
                    <div ref={menuRef} className="relative flex-shrink-0 -mr-2">
                        <Button
                            variant="ghost"
                            className="p-2 h-auto"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(prev => !prev); }}
                            aria-label={`More options for deck ${deck.name}`}
                        >
                            <Icon name="more-vertical" className="w-5 h-5" />
                        </Button>
                        {isMenuOpen && (
                             <div className="absolute right-0 mt-2 w-48 bg-surface rounded-md shadow-lg py-1 z-10 ring-1 ring-black ring-opacity-5 animate-fade-in" style={{ animationDuration: '150ms' }}>
                                 <button onClick={(e) => { e.preventDefault(); onUpdateDeck({...deck, archived: true}, { toastMessage: `Deck "${deck.name}" archived.` }); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2 text-sm text-left text-text hover:bg-border/20"><Icon name="archive" className="w-4 h-4 mr-3" /> Archive</button>
                                 <button onClick={(e) => { e.preventDefault(); onDeleteDeck(deck.id); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Icon name="trash-2" className="w-4 h-4 mr-3" /> Move to Trash</button>
                            </div>
                        )}
                    </div>
                </div>
                {itemCount > 0 && (
                    <div className="mt-3">
                        <MasteryBar level={effectiveMastery} />
                    </div>
                )}
                <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center">
                    <div className="text-sm text-text-muted">
                        {itemCount} {itemLabel}
                    </div>
                    {isTaskRunningForThisDeck ? (
                        <div className="flex items-center gap-2">
                            <Spinner size="sm" />
                            <span className="text-sm font-semibold text-text-muted">{relevantTask.statusText || 'Generating...'}</span>
                        </div>
                    ) : (
                         <Button
                            variant={(isActionableEmptyDeck && aiFeaturesEnabled) ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={handlePrimaryAction}
                            disabled={deck.locked || (itemCount === 0 && !isActionableEmptyDeck)}
                        >
                            <Icon name={deck.locked ? 'lock' : (isActionableEmptyDeck ? 'zap' : 'laptop')} className="w-4 h-4 mr-2"/>
                            {studyButtonText}
                        </Button>
                    )}
                </div>
            </div>
        </Link>
    );
};
