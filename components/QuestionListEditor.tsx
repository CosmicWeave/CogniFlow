
import React, { useState, useRef } from 'react';
import { Question } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import type { EditableQuestionParts } from './EditQuestionModal';
import EditQuestionModal from './EditQuestionModal';
import ConfirmModal from './ConfirmModal';
import { getEffectiveMasteryLevel } from '../services/srs';

type NewQuestionData = Omit<Question, 'id' | 'dueDate' | 'interval' | 'easeFactor'>;

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
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);


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

  const handleUnignoreQuestion = (questionId: string) => {
    onQuestionsChange(questions.map(q => q.id === questionId ? { ...q, suspended: false } : q));
  };

  return (
    <div>
      <div className="border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center text-left p-6"
          aria-expanded={isOpen}
          aria-controls="question-list-content"
        >
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Questions</h3>
          <Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'} text-gray-500`}/>
        </button>
      </div>

      {isOpen && (
        <div id="question-list-content" className="animate-fade-in">
          <div className="p-6">
            {questions.length > 0 ? (
              <ul className="space-y-3">
                {questions.map((question) => {
                  const { text: dueDateText, isDue } = getDueDateInfo(question.dueDate);
                  const mastery = Math.round(getEffectiveMasteryLevel(question) * 100);
                  return (
                    <li key={question.id} className={`bg-gray-100 dark:bg-gray-900/50 p-3 rounded-md flex items-center justify-between transition-opacity ${question.suspended ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{question.questionText}</p>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-x-4 gap-y-1 flex-wrap">
                            <span>{question.options.length} options</span>
                            <span className={isDue ? 'font-semibold text-blue-500 dark:text-blue-400' : ''}>
                                {dueDateText}
                            </span>
                            <span>Mastery: {mastery}%</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                       {question.suspended ? (
                        <Button variant="ghost" className="p-2 h-auto text-yellow-600 dark:text-yellow-400" onClick={() => handleUnignoreQuestion(question.id)} title="Re-enable this question">
                            <Icon name="eye" className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" className="p-2 h-auto" onClick={(e) => openEditModal(question, e)} title="Edit this question">
                          <Icon name="edit" className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" className="p-2 h-auto text-gray-500 dark:text-gray-400 hover:text-red-500" onClick={(e) => openConfirmDelete(question, e)} title="Delete this question">
                        <Icon name="trash-2" className="w-4 h-4" />
                      </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-center py-4">This deck has no questions.</p>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
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
