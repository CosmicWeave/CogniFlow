
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

interface SimItem extends Reviewable {
    // We only need the core SRS fields
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
        const currentDateMs = currentDate.getTime();
        const endOfDayMs = new Date(currentDate).setHours(23, 59, 59, 999);

        // A. Identify Reviews Due Today
        // Filter items where dueDate <= endOfDay
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

            // Calculate next state
            // We use the actual SRS logic but stub the date math relative to 'currentDate'
            // To reuse `calculateNextReview`, we need to mock the system time or manually adjust dates.
            // Since `calculateNextReview` uses `new Date()` internally for "today", 
            // we can't easily mock it without hacking global Date.
            // Instead, we'll manually apply the logic here roughly matching srs.ts logic for simulation speed.
            
            let nextInterval = 0;
            let nextEase = item.easeFactor;

            if (rating === ReviewRating.Again) {
                nextInterval = 1; // Reset to 1 day
                nextEase = Math.max(1.3, item.easeFactor - 0.2);
            } else {
                // Simplified Good logic from srs.ts
                nextEase = item.easeFactor; // Good doesn't change ease in standard SM-2 often, or +0?
                // Our srs.ts: Good -> ease + 0.
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
        // In simulation, we assume user clears the queue every day.
        // So `reviewsDueToday` are removed from `reviewQueue` (already done by splitting) 
        // and their updated versions are added back for future.
        reviewedItems.forEach(item => futureReviews.push(item));
        
        // Reset reviewQueue for next iteration
        reviewQueue.length = 0;
        futureReviews.forEach(i => reviewQueue.push(i));


        // C. Introduce New Cards
        const newCardsTodayCount = Math.min(newCardsPerDay, newQueue.length);
        const newCardsToday: SimItem[] = [];
        
        for (let i = 0; i < newCardsTodayCount; i++) {
            const newItem = newQueue.shift(); // Remove from new queue
            if (newItem) {
                // Simulate reviewing a new card (Graduating it)
                // Assume passing first time for simplicity in workload modeling, 
                // or apply retention rate same as reviews.
                const nextDueDate = new Date(currentDate);
                nextDueDate.setDate(currentDate.getDate() + 1); // Due tomorrow usually

                const graduateItem: SimItem = {
                    ...newItem,
                    interval: 1,
                    dueDate: nextDueDate.toISOString(),
                    isNew: false
                };
                reviewQueue.push(graduateItem); // Add to main review queue
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
