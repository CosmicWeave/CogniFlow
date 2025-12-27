
// components/LearningItemListEditor.tsx

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { LearningDeck, InfoCard, Question } from '../types.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import EditLearningBlockModal, { LearningBlockData } from './EditLearningBlockModal.tsx';
import { stripHtml } from '../services/utils.ts';
import AIActionsMenu from './AIActionsMenu.tsx';
import { useStore } from '../store/store.ts';
import { useSettings } from '../hooks/useSettings.ts';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer.tsx';
import { useData } from '../contexts/DataManagementContext.tsx';
import Spinner from './ui/Spinner.tsx';
import { useModal } from '../contexts/ModalContext.tsx';

interface LearningItemListEditorProps {
  deck: LearningDeck;
  onSaveBlock: (data: LearningBlockData) => void;
  onDeleteBlock: (infoCardId: string) => void;
  onBlockClick: (block: LearningBlockData) => void;
  onReorderBlocks: (newInfoCards: InfoCard[]) => void;
}

const LearningItemListEditor: React.FC<LearningItemListEditorProps> = ({ deck, onSaveBlock, onDeleteBlock, onBlockClick, onReorderBlocks }) => {
  const [editingBlock, setEditingBlock] = useState<LearningBlockData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { aiFeaturesEnabled } = useSettings();
  const dataHandlers = useData();
  const { openModal } = useModal();

  const currentTask = useStore(state => state.aiGenerationStatus.currentTask);
  const queue = useStore(state => state.aiGenerationStatus.queue);

  const isGeneratingTask = useCallback((itemId: string, type: 'text' | 'questions') => {
      const gType = type === 'text' ? 'holistic-expand-item' : 'deep-expand-questions';
      if (currentTask?.payload?.itemId === itemId && currentTask?.type === gType) return true;
      return (queue || []).some(t => t.payload?.itemId === itemId && t.type === gType);
  }, [currentTask, queue]);

  const isGeneratingGlobal = !!currentTask && currentTask.deckId === deck.id;

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

  const toggleTextExpand = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const newSet = new Set(expandedTextIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedTextIds(newSet);
  };

  const toggleQuestionsExpand = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const newSet = new Set(expandedQuestionIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedQuestionIds(newSet);
  };

  const handleExpandAllText = () => setExpandedTextIds(new Set(deck.infoCards.map(ic => ic.id)));
  const handleCollapseAllText = () => setExpandedTextIds(new Set());
  const handleExpandAllQuestions = () => setExpandedQuestionIds(new Set(deck.infoCards.map(ic => ic.id)));
  const handleCollapseAllQuestions = () => setExpandedQuestionIds(new Set());

  const handleIndividualSynthesis = (e: React.MouseEvent, itemId: string, type: 'text' | 'questions') => {
      e.stopPropagation();
      openModal('synthesisConfig', {
          title: type === 'text' ? 'Custom Holistic Synthesis' : 'Assessment Deepening',
          type,
          onConfirm: (config: any) => {
              dataHandlers?.handleImmediateAIGeneration({
                  generationType: type === 'text' ? 'holistic-expand-item' : 'deep-expand-questions',
                  topic: deck.name,
                  deckId: deck.id,
                  itemId: itemId,
                  ...config
              });
          }
      });
  };

  const learningBlocks = useMemo(() => {
    return (deck.infoCards || []).map(infoCard => ({
      infoCard,
      questions: (deck.questions || []).filter(q => q.infoCardIds?.includes(infoCard.id))
    }));
  }, [deck.infoCards, deck.questions]);

  // Drag and Drop Handlers
  const handleDragStart = (index: number, e: React.DragEvent) => {
      setDraggedBlockIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (index: number, e: React.DragEvent) => {
      e.preventDefault();
      if (draggedBlockIndex === null || draggedBlockIndex === index) return;

      const newInfoCards = [...(deck.infoCards || [])];
      const [draggedItem] = newInfoCards.splice(draggedBlockIndex, 1);
      newInfoCards.splice(index, 0, draggedItem);
      
      onReorderBlocks(newInfoCards);
      setDraggedBlockIndex(null);
  };

  return (
    <div>
      <div className="border-b border-border p-6 flex justify-between items-start bg-surface sticky top-0 z-10">
        <div>
            <h3 className="text-xl font-semibold text-text">Learning Blocks</h3>
            <p className="text-sm text-text-muted mt-1">Each block contains an info card and its related questions.</p>
        </div>
        {learningBlocks.length > 0 && (
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-text-muted uppercase w-12">Text:</span>
                    <Button variant="ghost" size="sm" onClick={handleExpandAllText} title="Expand All Text">
                        <Icon name="maximize" className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCollapseAllText} title="Collapse All Text">
                        <Icon name="minimize" className="w-3.5 h-3.5" />
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-text-muted uppercase w-12">Quiz:</span>
                    <Button variant="ghost" size="sm" onClick={handleExpandAllQuestions} title="Expand All Questions">
                        <Icon name="maximize" className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCollapseAllQuestions} title="Collapse All Questions">
                        <Icon name="minimize" className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        )}
      </div>

      <div className="p-6">
        {learningBlocks.length > 0 ? (
          <ul className="space-y-4">
            {learningBlocks.map((block, index) => {
              const isDragging = draggedBlockIndex === index;
              const isTextExpanded = expandedTextIds.has(block.infoCard.id);
              const isQuestionsExpanded = expandedQuestionIds.has(block.infoCard.id);
              
              const isSynthesizingText = isGeneratingTask(block.infoCard.id, 'text');
              const isSynthesizingQuiz = isGeneratingTask(block.infoCard.id, 'questions');

              return (
                <li
                  key={block.infoCard.id}
                  className={`p-4 rounded-lg bg-background border transition-all duration-200 cursor-pointer ${isDragging ? 'opacity-50 ring-2 ring-primary border-transparent' : 'border-border hover:border-primary hover:shadow-md'}`}
                  draggable
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDrop={(e) => handleDrop(index, e)}
                  onClick={() => onBlockClick(block)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onBlockClick(block); }}
                  tabIndex={0}
                  role="button"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start flex-1 min-w-0 mr-4">
                            <div className="mr-3 mt-1 cursor-grab active:cursor-grabbing text-text-muted hover:text-text" onClick={e => e.stopPropagation()}>
                                <Icon name="grip-vertical" className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-text font-semibold mb-1">
                                    {isSynthesizingText || isSynthesizingQuiz ? (
                                        <div className="p-1 animate-pulse bg-primary/10 rounded">
                                            <Icon name="bot" className="w-4 h-4 text-primary" />
                                        </div>
                                    ) : (
                                        <Icon name="book-open" className="w-5 h-5 text-purple-500 flex-shrink-0" />
                                    )}
                                    <p className="truncate" title={stripHtml(block.infoCard.content)}>
                                        {stripHtml(block.infoCard.content)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    <button 
                                        onClick={(e) => toggleTextExpand(e, block.infoCard.id)}
                                        className="text-[10px] flex items-center gap-1 font-bold uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
                                    >
                                        <Icon name={isTextExpanded ? "minimize" : "maximize"} className="w-3 h-3" />
                                        {isTextExpanded ? "Collapse Text" : "Full Text"}
                                    </button>
                                    <button 
                                        onClick={(e) => toggleQuestionsExpand(e, block.infoCard.id)}
                                        className="text-[10px] flex items-center gap-1 font-bold uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
                                    >
                                        <Icon name={isQuestionsExpanded ? "minimize" : "maximize"} className="w-3 h-3" />
                                        {isQuestionsExpanded ? "Hide Quiz" : `${block.questions.length} Questions`}
                                    </button>
                                    
                                    {aiFeaturesEnabled && (
                                        <div className="flex gap-2 pl-2 border-l border-border">
                                            <button 
                                                onClick={(e) => handleIndividualSynthesis(e, block.infoCard.id, 'text')}
                                                disabled={isSynthesizingText}
                                                className={`text-[10px] flex items-center gap-1 font-bold uppercase tracking-widest transition-colors ${isSynthesizingText ? 'text-primary animate-pulse' : 'text-indigo-500 hover:text-indigo-700'}`}
                                                title="AI: Holistic Text Expansion"
                                            >
                                                {isSynthesizingText ? <Spinner size="sm" /> : <Icon name="zap" className="w-3 h-3" />}
                                                Enhance
                                            </button>
                                            <button 
                                                onClick={(e) => handleIndividualSynthesis(e, block.infoCard.id, 'questions')}
                                                disabled={isSynthesizingQuiz}
                                                className={`text-[10px] flex items-center gap-1 font-bold uppercase tracking-widest transition-colors ${isSynthesizingQuiz ? 'text-primary animate-pulse' : 'text-indigo-500 hover:text-indigo-700'}`}
                                                title="AI: Add Deeper Questions"
                                            >
                                                {isSynthesizingQuiz ? <Spinner size="sm" /> : <Icon name="plus" className="w-3 h-3" />}
                                                More Quiz
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="p-2 h-auto" onClick={(e) => { e.stopPropagation(); openEditModal(block, e); }} title="Edit this block">
                                <Icon name="edit" className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="p-2 h-auto text-text-muted hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.infoCard.id); }} title="Delete this block">
                                <Icon name="trash-2" className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {isTextExpanded && (
                        <div className="bg-surface p-4 rounded border border-border animate-fade-in" onClick={e => e.stopPropagation()}>
                            <p className="text-[10px] font-bold text-text-muted uppercase mb-3 tracking-widest border-b border-border pb-1">Instructional Material</p>
                            <DangerousHtmlRenderer html={block.infoCard.content} className="prose prose-sm dark:prose-invert max-w-none" />
                        </div>
                    )}

                    {isQuestionsExpanded && (
                        <div className="bg-surface p-4 rounded border border-border animate-fade-in" onClick={e => e.stopPropagation()}>
                            <p className="text-[10px] font-bold text-text-muted uppercase mb-3 tracking-widest border-b border-border pb-1">Block Assessment</p>
                            <ul className="space-y-4">
                                {block.questions.map((q, qIdx) => (
                                    <li key={q.id} className="text-sm">
                                        <div className="flex items-start gap-2">
                                            <span className="font-bold text-primary flex-shrink-0">{qIdx + 1}.</span>
                                            <div>
                                                <p className="font-semibold text-text">{stripHtml(q.questionText)}</p>
                                                <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {q.options.map(opt => (
                                                        <li key={opt.id} className={`p-2 rounded border text-xs flex items-center gap-2 ${opt.id === q.correctAnswerId ? 'bg-green-500/10 border-green-500/30 font-bold' : 'bg-background border-border/50'}`}>
                                                            {opt.id === q.correctAnswerId && <Icon name="check-circle" className="w-3 h-3 text-green-500" />}
                                                            {opt.text}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center text-text-muted py-8">
            <Icon name="layers" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>This deck has no learning blocks yet.</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border flex flex-wrap gap-2 items-center">
        <Button variant="secondary" onClick={(e) => openEditModal(null, e)} className="flex-grow sm:flex-grow-0">
          <Icon name="plus" className="w-5 h-5 mr-2" />
          Add Learning Block
        </Button>
        
        <div className="flex-grow"></div>

        {aiFeaturesEnabled && (
            <AIActionsMenu 
                deck={deck}
                isGenerating={isGeneratingGlobal}
                onGenerateMore={() => dataHandlers?.handleOpenAIGenerationForDeck(deck)}
                onRework={() => dataHandlers?.handleOpenAIReworkForDeck(deck)}
                onAnalyze={() => dataHandlers?.handleOpenDeckAnalysis(deck)}
                onAutoTag={() => dataHandlers?.handleAutoTagQuestions(deck)}
                onHardenDistractors={() => dataHandlers?.handleHardenAllDistractors(deck)}
                onHolisticUpgrade={(type, config) => (dataHandlers as any).handleHolisticUpgrade(deck, type, config)}
            />
        )}
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
