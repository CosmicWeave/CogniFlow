import React from 'react';
import { ReviewRating } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface SessionControlsProps {
    isCurrent: boolean;
    isHistorical: boolean;
    isFlipped: boolean;
    isAnswered: boolean;
    isReviewing: boolean;
    isQuiz: boolean;
    isInfoCard: boolean;
    isCramSession: boolean;
    showNavArrows: boolean;
    displayIndex: number;
    currentIndex: number;
    queueLength: number;
    onReview: (rating: ReviewRating) => void;
    onSuspend: () => void;
    onReadInfoCard: () => void;
    onFlip: () => void;
    onReturnToCurrent: () => void;
    onNavigatePrevious: () => void;
    onNavigateNext: () => void;
    itemsCompleted: number;
    totalSessionItems: number;
}

const SessionControls: React.FC<SessionControlsProps> = ({
    isCurrent, isHistorical, isFlipped, isAnswered, isReviewing, isQuiz, isInfoCard, isCramSession, showNavArrows,
    displayIndex, currentIndex, queueLength, onReview, onSuspend, onReadInfoCard, onFlip, onReturnToCurrent, onNavigatePrevious, onNavigateNext,
    itemsCompleted, totalSessionItems
}) => {
    const showRatingButtons = (isFlipped || (isQuiz && isAnswered)) && isCurrent;

    return (
        <div className="flex-shrink-0 mt-4 flex flex-col items-center justify-center space-y-4 min-h-[10rem]">
            <div className="w-full flex-grow flex items-center justify-center">
                {isHistorical ? (
                    <div className="text-center animate-fade-in">
                        <Button onClick={onReturnToCurrent} variant="primary" className="text-lg py-3">Return to Current Item</Button>
                        <div className="text-xs mt-2 font-semibold text-yellow-600 dark:text-yellow-400">(Reviewing Past Item)</div>
                    </div>
                ) : showRatingButtons ? (
                    <div className="space-y-4 animate-fade-in w-full">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Button onClick={() => onReview(ReviewRating.Again)} className="bg-red-600 hover:bg-red-700 focus:ring-red-500 py-3 text-base text-white" disabled={isReviewing}>Forgot</Button>
                            <Button onClick={() => onReview(ReviewRating.Hard)} className="bg-orange-500 hover:bg-orange-600 focus:ring-orange-400 py-3 text-base text-white" disabled={isReviewing}>Struggled</Button>
                            <Button onClick={() => onReview(ReviewRating.Good)} className="bg-green-600 hover:bg-green-700 focus:ring-green-500 py-3 text-base text-white" disabled={isReviewing}>Knew It</Button>
                            <Button onClick={() => onReview(ReviewRating.Easy)} className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 py-3 text-base text-white" disabled={isReviewing}>Mastered</Button>
                        </div>
                        {!isCramSession && (
                            <div className="text-center">
                                <Button variant="ghost" onClick={onSuspend} className="text-xs" disabled={isReviewing}>
                                    <Icon name="eye-off" className="w-4 h-4 mr-1" /> Suspend this item
                                </Button>
                            </div>
                        )}
                    </div>
                ) : isInfoCard && isCurrent ? (
                    <Button onClick={onReadInfoCard} variant="primary" className="w-full max-w-md text-lg py-3 animate-fade-in mx-auto flex items-center justify-center">Continue</Button>
                ) : (
                    !isQuiz && isCurrent && (
                        <Button onClick={onFlip} variant="primary" className="w-full max-w-md text-lg py-3 animate-fade-in mx-auto flex items-center justify-center">Show Answer</Button>
                    )
                )}
            </div>

            {showNavArrows && (
                <div className="flex justify-center items-center w-full max-w-xs gap-4 animate-fade-in h-12">
                    <Button variant="ghost" onClick={onNavigatePrevious} disabled={displayIndex === 0} className="p-3 rounded-full disabled:opacity-30" aria-label="Previous item">
                        <Icon name="chevron-left" className="w-8 h-8" />
                    </Button>
                    <div className="text-center w-28">
                        <span className="text-sm text-text-muted">
                            Item {Math.min(itemsCompleted + 1, totalSessionItems)} of {totalSessionItems}
                        </span>
                    </div>
                    <Button variant="ghost" onClick={onNavigateNext} disabled={displayIndex >= currentIndex} className="p-3 rounded-full disabled:opacity-30" aria-label="Next item">
                        <Icon name="chevron-left" className="w-8 h-8 rotate-180" />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default SessionControls;