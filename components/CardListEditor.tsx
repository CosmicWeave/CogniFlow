import React, { useState, useRef } from 'react';
import { Card } from '../types';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import EditCardModal from './EditCardModal.tsx';
import ConfirmModal from './ConfirmModal.tsx';
import MasteryBar from './ui/MasteryBar.tsx';
import { getEffectiveMasteryLevel } from '../services/srs.ts';

interface CardListEditorProps {
  cards: Card[];
  onCardsChange: (newCards: Card[]) => void;
  onAddCard: (newCardData: Pick<Card, 'front' | 'back' | 'css'>) => void;
  onBulkAdd: () => void;
}

const getDueDateInfo = (dueDateString: string): { text: string, isDue: boolean } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(dueDateString);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const isDue = diffDays <= 0;
    let text: string;

    if (diffDays < 0) {
        text = "Due";
    } else if (diffDays === 0) {
        text = "Due today";
    } else if (diffDays === 1) {
        text = "Due tomorrow";
    } else {
        text = `Due in ${diffDays} days`;
    }
    
    return { text, isDue };
};


const CardListEditor: React.FC<CardListEditorProps> = ({ cards, onCardsChange, onAddCard, onBulkAdd }) => {
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<Card | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);


  const openEditModal = (card: Card | null, e?: React.MouseEvent<HTMLButtonElement>) => {
    setEditingCard(card);
    if(e) triggerRef.current = e.currentTarget;
    setIsEditModalOpen(true);
  };
  
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    triggerRef.current?.focus();
    setEditingCard(null);
  };

  const openConfirmDelete = (card: Card, e?: React.MouseEvent<HTMLButtonElement>) => {
    setCardToDelete(card);
    if(e) triggerRef.current = e.currentTarget;
  };

  const handleConfirmDelete = () => {
    if (cardToDelete) {
      onCardsChange(cards.filter(c => c.id !== cardToDelete.id));
    }
    setCardToDelete(null);
  };

  const handleSaveCard = (cardToSave: Pick<Card, 'front' | 'back' | 'id' | 'css'>) => {
    if (editingCard) { // Editing existing card
      onCardsChange(cards.map(c => c.id === cardToSave.id ? { ...c, ...cardToSave } : c));
    } else { // Adding new card
      onAddCard(cardToSave);
    }
    handleCloseEditModal();
  };

  const handleUnsuspendCard = (cardId: string) => {
    onCardsChange(cards.map(c => c.id === cardId ? { ...c, suspended: false } : c));
  };

  return (
    <div>
      <div className="border-b border-border">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center text-left p-6"
          aria-expanded={isOpen}
          aria-controls="card-list-content"
        >
          <h3 className="text-xl font-semibold text-text">Cards</h3>
          <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'} text-text-muted`}/>
        </button>
      </div>

      {isOpen && (
        <div id="card-list-content" className="animate-fade-in">
          <div className="p-6">
            {cards.length > 0 ? (
              <ul className="space-y-4">
                {cards.map((card) => {
                    const { text: dueDateText, isDue } = getDueDateInfo(card.dueDate);
                    return (
                      <li key={card.id} className={`p-4 rounded-lg flex items-start justify-between transition-all ${card.suspended ? 'bg-yellow-500/10 opacity-70' : 'bg-background'}`}>
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm font-medium text-text truncate"><strong>Front:</strong> {card.front.replace(/<[^>]+>/g, '')}</p>
                          <p className="text-sm text-text-muted truncate"><strong>Back:</strong> {card.back.replace(/<[^>]+>/g, '')}</p>
                           <div className="mt-3 space-y-2">
                                <MasteryBar level={getEffectiveMasteryLevel(card)} />
                                <div className="flex items-center gap-4 text-xs text-text-muted">
                                    <span className={`font-semibold ${isDue ? 'text-primary' : ''}`}>
                                        <Icon name="zap" className="w-3 h-3 inline-block mr-1" />{dueDateText}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {card.suspended ? (
                            <Button variant="ghost" className="p-2 h-auto text-yellow-600 dark:text-yellow-400" onClick={() => handleUnsuspendCard(card.id)} title="Unsuspend this card">
                                <Icon name="eye" className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" className="p-2 h-auto" onClick={(e) => openEditModal(card, e)} title="Edit this card">
                              <Icon name="edit" className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" className="p-2 h-auto text-text-muted hover:text-red-500" onClick={(e) => openConfirmDelete(card, e)} title="Delete this card">
                            <Icon name="trash-2" className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    )
                })}
              </ul>
            ) : (
              <div className="text-center text-text-muted py-8">
                <Icon name="laptop" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>This deck has no cards yet.</p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-border flex flex-wrap gap-2">
              <Button variant="secondary" onClick={(e) => openEditModal(null, e)} className="flex-grow sm:flex-grow-0">
                  <Icon name="plus" className="w-5 h-5 mr-2"/>
                  Add New Card
              </Button>
              <Button variant="ghost" onClick={onBulkAdd} className="flex-grow sm:flex-grow-0">
                  <Icon name="code" className="w-5 h-5 mr-2"/>
                  Bulk Add via JSON
              </Button>
          </div>
        </div>
      )}

      {isEditModalOpen && (
          <EditCardModal
            card={editingCard}
            onClose={handleCloseEditModal}
            onSave={handleSaveCard}
          />
      )}
      {cardToDelete && (
        <ConfirmModal
          isOpen={!!cardToDelete}
          onClose={() => setCardToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Card"
          message="Are you sure you want to delete this card? This action cannot be undone."
        />
      )}
    </div>
  );
};

export default CardListEditor;