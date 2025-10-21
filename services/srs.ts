/**
 * This service implements the core Spaced Repetition System (SRS) logic for CogniFlow.
 * The algorithm is a custom implementation inspired by the SM-2 algorithm (used in SuperMemo)
 * and the modifications made by Anki. Key features include:
 *
 * - Ease Factor: Each item has an "ease factor" that determines how quickly the interval grows.
 *   This factor is adjusted based on user performance.
 * - Interval Calculation: The next review interval is calculated based on the previous interval
 *   and the current ease factor. Different multipliers are used for 'Hard' and 'Easy' ratings.
 * - Lapse Handling: When an item is forgotten ('Again' rating), its interval is reset and its
 *   ease factor is penalized. Repeated lapses result in a greater penalty.
 * - Mastery Level: A custom, UI-focused metric (0.0 to 1.0) is calculated based on the review
 *   interval to give users a clear sense of their proficiency.
 * - Effective Mastery: A decay function is applied to the mastery level over time to simulate
 *   the "forgetting curve", providing a dynamic and realistic view of knowledge retention.
 */
// FIX: Corrected import path for types
import { Reviewable, ReviewRating, Deck, DeckType, FlashcardDeck, QuizDeck, LearningDeck } from '../types';
import { INITIAL_EASE_FACTOR, MIN_EASE_FACTOR, AGAIN_INTERVAL_DAYS, HARD_INTERVAL_MULTIPLIER, EASY_BONUS_MULTIPLIER, EASE_FACTOR_MODIFIERS } from '../constants.ts';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export const calculateNextReview = <T extends Reviewable>(item: T, rating: ReviewRating): T => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  let newLapses = item.lapses || 0;
  if (rating === ReviewRating.Again) {
    newLapses++;
  } else if (newLapses > 0) {
    // Any correct answer resets the lapse counter.
    newLapses = 0;
  }

  // 1. Adjust Ease Factor. This is based on Anki's modification of SM-2.
  // The ease factor is adjusted based on the user's rating.
  let easeModifier = EASE_FACTOR_MODIFIERS[rating];

  // For cards that are repeatedly forgotten (lapses), apply an additional penalty
  // to the ease factor. This makes them appear more frequently until they are truly mastered.
  if (rating === ReviewRating.Again && newLapses > 2) {
      easeModifier -= (newLapses - 2) * 0.05; // Additional 0.05 penalty for each lapse after the second.
  }

  let nextEaseFactor = item.easeFactor + easeModifier;
  if (nextEaseFactor < MIN_EASE_FACTOR) {
    nextEaseFactor = MIN_EASE_FACTOR;
  }
  
  let nextInterval: number;

  // 2. Calculate next review interval.
  if (rating === ReviewRating.Again) {
    // If failed, the card enters a "relearning" phase. The interval is reset to 1 day.
    nextInterval = AGAIN_INTERVAL_DAYS;
  } else {
    if (item.interval === 0) {
        // This is the first time the user has reviewed this card successfully ("graduating").
        // We provide a few initial interval options based on how easy it was.
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
                // Should not happen, but as a fallback.
                nextInterval = 1;
        }
    } else {
        // This is a subsequent review of a known card. This is the core SRS interval calculation.
        let intervalMultiplier = 1;
        if (rating === ReviewRating.Hard) {
            // "Hard" reviews still increase the interval, but by less than "Good".
            intervalMultiplier = HARD_INTERVAL_MULTIPLIER;
        }
        if (rating === ReviewRating.Easy) {
            // "Easy" reviews get a bonus multiplier to space them out further.
            intervalMultiplier = EASY_BONUS_MULTIPLIER;
        }
        nextInterval = Math.ceil(item.interval * nextEaseFactor * intervalMultiplier);
    }
  }

  const nextDueDate = addDays(today, nextInterval);

  // 3. Calculate Mastery Level. This is a custom metric for this app.
  // It provides a user-friendly 0-1 scale based on the new interval.
  // A 90-day interval is considered 'mastered' (1.0). The scale is logarithmic.
  const masteryLevel = Math.min(1, Math.log1p(nextInterval) / Math.log1p(90));

  return {
    ...item,
    interval: nextInterval,
    easeFactor: nextEaseFactor,
    dueDate: nextDueDate.toISOString(),
    lastReviewed: today.toISOString(),
    masteryLevel: masteryLevel,
    lapses: newLapses,
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
        lapses: 0,
    };
};

/**
 * Calculates the current mastery level of an item, applying a decay function
 * to simulate the forgetting curve. This provides a more dynamic, real-time
 * measure of knowledge retention than just the stored mastery level.
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
    // We'll set the half-life to be twice the interval. This is a heuristic.
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

export const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = (deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : 
                  deck.type === DeckType.Learning ? (deck as LearningDeck).questions : 
                  (deck as FlashcardDeck).cards) || [];
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};