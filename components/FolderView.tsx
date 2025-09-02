

import React, { useState, useEffect, useRef } from 'react';
import { Deck, Folder, LearningDeck, QuizDeck } from '../types';
import DeckListItem from './DeckListItem';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';

interface FolderViewProps {
  folder: Folder;
  decks: Deck[];
  isOpen: boolean;
  onToggle: () => void;
  sessionsToResume: Set<string>;
  onUpdateLastOpened: (deckId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  draggedDeckId: string | null;
  onDragStart: (deckId: string) => void;
  onDragEnd: () => void;
  onMoveDeck: (deckId: string, folderId: string | null) => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onDeleteDeck: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
  onSaveFolder: (folderData: { id: string; name: string }) => void;
  // FIX: Add missing props for AI generation handlers.
  onGenerateQuestionsForDeck?: (deck: QuizDeck) => void;
  onGenerateContentForLearningDeck?: (deck: LearningDeck) => void;
}

const FolderView: React.FC<FolderViewProps> = ({ folder, decks, isOpen, onToggle, sessionsToResume, onUpdateLastOpened, onDeleteFolder, draggedDeckId, onDragStart, onDragEnd, onMoveDeck, onUpdateDeck, onDeleteDeck, openConfirmModal, onSaveFolder, onGenerateQuestionsForDeck, onGenerateContentForLearningDeck }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(folder.name); // Reset on each edit start
    setIsEditing(true);
  };
  
  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };
  
  const handleSave = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (editedName.trim() === '') {
        addToast("Folder name cannot be empty.", "error");
        return;
    }
    onSaveFolder({ id: folder.id, name: editedName.trim() });
    setIsEditing(false);
  };

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
        <div
          onClick={isEditing ? undefined : onToggle}
          className="w-full flex justify-between items-center text-left p-4 cursor-pointer"
          aria-expanded={isOpen}
        >
          <div className="flex items-center flex-grow min-w-0">
            <Icon name="chevron-down" className={`w-5 h-5 transition-transform duration-300 mr-3 ${isOpen ? '' : '-rotate-90'} text-text-muted`}/>
            {isEditing ? (
                <div className="flex items-center flex-grow gap-2 min-w-0" onClick={e => e.stopPropagation()}>
                    <Icon name="folder" className="w-6 h-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={editedName}
                      onChange={e => setEditedName(e.target.value)}
                      onKeyDown={e => {
                          if (e.key === 'Enter') handleSave(e);
                          if (e.key === 'Escape') handleCancel(e as any);
                      }}
                      className="text-xl font-bold p-1 bg-background rounded-md w-full"
                    />
                </div>
            ) : (
                <>
                    <Icon name="folder" className="w-6 h-6 mr-3 text-yellow-600 dark:text-yellow-500" />
                    <h3 className="text-xl font-bold text-text truncate">{folder.name}</h3>
                </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
             {isEditing ? (
                <>
                    <Button variant="primary" size="sm" onClick={handleSave} aria-label={`Save changes for folder ${folder.name}`}>Save</Button>
                    <Button variant="secondary" size="sm" onClick={handleCancel} aria-label="Cancel editing">Cancel</Button>
                </>
             ) : (
                <>
                    <Button variant="ghost" className="p-2 h-auto" onClick={handleStartEdit} aria-label={`Edit folder ${folder.name}`}>
                        <Icon name="edit" className="w-4 h-4"/>
                    </Button>
                    <Button variant="ghost" className="p-2 h-auto hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} aria-label={`Delete folder ${folder.name}`}>
                        <Icon name="trash-2" className="w-4 h-4"/>
                    </Button>
                </>
             )}
          </div>
        </div>
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
                onGenerateQuestionsForDeck={onGenerateQuestionsForDeck}
                onGenerateContentForLearningDeck={onGenerateContentForLearningDeck}
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