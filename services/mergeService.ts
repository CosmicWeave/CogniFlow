import { FullBackupData } from '../types';

// A simple diff function to show what's different.
export const diffData = (localData: FullBackupData, remoteData: FullBackupData) => {
    // This is a placeholder implementation.
    const diffs: string[] = [];
    if (localData.decks.length !== remoteData.decks.length) {
        diffs.push(`Decks count mismatch: local ${localData.decks.length}, remote ${remoteData.decks.length}`);
    }
    // ... more diff logic would go here
    return diffs;
};

// A simple merge strategy: "last write wins" based on lastModified.
// A real implementation would be much more complex.
export const mergeData = (localData: FullBackupData, remoteData: FullBackupData): FullBackupData => {
    // Placeholder: for now, just prefer remote data as a simple merge strategy.
    return remoteData;
};
