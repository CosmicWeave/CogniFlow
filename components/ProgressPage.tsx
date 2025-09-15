import React, { useState, useEffect, useMemo } from 'react';
import * as db from '../services/db';
import { Card, Deck, Question, ReviewLog, Reviewable, QuizDeck, LearningDeck } from '../types';
import Spinner from './ui/Spinner';
import StatsGrid from './ui/StatsGrid';
import ActivityHeatmap from './ui/ActivityHeatmap';
import ForecastGraph from './ui/ForecastGraph';
import RetentionStats from './ui/RetentionStats';
import { useStore } from '../store/store';

const ProgressPage: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const decks = useStore(state => state.decks);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const reviewData = await db.getReviewsSince(oneYearAgo);
        setReviews(reviewData);
      } catch (err) {
        console.error("Failed to load review data:", err);
        setError("Could not load your review data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviews();
  }, []);

  const stats = useMemo(() => {
    if (isLoading) return null;

    // Calculate Streak
    let streak = 0;
    const reviewTimestamps = reviews.map(r => new Date(r.timestamp).setHours(0,0,0,0));
    const uniqueReviewDays = [...new Set(reviewTimestamps)];
    uniqueReviewDays.sort((a, b) => b - a);

    if (uniqueReviewDays.length > 0) {
      const today = new Date().setHours(0,0,0,0);
      const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);

      if (uniqueReviewDays[0] === today || uniqueReviewDays[0] === yesterday) {
        streak = 1;
        for (let i = 1; i < uniqueReviewDays.length; i++) {
          const day = uniqueReviewDays[i - 1];
          const prevDay = uniqueReviewDays[i];
          const expectedPrevDay = new Date(day).setDate(new Date(day).getDate() - 1);
          if (prevDay === expectedPrevDay) {
            streak++;
          } else {
            break;
          }
        }
      }
    }
    
    // Calculate Mature Items
    const allItems = decks.reduce<(Card | Question)[]>((acc, deck) => {
        if (deck.type === 'flashcard') {
            return acc.concat(deck.cards || []);
        } else {
            return acc.concat((deck as QuizDeck | LearningDeck).questions || []);
        }
    }, []);
    const matureCount = allItems.filter(item => (item.interval || 0) >= 21 && !item.suspended).length;
    
    return {
        streak,
        totalReviews: reviews.length,
        matureCount,
    };
  }, [reviews, decks, isLoading]);
  
  const allItems: Reviewable[] = useMemo(() => {
    const items = decks.reduce<(Card | Question)[]>((acc, deck) => {
        if (deck.type === 'flashcard') {
            return acc.concat(deck.cards || []);
        } else {
            return acc.concat((deck as QuizDeck | LearningDeck).questions || []);
        }
    }, []);
    return items.filter(i => !i.suspended);
  }, [decks]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
        <p className="ml-4 text-text-muted">Calculating your progress...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
  
  if (reviews.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-text-muted">No review history yet.</h2>
        <p className="mt-2 text-text-muted">Complete a study session to start tracking your progress!</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-8">
       <h1 className="text-3xl font-bold text-text border-b border-border pb-4">Your Progress</h1>
       <StatsGrid stats={stats!} />
       <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
          <h2 className="text-xl font-semibold text-text mb-4">Activity</h2>
          <ActivityHeatmap reviews={reviews} />
       </div>
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
             <h2 className="text-xl font-semibold text-text mb-4">30-Day Forecast</h2>
             <ForecastGraph items={allItems} />
          </div>
           <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
              <h2 className="text-xl font-semibold text-text mb-4">Retention (Last 30 Days)</h2>
              <RetentionStats reviews={reviews} />
           </div>
       </div>
    </div>
  );
};

export default ProgressPage;