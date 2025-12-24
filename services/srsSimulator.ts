
import { Reviewable, ReviewRating } from '../types';
import { calculateNextReview } from './srs';
import { INITIAL_EASE_FACTOR } from '../constants';

export interface SimulationDay {
    day: number; // Day index (0 = today)
    date: string; // Date string
    reviewCount: number; // Number of reviews due this day
    newCount: number; // Number of new cards introduced this day
    totalLoad: number; // reviewCount + newCount
}

// FIX: Ensure SimItem contains all required fields from Reviewable.
interface SimItem extends Reviewable {
    isNew: boolean;
}

/**
 * Simulates future study workload based on current items and user settings.
 * @param items All active reviewable items (cards/questions) from the decks.
 * @param daysToSimulate Number of days to look ahead.
 * @param newCardsPerDay Max number of new cards to introduce per day.
 * @param retentionRate Probability (0-1) that the user will answer correctly (Good/Easy).
 * @returns Array of SimulationDay data.
 */
export const simulateWorkload = (
    items: Reviewable[],
    daysToSimulate: number,
    newCardsPerDay: number,
    retentionRate: number
): SimulationDay[] => {
    // 1. Prepare Lightweight Copy of State
    // Sort into "Due/Review" pile and "New" pile
    const reviewQueue: SimItem[] = [];
    const newQueue: SimItem[] = [];

    items.forEach(item => {
        if (item.suspended) return;
        
        // Lightweight clone
        const simItem: SimItem = {
            id: item.id,
            dueDate: item.dueDate,
            interval: item.interval,
            easeFactor: item.easeFactor,
            lapses: item.lapses,
            masteryLevel: item.masteryLevel || 0,
            isNew: item.interval === 0
        };

        if (simItem.isNew) {
            newQueue.push(simItem);
        } else {
            reviewQueue.push(simItem);
        }
    });

    const results: SimulationDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Simulation Loop
    for (let dayOffset = 0; dayOffset < daysToSimulate; dayOffset++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + dayOffset);
        const endOfDayMs = new Date(currentDate).setHours(23, 59, 59, 999);

        // A. Identify Reviews Due Today
        const reviewsDueToday: SimItem[] = [];
        const futureReviews: SimItem[] = [];

        reviewQueue.forEach(item => {
            const dueTime = new Date(item.dueDate).getTime();
            if (dueTime <= endOfDayMs) {
                reviewsDueToday.push(item);
            } else {
                futureReviews.push(item);
            }
        });

        // B. Process Reviews (Simulated)
        const reviewedItems: SimItem[] = [];
        
        reviewsDueToday.forEach(item => {
            // Determine outcome based on retention rate
            const isSuccess = Math.random() < retentionRate;
            const rating = isSuccess ? ReviewRating.Good : ReviewRating.Again;

            let nextInterval = 0;
            let nextEase = item.easeFactor;

            if (rating === ReviewRating.Again) {
                nextInterval = 1; // Reset to 1 day
                nextEase = Math.max(1.3, item.easeFactor - 0.2);
            } else {
                nextEase = item.easeFactor;
                if (item.interval === 0) {
                    nextInterval = 1; // Graduate
                } else {
                    nextInterval = Math.ceil(item.interval * item.easeFactor);
                }
            }

            const nextDueDate = new Date(currentDate);
            nextDueDate.setDate(currentDate.getDate() + nextInterval);

            const updatedItem: SimItem = {
                ...item,
                interval: nextInterval,
                easeFactor: nextEase,
                dueDate: nextDueDate.toISOString(),
                isNew: false
            };
            reviewedItems.push(updatedItem);
        });

        // Rebuild review queue with processed items
        reviewedItems.forEach(item => futureReviews.push(item));
        
        // Reset reviewQueue for next iteration
        reviewQueue.length = 0;
        futureReviews.forEach(i => reviewQueue.push(i));


        // C. Introduce New Cards
        const newCardsTodayCount = Math.min(newCardsPerDay, newQueue.length);
        const newCardsToday: SimItem[] = [];
        
        for (let i = 0; i < newCardsTodayCount; i++) {
            const newItem = newQueue.shift(); 
            if (newItem) {
                const nextDueDate = new Date(currentDate);
                nextDueDate.setDate(currentDate.getDate() + 1); 

                const graduateItem: SimItem = {
                    ...newItem,
                    interval: 1,
                    dueDate: nextDueDate.toISOString(),
                    isNew: false
                };
                reviewQueue.push(graduateItem); 
                newCardsToday.push(graduateItem);
            }
        }

        // D. Record Stats
        results.push({
            day: dayOffset,
            date: currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            reviewCount: reviewsDueToday.length,
            newCount: newCardsTodayCount,
            totalLoad: reviewsDueToday.length + newCardsTodayCount
        });
    }

    return results;
};
