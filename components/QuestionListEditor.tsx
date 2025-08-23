
import React, { useState, useRef, useEffect } from 'react';
import { Question } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import type { EditableQuestionParts } from './EditQuestionModal';
import EditQuestionModal from './EditQuestionModal';
import ConfirmModal from './ConfirmModal';
import { getEffectiveMasteryLevel } from '../services/srs';
import MasteryBar from './ui/MasteryBar';

type NewQuestionData = Omit<Question, 'id' | 'dueDate' | 'interval' | 'easeFactor' | 'lapses'>;

interface QuestionListEditorProps {
  questions: Question[];
  onQuestionsChange: (newQuestions: Question[]) => void;
  onAddQuestion: (newQuestionData: NewQuestionData) => void;
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


const QuestionListEditor: React.FC<QuestionListEditorProps> = ({ questions, onQuestionsChange, onAddQuestion, onBulkAdd }) => {
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [menuOpenForQuestion, setMenuOpenForQuestion] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <div>
      <div className="border-b border-border">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center text-left p-6"
          aria-expanded={isOpen}
          aria-controls="question-list-content"
        >
          <h3 className="text-xl font-semibold text-text">Questions</h3>
          <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'} text-text-muted`}/>
        </button>
      </div>

      {isOpen && (
        <div id="question-list-content" className="animate-fade-in">
          <div className="p-6">
            {questions.length > 0 ? (
              <ul className="space-y-4">
                {questions.map((question) => {
                  const { text: dueDateText, isDue } = getDueDateInfo(question.dueDate);
                  return (
                    <li key={question.id} className={`p-4 rounded-lg flex items-start justify-between transition-all ${question.suspended ? 'bg-yellow-500/10 opacity-70' : 'bg-background'}`}>
                        <div className="flex-1 min-w-0 mr-4">
                            <p className="text-base font-medium text-text break-words">{question.questionText}</p>
                            <div className="mt-3 space-y-2">
                                <MasteryBar level={getEffectiveMasteryLevel(question)} />
                                <div className="flex items-center gap-4 text-xs text-text-muted">
                                    <span className={`font-semibold ${isDue ? 'text-primary' : ''}`}>
                                        <Icon name="zap" className="w-3 h-3 inline-block mr-1" />{dueDateText}
                                    </span>
                                    <span>
                                        <Icon name="list" className="w-3 h-3 inline-block mr-1" />{question.options.length} options
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-shrink-0 relative" ref={menuOpenForQuestion === question.id ? menuRef : null}>
                            <Button
                                variant="ghost"
                                className="p-2 h-auto"
                                onClick={(e) => { e.stopPropagation(); setMenuOpenForQuestion(q => q === question.id ? null : question.id); }}
                                aria-label={`More options for question`}
                            >
                                <Icon name="more-vertical" className="w-5 h-5" />
                            </Button>
                            {menuOpenForQuestion === question.id && (
                                <div
                                    className="absolute right-0 mt-2 w-48 bg-surface rounded-md shadow-lg py-1 z-10 ring-1 ring-black ring-opacity-5 animate-fade-in"
                                    style={{ animationDuration: '150ms' }}
                                >
                                    <button type="button" onClick={(e) => { openEditModal(question, e); setMenuOpenForQuestion(null); }} className="flex items-center w-full px-4 py-2 text-sm text-left text-text hover:bg-border/20">
                                        <Icon name="edit" className="w-4 h-4 mr-3" />
                                        Edit
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
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center text-text-muted py-8">
                <Icon name="help-circle" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>This deck has no questions yet.</p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-border flex flex-wrap gap-2">
              <Button variant="secondary" onClick={(e) => openEditModal(null, e)} className="flex-grow sm:flex-grow-0">
                  <Icon name="plus" className="w-5 h-5 mr-2"/>
                  Add New Question
              </Button>
              <Button variant="ghost" onClick={onBulkAdd} className="flex-grow sm:flex-grow-0">
                  <Icon name="code" className="w-5 h-5 mr-2"/>
                  Bulk Add via JSON
              </Button>
          </div>
        </div>
      )}

      {isEditModalOpen && (
          <EditQuestionModal
            question={editingQuestion}
            onClose={handleCloseEditModal}
            onSave={handleSaveQuestion}
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
