

import React, { useState, useMemo, useRef } from 'react';
import { LearningDeck, InfoCard, Question } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import EditLearningBlockModal, { LearningBlockData } from './EditLearningBlockModal';
import { stripHtml } from '../services/utils';

interface LearningItemListEditorProps {
  deck: LearningDeck;
  onSaveBlock: (data: LearningBlockData) => void;
  onDeleteBlock: (infoCardId: string) => void;
  onBlockClick: (block: LearningBlockData) => void;
}

const LearningItemListEditor: React.FC<LearningItemListEditorProps> = ({ deck, onSaveBlock, onDeleteBlock, onBlockClick }) => {
  const [editingBlock, setEditingBlock] = useState<LearningBlockData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openEditModal = (block: LearningBlockData | null, e?: React.MouseEvent<HTMLButtonElement>) => {
    setEditingBlock(block);
    if (e) triggerRef.current = e.currentTarget;
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    triggerRef.current?.focus();
    setEditingBlock(null);
  };

  const handleSaveBlock = (data: LearningBlockData) => {
    onSaveBlock(data);
    handleCloseEditModal();
  };

  const learningBlocks = useMemo(() => {
    return (deck.infoCards || []).map(infoCard => ({
      infoCard,
      questions: (deck.questions || []).filter(q => q.infoCardIds?.includes(infoCard.id))
    }));
  }, [deck.infoCards, deck.questions]);

  return (
    <div>
      <div className="border-b border-border p-6">
        <h3 className="text-xl font-semibold text-text">Learning Blocks</h3>
        <p className="text-sm text-text-muted mt-1">Each block contains an info card and its related questions.</p>
      </div>

      <div className="p-6">
        {learningBlocks.length > 0 ? (
          <ul className="space-y-4">
            {learningBlocks.map(block => (
              <li
                key={block.infoCard.id}
                className="p-4 rounded-lg bg-background border border-border transition-all duration-200 hover:border-primary hover:shadow-md cursor-pointer"
                onClick={() => onBlockClick(block)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onBlockClick(block); }}
                tabIndex={0}
                role="button"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 text-text font-semibold">
                        <Icon name="book-open" className="w-5 h-5 text-purple-500 flex-shrink-0" />
                        <p className="truncate" title={stripHtml(block.infoCard.content)}>
                            {stripHtml(block.infoCard.content)}
                        </p>
                    </div>
                    {block.questions.length > 0 && (
                        <ul className="mt-2 pl-7 space-y-1">
                            {block.questions.map(q => (
                                <li key={q.id} className="flex items-center gap-2 text-sm text-text-muted">
                                    <Icon name="help-circle" className="w-4 h-4 flex-shrink-0"/>
                                    <span className="truncate" title={stripHtml(q.questionText)}>{stripHtml(q.questionText)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <Button variant="ghost" className="p-2 h-auto" onClick={(e) => { e.stopPropagation(); openEditModal(block, e); }} title="Edit this block">
                      <Icon name="edit" className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" className="p-2 h-auto text-text-muted hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.infoCard.id); }} title="Delete this block">
                      <Icon name="trash-2" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-text-muted py-8">
            <Icon name="layers" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>This deck has no learning blocks yet.</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border flex flex-wrap gap-2">
        <Button variant="secondary" onClick={(e) => openEditModal(null, e)} className="flex-grow sm:flex-grow-0">
          <Icon name="plus" className="w-5 h-5 mr-2" />
          Add Learning Block
        </Button>
      </div>

      {isEditModalOpen && (
        <EditLearningBlockModal
          block={editingBlock}
          onClose={handleCloseEditModal}
          onSave={handleSaveBlock}
        />
      )}
    </div>
  );
};

export default LearningItemListEditor;