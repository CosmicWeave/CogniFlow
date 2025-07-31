import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Deck, DeckType } from '../types';
import Button from './ui/Button';
import Link from './ui/Link';
import { getEffectiveMasteryLevel } from '../services/srs';
import MasteryBar from './ui/MasteryBar';
import Icon from './ui/Icon';

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
    const items = deck.type === DeckType.Quiz ? deck.questions : deck.cards;
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

const stripHtml = (html: string | undefined): string => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

const DeckListItem: React.FC<DeckListItemProps> = ({ deck, sessionsToResume, onUpdateLastOpened, draggedDeckId, onDragStart, onDragEnd, onUpdateDeck, onDeleteDeck, openConfirmModal }) => {
    const dueCount = getDueItemsCount(deck);
    const canResume = sessionsToResume.has(deck.id);
    const items = deck.type === DeckType.Quiz ? deck.questions : deck.cards;
    const itemCount = items.length;
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

    const handleArchive = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateDeck({ ...deck, archived: true });
        setIsMenuOpen(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        openConfirmModal({
            title: 'Move Deck to Trash',
            message: `Are you sure you want to move the deck "${deck.name}" to the trash? It will be permanently deleted after 10 days.`,
            onConfirm: () => onDeleteDeck(deck.id),
        });
        setIsMenuOpen(false);
    };

    const averageMastery = useMemo(() => {
        const activeItems = items.filter(i => !i.suspended);
        if (activeItems.length === 0) return 0;
        const totalMastery = activeItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0);
        return totalMastery / activeItems.length;
    }, [items]);

    return (
        <div
            key={deck.id}
            draggable="true"
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', deck.id);
                setTimeout(() => onDragStart(deck.id), 0);
            }}
            onDragEnd={onDragEnd}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 ${draggedDeckId === deck.id ? 'opacity-40 scale-95' : 'opacity-100'}`}
        >
             <div className="p-4 flex items-center justify-between">
                <div className="flex-1 mr-4 min-w-0">
                    <Link href={`/decks/${deck.id}`} className="block" onClick={() => onUpdateLastOpened(deck.id)}>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words hover:text-blue-500 dark:hover:text-blue-300 transition-colors">{deck.name}</h3>
                        {deck.description && (
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none text-gray-500 dark:text-gray-400 mt-1 truncate [&_a]:text-blue-500 dark:[&_a]:text-blue-400 [&_a:hover]:text-blue-600 dark:[&_a:hover]:text-blue-300"
                                title={stripHtml(deck.description)}
                                dangerouslySetInnerHTML={{ __html: deck.description }}
                            />
                        )}
                        <div className="flex items-center space-x-4 text-sm mt-2">
                            <span className="text-gray-500 dark:text-gray-400">{itemCount} {itemLabel}</span>
                            <span className={`font-semibold ${dueCount > 0 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {dueCount} due
                            </span>
                        </div>
                    </Link>
                    <div className="mt-3">
                        <MasteryBar level={averageMastery} />
                    </div>
                </div>
                <div className="flex flex-shrink-0 items-center space-x-1 pl-2">
                    <Link href={`/decks/${deck.id}/study`} passAs={Button} variant="primary" onClick={() => onUpdateLastOpened(deck.id)}
                        disabled={dueCount === 0 && !canResume}
                        className="font-semibold w-24"
                    >
                       {canResume ? 'Resume' : 'Study'}
                    </Link>
                    <div className="relative" ref={menuRef}>
                        <Button variant="ghost" className="p-2 h-auto" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(p => !p);}} aria-label={`More options for ${deck.name}`}>
                           <Icon name="more-vertical" className="w-5 h-5" />
                        </Button>
                        {isMenuOpen && (
                             <div 
                                className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 ring-1 ring-black ring-opacity-5 animate-fade-in"
                                style={{ animationDuration: '150ms' }}
                            >
                                <Link href={`/decks/${deck.id}`} onClick={() => { onUpdateLastOpened(deck.id); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <Icon name="edit" className="w-4 h-4 mr-3" />
                                    Details / Edit
                                </Link>
                                <button onClick={handleArchive} className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <Icon name="archive" className="w-4 h-4 mr-3" />
                                    Archive
                                </button>
                                <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
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
    );
};

export default DeckListItem;