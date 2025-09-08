import { FullBackupData, Deck, Folder, DeckSeries, ReviewLog, AIMessage } from '../types';

// Using a generic type for items that have an 'id' and optional 'deletedAt'
type ItemWithId = { id: string; deletedAt?: string | null; [key: string]: any };

// Define what a change looks like for the UI
export interface Change<T extends ItemWithId> {
  type: 'added' | 'removed';
  itemType: 'deck' | 'folder' | 'series';
  item: T;
  source: 'local' | 'remote';
}

// Define what a conflict looks like
export interface Conflict<T extends ItemWithId> {
  itemType: 'deck' | 'folder' | 'series';
  id: string;
  local: T;
  remote: T;
}

export interface MergeReport {
  // Changes that can be automatically merged without conflict
  unconflictedChanges: Change<any>[];
  // Conflicts that require user input
  conflicts: Conflict<any>[];
  // Summary stats
  hasConflicts: boolean;
}

// Helper to diff arrays of items with IDs
function diffItemArrays<T extends ItemWithId>(
  localItems: T[],
  remoteItems: T[],
  itemType: 'deck' | 'folder' | 'series'
): { changes: Change<T>[], conflicts: Conflict<T>[] } {
  const localMap = new Map(localItems.map(item => [item.id, item]));
  const remoteMap = new Map(remoteItems.map(item => [item.id, item]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const changes: Change<T>[] = [];
  const conflicts: Conflict<T>[] = [];

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (local && !remote) {
      changes.push({ type: local.deletedAt ? 'removed' : 'added', itemType, item: local, source: 'local' });
    } else if (remote && !local) {
      changes.push({ type: remote.deletedAt ? 'removed' : 'added', itemType, item: remote, source: 'remote' });
    } else if (local && remote) {
      // Don't create conflicts for items deleted on one side but modified on the other.
      // The deletion will be handled as an "unconflicted change" later.
      if (local.deletedAt || remote.deletedAt) {
          continue;
      }
      
      const normalize = (item: T) => {
        // We ignore `lastOpened` as it changes without being a "modification".
        const { lastOpened, ...rest } = item;
        return JSON.stringify(rest);
      };
      if (normalize(local) !== normalize(remote)) {
        conflicts.push({ itemType, id, local, remote });
      }
    }
  }
  return { changes, conflicts };
}

export function diffData(local: FullBackupData, remote: FullBackupData): MergeReport {
  const deckDiff = diffItemArrays(local.decks, remote.decks, 'deck');
  const folderDiff = diffItemArrays(local.folders, remote.folders, 'folder');
  const seriesDiff = diffItemArrays(local.deckSeries, remote.deckSeries, 'series');

  const unconflictedChanges = [...deckDiff.changes, ...folderDiff.changes, ...seriesDiff.changes];
  const conflicts = [...deckDiff.conflicts, ...folderDiff.conflicts, ...seriesDiff.conflicts];

  return {
    unconflictedChanges,
    conflicts,
    hasConflicts: conflicts.length > 0,
  };
}

export type UserResolution = 'keep_local' | 'keep_remote';

export function mergeData(
    local: FullBackupData,
    remote: FullBackupData,
    resolutions: Map<string, UserResolution> // Map of item ID to resolution choice
): FullBackupData {
    const allItems = new Map<string, ItemWithId>();

    // Add all items from both sources. This ensures additions from both are included.
    // The second loop will overwrite duplicates, which is fine as conflicts are handled next.
    [...local.folders, ...local.decks, ...local.deckSeries].forEach(item => item && allItems.set(item.id, item));
    [...remote.folders, ...remote.decks, ...remote.deckSeries].forEach(item => item && allItems.set(item.id, item));

    // Now, apply user resolutions for conflicts, overwriting the naive merge above.
    const { conflicts } = diffData(local, remote);
    conflicts.forEach(conflict => {
        const resolution = resolutions.get(conflict.id);
        if (resolution === 'keep_local') {
            allItems.set(conflict.id, conflict.local);
        } else if (resolution === 'keep_remote') {
            allItems.set(conflict.id, conflict.remote);
        }
    });

    // Safely merge reviews by combining and deduplicating
    const allReviews = [...(local.reviews || []), ...(remote.reviews || [])];
    const uniqueReviews = Array.from(new Map(allReviews.map(r => [`${r.itemId}-${r.timestamp}`, r])).values());
    
    // Safely merge series progress by unioning completed decks for each series
    const mergedSeriesProgress: FullBackupData['seriesProgress'] = { ...(local.seriesProgress || {}), ...(remote.seriesProgress || {})};
    const allSeriesIds = new Set([...Object.keys(local.seriesProgress || {}), ...Object.keys(remote.seriesProgress || {})]);

    allSeriesIds.forEach(seriesId => {
        const localSet = new Set(local.seriesProgress?.[seriesId] || []);
        const remoteSet = new Set(remote.seriesProgress?.[seriesId] || []);
        mergedSeriesProgress[seriesId] = Array.from(new Set([...localSet, ...remoteSet]));
    });

    // Pick the latest AI chat history based on length, or local if equal.
    const mergedAIChatHistory = (remote.aiChatHistory?.length || 0) > (local.aiChatHistory?.length || 0) 
        ? remote.aiChatHistory 
        : local.aiChatHistory;
        
    const mergedDecks: Deck[] = [];
    const mergedFolders: Folder[] = [];
    const mergedSeries: DeckSeries[] = [];
    
    allItems.forEach(item => {
        if (!item) return;
        if ('cards' in item || 'questions' in item) mergedDecks.push(item as Deck);
        else if ('levels' in item) mergedSeries.push(item as DeckSeries);
        else if ('name' in item) mergedFolders.push(item as Folder);
    });

    return {
        ...local, // base for version, sessions etc.
        decks: mergedDecks,
        folders: mergedFolders,
        deckSeries: mergedSeries,
        reviews: uniqueReviews,
        seriesProgress: mergedSeriesProgress,
        aiChatHistory: mergedAIChatHistory,
    };
}