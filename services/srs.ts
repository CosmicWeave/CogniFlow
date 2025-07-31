

import { Reviewable, ReviewRating } from '../types';
import { INITIAL_EASE_FACTOR, MIN_EASE_FACTOR, AGAIN_INTERVAL_DAYS, HARD_INTERVAL_MULTIPLIER, EASY_BONUS_MULTIPLIER, EASE_FACTOR_MODIFIERS } from '../constants';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export const calculateNextReview = <T extends Reviewable>(item: T, rating: ReviewRating): T => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  let nextInterval: number;
  let nextEaseFactor = item.easeFactor;

  // Adjust ease factor
  nextEaseFactor = item.easeFactor + EASE_FACTOR_MODIFIERS[rating];
  if (nextEaseFactor < MIN_EASE_FACTOR) {
    nextEaseFactor = MIN_EASE_FACTOR;
  }
  
  // Calculate next interval
  if (rating === ReviewRating.Again) {
    nextInterval = AGAIN_INTERVAL_DAYS;
  } else {
    if(item.interval === 0) { // First time seeing item
        switch(rating) {
            case ReviewRating.Hard:
                nextInterval = 1;
                break;
            case ReviewRating.Good:
                nextInterval = 3;
                break;
            case ReviewRating.Easy:
                nextInterval = 5;
                break;
            default:
                nextInterval = 1;
        }
    } else {
        let intervalMultiplier = 1;
        if(rating === ReviewRating.Hard) {
            intervalMultiplier = HARD_INTERVAL_MULTIPLIER;
        }
        if(rating === ReviewRating.Easy) {
            intervalMultiplier = EASY_BONUS_MULTIPLIER;
        }
        nextInterval = Math.ceil(item.interval * nextEaseFactor * intervalMultiplier);
    }
  }

  const nextDueDate = addDays(today, nextInterval);

  // Mastery is calculated based on the *new* interval after review.
  // A 90-day interval is considered 'mastered' (1.0). The scale is logarithmic.
  const masteryLevel = Math.min(1, Math.log1p(nextInterval) / Math.log1p(90));

  return {
    ...item,
    interval: nextInterval,
    easeFactor: nextEaseFactor,
    dueDate: nextDueDate.toISOString(),
    lastReviewed: today.toISOString(),
    masteryLevel: masteryLevel,
  };
};

export const resetReviewable = <T extends Reviewable>(item: T): T => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
        ...item,
        dueDate: today.toISOString(),
        interval: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        suspended: false,
        masteryLevel: 0,
        lastReviewed: undefined,
    };
};

/**
 * Calculates the current mastery level of an item, applying a decay function
 * to simulate the forgetting curve.
 * @param item The reviewable item.
 * @returns The effective mastery level from 0.0 to 1.0.
 */
export const getEffectiveMasteryLevel = (item: Reviewable): number => {
    const storedMastery = item.masteryLevel || 0;
    if (storedMastery === 0 || !item.lastReviewed || item.suspended) {
        return 0;
    }
    
    // The "half-life" of a memory is proportional to its review interval.
    // A card with a 10-day interval will decay much slower than one with a 1-day interval.
    // We'll set the half-life to be twice the interval.
    const halfLifeDays = (item.interval || 1) * 2; 

    const lastReviewedDate = new Date(item.lastReviewed);
    const now = new Date();
    // Only apply decay for time passed since last review.
    const daysSinceLastReview = Math.max(0, (now.getTime() - lastReviewedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastReview <= 0) {
        return storedMastery;
    }

    // Exponential decay formula: N(t) = N0 * (1/2)^(t / T)
    const decayFactor = Math.pow(0.5, daysSinceLastReview / halfLifeDays);
    
    return storedMastery * decayFactor;
};