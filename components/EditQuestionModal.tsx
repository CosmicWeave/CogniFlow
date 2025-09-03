
import React, { useState, useEffect, useRef } from 'react';
import { Question, QuestionOption } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';

export type EditableQuestionParts = Pick<Question, 'questionText' | 'detailedExplanation' | 'options' | 'correctAnswerId' | 'tags'>;

interface EditQuestionModalProps {
  question: Question | null; // null for creating a new card
  onClose: () => void;
  onSave: (question: EditableQuestionParts & { id?: string }) => void;
}

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({ question, onClose, onSave }) => {
  const [questionText, setQuestionText] = useState('');
  const [detailedExplanation, setDetailedExplanation] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>([]);
  const [correctAnswerId, setCorrectAnswerId] = useState<string>('');
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);


  useEffect(() => {
    if (question) {
      setQuestionText(question.questionText);
      setDetailedExplanation(question.detailedExplanation);
      setOptions(question.options.map(o => ({...o}))); // deep copy
      setCorrectAnswerId(question.correctAnswerId);
    } else {
        // Start with two empty options for a new question
        const newOptions = [
            { id: crypto.randomUUID(), text: '' },
            { id: crypto.randomUUID(), text: '' }
        ];
        setOptions(newOptions);
    }
  }, [question]);

  const handleOptionTextChange = (id: string, text: string) => {
    setOptions(options.map(opt => opt.id === id ? { ...opt, text } : opt));
  };

  const handleAddOption = () => {
    setOptions([...options, { id: crypto.randomUUID(), text: '' }]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) {
        addToast("A question must have at least two options.", "error");
        return;
    }
    setOptions(options.filter(opt => opt.id !== id));
    if (correctAnswerId === id) {
      setCorrectAnswerId('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      addToast("Question text is required.", "error");
      return;
    }
    if (options.some(opt => !opt.text.trim())) {
        addToast("All options must have text.", "error");
        return;
    }
    if (!correctAnswerId) {
        addToast("You must select a correct answer.", "error");
        return;
    }
    
    onSave({
      id: question?.id,
      questionText: questionText.trim(),
      detailedExplanation: detailedExplanation.trim(),
      options,
      correctAnswerId,
      tags: question?.tags || [],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-3xl transform transition-all relative max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">{question ? 'Edit Question' : 'Add New Question'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label htmlFor="question-text" className="block text-sm font-medium text-text-muted mb-1">Question Text</label>
              <textarea
                id="question-text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="What is the capital of France?"
              />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Options</label>
                <div className="space-y-2">
                    {options.map((option, index) => (
                        <div key={option.id} className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="correct-answer"
                                checked={correctAnswerId === option.id}
                                onChange={() => setCorrectAnswerId(option.id)}
                                className="h-5 w-5 text-primary bg-border/50 border-border focus:ring-primary"
                                aria-label={`Set option ${index + 1} as correct`}
                            />
                            <input
                                type="text"
                                value={option.text}
                                onChange={(e) => handleOptionTextChange(option.id, e.target.value)}
                                className="flex-grow p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                                placeholder={`Option ${index + 1}`}
                            />
                            <Button type="button" variant="ghost" onClick={() => handleRemoveOption(option.id)} className="p-2 h-auto" aria-label={`Remove option ${index+1}`}>
                                <Icon name="trash-2" className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button type="button" variant="ghost" onClick={handleAddOption} className="mt-2 text-primary">
                    <Icon name="plus" className="w-4 h-4 mr-2"/>
                    Add Option
                </Button>
            </div>

            <div>
              <label htmlFor="detailed-explanation" className="block text-sm font-medium text-text-muted mb-1">Detailed Explanation (Optional)</label>
              <textarea
                id="detailed-explanation"
                value={detailedExplanation}
                onChange={(e) => setDetailedExplanation(e.target.value)}
                rows={4}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="Explain why the correct answer is right and others are wrong."
              />
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">
              {question ? 'Save Changes' : 'Add Question'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditQuestionModal;