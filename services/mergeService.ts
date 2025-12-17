import { FullBackupData, Deck, DeckSeries } from '../types';

export interface MergeResolutionStrategy {
    decks: Record<string, 'local' | 'remote'>;
    series: Record<string, 'local' | 'remote'>;
}

export const diffData = (localData: FullBackupData, remoteData: FullBackupData) => {
    // Placeholder kept for backward compatibility if needed, though comparison logic moved to hook
    return [];
};

export const mergeData = (
    localData: FullBackupData, 
    remoteData: FullBackupData, 
    strategy: MergeResolutionStrategy
): FullBackupData => {
    // 1. Start with remote data structure as base for new items
    const mergedData: FullBackupData = {
        ...remoteData,
        decks: [...remoteData.decks],
        deckSeries: [...remoteData.deckSeries],
        seriesProgress: { ...remoteData.seriesProgress }
    };

    // 2. Handle Decks
    const remoteDeckMap = new Map(remoteData.decks.map(d => [d.id, d]));
    const localDeckMap = new Map(localData.decks.map(d => [d.id, d]));

    // Apply strategy for conflicts
    const mergedDecks: Deck[] = [];
    
    // Add remote items, respecting strategy
    remoteData.decks.forEach(remoteDeck => {
        const choice = strategy.decks[remoteDeck.id];
        if (choice === 'local' && localDeckMap.has(remoteDeck.id)) {
            mergedDecks.push(localDeckMap.get(remoteDeck.id)!);
        } else {
            mergedDecks.push(remoteDeck);
        }
    });

    // Add strictly local items (not on remote)
    localData.decks.forEach(localDeck => {
        if (!remoteDeckMap.has(localDeck.id)) {
            // Check if it was deleted on remote? 
            // For now, simpler sync model: if it's local but not remote, we assume it's new locally OR deleted remotely.
            // In a conflict scenario (both modified), it usually means the file exists on both.
            // If the file is MISSING on remote, it might be a new local file.
            // We will keep local files that are missing from remote to be safe (Union merge for non-conflicting).
            mergedDecks.push(localDeck);
        }
    });
    
    mergedData.decks = mergedDecks;

    // 3. Handle Series
    const remoteSeriesMap = new Map(remoteData.deckSeries.map(s => [s.id, s]));
    const localSeriesMap = new Map(localData.deckSeries.map(s => [s.id, s]));
    
    const mergedSeries: DeckSeries[] = [];

    remoteData.deckSeries.forEach(remoteS => {
        const choice = strategy.series[remoteS.id];
        if (choice === 'local' && localSeriesMap.has(remoteS.id)) {
            mergedSeries.push(localSeriesMap.get(remoteS.id)!);
            // Also keep local progress for this series
            if (localData.seriesProgress && localData.seriesProgress[remoteS.id]) {
                mergedData.seriesProgress![remoteS.id] = localData.seriesProgress[remoteS.id];
            }
        } else {
            mergedSeries.push(remoteS);
            // Remote progress is already in mergedData base
        }
    });

    localData.deckSeries.forEach(localS => {
        if (!remoteSeriesMap.has(localS.id)) {
            mergedSeries.push(localS);
            if (localData.seriesProgress && localData.seriesProgress[localS.id]) {
                mergedData.seriesProgress![localS.id] = localData.seriesProgress[localS.id];
            }
        }
    });

    mergedData.deckSeries = mergedSeries;

    // 4. Handle Reviews & Sessions
    // For simplicity in this version, we will Union reviews (append new ones), and take Local sessions.
    // Reviews are append-only mostly.
    const remoteReviewIds = new Set(remoteData.reviews?.map(r => r.timestamp + r.itemId)); // composite key approximation
    const newLocalReviews = (localData.reviews || []).filter(r => !remoteReviewIds.has(r.timestamp + r.itemId));
    mergedData.reviews = [...(mergedData.reviews || []), ...newLocalReviews];

    // Prefer local sessions so current study isn't interrupted
    mergedData.sessions = localData.sessions;

    return mergedData;
};