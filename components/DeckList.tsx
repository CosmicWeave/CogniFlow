

import React, { useMemo, useState } from 'react';
import { Deck, Folder } from '../types';
import DeckListItem from './DeckListItem';
import FolderView from './FolderView';

interface DeckListProps {
  decks: Deck[];
  folders: Folder[];
  sessionsToResume: Set<string>;
  onUpdateLastOpened: (deckId: string) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  draggedDeckId: string | null;
  onDragStart: (deckId: string) => void;
  onDragEnd: () => void;
  onMoveDeck: (deckId: string, folderId: string | null) => void;
  openFolderIds: Set<string>;
  onToggleFolder: (folderId: string) => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onDeleteDeck: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
}

const DeckList: React.FC<DeckListProps> = ({ decks, folders, sessionsToResume, onUpdateLastOpened, onEditFolder, onDeleteFolder, draggedDeckId, onDragStart, onDragEnd, onMoveDeck, openFolderIds, onToggleFolder, onUpdateDeck, onDeleteDeck, openConfirmModal }) => {

    const { decksByFolder, ungroupedDecks } = useMemo(() => {
        const decksByFolder = new Map<string, Deck[]>();
        const ungroupedDecks: Deck[] = [];

        decks.forEach(deck => {
            if (deck.folderId && folders.some(f => f.id === deck.folderId)) {
                if (!decksByFolder.has(deck.folderId)) {
                    decksByFolder.set(deck.folderId, []);
                }
                decksByFolder.get(deck.folderId)!.push(deck);
            } else {
                ungroupedDecks.push(deck);
            }
        });

        return { decksByFolder, ungroupedDecks };
    }, [decks, folders]);
    
    const [isUngroupedAreaOver, setIsUngroupedAreaOver] = useState(false);

    const handleUngroupedDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const deckId = e.dataTransfer.getData('text/plain');
        if (deckId && deckId === draggedDeckId) {
            onMoveDeck(deckId, null);
            onDragEnd(); // Reset style immediately
        }
        setIsUngroupedAreaOver(false);
    };

    const handleUngroupedDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsUngroupedAreaOver(true);
    };

    return (
        <div className="space-y-4">
            {folders.map(folder => (
                <FolderView
                    key={folder.id}
                    folder={folder}
                    decks={decksByFolder.get(folder.id) || []}
                    isOpen={openFolderIds.has(folder.id)}
                    onToggle={() => onToggleFolder(folder.id)}
                    sessionsToResume={sessionsToResume}
                    onUpdateLastOpened={onUpdateLastOpened}
                    onEditFolder={onEditFolder}
                    onDeleteFolder={onDeleteFolder}
                    draggedDeckId={draggedDeckId}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onMoveDeck={onMoveDeck}
                    onUpdateDeck={onUpdateDeck}
                    onDeleteDeck={onDeleteDeck}
                    openConfirmModal={openConfirmModal}
                />
            ))}
            
            <div
                onDrop={handleUngroupedDrop}
                onDragOver={handleUngroupedDragOver}
                onDragLeave={() => setIsUngroupedAreaOver(false)}
                className={`p-2 -m-2 rounded-lg transition-colors ${isUngroupedAreaOver ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
            >
                <div className="space-y-4">
                {ungroupedDecks.map(deck => (
                    <DeckListItem
                        key={deck.id}
                        deck={deck}
                        sessionsToResume={sessionsToResume}
                        onUpdateLastOpened={onUpdateLastOpened}
                        draggedDeckId={draggedDeckId}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onUpdateDeck={onUpdateDeck}
                        onDeleteDeck={onDeleteDeck}
                        openConfirmModal={openConfirmModal}
                    />
                ))}
                </div>
            </div>
        </div>
    );
};

export default DeckList;