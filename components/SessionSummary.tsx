import React from 'react';
import { Card, Question, ReviewRating } from '../types';
import { getEffectiveMasteryLevel } from '../services/srs';
import Confetti from './ui/Confetti';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface SessionSummaryProps {
    deckId: string;
    seriesId?: string;
    reviewedItems: Array<{ oldItem: Card | Question; newItem: Card | Question; rating: ReviewRating | null }>;
    nextDeckId: string | null;
    onSessionEnd: (deckId: string, seriesId?: string) => void;
    onStudyNextDeck?: (deckId: string, seriesId: string, nextDeckId: string) => Promise<void>;
    isCramSession: boolean;
}

const SessionSummary: React.FC<SessionSummaryProps> = ({ deckId, seriesId, reviewedItems, nextDeckId, onSessionEnd, onStudyNextDeck, isCramSession }) => {
    if (isCramSession) {
        return (
            <div className="text-center p-8 animate-fade-in relative">
                <Confetti />
                <h2 className="text-2xl font-bold text-green-500">Cram Session Complete!</h2>
                <p className="text-text-muted mt-2">You've reviewed all {reviewedItems.length} items in this deck.</p>
                <Button onClick={() => onSessionEnd(deckId, seriesId)} className="mt-8">Finish Session</Button>
            </div>
        );
    }

    const summary = reviewedItems.reduce((acc, { rating }) => {
        if (rating) acc[rating] = (acc[rating] || 0) + 1;
        return acc;
    }, {} as Record<ReviewRating, number>);

    const masteryChanges = reviewedItems.map(({ oldItem, newItem }) => {
        const oldMastery = getEffectiveMasteryLevel(oldItem);
        const newMastery = newItem.masteryLevel || 0;
        return newMastery - oldMastery;
    });

    const avgMasteryChange = masteryChanges.length > 0 ? (masteryChanges.reduce((a, b) => a + b, 0) / masteryChanges.length) * 100 : 0;

    return (
        <div className="text-center p-8 animate-fade-in relative">
            <Confetti />
            <h2 className="text-2xl font-bold text-green-500">Session Complete!</h2>
            <p className="text-text-muted mt-2">You reviewed {reviewedItems.length} item{reviewedItems.length !== 1 ? 's' : ''}.</p>
            
            <div className="mt-8 max-w-sm mx-auto bg-surface p-4 rounded-lg border border-border">
                <h3 className="font-semibold text-lg mb-3">Session Summary</h3>
                <div className="flex justify-around text-center">
                    <div><p className="text-2xl font-bold text-red-500">{summary[ReviewRating.Again] || 0}</p><p className="text-xs text-text-muted">Again</p></div>
                    <div><p className="text-2xl font-bold text-orange-500">{summary[ReviewRating.Hard] || 0}</p><p className="text-xs text-text-muted">Hard</p></div>
                    <div><p className="text-2xl font-bold text-green-500">{summary[ReviewRating.Good] || 0}</p><p className="text-xs text-text-muted">Good</p></div>
                    <div><p className="text-2xl font-bold text-blue-500">{summary[ReviewRating.Easy] || 0}</p><p className="text-xs text-text-muted">Easy</p></div>
                </div>
                <div className="mt-4 text-sm">
                    <p>Average Mastery Change: <strong className={avgMasteryChange >= 0 ? 'text-green-500' : 'text-red-500'}>{avgMasteryChange >= 0 ? '+' : ''}{avgMasteryChange.toFixed(1)}%</strong></p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
                {nextDeckId && onStudyNextDeck && seriesId && (
                    <Button onClick={() => onStudyNextDeck(deckId, seriesId, nextDeckId)} variant="primary" size="lg">
                        <Icon name="zap" className="w-5 h-5 mr-2" />
                        Start Next Deck
                    </Button>
                )}
                <Button onClick={() => onSessionEnd(deckId, seriesId)} variant={nextDeckId ? 'secondary' : 'primary'} size="lg">Finish Session</Button>
            </div>
        </div>
    );
};

export default SessionSummary;
