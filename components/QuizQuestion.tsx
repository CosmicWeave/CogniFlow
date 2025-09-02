import React, { useMemo } from 'react';
import type { Question, QuestionOption, InfoCard } from '../types';
import Icon from './ui/Icon';
import MasteryBar from './ui/MasteryBar';
import { getEffectiveMasteryLevel } from '../services/srs';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import Button from './ui/Button';

interface QuizQuestionProps {
  question: Question;
  selectedAnswerId: string | null;
  onSelectAnswer: (optionId: string) => void;
  deckName?: string;
  onShowInfo?: () => void; // Callback to show related info
}

const QuizQuestion: React.FC<QuizQuestionProps> = ({ question, selectedAnswerId, onSelectAnswer, deckName, onShowInfo }) => {
  const isAnswered = selectedAnswerId !== null;

  const shuffledOptions = useMemo(() => {
    // For Learning Decks, we may not want to shuffle to maintain instructional order.
    // For now, we keep shuffling for all quiz types.
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
    if (!isAnswered) {
        return `${baseClasses} bg-surface border-border hover:border-primary cursor-pointer`;
    }
    
    // After answering
    const isCorrect = option.id === question.correctAnswerId;
    const isSelected = option.id === selectedAnswerId;

    if (isCorrect) {
        return `${baseClasses} border-green-500 bg-green-500/10 cursor-not-allowed`;
    }
    if (isSelected) { // and not correct
        return `${baseClasses} border-red-500 bg-red-500/10 cursor-not-allowed`;
    }
    
    return `${baseClasses} border-border bg-background/50 cursor-not-allowed`;
  };

  const mastery = getEffectiveMasteryLevel(question);

  return (
    <div className="bg-surface rounded-lg shadow-lg border border-border">
      {/* Question Text */}
      <div className="p-6 md:p-8">
        {deckName && <p className="text-xs text-text-muted mb-2 uppercase tracking-wider font-semibold">{deckName}</p>}
        <DangerousHtmlRenderer html={question.questionText} className="text-xl font-semibold text-text" as="h3"/>
      </div>

      {/* Options */}
      <div className="px-6 md:px-8 pb-6 md:pb-8">
        <div className="space-y-3">
          {shuffledOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelectAnswer(option.id)}
              disabled={isAnswered}
              className={getOptionClasses(option)}
              aria-pressed={selectedAnswerId === option.id}
            >
              <div className="flex-1 min-w-0">
                <DangerousHtmlRenderer html={option.text} className="prose dark:prose-invert max-w-none" />
                {isAnswered && option.explanation && (
                  <p className="text-xs mt-1 text-text-muted">{option.explanation}</p>
                )}
              </div>
              {isAnswered && (
                <div className="ml-4 flex-shrink-0">
                  {option.id === question.correctAnswerId ? (
                    <Icon name="check-circle" className="w-6 h-6 text-green-500"/>
                  ) : option.id === selectedAnswerId ? (
                    <Icon name="x-circle" className="w-6 h-6 text-red-500"/>
                  ) : null}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation & Mastery */}
      {isAnswered && (
        <div className="p-6 bg-background/30 dark:bg-black/10 border-t border-border/50 animate-fade-in">
          <div className="flex justify-between items-start">
            <div>
                {question.detailedExplanation && (
                    <>
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">
                        Explanation
                        </h4>
                        <DangerousHtmlRenderer html={question.detailedExplanation} className="prose dark:prose-invert max-w-none prose-sm"/>
                    </>
                )}
            </div>
            {onShowInfo && (
                <Button variant="ghost" size="sm" onClick={onShowInfo} className="ml-4 flex-shrink-0">
                    <Icon name="info" className="w-4 h-4 mr-1"/>
                    View Related Info
                </Button>
            )}
          </div>

          <div className={question.detailedExplanation ? "mt-6 pt-6 border-t border-border/50" : ""}>
            <MasteryBar level={mastery} />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizQuestion;
