
import { useCallback } from 'react';
import { Deck, Card, Question, DeckType, Reviewable, QuizDeck, Folder, DeckSeries, SeriesProgress, SeriesLevel } from '../types';
import * as db from '../services/db';
import { useToast } from './useToast';
import { useRouter } from '../contexts/RouterContext';
import { createNatureSampleDeck, createSampleSeries } from '../services/sampleData';
import { resetReviewable } from '../services/srs';
import { AppState, AppAction } from './useAppReducer';
import { RestoreData } from '../services/googleDriveService';

interface UseDataManagementProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    sessionsToResume: Set<string>;
    setSessionsToResume: React.Dispatch<React.SetStateAction<Set<string>>>;
    seriesProgress: SeriesProgress;
    setSeriesProgress: React.Dispatch<React.SetStateAction<SeriesProgress>>;
    setGeneralStudyDeck: React.Dispatch<React.SetStateAction<QuizDeck | null>>;
    openConfirmModal: (props: any) => void;
    setFolderToEdit: (folder: Folder | 'new' | null) => void;
    setSeriesToEdit: (series: DeckSeries | 'new' | null) => void;
}

export const useDataManagement = ({
    state,
    dispatch,
    sessionsToResume,
    setSessionsToResume,
    seriesProgress,
    setSeriesProgress,
    setGeneralStudyDeck,
    openConfirmModal,
    setFolderToEdit,
    setSeriesToEdit
}: UseDataManagementProps) => {
    const { addToast } = useToast();
    const { navigate } = useRouter();

    const handleUpdateDeck = useCallback(async (deck: Deck, options?: { silent?: boolean; toastMessage?: string }) => {
        // Optimistic UI update
        dispatch({ type: 'UPDATE_DECK', payload: deck });

        if (!options?.silent) {
            if (options?.toastMessage) {
                addToast(options.toastMessage, 'success');
            } else if (deck.archived) {
                addToast(`Deck "${deck.name}" archived.`, 'success');
            } else if (deck.archived === false) {
                addToast(`Deck "${deck.name}" unarchived.`, 'success');
            } else {
                addToast(`Deck "${deck.name}" updated.`, 'success');
            }
        }

        try {
            await db.updateDeck(deck);
        } catch (error) {
            console.error("Failed to update deck:", error);
            addToast("There was an error syncing the deck update.", "error");
        }
    }, [addToast, dispatch]);

    const handleAddDecks = useCallback(async (decks: Deck[]) => {
        try {
            // Optimistic update
            dispatch({ type: 'ADD_DECKS', payload: decks });
            await db.addDecks(decks);
        } catch (error) {
            console.error("Failed to add decks:", error);
            addToast("There was an error saving the new deck(s).", "error");
        }
    }, [addToast, dispatch]);

    const updateLastOpened = useCallback(async (deckId: string) => {
        const deck = state.decks.find(d => d.id === deckId);
        if (deck) {
            const updatedDeck = { ...deck, lastOpened: new Date().toISOString() };
            await handleUpdateDeck(updatedDeck, { silent: true });
        }
    }, [state.decks, handleUpdateDeck]);

    const handleSessionEnd = useCallback(async (deckId: string, seriesId?: string) => {
        const baseDeckId = deckId.replace('_flip', '');
        
        if (sessionsToResume.has(deckId)) {
            const newSessions = new Set(sessionsToResume);
            newSessions.delete(deckId);
            setSessionsToResume(newSessions);
        }
        
        localStorage.removeItem(`session_deck_${baseDeckId}`);
        localStorage.removeItem(`session_deck_${baseDeckId}_flip`);
        
        if (deckId === 'general-study-deck') setGeneralStudyDeck(null);
        
        navigate(seriesId ? `/series/${seriesId}` : '/');
    }, [navigate, sessionsToResume, setSessionsToResume, setGeneralStudyDeck]);

    const handleCreateSampleDeck = useCallback(async () => {
        const sampleDeck = createNatureSampleDeck();
        await handleAddDecks([sampleDeck]);
        addToast(`Sample deck "${sampleDeck.name}" created!`, "success");
    }, [handleAddDecks, addToast]);
      
    const handleCreateSampleSeries = useCallback(async () => {
        const { series, decks } = createSampleSeries();
        try {
            // Dispatch both state changes at once to prevent UI inconsistencies
            dispatch({ type: 'ADD_SERIES_WITH_DECKS', payload: { series, decks } });

            // Then perform database operations
            await Promise.all([
                db.addDecks(decks),
                db.addDeckSeries([series])
            ]);

            addToast(`Sample series "${series.name}" created!`, "success");
        } catch (error) {
            console.error("Failed to create sample series:", error);
            addToast("There was an error creating the sample series.", "error");
        }
    }, [addToast, dispatch]);
    
    const handleRestoreData = useCallback(async (data: RestoreData) => {
        try {
            // Dispatch first for instant UI update
            dispatch({ type: 'RESTORE_DATA', payload: data });

            await Promise.all([
                db.addDecks(data.decks),
                db.addFolders(data.folders),
                db.addDeckSeries(data.deckSeries)
            ]);
            addToast(`Successfully restored data.`, "success");
        } catch (error) {
            console.error("Failed to restore from backup:", error);
            addToast("There was an error restoring from the backup file.", "error");
            throw error;
        }
    }, [addToast, dispatch]);

    const handleDeleteDeck = useCallback(async (deckId: string) => {
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck) return;
        const updatedDeck = { ...deck, deletedAt: new Date().toISOString(), archived: false };
        await handleUpdateDeck(updatedDeck, { toastMessage: `Moved "${deck.name}" to Trash.` });
    }, [state.decks, handleUpdateDeck]);
    
    const handleMoveDeck = useCallback(async (deckId: string, folderId: string | null) => {
        const deck = state.decks.find(d => d.id === deckId);
        const folder = state.folders.find(f => f.id === folderId);
        if (!deck || deck.folderId === folderId) return;
        const updatedDeck = { ...deck, folderId: folderId };
        const folderName = folder ? `"${folder.name}"` : 'the ungrouped area';
        await handleUpdateDeck(updatedDeck, { toastMessage: `Moved "${deck.name}" to ${folderName}.` });
    }, [state.decks, state.folders, handleUpdateDeck]);
    
    const handleItemReviewed = useCallback(async (deckId: string, reviewedItem: Reviewable, seriesId?: string) => {
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck) return;

        let newDeck: Deck;
        if (deck.type === DeckType.Flashcard) {
            newDeck = { ...deck, cards: deck.cards.map(c => c.id === reviewedItem.id ? (reviewedItem as Card) : c) };
        } else { // QuizDeck
            newDeck = { 
                ...deck, 
                questions: deck.questions.map(q => {
                    if (q.id === reviewedItem.id) {
                        // Only update reviewable properties to prevent data corruption from virtual cards
                        return {
                            ...q,
                            dueDate: reviewedItem.dueDate,
                            interval: reviewedItem.interval,
                            easeFactor: reviewedItem.easeFactor,
                            suspended: reviewedItem.suspended,
                            masteryLevel: reviewedItem.masteryLevel,
                            lastReviewed: reviewedItem.lastReviewed,
                        };
                    }
                    return q;
                }) 
            };
        }
        
        // Perform the state update and DB write
        await handleUpdateDeck(newDeck, { silent: true });

        // Check for series completion after the deck state is updated
        if (seriesId) {
            const updatedDeckFromState = newDeck; // We can use the just-created newDeck object
            const items = updatedDeckFromState.type === DeckType.Flashcard ? updatedDeckFromState.cards : updatedDeckFromState.questions;
            const hasNewItems = items.some(item => !item.suspended && item.interval === 0);
            
            const isAlreadyCompleted = (seriesProgress.get(seriesId) || new Set()).has(deckId);

            if (!hasNewItems && !isAlreadyCompleted) {
                // This is the first time the deck is completed. Mark it.
                setSeriesProgress(prev => {
                    const newProgress = new Map(prev);
                    const currentSeriesProgress = new Set(newProgress.get(seriesId) || []);
                    
                    currentSeriesProgress.add(deckId);
                    newProgress.set(seriesId, currentSeriesProgress);

                    try {
                        localStorage.setItem(`series-progress-${seriesId}`, JSON.stringify(Array.from(currentSeriesProgress)));
                        const series = state.deckSeries.find(s => s.id === seriesId);
                        const flatDeckIds = series?.levels.flatMap(l => l.deckIds) || [];
                        const isLastDeckInSeries = flatDeckIds.indexOf(deckId) === flatDeckIds.length - 1;
                        
                        if (isLastDeckInSeries && flatDeckIds.length > 0) {
                            addToast(`Congratulations! You've completed the series: "${series?.name}"!`, 'success');
                        } else {
                            addToast(`Deck "${updatedDeckFromState.name}" completed! Next chapter unlocked.`, 'success');
                        }
                    } catch (e) {
                        console.error("Could not save series progress", e);
                    }
                    return newProgress;
                });
            }
        }
    }, [state.decks, handleUpdateDeck, addToast, seriesProgress, setSeriesProgress, state.deckSeries]);

    const handleResetDeckProgress = useCallback(async (deckId: string) => {
        const deckToReset = state.decks.find(d => d.id === deckId);
        if (!deckToReset) return;
        let updatedDeck: Deck;
        if (deckToReset.type === DeckType.Flashcard) {
            updatedDeck = { ...deckToReset, cards: deckToReset.cards.map(c => resetReviewable(c)) };
        } else {
            updatedDeck = { ...deckToReset, questions: deckToReset.questions.map(q => resetReviewable(q)) };
        }
        await handleUpdateDeck(updatedDeck, { toastMessage: `Progress for deck "${updatedDeck.name}" has been reset.`});
    }, [state.decks, handleUpdateDeck]);
      
    const handleExportData = async () => {
        try {
            const filename = await db.exportAllData();
            if (filename) addToast(`Data exported to ${filename}`, 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            addToast(`Export failed: ${message}`, 'error');
        }
    };
      
    const handleStartGeneralStudy = useCallback(() => {
        const unlockedSeriesDeckIds = new Set<string>();
        state.deckSeries.forEach(series => {
            if (!series.archived && !series.deletedAt) {
                const completedCount = seriesProgress.get(series.id)?.size || 0;
                let deckCount = 0;
                series.levels.forEach(level => {
                    level.deckIds.forEach(() => {
                        if (deckCount <= completedCount) {
                            unlockedSeriesDeckIds.add(series.id);
                        }
                        deckCount++;
                    });
                });
            }
        });
        
        const seriesDeckIds = new Set<string>();
        state.deckSeries.forEach(series => {
            series.levels.forEach(level => level.deckIds.forEach(deckId => seriesDeckIds.add(deckId)));
        });

        const today = new Date();
        today.setHours(23, 59, 59, 999);
    
        const allDueQuestions = state.decks
          .filter((deck): deck is QuizDeck => {
            if (deck.type !== DeckType.Quiz || deck.archived || deck.deletedAt) return false;
            if (seriesDeckIds.has(deck.id) && !unlockedSeriesDeckIds.has(deck.id)) return false;
            return true;
          })
          .flatMap(deck => 
            deck.questions
              .filter(q => !q.suspended && new Date(q.dueDate) <= today)
              .map(q => ({ ...q, originalDeckId: deck.id, originalDeckName: deck.name }))
          )
          .sort(() => Math.random() - 0.5);
    
        const virtualDeck: QuizDeck = {
          id: 'general-study-deck', name: 'General Study Session', type: DeckType.Quiz, questions: allDueQuestions
        };
        setGeneralStudyDeck(virtualDeck);
        navigate('/study/general');
    }, [state.decks, state.deckSeries, seriesProgress, navigate, setGeneralStudyDeck]);

    const handleStartSeriesStudy = useCallback(async (seriesId: string) => {
        const series = state.deckSeries.find(s => s.id === seriesId);
        if (!series) return;

        const unlockedSeriesDeckIds = new Set<string>();
        const completedCount = seriesProgress.get(series.id)?.size || 0;
        let deckCount = 0;
        series.levels.forEach(level => {
            level.deckIds.forEach(deckId => {
                if (deckCount <= completedCount) {
                    unlockedSeriesDeckIds.add(deckId);
                }
                deckCount++;
            });
        });
    
        const today = new Date();
        today.setHours(23, 59, 59, 999);
    
        const seriesDecks = series.levels.flatMap(l => l.deckIds).map(id => state.decks.find(d => d.id === id)).filter((d): d is QuizDeck => !!(d && d.type === DeckType.Quiz));
        
        const allDueQuestions = seriesDecks
          .filter(deck => unlockedSeriesDeckIds.has(deck.id))
          .flatMap(deck => 
            deck.questions
              .filter(q => !q.suspended && new Date(q.dueDate) <= today)
              .map(q => ({ ...q, originalDeckId: deck.id, originalDeckName: deck.name }))
          )
          .sort(() => Math.random() - 0.5);
    
        const virtualDeck: QuizDeck = {
          id: 'general-study-deck', name: `${series.name} - Study Session`, type: DeckType.Quiz, questions: allDueQuestions
        };
        setGeneralStudyDeck(virtualDeck);
        navigate(`/study/general?seriesId=${seriesId}`);
    }, [state.decks, state.deckSeries, seriesProgress, navigate, setGeneralStudyDeck]);

    const handleSaveFolder = useCallback(async (folderData: {id: string | null, name: string}) => {
        if (folderData.id) {
            const updatedFolder = { id: folderData.id, name: folderData.name };
            dispatch({ type: 'UPDATE_FOLDER', payload: updatedFolder });
            addToast(`Folder "${updatedFolder.name}" updated.`, 'success');
            await db.updateFolder(updatedFolder);
        } else {
            const newFolder: Folder = { id: crypto.randomUUID(), name: folderData.name };
            dispatch({ type: 'ADD_FOLDER', payload: newFolder });
            addToast(`Folder "${newFolder.name}" created.`, 'success');
            await db.addFolder(newFolder);
        }
        setFolderToEdit(null);
    }, [addToast, dispatch, setFolderToEdit]);
    
    const handleDeleteFolder = useCallback(async (folderId: string) => {
        const folder = state.folders.find(f => f.id === folderId);
        if (!folder) return;
        openConfirmModal({
            title: 'Delete Folder',
            message: `Are you sure you want to delete folder "${folder.name}"? Decks inside will not be deleted.`,
            onConfirm: async () => {
                dispatch({ type: 'DELETE_FOLDER', payload: folderId });
                addToast(`Folder "${folder.name}" deleted.`, 'success');
                const decksToUpdate = state.decks.filter(d => d.folderId === folderId).map(d => ({ ...d, folderId: null as (string | null) }));
                if (decksToUpdate.length > 0) await db.bulkUpdateDecks(decksToUpdate);
                await db.deleteFolder(folderId);
            }
        })
    }, [state.decks, state.folders, addToast, dispatch, openConfirmModal]);
    
    const handleUpdateSeries = useCallback(async (series: DeckSeries, options?: { silent?: boolean; toastMessage?: string }) => {
        // Optimistic UI update
        dispatch({ type: 'UPDATE_SERIES', payload: series });

        if (!options?.silent) {
            if (options?.toastMessage) {
                addToast(options.toastMessage, 'success');
            } else if (series.archived) {
                addToast(`Series "${series.name}" archived.`, 'success');
            } else if (series.archived === false) {
                addToast(`Series "${series.name}" unarchived.`, 'success');
            } else {
                addToast(`Series "${series.name}" updated.`, 'success');
            }
        }
        
        try {
            await db.updateDeckSeries(series);
        } catch (error) {
            console.error("Failed to update series:", error);
            addToast("There was an error updating the series.", "error");
        }
    }, [addToast, dispatch]);

    const handleSaveSeries = useCallback(async (data: { id: string | null, name: string, description: string }) => {
        if (data.id) {
            const seriesToUpdate = state.deckSeries.find(s => s.id === data.id);
            if(seriesToUpdate) {
                const updatedSeries = { ...seriesToUpdate, name: data.name, description: data.description };
                await handleUpdateSeries(updatedSeries);
            }
        } else {
            const newSeries: DeckSeries = { id: crypto.randomUUID(), type: 'series', name: data.name, description: data.description, levels: [] };
            dispatch({ type: 'ADD_SERIES', payload: newSeries });
            addToast(`Series "${newSeries.name}" created.`, 'success');
            await db.addDeckSeries([newSeries]);
        }
        setSeriesToEdit(null);
    }, [addToast, state.deckSeries, handleUpdateSeries, dispatch, setSeriesToEdit]);
    
    const handleDeleteSeries = useCallback(async (seriesId: string) => {
        const series = state.deckSeries.find(s => s.id === seriesId);
        if (!series) return;
        
        const deckIdsToDelete = series.levels.flatMap(level => level.deckIds);
        const decksToTrash = state.decks
            .filter(d => deckIdsToDelete.includes(d.id))
            .map(d => ({ ...d, deletedAt: new Date().toISOString(), archived: false }));
        
        const updatedSeries = { ...series, deletedAt: new Date().toISOString(), archived: false };
    
        // Optimistic UI updates
        dispatch({ type: 'BULK_UPDATE_DECKS', payload: decksToTrash });
        dispatch({ type: 'UPDATE_SERIES', payload: updatedSeries });
        addToast(`Series "${series.name}" and its ${decksToTrash.length} deck(s) moved to Trash.`, 'success');
    
        // Database updates
        try {
            await Promise.all([
                db.bulkUpdateDecks(decksToTrash),
                db.updateDeckSeries(updatedSeries)
            ]);
        } catch (error) {
            console.error("Failed to move series and its decks to trash:", error);
            addToast("Error moving series to trash.", "error");
        }
    }, [state.deckSeries, state.decks, dispatch, addToast]);
    
    const handleAddDeckToSeries = useCallback(async (seriesId: string, newDeck: QuizDeck) => {
        const series = state.deckSeries.find(s => s.id === seriesId);
        if (!series) return;
        await handleAddDecks([newDeck]);
        const newLevel: SeriesLevel = { title: newDeck.name, deckIds: [newDeck.id] };
        const updatedSeries = { ...series, levels: [...series.levels, newLevel] };
        await handleUpdateSeries(updatedSeries);
    }, [state.deckSeries, handleAddDecks, handleUpdateSeries]);
    
    const handleAddSeriesWithDecks = useCallback(async (series: DeckSeries, decks: Deck[]) => {
        try {
            dispatch({ type: 'ADD_SERIES_WITH_DECKS', payload: { series, decks }});

            await Promise.all([
                db.addDecks(decks),
                db.addDeckSeries([series])
            ]);

            addToast(`Successfully imported series "${series.name}" with ${decks.length} decks.`, "success");
        } catch (error) {
            console.error("Failed to create series with decks:", error);
            addToast("There was an error creating the new series.", "error");
        }
    }, [dispatch, addToast]);

    const handleRestoreDeck = useCallback(async (deckId: string) => {
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck) return;
        const { deletedAt, ...restoredDeck } = deck;
        await handleUpdateDeck(restoredDeck, { toastMessage: `Restored deck "${restoredDeck.name}".` });
    }, [state.decks, handleUpdateDeck]);

    const handleRestoreSeries = useCallback(async (seriesId: string) => {
        const series = state.deckSeries.find(s => s.id === seriesId);
        if (!series) return;
        const { deletedAt, ...restoredSeries } = series;
        await handleUpdateSeries(restoredSeries, { toastMessage: `Restored series "${restoredSeries.name}".` });
    }, [state.deckSeries, handleUpdateSeries]);

    const handleDeleteDeckPermanently = useCallback(async (deckId: string) => {
        try {
            const deckName = state.decks.find(d => d.id === deckId)?.name;
            dispatch({ type: 'DELETE_DECK', payload: deckId });
            addToast(`Deck "${deckName || 'Deck'}" permanently deleted.`, 'success');
            await db.deleteDeck(deckId);
        } catch (error) {
            console.error("Failed to permanently delete deck:", error);
            addToast("There was an error permanently deleting the deck.", "error");
        }
    }, [state.decks, dispatch, addToast]);

    const handleDeleteSeriesPermanently = useCallback(async (seriesId: string) => {
        const series = state.deckSeries.find(s => s.id === seriesId);
        if (!series) return;
    
        const deckIdsToDelete = series.levels.flatMap(level => level.deckIds);
        const seriesName = series.name;
    
        try {
            // Optimistic UI updates
            deckIdsToDelete.forEach(deckId => {
                dispatch({ type: 'DELETE_DECK', payload: deckId });
            });
            dispatch({ type: 'DELETE_SERIES', payload: seriesId });
            addToast(`Series "${seriesName}" and its ${deckIdsToDelete.length} deck(s) permanently deleted.`, 'success');
            
            // Database operations
            await Promise.all([
                ...deckIdsToDelete.map(deckId => db.deleteDeck(deckId)),
                db.deleteDeckSeries(seriesId)
            ]);
        } catch (error) {
            console.error("Failed to permanently delete series and its decks:", error);
            addToast("There was an error permanently deleting the series.", "error");
        }
    }, [state.deckSeries, dispatch, addToast]);
    
    const handleFactoryReset = useCallback(() => {
    openConfirmModal({
      title: 'Factory Reset',
      message: 'Are you sure you want to perform a factory reset? All of your decks, folders, series, and settings will be permanently deleted. This action cannot be undone.',
      confirmText: 'RESET',
      onConfirm: async () => {
        try {
          addToast("Resetting application...", "info");

          // 1. Clear caches
          if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CDN_CACHE' });
          }

          // 2. Wipe IndexedDB
          await db.factoryReset();

          // 3. Clear localStorage
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('cogniflow-') || key.startsWith('session_deck_') || key.startsWith('series-progress-'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          
          // 4. Reload after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 1500);

        } catch (error) {
          console.error('Factory reset failed:', error);
          const message = error instanceof Error ? error.message : 'Factory reset failed. Please try again.';
          addToast(message, 'error');
        }
      }
    });
    }, [addToast, openConfirmModal]);

    const reconcileSeriesProgress = useCallback(() => {
        const { deckSeries, decks } = state;
        if (!deckSeries.length || !decks.length) return;

        let anySeriesUpdated = false;
        const newProgressMap = new Map(seriesProgress);

        for (const series of deckSeries) {
            if (series.archived || series.deletedAt) continue;

            const completedInSeries = new Set(newProgressMap.get(series.id) || []);
            let seriesWasUpdated = false;
            
            const flatDeckIds = series.levels.flatMap(l => l.deckIds);
            for (const deckId of flatDeckIds) {
                if (completedInSeries.has(deckId)) {
                    continue; // Already complete, skip check
                }

                const deck = decks.find(d => d.id === deckId);
                if (!deck) continue;

                const items = deck.type === DeckType.Quiz ? deck.questions : deck.cards;
                const hasNewItems = items.some(item => !item.suspended && item.interval === 0);

                if (!hasNewItems) {
                    completedInSeries.add(deckId);
                    seriesWasUpdated = true;
                }
            }
            
            if (seriesWasUpdated) {
                newProgressMap.set(series.id, completedInSeries);
                anySeriesUpdated = true;
            }
        }

        if (anySeriesUpdated) {
            setSeriesProgress(newProgressMap);
            // Persist all changes to localStorage
            newProgressMap.forEach((completedIds, seriesId) => {
                try {
                    localStorage.setItem(`series-progress-${seriesId}`, JSON.stringify(Array.from(completedIds)));
                } catch (e) {
                    console.error(`Could not save reconciled series progress for ${seriesId}`, e);
                }
            });
            addToast("Unlocked decks based on your progress.", "info");
        }
    }, [state.decks, state.deckSeries, seriesProgress, setSeriesProgress, addToast]);


    return {
        updateLastOpened,
        handleSessionEnd,
        handleAddDecks,
        handleCreateSampleDeck,
        handleCreateSampleSeries,
        handleRestoreData,
        handleDeleteDeck,
        handleUpdateDeck,
        handleMoveDeck,
        handleItemReviewed,
        handleResetDeckProgress,
        handleExportData,
        handleStartGeneralStudy,
        handleStartSeriesStudy,
        handleSaveFolder,
        handleDeleteFolder,
        handleUpdateSeries,
        handleSaveSeries,
        handleDeleteSeries,
        handleAddDeckToSeries,
        handleAddSeriesWithDecks,
        handleRestoreDeck,
        handleRestoreSeries,
        handleDeleteDeckPermanently,
        handleDeleteSeriesPermanently,
        handleFactoryReset,
        reconcileSeriesProgress,
    };
};
