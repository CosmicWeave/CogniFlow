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
        iconName = deck.type === DeckType.Learning ? 'layers' : 'help-circle';
    } else {
        itemLabel = itemCount === 1 ? 'card' : 'cards';
        iconName = 'laptop';
    }

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isGeneratingThisDeck = aiGenerationStatus.isGenerating && aiGenerationStatus.generatingDeckId === deck.id;
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
        onUpdateDeck({ ...deck, archived: true });
        setIsMenuOpen(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        openConfirmModal({
            title: 'Move Deck to Trash',
            message: `Are you sure you want to move the deck "${deck.name}" to the trash? It will be permanently deleted after 10 days.`,
            onConfirm: () => onDeleteDeck(deck.id),
        });
        setIsMenuOpen(false);
    };

    const averageMastery = useMemo(() => {
        if (!items) return 0;
        const activeItems = items.filter(i => !i.suspended);
        if (activeItems.length === 0) return 0;
        const totalMastery = activeItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0);
        return totalMastery / activeItems.length;
    }, [items]);

    return (
        <div
            key={deck.id}
            draggable="true"
            onClick={handleContainerClick}
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', deck.id);
                // The browser creates the drag image from the element's current state.
                // We defer the state update that changes its appearance to a "placeholder".
                setTimeout(() => onDragStart(deck.id), 0);
            }}
            onDragEnd={onDragEnd}
            className={`bg-surface rounded-lg shadow-md hover:shadow-lg transition-all duration-200 group relative ${draggedDeckId === deck.id ? 'border-2 border-dashed border-border bg-background/50' : 'cursor-pointer'}`}
        >
            <div className={`p-4 pr-10 flex flex-col justify-between h-full space-y-3 ${draggedDeckId === deck.id ? 'opacity-0' : ''}`}>
                <div>
                    <h3 className="text-xl font-bold text-text break-words group-hover:text-primary transition-colors">{deck.name}</h3>
                    {deck.description && (
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none text-text-muted mt-1 truncate"
                            title={stripHtml(deck.description)}
                            dangerouslySetInnerHTML={{ __html: deck.description }}
                        />
                    )}
                </div>

                <MasteryBar level={averageMastery} />

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 text-sm text-text-muted">
                        <span className="flex items-center gap-1.5">
                            <Icon name={iconName} className="w-4 h-4" />
                            {itemCount} {itemLabel}
                        </span>
                        <span className={`flex items-center gap-1.5 font-semibold ${dueCount > 0 ? 'text-primary' : ''}`}>
                            <Icon name="zap" className="w-4 h-4" />
                            {dueCount} due
                        </span>
                    </div>

                    <div className="flex items-center space-x-1">
                        {isGeneratingThisDeck ? (
                            <div className="flex items-center text-text-muted pr-1">
                                <Spinner size="sm" />
                                <span className="ml-2 text-sm font-semibold">Generating...</span>
                            </div>
                        ) : (
                            <>
                                {aiFeaturesEnabled && isActionableEmptyDeck ? (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (deck.type === DeckType.Quiz && onGenerateQuestionsForDeck) {
                                                onGenerateQuestionsForDeck(deck as QuizDeck);
                                            } else if (deck.type === DeckType.Learning && onGenerateContentForLearningDeck) {
                                                onGenerateContentForLearningDeck(deck as LearningDeck);
                                            }
                                        }}
                                        className="font-semibold"
                                    >
                                       <Icon name="zap" className="w-4 h-4 mr-1.5"/>
                                       Generate
                                    </Button>
                                ) : (
                                     <Link 
                                        href={`/decks/${deck.id}/study`}
                                        passAs={Button}
                                        variant="primary"
                                        size="sm"
                                        onClick={() => onUpdateLastOpened(deck.id)}
                                        disabled={itemCount === 0 || (dueCount === 0 && !canResume)}
                                        className="font-semibold"
                                    >
                                       {canResume ? 'Resume' : 'Study'} 
                                    </Link>
                                )}
                               
                                <div className="relative" ref={menuRef}>
                                    <Button 
                                        variant="ghost"
                                        size="sm" 
                                        className="p-2 h-auto"
                                        onClick={(e) => { e.stopPropagation(); setIsMenuOpen(p => !p); }}
                                        aria-label={`More options for ${deck.name}`}
                                        disabled={isGeneratingThisDeck}
                                    >
                                       <Icon name="more-vertical" className="w-5 h-5" />
                                    </Button>
                                    {isMenuOpen && (
                                        <div 
                                            className="absolute right-0 mt-2 w-48 bg-surface rounded-md shadow-lg py-1 z-20 ring-1 ring-black ring-opacity-5 animate-fade-in"
                                            style={{ animationDuration: '150ms' }}
                                        >
                                            <button onClick={handleArchive} className="flex items-center w-full px-4 py-2 text-sm text-left text-text hover:bg-border/20">
                                                <Icon name="archive" className="w-4 h-4 mr-3" />
                                                Archive
                                            </button>
                                            <div className="border-t border-border my-1"></div>
                                            <button onClick={handleDelete} className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                <Icon name="trash-2" className="w-4 h-4 mr-3" />
                                                Move to Trash
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="absolute top-0 right-0 h-full flex items-center px-3 text-text-muted/60 cursor-grab" aria-hidden="true">
                <Icon name="grip-vertical" className="w-5 h-5"/>
            </div>
        </div>
    );
};

export default DeckListItem;
