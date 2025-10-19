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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [openExplanationIds, setOpenExplanationIds] = useState<Set<string>>(new Set());
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);


  useEffect(() => {
    if (question) {
      setQuestionText(question.questionText);
      setDetailedExplanation(question.detailedExplanation);
      setOptions((question.options || []).map(o => ({...o}))); // deep copy
      setCorrectAnswerId(question.correctAnswerId);
      setTags(question.tags || []);
    } else {
        // Start with two empty options for a new question
        const newOptions = [
            { id: crypto.randomUUID(), text: '' },
            { id: crypto.randomUUID(), text: '' }
        ];
        setOptions(newOptions);
        setTags([]);
    }
  }, [question]);

  const handleOptionChange = (id: string, field: 'text' | 'explanation', value: string) => {
    setOptions(options.map(opt => opt.id === id ? { ...opt, [field]: value } : opt));
  };

  const toggleExplanationEditor = (id: string) => {
    setOpenExplanationIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
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

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
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
      tags: tags,
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
                      <div key={option.id}>
                        <div className="flex items-center gap-2">
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
                                onChange={(e) => handleOptionChange(option.id, 'text', e.target.value)}
                                className="flex-grow p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                                placeholder={`Option ${index + 1}`}
                            />
                            <Button type="button" variant="ghost" onClick={() => toggleExplanationEditor(option.id)} className={`p-2 h-auto ${openExplanationIds.has(option.id) ? 'bg-primary/10 text-primary' : 'text-text-muted'}`} title="Add/Edit option explanation">
                                <Icon name="info" className="w-4 h-4" />
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => handleRemoveOption(option.id)} className="p-2 h-auto text-text-muted hover:text-red-500">
                                <Icon name="x" className="w-4 h-4" />
                            </Button>
                        </div>
                        {openExplanationIds.has(option.id) && (
                            <div className="pl-7 mt-1 animate-fade-in">
                                <input
                                    type="text"
                                    value={option.explanation || ''}
                                    onChange={(e) => handleOptionChange(option.id, 'explanation', e.target.value)}
                                    className="w-full p-1 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                                    placeholder="Brief explanation for this option..."
                                />
                            </div>
                        )}
                      </div>
                    ))}
                </div>
                <Button type="button" variant="ghost" onClick={handleAddOption} size="sm" className="mt-2">
                    <Icon name="plus" className="w-4 h-4 mr-2" />
                    Add Option
                </Button>
            </div>

            <div>
              <label htmlFor="detailed-explanation" className="block text-sm font-medium text-text-muted mb-1">Detailed Explanation</label>
              <textarea
                id="detailed-explanation"
                value={detailedExplanation}
                onChange={(e) => setDetailedExplanation(e.target.value)}
                rows={4}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="Explain why the correct answer is right and provide more context."
              />
            </div>

            <div>
                <label htmlFor="tags-input" className="block text-sm font-medium text-text-muted mb-1">Tags</label>
                <div className="flex flex-wrap items-center gap-2 p-2 bg-background border border-border rounded-md">
                    {tags.map((tag, index) => (
                        <span key={index} className="flex items-center gap-1 bg-primary/10 text-primary text-sm px-2 py-1 rounded-md">
                            {tag}
                            <button type="button" onClick={() => handleRemoveTag(tag)} className="text-primary hover:text-primary-hover">
                                <Icon name="x" className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                    <input
                        id="tags-input"
                        type="text"
                        value={tagInput}
                        onChange={handleTagInputChange}
                        onKeyDown={handleTagInputKeyDown}
                        className="flex-grow bg-transparent focus:outline-none"
                        placeholder={tags.length === 0 ? "Add tags (comma or enter)..." : ""}
                    />
                </div>
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
