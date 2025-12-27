
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Question, QuizDeck, LearningDeck } from '../types.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import type { EditableQuestionParts } from './EditQuestionModal.tsx';
import EditQuestionModal from './EditQuestionModal.tsx';
import ConfirmModal from './ConfirmModal.tsx';
import { getEffectiveMasteryLevel } from '../services/srs.ts';
import MasteryBar from './ui/MasteryBar.tsx';
import Spinner from './ui/Spinner.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import { stripHtml } from '../services/utils.ts';
import AIActionsMenu from './AIActionsMenu.tsx';
import { useStore } from '../store/store.ts';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer.tsx';
import { useData } from '../contexts/DataManagementContext.tsx';

type NewQuestionData = Omit<Question, 'id' | 'dueDate' | 'interval' | 'easeFactor' | 'lapses'>;

interface QuestionListEditorProps {
  deck: QuizDeck | LearningDeck;
  questions: Question[];
  onQuestionsChange: (newQuestions: Question[]) => void;
  onAddQuestion: (newQuestionData: NewQuestionData) => void;
  onBulkAdd: () => void;
  onGenerateAI?: () => void;
  isGeneratingAI: boolean;
  onRegenerateQuestion: (deck: QuizDeck | LearningDeck, question: Question) => Promise<void>;
  onAutoTag?: () => void;
  deckName?: string;
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


const QuestionListEditor: React.FC<QuestionListEditorProps> = ({ deck, questions, onQuestionsChange, onAddQuestion, onBulkAdd, onGenerateAI, isGeneratingAI, onRegenerateQuestion, onAutoTag, deckName }) => {
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [menuOpenForQuestion, setMenuOpenForQuestion] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState<number | null>(null);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { aiFeaturesEnabled } = useSettings();
  const dataHandlers = useData();

  const relevantTask = useStore(useCallback(state => {
      const { currentTask, queue } = state.aiGenerationStatus;
      if (currentTask?.deckId === deck.id) return currentTask;
      return (queue || []).find(task => task.deckId === deck.id);
  }, [deck.id]));

  const isGenerating = !!relevantTask;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setMenuOpenForQuestion(null);
        }
    };
    if (menuOpenForQuestion) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenForQuestion]);

  const toggleExpand = (id: string) => {
    setExpandedQuestionIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };

  const handleExpandAll = () => setExpandedQuestionIds(new Set(questions.map(q => q.id)));
  const handleCollapseAll = () => setExpandedQuestionIds(new Set());

  const openEditModal = (question: Question | null, e?: React.MouseEvent<HTMLButtonElement>) => {
    setEditingQuestion(question);
    if(e) triggerRef.current = e.currentTarget;
    setIsEditModalOpen(true);
  };
  
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    triggerRef.current?.focus();
    setEditingQuestion(null);
  };

  const openConfirmDelete = (question: Question, e?: React.MouseEvent<HTMLButtonElement>) => {
    setQuestionToDelete(question);
    if(e) triggerRef.current = e.currentTarget;
  };

  const handleConfirmDelete = () => {
    if (questionToDelete) {
        onQuestionsChange(questions.filter(q => q.id !== questionToDelete.id));
    }
    setQuestionToDelete(null);
  };

  const handleSaveQuestion = (data: EditableQuestionParts & { id?: string }) => {
    if (editingQuestion && data.id) { // Editing existing question
      onQuestionsChange(questions.map(q => q.id === data.id ? { ...q, ...data } : q));
    } else { // Adding new question
        const { id, ...newQuestionData } = data;
        const completeData: NewQuestionData = {
            ...newQuestionData,
            questionType: 'multipleChoice',
            suspended: false
        };
        onAddQuestion(completeData);
    }
    handleCloseEditModal();
  };

  const handleSuspendQuestion = (questionId: string) => {
    onQuestionsChange(questions.map(q => q.id === questionId ? { ...q, suspended: true } : q));
    setMenuOpenForQuestion(null);
  };
  
  const handleUnsuspendQuestion = (questionId: string) => {
    onQuestionsChange(questions.map(q => q.id === questionId ? { ...q, suspended: false } : q));
    setMenuOpenForQuestion(null);
  };

  const handleRegenerate = async (question: Question) => {
    setMenuOpenForQuestion(null);
    setRegeneratingId(question.id);
    try {
        await onRegenerateQuestion(deck, question);
    } finally {
        setRegeneratingId(null);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (index: number, e: React.DragEvent) => {
      setDraggedQuestionIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (index: number, e: React.DragEvent) => {
      e.preventDefault();
      if (draggedQuestionIndex === null || draggedQuestionIndex === index) return;

      const newQuestions = [...questions];
      const [draggedItem] = newQuestions.splice(draggedQuestionIndex, 1);
      newQuestions.splice(index, 0, draggedItem);
      
      onQuestionsChange(newQuestions);
      setDraggedQuestionIndex(null);
  };

  return (
    <div>
      <div className="border-b border-border flex justify-between items-center bg-surface sticky top-0 z-10">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex-grow flex justify-between items-center text-left p-6"
          aria-expanded={isOpen}
          aria-controls="question-list-content"
        >
          <h3 className="text-xl font-semibold text-text">Questions ({questions.length})</h3>
          <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'} text-text-muted`}/>
        </button>
        {isOpen && questions.length > 0 && (
            <div className="pr-6 flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleExpandAll} title="Expand All">
                    <Icon name="maximize" className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCollapseAll} title="Collapse All">
                    <Icon name="minimize" className="w-4 h-4" />
                </Button>
            </div>
        )}
      </div>

      {isOpen && (
        <div id="question-list-content" className="animate-fade-in">
          <div className="p-6">
            {questions.length > 0 ? (
              <ul className="space-y-4">
                {questions.map((question, index) => {
                  const { text: dueDateText, isDue } = getDueDateInfo(question.dueDate);
                  const isDragging = draggedQuestionIndex === index;
                  const isExpanded = expandedQuestionIds.has(question.id);

                  return (
                    <li 
                        key={question.id} 
                        className={`p-4 rounded-lg flex flex-col transition-all border border-transparent ${question.suspended ? 'bg-yellow-500/10 opacity-70' : 'bg-background'} ${isDragging ? 'opacity-50 ring-2 ring-primary' : 'hover:border-border'}`}
                        draggable
                        onDragStart={(e) => handleDragStart(index, e)}
                        onDragOver={(e) => handleDragOver(index, e)}
                        onDrop={(e) => handleDrop(index, e)}
                    >
                        <div className="flex items-start justify-between w-full">
                            <div className="flex items-start flex-1 min-w-0">
                                <div className="mr-3 mt-1 cursor-grab active:cursor-grabbing text-text-muted hover:text-text" onClick={e => e.stopPropagation()}>
                                    <Icon name="grip-vertical" className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0 mr-4">
                                    {isExpanded ? (
                                        <div className="py-2 space-y-4">
                                            <div>
                                                <p className="text-xs font-bold text-text-muted uppercase mb-1">Question</p>
                                                <DangerousHtmlRenderer html={question.questionText} className="prose prose-sm dark:prose-invert max-w-none font-semibold text-text" />
                                            </div>
                                            <div className="pt-2 border-t border-border/50">
                                                <p className="text-xs font-bold text-text-muted uppercase mb-2">Options</p>
                                                <ul className="space-y-2">
                                                    {question.options.map(opt => (
                                                        <li key={opt.id} className={`p-2 rounded border text-sm ${opt.id === question.correctAnswerId ? 'bg-green-500/10 border-green-500/30' : 'bg-background border-border/50'}`}>
                                                            <div className="flex items-center gap-2">
                                                                {opt.id === question.correctAnswerId && <Icon name="check-circle" className="w-4 h-4 text-green-500" />}
                                                                <span className={opt.id === question.correctAnswerId ? 'font-bold' : ''}>{opt.text}</span>
                                                            </div>
                                                            {opt.explanation && <p className="text-[10px] text-text-muted mt-1 italic pl-6">{opt.explanation}</p>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            {question.detailedExplanation && (
                                                <div className="pt-2 border-t border-border/50">
                                                    <p className="text-xs font-bold text-text-muted uppercase mb-1">Full Explanation</p>
                                                    <DangerousHtmlRenderer html={question.detailedExplanation} className="prose prose-sm dark:prose-invert max-w-none text-text-muted" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-base font-medium text-text break-words truncate" title={stripHtml(question.questionText)}>{stripHtml(question.questionText)}</p>
                                    )}
                                    <div className="mt-3 space-y-2">
                                        <MasteryBar level={getEffectiveMasteryLevel(question)} />
                                        <div className="flex items-center gap-4 text-xs text-text-muted">
                                            <span className={`font-semibold ${isDue ? 'text-primary' : ''}`}>
                                                <Icon name="zap" className="w-3 h-3 inline-block mr-1" />{dueDateText}
                                            </span>
                                            <span>
                                                <Icon name="list" className="w-3 h-3 inline-block mr-1" />{(question.options || []).length} options
                                            </span>
                                        </div>
                                        {question.tags && question.tags.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-1 mt-2">
                                                {question.tags.map(tag => (
                                                    <span key={tag} className="bg-border/50 text-text-muted text-xs px-2 py-0.5 rounded-full">{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1" ref={menuOpenForQuestion === question.id ? menuRef : null}>
                                <Button variant="ghost" size="sm" className="p-2 h-auto text-text-muted" onClick={() => toggleExpand(question.id)} title={isExpanded ? "Collapse" : "Expand"}>
                                    <Icon name={isExpanded ? "minimize" : "maximize"} className="w-4 h-4" />
                                </Button>
                               {regeneratingId === question.id ? (
                                    <div className="p-2"><Spinner size="sm" /></div>
                               ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-2 h-auto"
                                    onClick={(e) => { e.stopPropagation(); setMenuOpenForQuestion(q => q === question.id ? null : question.id); }}
                                    aria-label={`More options for question`}
                                >
                                    <Icon name="more-vertical" className="w-5 h-5" />
                                </Button>
                               )}
                                {menuOpenForQuestion === question.id && (
                                    <div
                                        className="absolute right-0 mt-2 w-48 bg-surface rounded-md shadow-lg py-1 z-10 ring-1 ring-black ring-opacity-5 animate-fade-in"
                                        style={{ animationDuration: '150ms' }}
                                    >
                                        <button type="button" onClick={(e) => { openEditModal(question, e); setMenuOpenForQuestion(null); }} className="flex items-center w-full px-4 py-2 text-sm text-left text-text hover:bg-border/20">
                                            <Icon name="edit" className="w-4 h-4 mr-3" />
                                            Edit
                                        </button>
                                        <button type="button" onClick={() => handleRegenerate(question)} className="flex items-center w-full px-4 py-2 text-sm text-left text-text hover:bg-border/20">
                                            <Icon name="zap" className="w-4 h-4 mr-3" />
                                            Regenerate
                                        </button>
                                        {question.suspended ? (
                                            <button type="button" onClick={() => handleUnsuspendQuestion(question.id)} className="flex items-center w-full px-4 py-2 text-sm text-left text-text hover:bg-border/20">
                                                <Icon name="eye" className="w-4 h-4 mr-3" />
                                                Unsuspend
                                            </button>
                                        ) : (
                                            <button type="button" onClick={() => handleSuspendQuestion(question.id)} className="flex items-center w-full px-4 py-2 text-sm text-left text-text hover:bg-border/20">
                                                <Icon name="eye-off" className="w-4 h-4 mr-3" />
                                                Suspend
                                            </button>
                                        )}
                                        <div className="border-t border-border my-1"></div>
                                        <button type="button" onClick={(e) => { openConfirmDelete(question, e); setMenuOpenForQuestion(null); }} className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <Icon name="trash-2" className="w-4 h-4 mr-3" />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-lg bg-background/50">
                <Icon name="help-circle" className="w-12 h-12 text-text-muted mb-3" />
                <p className="text-text font-medium mb-1">No questions yet</p>
                <p className="text-sm text-text-muted text-center max-w-xs">Start adding questions to build your quiz.</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <Button variant="primary" onClick={(e) => openEditModal(null, e)}>
                        <Icon name="plus" className="w-4 h-4 mr-2"/>
                        Add Question
                    </Button>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex flex-wrap gap-2 items-center">
            <Button variant="secondary" onClick={(e) => openEditModal(null, e)} className="flex-grow sm:flex-grow-0">
                <Icon name="plus" className="w-5 h-5 mr-2"/>
                Add New Question
            </Button>
            <Button variant="ghost" onClick={onBulkAdd} className="flex-grow sm:flex-grow-0">
                <Icon name="code" className="w-5 h-5 mr-2"/>
                Bulk Add via JSON
            </Button>

            <div className="flex-grow"></div>

            {aiFeaturesEnabled && (
                <AIActionsMenu 
                    deck={deck}
                    isGenerating={isGenerating}
                    onGenerateMore={() => dataHandlers?.handleOpenAIGenerationForDeck(deck)}
                    onRework={() => dataHandlers?.handleOpenAIReworkForDeck(deck)}
                    onAnalyze={() => dataHandlers?.handleOpenDeckAnalysis(deck)}
                    onAutoTag={() => dataHandlers?.handleAutoTagQuestions(deck as QuizDeck)}
                    onHardenDistractors={() => dataHandlers?.handleHardenAllDistractors(deck as QuizDeck)}
                />
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && (
          <EditQuestionModal
            question={editingQuestion}
            onClose={handleCloseEditModal}
            onSave={handleSaveQuestion}
            deckName={deckName}
          />
      )}
      {questionToDelete && (
        <ConfirmModal
            isOpen={!!questionToDelete}
            onClose={() => setQuestionToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Delete Question"
            message="Are you sure you want to delete this question? This action cannot be undone."
        />
      )}
    </div>
  );
};

export default QuestionListEditor;
