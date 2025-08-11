import React, { useState, useMemo } from 'react';
import type { Question, QuestionOption } from '../types';
import Icon from './ui/Icon';
import MasteryBar from './ui/MasteryBar';
import { getEffectiveMasteryLevel } from '../services/srs';

interface QuizQuestionProps {
  question: Question;
  selectedAnswerId: string | null;
  onSelectAnswer: (optionId: string) => void;
  deckName?: string;
}

const QuizQuestion: React.FC<QuizQuestionProps> = ({ question, selectedAnswerId, onSelectAnswer, deckName }) => {
  const isAnswered = selectedAnswerId !== null;
  const [showAIExplanation, setShowAIExplanation] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);

  const shuffledOptions = useMemo(() => {
    const options = [...question.options];
    // Fisher-Yates shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }, [question.id]); // Re-shuffle only when the question changes

  const getOptionClasses = (option: QuestionOption) => {
    let baseClasses = 'flex items-start text-left w-full p-4 rounded-lg border-2 transition-all duration-200';
    if (isAnswered) {
      const isCorrect = option.id === question.correctAnswerId;
      const isSelected = option.id === selectedAnswerId;

      if (isCorrect) return `${baseClasses} bg-green-500/10 border-green-500 cursor-default`;
      if (isSelected) return `${baseClasses} bg-red-500/10 border-red-500 cursor-default`;
      return `${baseClasses} bg-surface/50 border-border opacity-60 cursor-default`;
    }
    return `${baseClasses} bg-surface border-border hover:border-primary hover:bg-border/20`;
  };
  
  const mastery = getEffectiveMasteryLevel(question);

  return (
    <div className="bg-surface/50 rounded-lg p-6 w-full border border-border">
      {deckName && (
        <div className="mb-3 text-xs text-text-muted font-medium tracking-wider uppercase">
          From: {deckName}
        </div>
      )}
      <p className="text-lg md:text-xl font-semibold mb-6 text-text break-words">{question.questionText}</p>
      
      <div className="space-y-3">
        {shuffledOptions.map((option) => {
          const isCorrect = option.id === question.correctAnswerId;
          const isSelected = option.id === selectedAnswerId;
          
          return (
            <button
              key={option.id}
              onClick={() => onSelectAnswer(option.id)}
              disabled={isAnswered}
              className={getOptionClasses(option)}
              aria-pressed={isSelected}
            >
              <div className="flex-shrink-0 w-6 h-6 mr-4 mt-1">
                {isAnswered && isCorrect && <Icon name="check-circle" className="text-green-500" />}
                {isAnswered && isSelected && !isCorrect && <Icon name="x-circle" className="text-red-500" />}
              </div>
              <div className="flex-grow min-w-0">
                <span className="text-text break-words">{option.text}</span>
                {isAnswered && option.explanation && (
                  <p className="text-sm text-text-muted mt-1 break-words">{option.explanation}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div className="mt-8 p-4 bg-background rounded-lg animate-fade-in space-y-4 border border-border">
          <div>
            <h4 className="font-bold text-lg text-primary mb-2">Detailed Explanation</h4>
            <p className="text-text-muted whitespace-pre-wrap">{question.detailedExplanation}</p>
          </div>
           <div className="pt-4 border-t border-border/50">
            <MasteryBar level={mastery} />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizQuestion;