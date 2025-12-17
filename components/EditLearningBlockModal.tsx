
import React, { useState, useEffect, useRef } from 'react';
import { InfoCard, Question, QuestionOption, ReviewRating } from '../types.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useToast } from '../hooks/useToast.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import { INITIAL_EASE_FACTOR } from '../constants.ts';
import RichTextToolbar from './ui/RichTextToolbar.tsx';

export interface LearningBlockData {
  infoCard: InfoCard;
  questions: Question[];
}

interface EditLearningBlockModalProps {
  block: LearningBlockData | null;
  onClose: () => void;
  onSave: (data: LearningBlockData) => void;
}

const EditLearningBlockModal: React.FC<EditLearningBlockModalProps> = ({ block, onClose, onSave }) => {
  const [infoContent, setInfoContent] = useState('');
  const [questions, setQuestions] = useState<Partial<Question>[]>([]);
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);

  useEffect(() => {
    if (block) {
      setInfoContent(block.infoCard.content);
      setQuestions(block.questions.map(q => ({ ...q })));
    } else {
      setQuestions([{
          id: crypto.randomUUID(),
          questionText: '',
          options: [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }],
          correctAnswerId: '',
          detailedExplanation: ''
      }]);
    }
  }, [block]);

  const handleQuestionChange = (qIndex: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions];
    (newQuestions[qIndex] as any)[field] = value;
    setQuestions(newQuestions);
  };
  
  const handleOptionChange = (qIndex: number, optIndex: number, text: string) => {
    const newQuestions = [...questions];
    if (newQuestions[qIndex].options) {
      newQuestions[qIndex].options![optIndex].text = text;
      setQuestions(newQuestions);
    }
  };
  
  const handleAddQuestion = () => {
      setQuestions([...questions, {
          id: crypto.randomUUID(),
          questionText: '',
          options: [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }],
          correctAnswerId: '',
          detailedExplanation: ''
      }]);
  };
  
  const handleRemoveQuestion = (qIndex: number) => {
    if (questions.length <= 1) {
        addToast("A learning block must have at least one question.", "error");
        return;
    }
    setQuestions(questions.filter((_, index) => index !== qIndex));
  };
  
  const handleAddOption = (qIndex: number) => {
      const newQuestions = [...questions];
      newQuestions[qIndex].options?.push({ id: crypto.randomUUID(), text: '' });
      setQuestions(newQuestions);
  };
  
  const handleRemoveOption = (qIndex: number, optIndex: number) => {
      const newQuestions = [...questions];
      const question = newQuestions[qIndex];
      if (question.options && question.options.length > 2) {
          const removedOption = question.options.splice(optIndex, 1)[0];
          if (question.correctAnswerId === removedOption.id) {
              question.correctAnswerId = '';
          }
          setQuestions(newQuestions);
      } else {
          addToast("A question must have at least two options.", "error");
      }
  };

  const handleTextAreaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = target.value.substring(0, start) + "\t" + target.value.substring(end);
        target.value = newValue; // Visual update
        setter(newValue); // State update
        target.selectionStart = target.selectionEnd = start + 1;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoContent.trim()) {
      addToast("Informational content cannot be empty.", "error");
      return;
    }
    for (const q of questions) {
        if (!q.questionText?.trim()) { addToast("Question text is required.", "error"); return; }
        if (q.options?.some(opt => !opt.text.trim())) { addToast("All options must have text.", "error"); return; }
        if (!q.correctAnswerId) { addToast("You must select a correct answer for each question.", "error"); return; }
    }

    const today = new Date().toISOString();
    
    const finalInfoCard: InfoCard = {
        id: block?.infoCard.id || crypto.randomUUID(),
        content: infoContent,
        unlocksQuestionIds: questions.map(q => q.id!)
    };

    const finalQuestions: Question[] = questions.map((q, index) => {
        const originalQuestion = block?.questions[index];
        return {
            ...originalQuestion,
            ...q,
            id: q.id!,
            questionType: 'multipleChoice',
            infoCardIds: [finalInfoCard.id],
            dueDate: originalQuestion?.dueDate || today,
            interval: originalQuestion?.interval || 0,
            easeFactor: originalQuestion?.easeFactor || INITIAL_EASE_FACTOR,
            tags: q.tags || [],
        } as Question;
    });

    onSave({ infoCard: finalInfoCard, questions: finalQuestions });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-4xl transform transition-all relative max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">{block ? 'Edit Learning Block' : 'Add New Learning Block'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </header>

          <main className="p-6 space-y-6 overflow-y-auto">
            <div>
              <label htmlFor="info-content" className="block text-sm font-bold text-text mb-1">Informational Content (Supports HTML)</label>
              <div className="border border-border rounded-md focus-within:ring-2 focus-within:ring-primary overflow-hidden">
                <RichTextToolbar targetId="info-content" value={infoContent} onChange={setInfoContent} />
                <textarea 
                    id="info-content" 
                    value={infoContent} 
                    onChange={(e) => setInfoContent(e.target.value)} 
                    onKeyDown={(e) => handleTextAreaKeyDown(e, setInfoContent)}
                    rows={12} 
                    className="w-full p-2 bg-background focus:outline-none font-mono text-sm block" 
                    placeholder="Explain a concept here..."
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
                <h3 className="text-lg font-bold text-text mb-2">Questions</h3>
                <div className="space-y-6">
                    {questions.map((q, qIndex) => (
                        <div key={q.id || qIndex} className="p-4 bg-background rounded-lg border border-border space-y-3 relative">
                            <label className="block text-sm font-medium text-text-muted">Question {qIndex + 1}</label>
                            <textarea value={q.questionText} onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)} rows={2} className="w-full p-2 bg-surface border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Question related to the info above"/>
                            
                            <div className="space-y-2">
                                {q.options?.map((opt, optIndex) => (
                                    <div key={opt.id || optIndex} className="flex items-center gap-2">
                                        <input type="radio" name={`correct-answer-${qIndex}`} checked={q.correctAnswerId === opt.id} onChange={() => handleQuestionChange(qIndex, 'correctAnswerId', opt.id)} className="h-5 w-5 text-primary bg-border/50 border-border focus:ring-primary" />
                                        <input type="text" value={opt.text} onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)} className="flex-grow p-2 bg-surface border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder={`Option ${optIndex + 1}`} />
                                        <Button type="button" variant="ghost" onClick={() => handleRemoveOption(qIndex, optIndex)} className="p-2 h-auto text-text-muted hover:text-red-500"><Icon name="x" className="w-4 h-4" /></Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="ghost" onClick={() => handleAddOption(qIndex)} size="sm"><Icon name="plus" className="w-4 h-4 mr-1"/>Add Option</Button>
                            
                             <textarea value={q.detailedExplanation} onChange={(e) => handleQuestionChange(qIndex, 'detailedExplanation', e.target.value)} rows={2} className="w-full p-2 bg-surface border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Detailed explanation for the answer"/>
                            
                            <Button type="button" variant="ghost" onClick={() => handleRemoveQuestion(qIndex)} className="absolute top-2 right-2 p-2 h-auto text-text-muted hover:text-red-500"><Icon name="trash-2" className="w-4 h-4" /></Button>
                        </div>
                    ))}
                     <Button type="button" variant="secondary" onClick={handleAddQuestion}><Icon name="plus" className="w-4 h-4 mr-2"/>Add Question</Button>
                </div>
            </div>
          </main>

          <footer className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">{block ? 'Save Changes' : 'Add Block'}</Button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditLearningBlockModal;
