





import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Deck, DeckType, FlashcardDeck, QuizDeck } from '../types';
import Button from './ui/Button';
import Link from './ui/Link';
import { getEffectiveMasteryLevel } from '../services/srs';
import MasteryBar from './ui/MasteryBar';
import Icon from './ui/Icon';
import { useRouter } from '../contexts/RouterContext';

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
}

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : (deck as FlashcardDeck).cards;
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

const stripHtml = (html: string | undefined): string => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

const DeckListItem: React.FC<DeckListItemProps> = ({ deck, sessionsToResume, onUpdateLastOpened, draggedDeckId, onDragStart, onDragEnd, onUpdateDeck, onDeleteDeck, openConfirmModal }) => {
    const { navigate } = useRouter();
    const dueCount = getDueItemsCount(deck);
    const canResume = sessionsToResume.has(deck.id);
    const items = deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : (deck as FlashcardDeck).cards;
    const itemCount = items?.length || 0;
    const itemLabel = deck.type === DeckType.Quiz ? (itemCount === 1 ? 'question' : 'questions') : (itemCount === 1 ? 'card' : 'cards');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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
        // This is more robust. It checks if the click originated from an interactive element.
        // If so, it lets that element's own handler take over. Otherwise, it navigates.
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
                setTimeout(() => onDragStart(deck.id), 0);
            }}
            onDragEnd={onDragEnd}
            className={`bg-surface rounded-lg shadow-md hover:shadow-lg transition-all duration-200 group relative cursor-pointer ${draggedDeckId === deck.id ? 'opacity-40 scale-95' : 'opacity-100'}`}
        >
             <div className="p-4 flex flex-col justify-between h-full space-y-3">
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
                            <Icon name="list" className="w-4 h-4" />
                            {itemCount} {itemLabel}
                        </span>
                        <span className={`flex items-center gap-1.5 font-semibold ${dueCount > 0 ? 'text-primary' : ''}`}>
                            <Icon name="zap" className="w-4 h-4" />
                            {dueCount} due
                        </span>
                    </div>

                    <div className="flex items-center space-x-1">
                        <Link 
                            href={`/decks/${deck.id}/study`}
                            passAs={Button}
                            variant="primary"
                            size="sm"
                            onClick={() => onUpdateLastOpened(deck.id)}
                            disabled={dueCount === 0 && !canResume}
                            className="font-semibold"
                        >
                           {canResume ? 'Resume' : 'Study'} 
                        </Link>
                        <div className="relative" ref={menuRef}>
                            <Button 
                                variant="ghost"
                                size="sm" 
                                className="p-2 h-auto"
                                onClick={() => setIsMenuOpen(p => !p)}
                                aria-label={`More options for ${deck.name}`}
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeckListItem;