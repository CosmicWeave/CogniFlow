

import React, { useState, useRef } from 'react';
import { Card } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import EditCardModal from './EditCardModal';
import ConfirmModal from './ConfirmModal';
import MasteryBar from './ui/MasteryBar';
import { getEffectiveMasteryLevel } from '../services/srs';

interface CardListEditorProps {
  cards: Card[];
  onCardsChange: (newCards: Card[]) => void;
  onAddCard: (newCardData: Pick<Card, 'front' | 'back'>) => void;
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

  const handleSaveCard = (cardToSave: Pick<Card, 'front' | 'back' | 'id'>) => {
    if (editingCard) { // Editing existing card
      onCardsChange(cards.map(c => c.id === cardToSave.id ? { ...c, ...cardToSave } : c));
    } else { // Adding new card
      onAddCard(cardToSave);
    }
    handleCloseEditModal();
  };

  const handleUnignoreCard = (cardId: string) => {
    onCardsChange(cards.map(c => c.id === cardId ? { ...c, suspended: false } : c));
  };

  return (
    <div>
      <div className="border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center text-left p-6"
          aria-expanded={isOpen}
          aria-controls="card-list-content"
        >
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Cards</h3>
          <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'} text-gray-500`}/>
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
                      <li key={card.id} className={`p-4 rounded-lg flex items-start justify-between transition-all ${card.suspended ? 'bg-yellow-50 dark:bg-yellow-900/20 opacity-70' : 'bg-gray-50 dark:bg-gray-900/30'}`}>
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate"><strong>Front:</strong> {card.front.replace(/<[^>]+>/g, '')}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate"><strong>Back:</strong> {card.back.replace(/<[^>]+>/g, '')}</p>
                           <div className="mt-3 space-y-2">
                                <MasteryBar level={getEffectiveMasteryLevel(card)} />
                                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                    <span className={`font-semibold ${isDue ? 'text-blue-500 dark:text-blue-400' : ''}`}>
                                        <Icon name="zap" className="w-3 h-3 inline-block mr-1" />{dueDateText}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {card.suspended ? (
                            <Button variant="ghost" className="p-2 h-auto text-yellow-600 dark:text-yellow-400" onClick={() => handleUnignoreCard(card.id)} title="Re-enable this card">
                                <Icon name="eye" className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" className="p-2 h-auto" onClick={(e) => openEditModal(card, e)} title="Edit this card">
                              <Icon name="edit" className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" className="p-2 h-auto text-gray-500 dark:text-gray-400 hover:text-red-500" onClick={(e) => openConfirmDelete(card, e)} title="Delete this card">
                            <Icon name="trash-2" className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    )
                })}
              </ul>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-center py-4">This deck has no cards.</p>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
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
