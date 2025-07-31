
export const INITIAL_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;

// Interval adjustments
export const AGAIN_INTERVAL_DAYS = 1;
export const HARD_INTERVAL_MULTIPLIER = 1.2;
export const EASY_BONUS_MULTIPLIER = 1.3;

// Ease factor adjustments
export const EASE_FACTOR_MODIFIERS = {
    1: -0.20, // Again
    2: -0.15, // Hard
    3: 0,     // Good
    4: 0.15,  // Easy
};