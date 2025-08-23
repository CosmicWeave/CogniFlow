
import React, { useState } from 'react';
import { Deck, Folder } from '../types';
import DeckListItem from './DeckListItem';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface FolderViewProps {
  folder: Folder;
  decks: Deck[];
  isOpen: boolean;
  onToggle: () => void;
  sessionsToResume: Set<string>;
  onUpdateLastOpened: (deckId: string) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  draggedDeckId: string | null;
  onDragStart: (deckId: string) => void;
  onDragEnd: () => void;
  onMoveDeck: (deckId: string, folderId: string | null) => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onDeleteDeck: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
}

const FolderView: React.FC<FolderViewProps> = ({ folder, decks, isOpen, onToggle, sessionsToResume, onUpdateLastOpened, onEditFolder, onDeleteFolder, draggedDeckId, onDragStart, onDragEnd, onMoveDeck, onUpdateDeck, onDeleteDeck, openConfirmModal }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const deckId = e.dataTransfer.getData('text/plain');
    if (deckId && deckId === draggedDeckId) {
        onMoveDeck(deckId, folder.id);
        onDragEnd(); // Reset style immediately
    }
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
  };

  const handleDragLeave = () => {
      setIsDragOver(false);
  };

  return (
    <div
      className={`rounded-lg transition-all duration-200 ${isDragOver ? 'bg-primary/20 ring-2 ring-primary ring-inset' : 'bg-surface border border-border'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="border-b border-border">
        <button
          onClick={onToggle}
          className="w-full flex justify-between items-center text-left p-4"
          aria-expanded={isOpen}
        >
          <div className="flex items-center">
            <Icon name="chevron-down" className={`w-5 h-5 transition-transform duration-300 mr-3 ${isOpen ? '' : '-rotate-90'} text-text-muted`}/>
            <Icon name="folder" className="w-6 h-6 mr-3 text-yellow-600 dark:text-yellow-500" />
            <h3 className="text-xl font-bold text-text">{folder.name}</h3>
          </div>
          <div className="flex items-center gap-1">
             <Button variant="ghost" className="p-2 h-auto" onClick={(e) => { e.stopPropagation(); onEditFolder(folder); }} aria-label={`Edit folder ${folder.name}`}>
                <Icon name="edit" className="w-4 h-4"/>
            </Button>
            <Button variant="ghost" className="p-2 h-auto hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} aria-label={`Delete folder ${folder.name}`}>
                <Icon name="trash-2" className="w-4 h-4"/>
            </Button>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4">
          {decks.length > 0 ? (
            decks.map(deck => (
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
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-md m-4 text-center">
                <Icon name="grip-vertical" className="w-8 h-8 text-text-muted mb-2" />
                <p className="text-sm font-medium text-text-muted">Drag a deck here to organize it!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FolderView;
