import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Deck, DeckType, FlashcardDeck, QuizDeck, LearningDeck } from '../types';
import Button from './ui/Button';
import Link from './ui/Link';
import { getEffectiveMasteryLevel } from '../services/srs';
import MasteryBar from './ui/MasteryBar';
import Icon, { IconName } from './ui/Icon';
import { useRouter } from '../contexts/RouterContext';
import { stripHtml } from '../services/utils';
import { useStore } from '../store/store';
import Spinner from './ui/Spinner';
import { useSettings } from '../hooks/useSettings';

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
  onGenerateQuestionsForDeck?: (deck: QuizDeck) => void;
  onGenerateContentForLearningDeck?: (deck: LearningDeck) => void;
}

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : 
                  deck.type === DeckType.Learning ? (deck as LearningDeck).questions : 
                  (deck as FlashcardDeck).cards;
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

const DeckListItem: React.FC<DeckListItemProps> = ({ deck, sessionsToResume, onUpdateLastOpened, draggedDeckId, onDragStart, onDragEnd, onUpdateDeck, onDeleteDeck, openConfirmModal, onGenerateQuestionsForDeck, onGenerateContentForLearningDeck }) => {
    const { navigate } = useRouter();
    const { aiGenerationStatus } = useStore();
    const { aiFeaturesEnabled } = useSettings();
    
    const dueCount = getDueItemsCount(deck);
    const canResume = sessionsToResume.has(deck.id);
    const items = deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : 
                  deck.type === DeckType.Learning ? (deck as LearningDeck).questions : 
                  (deck as FlashcardDeck).cards;

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

    const isTaskRunningForThisDeck = useMemo(() => {
        const { currentTask, queue } = aiGenerationStatus;
        if (currentTask?.deckId === deck.id) return true;
        return queue.some(task => task.deckId === deck.id);
    }, [aiGenerationStatus, deck.id]);

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

    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, a')) {
            return;
        }
        onUpdateLastOpened(deck.id);
        navigate(`/decks/${deck.id}`);
    };

    const handleArchive = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateDeck({ ...deck, archived: true });
        setIsMenuOpen(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        openConfirmModal({
            title: 'Move Deck to Trash',
            message: `Are you sure you want to move the deck "${deck.name}" to the trash?`,
            onConfirm: () => onDeleteDeck(deck.id),
        });
        setIsMenuOpen(false);
    };

    const masteryLevel = useMemo(() => {
        const activeItems = items?.filter(item => !item.suspended);
        if (!activeItems || activeItems.length === 0) return 0;
        const totalMastery = activeItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0);
        return totalMastery / activeItems.length;
    }, [items]);

    const handleGenerate = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (deck.type === DeckType.Quiz && onGenerateQuestionsForDeck) {
            onGenerateQuestionsForDeck(deck as QuizDeck);
        } else if (deck.type === DeckType.Learning && onGenerateContentForLearningDeck) {
            onGenerateContentForLearningDeck(deck as LearningDeck);
        }
    };
    
    return (
        <div
            draggable
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', deck.id); onDragStart(deck.id); }}
            onDragEnd={onDragEnd}
            onClick={handleContainerClick}
            className={`bg-surface rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-transparent hover:border-primary cursor-pointer relative ${draggedDeckId === deck.id ? 'opacity-50 scale-95' : ''}`}
        >
             <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center mb-1">
                            <Icon name={iconName} className="w-5 h-5 mr-2 text-text-muted" />
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
                    <div className="flex-shrink-0 flex items-center gap-1" ref={menuRef}>
                         <Button
                            variant="ghost"
                            className="p-2 h-auto"
                            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(p => !p); }}
                            aria-label={`More options for deck ${deck.name}`}
                        >
                            <Icon name="more-vertical" className="w-5 h-5" />
                        </Button>
                        {isMenuOpen && (
                            <div
                                className="absolute top-12 right-4 w-48 bg-surface rounded-md shadow-lg py-1 z-10 ring-1 ring-black ring-opacity-5 animate-fade-in"
                                style={{ animationDuration: '150ms' }}
                                onClick={e => e.stopPropagation()}
                            >
                                <button type="button" onClick={handleArchive} className="flex items-center w-full px-4 py-2 text-sm text-left text-text hover:bg-border/20">
                                    <Icon name="archive" className="w-4 h-4 mr-3" /> Archive
                                </button>
                                <div className="border-t border-border my-1"></div>
                                <button type="button" onClick={handleDelete} className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <Icon name="trash-2" className="w-4 h-4 mr-3" /> Move to Trash
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-3 space-y-3">
                    <MasteryBar level={masteryLevel} />
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-text-muted">{itemCount} {itemLabel}</p>
                        <p className={`text-sm font-semibold ${dueCount > 0 ? 'text-primary' : 'text-text-muted'}`}>{dueCount} due</p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex justify-end gap-2">
                    { isTaskRunningForThisDeck ? (
                        <div className="flex items-center text-text-muted">
                            <Spinner size="sm" />
                            <span className="ml-2 text-sm font-semibold">Generating...</span>
                        </div>
                    ) : (
                        <>
                        {isActionableEmptyDeck && aiFeaturesEnabled && (
                            <Button variant="secondary" size="sm" onClick={handleGenerate}>
                                <Icon name="zap" className="w-4 h-4 mr-2"/>
                                Generate Content
                            </Button>
                        )}
                        <Link
                            href={`/decks/${deck.id}/study`}
                            passAs={Button}
                            variant="primary"
                            size="sm"
                            disabled={deck.locked || (dueCount === 0 && !canResume) || itemCount === 0}
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdateLastOpened(deck.id);
                            }}
                        >
                            <Icon name={deck.locked ? 'lock' : (canResume ? 'zap' : 'laptop')} className="w-4 h-4 mr-2"/>
                            {canResume ? 'Resume' : 'Study'}
                        </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeckListItem;
