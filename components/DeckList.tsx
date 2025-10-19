import React, { useMemo, useState } from 'react';
import { Deck, Folder, LearningDeck, QuizDeck } from '../types.ts';
// FIX: Changed to named import to match the updated export in DeckListItem.tsx.
import { DeckListItem } from './DeckListItem.tsx';
import FolderView from './FolderView.tsx';

interface DeckListProps {
  decks: Deck[];
  folders: Folder[];
  sessionsToResume: Set<string>;
  onUpdateLastOpened: (deckId: string) => void;
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
  onSaveFolder: (folderData: { id: string; name: string; }) => void;
  onGenerateQuestionsForDeck?: (deck: QuizDeck) => void;
  onGenerateContentForLearningDeck?: (deck: LearningDeck) => void;
}

const DeckList: React.FC<DeckListProps> = ({ decks, folders, sessionsToResume, onUpdateLastOpened, onDeleteFolder, draggedDeckId, onDragStart, onDragEnd, onMoveDeck, openFolderIds, onToggleFolder, onUpdateDeck, onDeleteDeck, openConfirmModal, onSaveFolder, onGenerateQuestionsForDeck, onGenerateContentForLearningDeck }) => {

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
                    onDeleteFolder={onDeleteFolder}
                    draggedDeckId={draggedDeckId}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onMoveDeck={onMoveDeck}
                    onUpdateDeck={onUpdateDeck}
                    onDeleteDeck={onDeleteDeck}
                    openConfirmModal={openConfirmModal}
                    onSaveFolder={onSaveFolder}
                    onGenerateQuestionsForDeck={onGenerateQuestionsForDeck}
                    onGenerateContentForLearningDeck={onGenerateContentForLearningDeck}
                />
            ))}
            
            <div
                onDrop={handleUngroupedDrop}
                onDragOver={handleUngroupedDragOver}
                onDragLeave={() => setIsUngroupedAreaOver(false)}
                className={`p-2 -m-2 rounded-lg transition-all duration-200 ${isUngroupedAreaOver ? 'bg-primary/20 ring-2 ring-primary ring-inset' : ''}`}
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
                        handleGenerateQuestionsForDeck={onGenerateQuestionsForDeck}
                        handleGenerateContentForLearningDeck={onGenerateContentForLearningDeck}
                    />
                ))}
                </div>
            </div>
        </div>
    );
};

export default DeckList;