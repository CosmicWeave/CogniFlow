import { useCallback } from 'react';
import { Deck, Card, Question, DeckType, Reviewable, QuizDeck, Folder, DeckSeries, SeriesProgress, SeriesLevel, ReviewRating, ReviewLog, AIAction, AIActionType, AIGeneratedDeck, AIGeneratedLevel, AIGenerationParams, InfoCard, LearningDeck, FlashcardDeck } from '../types';
import * as db from '../services/db';
import { useToast } from './useToast';
import { useRouter } from '../contexts/RouterContext';
import { createNatureSampleDeck, createSampleSeries } from '../services/sampleData';
import { resetReviewable } from '../services/srs';
import { RestoreData } from '../services/googleDriveService';
import { useStore } from '../store/store';
import { createQuestionsFromImport } from '../services/importService';
import { generateMoreDecksForLevel, generateMoreLevelsForSeries, generateQuestionsForDeck, generateSeriesScaffoldWithAI, generateDeckWithAI, generateSeriesQuestionsInBatches, generateLearningDeckWithAI, generateSeriesLearningContentInBatches } from '../services/aiService';

interface UseDataManagementProps {
    sessionsToResume: Set<string>;
    setSessionsToResume: React.Dispatch<React.SetStateAction<Set<string>>>;
    setGeneralStudyDeck: React.Dispatch<React.SetStateAction<QuizDeck | null>>;
    openConfirmModal: (props: any) => void;
    setFolderToEdit: (folder: Folder | 'new' | null) => void;
    setSeriesToEdit: (series: DeckSeries | 'new' | null) => void;
}

export const useDataManagement = ({
    sessionsToResume,
    setSessionsToResume,
    setGeneralStudyDeck,
    openConfirmModal,
    setFolderToEdit,
    setSeriesToEdit
}: UseDataManagementProps) => {
    const { addToast } = useToast();
    const { navigate } = useRouter();
    const dispatch = useStore(state => state.dispatch);

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

    const updateLastOpened = useCallback(async (deckId: string) => {
        const deck = useStore.getState().decks.find(d => d.id === deckId);
        if (deck) {
            const updatedDeck = { ...deck, lastOpened: new Date().toISOString() };
            await handleUpdateDeck(updatedDeck, { silent: true });
        }
    }, [handleUpdateDeck]);
    
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

    const updateLastOpenedSeries = useCallback(async (seriesId: string) => {
        const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
        if (series) {
            const updatedSeries = { ...series, lastOpened: new Date().toISOString() };
            await handleUpdateSeries(updatedSeries, { silent: true });
        }
    }, [handleUpdateSeries]);


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

    const handleSessionEnd = useCallback(async (deckId: string, seriesId?: string) => {
        const sessionKey = `session_deck_${deckId}`;

        if (sessionsToResume.has(deckId)) {
            const newSessions = new Set(sessionsToResume);
            newSessions.delete(deckId);
            setSessionsToResume(newSessions);
        }
        
        try {
            await db.deleteSessionState(sessionKey);
        } catch (e) {
            console.error(`Failed to clean up session state for ${sessionKey} from DB`, e);
        }
        
        if (deckId === 'general-study-deck') setGeneralStudyDeck(null);
        
        navigate(seriesId ? `/series/${seriesId}` : '/');
    }, [navigate, sessionsToResume, setSessionsToResume, setGeneralStudyDeck]);
    
    const handleStudyNextDeckInSeries = useCallback(async (deckId: string, seriesId: string, nextDeckId: string) => {
        const sessionKey = `session_deck_${deckId}`;

        // Clean up state for the session that just ended
        if (sessionsToResume.has(deckId)) {
            const newSessions = new Set(sessionsToResume);
            newSessions.delete(deckId);
            setSessionsToResume(newSessions);
        }
        try {
            await db.deleteSessionState(sessionKey);
        } catch (e) {
            console.error(`Failed to clean up session state for ${sessionKey} from DB`, e);
        }
        
        if (deckId === 'general-study-deck') setGeneralStudyDeck(null);
        
        // Navigate to the next deck's study session
        navigate(`/decks/${nextDeckId}/study?seriesId=${seriesId}`);
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
        const deck = useStore.getState().decks.find(d => d.id === deckId);
        if (!deck) return;
        const updatedDeck = { ...deck, deletedAt: new Date().toISOString(), archived: false };
        await handleUpdateDeck(updatedDeck, { toastMessage: `Moved "${deck.name}" to Trash.` });
    }, [handleUpdateDeck]);
    
    const handleMoveDeck = useCallback(async (deckId: string, folderId: string | null) => {
        const { decks, folders } = useStore.getState();
        const deck = decks.find(d => d.id === deckId);
        const folder = folders.find(f => f.id === folderId);
        if (!deck || deck.folderId === folderId) return;
        const updatedDeck = { ...deck, folderId: folderId };
        const folderName = folder ? `"${folder.name}"` : 'the ungrouped area';
        await handleUpdateDeck(updatedDeck, { toastMessage: `Moved "${deck.name}" to ${folderName}.` });
    }, [handleUpdateDeck]);
    
    const handleItemReviewed = useCallback(async (deckId: string, reviewedItem: Reviewable, rating: ReviewRating | null, seriesId?: string) => {
        const { decks, deckSeries, seriesProgress } = useStore.getState();
        const deck = decks.find(d => d.id === deckId);
        if (!deck) return;

        let newDeck: Deck;
        
        const { id, dueDate, interval, easeFactor, suspended, masteryLevel, lastReviewed, lapses } = reviewedItem;
        const srsUpdates = { dueDate, interval, easeFactor, suspended, masteryLevel, lastReviewed, lapses };

        if (deck.type === DeckType.Flashcard) {
            newDeck = { ...deck, cards: (deck as FlashcardDeck).cards.map(c => c.id === id ? { ...c, ...srsUpdates } : c) };
        } else if (deck.type === DeckType.Learning) {
            newDeck = { ...deck, questions: (deck as LearningDeck).questions.map(q => q.id === id ? { ...q, ...srsUpdates } : q) };
        } else { // QuizDeck
            newDeck = { ...deck, questions: (deck as QuizDeck).questions.map(q => q.id === id ? { ...q, ...srsUpdates } : q) };
        }
        
        await handleUpdateDeck(newDeck, { silent: true });

        try {
            const reviewLog: ReviewLog = {
                itemId: reviewedItem.id,
                deckId: deckId,
                seriesId: seriesId,
                timestamp: new Date().toISOString(),
                rating: rating,
                newInterval: reviewedItem.interval,
                easeFactor: reviewedItem.easeFactor,
                masteryLevel: reviewedItem.masteryLevel || 0,
            };
            await db.addReviewLog(reviewLog);
        } catch (e) {
            console.error("Failed to log review:", e);
        }
        
        if (seriesId) {
            const updatedDeckFromState = newDeck;
            const items = ('cards' in updatedDeckFromState ? (updatedDeckFromState as FlashcardDeck).cards : (updatedDeckFromState as QuizDeck | LearningDeck).questions);
            
            const hasNewItems = Array.isArray(items) && items.some(item => !item.suspended && item.interval === 0);
            
            const isAlreadyCompleted = (seriesProgress.get(seriesId) || new Set()).has(deckId);
            
            if (!hasNewItems && !isAlreadyCompleted && items?.length > 0) {
                const newProgress = new Map(seriesProgress);
                const progressValue = newProgress.get(seriesId);
                const currentSeriesProgress = new Set(progressValue instanceof Set ? progressValue : []);
                
                currentSeriesProgress.add(deckId);
                newProgress.set(seriesId, currentSeriesProgress);

                try {
                    localStorage.setItem(`series-progress-${seriesId}`, JSON.stringify(Array.from(currentSeriesProgress)));
                    const series = deckSeries.find(s => s.id === seriesId);
                    const flatDeckIds = series?.levels.flatMap(l => l.deckIds) || [];
                    const isLastDeckInSeries = flatDeckIds.indexOf(deckId) === flatDeckIds.length - 1;
                    
                    if (isLastDeckInSeries && flatDeckIds.length > 0) {
                        addToast(`Congratulations! You've completed the series: "${series?.name}"!`, 'success');
                    } else {
                        addToast(`Deck "${updatedDeckFromState.name}" completed! Next chapter unlocked.`, 'success');
                    }
                    dispatch({ type: 'SET_SERIES_PROGRESS', payload: newProgress });
                } catch (e) {
                    console.error("Could not save series progress", e);
                }
            }
        }
    }, [handleUpdateDeck, addToast, dispatch]);

    const handleResetDeckProgress = useCallback(async (deckId: string) => {
        const deckToReset = useStore.getState().decks.find(d => d.id === deckId);
        if (!deckToReset) return;
        let updatedDeck: Deck;
        if (deckToReset.type === DeckType.Flashcard) {
            updatedDeck = { ...deckToReset, cards: (deckToReset as FlashcardDeck).cards.map(c => resetReviewable(c)) };
        } else {
            updatedDeck = { ...deckToReset, questions: (deckToReset as QuizDeck | LearningDeck).questions.map(q => resetReviewable(q)) };
        }
        await handleUpdateDeck(updatedDeck, { toastMessage: `Progress for deck "${updatedDeck.name}" has been reset.`});
    }, [handleUpdateDeck]);
      
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
        const { decks, deckSeries, seriesProgress } = useStore.getState();

        const seriesDeckIds = new Set<string>();
        deckSeries.forEach(series => {
            series.levels.forEach(level => level.deckIds.forEach(deckId => seriesDeckIds.add(deckId)));
        });

        const unlockedSeriesDeckIds = new Set<string>();
        deckSeries.forEach(series => {
            if (!series.archived && !series.deletedAt) {
                const completedCount = seriesProgress.get(series.id)?.size || 0;
                let deckCount = 0;
                series.levels.forEach(level => {
                    level.deckIds.forEach((deckId) => {
                        if (deckCount <= completedCount) {
                            unlockedSeriesDeckIds.add(deckId);
                        }
                        deckCount++;
                    });
                });
            }
        });
        
        const today = new Date();
        today.setHours(23, 59, 59, 999);
    
        const allDueQuestions = decks
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
    }, [navigate, setGeneralStudyDeck]);

    const handleStartSeriesStudy = useCallback(async (seriesId: string) => {
        const { decks, deckSeries, seriesProgress } = useStore.getState();
        const series = deckSeries.find(s => s.id === seriesId);
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
    
        const seriesDecks = series.levels.flatMap(l => l.deckIds).map(id => decks.find(d => d.id === id)).filter((d): d is QuizDeck => !!(d && d.type === DeckType.Quiz));
        
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
    }, [navigate, setGeneralStudyDeck]);

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
        const { folders, decks } = useStore.getState();
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return;
        openConfirmModal({
            title: 'Delete Folder',
            message: `Are you sure you want to delete folder "${folder.name}"? Decks inside will not be deleted.`,
            onConfirm: async () => {
                dispatch({ type: 'DELETE_FOLDER', payload: folderId });
                addToast(`Folder "${folder.name}" deleted.`, 'success');
                const decksToUpdate = decks.filter(d => d.folderId === folderId).map(d => ({ ...d, folderId: null as (string | null) }));
                if (decksToUpdate.length > 0) await db.bulkUpdateDecks(decksToUpdate);
                await db.deleteFolder(folderId);
            }
        })
    }, [addToast, dispatch, openConfirmModal]);
    
    const handleSaveSeries = useCallback(async (data: { id: string | null, name: string, description: string, scaffold?: any }) => {
        if (data.id) {
            const seriesToUpdate = useStore.getState().deckSeries.find(s => s.id === data.id);
            if(seriesToUpdate) {
                const updatedSeries = { ...seriesToUpdate, name: data.name, description: data.description };
                await handleUpdateSeries(updatedSeries);
            }
        } else { // creating new series
            if (data.scaffold && Array.isArray(data.scaffold.levels)) {
                // Create series from scaffold
                const { levels: levelsData } = data.scaffold;
                const allNewDecks: QuizDeck[] = [];
                const newLevels: SeriesLevel[] = levelsData.map((levelData: any) => {
                    const decksForLevel: QuizDeck[] = (levelData.decks || []).map((d: any) => ({
                        id: crypto.randomUUID(),
                        name: d.name,
                        description: d.description,
                        type: DeckType.Quiz,
                        questions: createQuestionsFromImport(Array.isArray(d.questions) ? d.questions : [])
                    }));
                    allNewDecks.push(...decksForLevel);
                    return {
                        title: levelData.title,
                        deckIds: decksForLevel.map(deck => deck.id)
                    };
                });
                
                const newSeries: DeckSeries = {
                    id: crypto.randomUUID(),
                    type: 'series',
                    name: data.name,
                    description: data.description,
                    levels: newLevels,
                    archived: false,
                    createdAt: new Date().toISOString(),
                };
    
                await handleAddSeriesWithDecks(newSeries, allNewDecks);
                addToast(`Series "${newSeries.name}" created from scaffold.`, 'success');
                navigate(`/series/${newSeries.id}?edit=true`);
            } else {
                // Original logic for creating an empty series
                const newSeries: DeckSeries = { id: crypto.randomUUID(), type: 'series', name: data.name, description: data.description, levels: [], createdAt: new Date().toISOString() };
                dispatch({ type: 'ADD_SERIES', payload: newSeries });
                addToast(`Series "${newSeries.name}" created.`, 'success');
                await db.addDeckSeries([newSeries]);
                navigate(`/series/${newSeries.id}?edit=true`);
            }
        }
        setSeriesToEdit(null);
    }, [addToast, handleUpdateSeries, dispatch, setSeriesToEdit, navigate, handleAddSeriesWithDecks]);
    
    const handleDeleteSeries = useCallback(async (seriesId: string) => {
        const { deckSeries, decks } = useStore.getState();
        const series = deckSeries.find(s => s.id === seriesId);
        if (!series) return;
        
        const deckIdsToDelete = series.levels.flatMap(level => level.deckIds);
        const decksToTrash = decks
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
    }, [dispatch, addToast]);
    
    const handleAddDeckToSeries = useCallback(async (seriesId: string, newDeck: QuizDeck) => {
        const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
        if (!series) return;
        await handleAddDecks([newDeck]);
        const newLevel: SeriesLevel = { title: newDeck.name, deckIds: [newDeck.id] };
        const updatedSeries = { ...series, levels: [...series.levels, newLevel] };
        await handleUpdateSeries(updatedSeries);
    }, [handleAddDecks, handleUpdateSeries]);

    const handleRestoreDeck = useCallback(async (deckId: string) => {
        const deck = useStore.getState().decks.find(d => d.id === deckId);
        if (!deck) return;
        const { deletedAt, ...restoredDeck } = deck;
        await handleUpdateDeck(restoredDeck, { toastMessage: `Restored deck "${restoredDeck.name}".` });
    }, [handleUpdateDeck]);

    const handleRestoreSeries = useCallback(async (seriesId: string) => {
        const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
        if (!series) return;
        const { deletedAt, ...restoredSeries } = series;
        await handleUpdateSeries(restoredSeries, { toastMessage: `Restored series "${restoredSeries.name}".` });
    }, [handleUpdateSeries]);

    const handleDeleteDeckPermanently = useCallback(async (deckId: string) => {
        try {
            const deckName = useStore.getState().decks.find(d => d.id === deckId)?.name;
            dispatch({ type: 'DELETE_DECK', payload: deckId });
            addToast(`Deck "${deckName || 'Deck'}" permanently deleted.`, 'success');
            await db.deleteDeck(deckId);
        } catch (error) {
            console.error("Failed to permanently delete deck:", error);
            addToast("There was an error permanently deleting the deck.", "error");
        }
    }, [dispatch, addToast]);

    const handleDeleteSeriesPermanently = useCallback(async (seriesId: string) => {
        const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
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
    }, [dispatch, addToast]);
    
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
        const { deckSeries, decks, seriesProgress } = useStore.getState();
        if (!deckSeries.length || !decks.length) return;

        let anySeriesUpdated = false;
        
        const newProgressMap = new Map(seriesProgress);

        for (const series of deckSeries) {
            if (series.archived || series.deletedAt) continue;

            const progressValue = newProgressMap.get(series.id);
            const completedInSeries = new Set(progressValue instanceof Set ? progressValue : []);
            let seriesWasUpdated = false;
            
            const flatDeckIds = series.levels.flatMap(l => l.deckIds);
            for (const deckId of flatDeckIds) {
                if (completedInSeries.has(deckId)) {
                    continue; // Already complete, skip check
                }

                const deck = decks.find(d => d.id === deckId);
                if (!deck) continue;

                const items = deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : (deck as FlashcardDeck).cards;
                const hasNewItems = items.some(item => !item.suspended && item.interval === 0);

                if (!hasNewItems && items.length > 0) {
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
             // Persist all changes to localStorage
            newProgressMap.forEach((completedIds, seriesId) => {
                try {
                    if (completedIds instanceof Set) {
                        localStorage.setItem(`series-progress-${seriesId}`, JSON.stringify(Array.from(completedIds)));
                    }
                } catch (e) {
                    console.error(`Could not save reconciled series progress for ${seriesId}`, e);
                }
            });
            addToast("Unlocked decks based on your progress.", "info");
            dispatch({ type: 'SET_SERIES_PROGRESS', payload: newProgressMap });
        }

    }, [addToast, dispatch]);
    
    const handleGenerateWithAI = useCallback(async (params: AIGenerationParams & { generationType: 'series' | 'deck', generateQuestions?: boolean, isLearningMode?: boolean }) => {
        const { aiGenerationStatus } = useStore.getState();
        if (aiGenerationStatus.isGenerating) {
            addToast("An AI generation task is already in progress. Please wait for it to complete.", "info");
            return;
        }
    
        const { generationType, generateQuestions, isLearningMode, ...aiParams } = params;
        
        const initialStatusText = `Initializing AI generation for '${params.topic}'...`;
        dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText: initialStatusText, generatingDeckId: null, generatingSeriesId: null } });
    
        try {
            if (generationType === 'series') {
                dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText: `Generating series outline for '${params.topic}'...`, generatingDeckId: null, generatingSeriesId: null } });
                const scaffold = await generateSeriesScaffoldWithAI(aiParams);
                const allNewDecks: Deck[] = [];
                
                const newLevels: SeriesLevel[] = scaffold.levels.map(levelData => {
                    const decksForLevel: Deck[] = levelData.decks.map(d => {
                        const baseDeck = {
                            id: crypto.randomUUID(), name: d.name, description: d.description,
                            questions: [], suggestedQuestionCount: d.suggestedQuestionCount, aiGenerationParams: aiParams
                        };
                        if (isLearningMode) {
                            return { ...baseDeck, type: DeckType.Learning, infoCards: [] };
                        }
                        return { ...baseDeck, type: DeckType.Quiz };
                    });
                    allNewDecks.push(...decksForLevel);
                    return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
                });
    
                const newSeries: DeckSeries = {
                    id: crypto.randomUUID(), type: 'series', name: scaffold.seriesName, description: scaffold.seriesDescription,
                    levels: newLevels, createdAt: new Date().toISOString(), aiGenerationParams: aiParams
                };
    
                await handleAddSeriesWithDecks(newSeries, allNewDecks);
    
                if (generateQuestions && allNewDecks.length > 0) {
                    if (isLearningMode) {
                        const learningDecksToPopulate = allNewDecks.filter(d => d.type === DeckType.Learning) as LearningDeck[];
                        dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText: `Preparing to generate learning content...`, generatingDeckId: null, generatingSeriesId: newSeries.id } });

                        const history = await generateSeriesLearningContentInBatches(newSeries, learningDecksToPopulate, (deckId, learningContent) => {
                            const currentDecks = useStore.getState().decks;
                            const deckToUpdate = currentDecks.find(d => d.id === deckId);
                            if (deckToUpdate && deckToUpdate.type === DeckType.Learning) {
                                const newInfoCards: InfoCard[] = [];
                                const newQuestions: Question[] = [];
                                
                                (learningContent || []).forEach((block: any) => {
                                    const infoCardId = crypto.randomUUID();
                                    const questionIdsForThisCard: string[] = [];
                                    const questionsForBlock = createQuestionsFromImport(Array.isArray(block.questions) ? block.questions : []);

                                    questionsForBlock.forEach(q => {
                                        const fullQuestion = { ...q, id: crypto.randomUUID(), dueDate: new Date().toISOString(), interval: 0, easeFactor: 2.5, infoCardIds: [infoCardId] };
                                        questionIdsForThisCard.push(fullQuestion.id);
                                        newQuestions.push(fullQuestion);
                                    });

                                    newInfoCards.push({
                                        id: infoCardId,
                                        content: block.infoCardContent,
                                        unlocksQuestionIds: questionIdsForThisCard,
                                    });
                                });
                                
                                const updatedDeck = { ...deckToUpdate, questions: newQuestions, infoCards: newInfoCards };
                                handleUpdateDeck(updatedDeck, { silent: true });
                                const deckIndex = learningDecksToPopulate.findIndex(d => d.id === deckId) + 1;
                                const statusText = `Generating content for '${deckToUpdate.name}' (${deckIndex} of ${learningDecksToPopulate.length})...`;
                                dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText, generatingDeckId: deckToUpdate.id, generatingSeriesId: newSeries.id } });
                            }
                        });
                        handleUpdateSeries({ ...newSeries, aiChatHistory: history }, { silent: true });
                        addToast(`Successfully generated all content for "${newSeries.name}"!`, 'success');
                    } else {
                        const quizDecksToPopulate = allNewDecks.filter(d => d.type === DeckType.Quiz) as QuizDeck[];
                        dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText: `Preparing to generate questions...`, generatingDeckId: null, generatingSeriesId: newSeries.id } });
                        
                        const history = await generateSeriesQuestionsInBatches(newSeries, quizDecksToPopulate, (deckId, questions) => {
                            const newQuestions = createQuestionsFromImport(questions);
                            const currentDecks = useStore.getState().decks;
                            const deckToUpdate = currentDecks.find(d => d.id === deckId);
                            if (deckToUpdate && deckToUpdate.type === DeckType.Quiz) {
                                const updatedDeck = { ...deckToUpdate, questions: newQuestions };
                                handleUpdateDeck(updatedDeck, { silent: true });
                                const deckIndex = quizDecksToPopulate.findIndex(d => d.id === deckId) + 1;
                                const statusText = `Generating questions for '${deckToUpdate.name}' (${deckIndex} of ${quizDecksToPopulate.length})...`;
                                dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText, generatingDeckId: deckToUpdate.id, generatingSeriesId: newSeries.id } });
                            }
                        });
                        handleUpdateSeries({ ...newSeries, aiChatHistory: history }, { silent: true });
                        addToast(`Successfully generated all questions for "${newSeries.name}"!`, 'success');
                    }
                } else {
                     addToast(`Successfully created series scaffold "${newSeries.name}"!`, 'success');
                }
            } else if (generationType === 'deck') {
                if (isLearningMode) {
                    // Generate a Learning Deck
                    dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText: `Generating learning deck: '${params.topic}'...`, generatingDeckId: null, generatingSeriesId: null } });
                    const aiResponse = await generateLearningDeckWithAI(aiParams);

                    const newInfoCards: InfoCard[] = [];
                    const newQuestions: Question[] = [];

                    (aiResponse.learningContent || []).forEach((block: any) => {
                        const infoCardId = crypto.randomUUID();
                        const questionIdsForThisCard: string[] = [];
                        const questionsForBlock = createQuestionsFromImport(Array.isArray(block.questions) ? block.questions : []);

                        questionsForBlock.forEach(q => {
                            const fullQuestion = { ...q, id: crypto.randomUUID(), dueDate: new Date().toISOString(), interval: 0, easeFactor: 2.5, infoCardIds: [infoCardId] };
                            questionIdsForThisCard.push(fullQuestion.id);
                            newQuestions.push(fullQuestion);
                        });

                        newInfoCards.push({
                            id: infoCardId,
                            content: block.infoCardContent,
                            unlocksQuestionIds: questionIdsForThisCard,
                        });
                    });

                    const newDeck: LearningDeck = {
                        id: crypto.randomUUID(), name: aiResponse.name, description: aiResponse.description,
                        type: DeckType.Learning, infoCards: newInfoCards, questions: newQuestions, aiGenerationParams: aiParams
                    };
                    await handleAddDecks([newDeck]);
                    addToast(`Successfully generated learning deck "${newDeck.name}"!`, 'success');
                } else {
                    // Generate a standard Quiz Deck
                    dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText: `Generating deck: '${params.topic}'...`, generatingDeckId: null, generatingSeriesId: null } });
                    const importedDeck = await generateDeckWithAI(aiParams);
                    const newDeck: QuizDeck = {
                        id: crypto.randomUUID(), name: importedDeck.name, description: importedDeck.description,
                        type: DeckType.Quiz, questions: createQuestionsFromImport(importedDeck.questions), aiGenerationParams: aiParams
                    };
                    await handleAddDecks([newDeck]);
                    addToast(`Successfully generated deck "${newDeck.name}"!`, 'success');
                }
            }
        } catch (error) {
           const message = error instanceof Error ? error.message : "An unknown error occurred during AI generation.";
           addToast(message, 'error');
           throw error;
        } finally {
            dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: false, statusText: null, generatingDeckId: null, generatingSeriesId: null } });
        }
    }, [dispatch, addToast, handleAddSeriesWithDecks, handleAddDecks, handleUpdateDeck, handleUpdateSeries]);

    const handleGenerateQuestionsForDeck = useCallback(async (deck: QuizDeck) => {
        const { decks, deckSeries, aiGenerationStatus } = useStore.getState();
    
        if (aiGenerationStatus.isGenerating) {
            addToast("An AI generation task is already in progress.", "info");
            return;
        }
    
        const questionCount = deck.suggestedQuestionCount || 15;
        
        const statusText = `Generating ${questionCount} questions for "${deck.name}"...`;
        dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText, generatingDeckId: deck.id, generatingSeriesId: null } });
    
        const series = deckSeries.find(s => s.levels.some(l => l.deckIds.includes(deck.id)));
        let seriesContext: { series: DeckSeries, allDecks: QuizDeck[] } | undefined = undefined;
        if (series) {
            const allDecksInSeries = series.levels
                .flatMap(l => l.deckIds)
                .map(id => decks.find(d => d.id === id))
                .filter((d): d is QuizDeck => !!(d && d.type === DeckType.Quiz));
            seriesContext = { series, allDecks: allDecksInSeries };
        }
    
        try {
            const { questions: generatedQuestions } = await generateQuestionsForDeck(deck, questionCount, seriesContext);
            
            if (!generatedQuestions || generatedQuestions.length === 0) {
                addToast("The AI didn't return any questions. Please try again.", "info");
                return;
            }
    
            const newQuestions = createQuestionsFromImport(generatedQuestions);
            const currentDeckState = useStore.getState().decks.find(d => d.id === deck.id);
            if (!currentDeckState || currentDeckState.type !== DeckType.Quiz) {
                throw new Error("Deck not found or is not a quiz deck.");
            }
            
            const updatedQuestions = [...currentDeckState.questions, ...newQuestions];
            
            await handleUpdateDeck({ ...currentDeckState, questions: updatedQuestions });
            addToast(`Successfully added ${newQuestions.length} AI-generated questions to "${deck.name}"!`, 'success');
    
        } catch (e) {
            const message = e instanceof Error ? e.message : "An unknown error occurred during AI generation.";
            addToast(message, 'error');
        } finally {
            if (useStore.getState().aiGenerationStatus.generatingDeckId === deck.id) {
                dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: false, statusText: null, generatingDeckId: null, generatingSeriesId: null } });
            }
        }
    }, [addToast, handleUpdateDeck, dispatch]);

    const handleGenerateContentForLearningDeck = useCallback(async (deck: LearningDeck) => {
        const { aiGenerationStatus } = useStore.getState();
        if (aiGenerationStatus.isGenerating) {
            addToast("An AI generation task is already in progress.", "info");
            return;
        }
        
        const aiParams = deck.aiGenerationParams;
        if (!aiParams) {
            addToast("Cannot generate content: original generation parameters are missing.", "error");
            return;
        }

        const statusText = `Generating content for "${deck.name}"...`;
        dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText, generatingDeckId: deck.id, generatingSeriesId: null } });

        try {
            const aiResponse = await generateLearningDeckWithAI(aiParams);

            const newInfoCards: InfoCard[] = [];
            const newQuestions: Question[] = [];

            (aiResponse.learningContent || []).forEach((block: any) => {
                const infoCardId = crypto.randomUUID();
                const questionIdsForThisCard: string[] = [];
                const questionsForBlock = createQuestionsFromImport(Array.isArray(block.questions) ? block.questions : []);

                questionsForBlock.forEach(q => {
                    const fullQuestion = { ...q, id: crypto.randomUUID(), dueDate: new Date().toISOString(), interval: 0, easeFactor: 2.5, infoCardIds: [infoCardId] };
                    questionIdsForThisCard.push(fullQuestion.id);
                    newQuestions.push(fullQuestion);
                });

                newInfoCards.push({
                    id: infoCardId,
                    content: block.infoCardContent,
                    unlocksQuestionIds: questionIdsForThisCard,
                });
            });

            const updatedDeck: LearningDeck = { ...deck, infoCards: newInfoCards, questions: newQuestions };
            await handleUpdateDeck(updatedDeck, { toastMessage: `Successfully generated content for "${deck.name}"!` });

        } catch (e) {
            const message = e instanceof Error ? e.message : "An unknown error occurred during AI generation.";
            addToast(message, 'error');
        } finally {
            if (useStore.getState().aiGenerationStatus.generatingDeckId === deck.id) {
                dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: false, statusText: null, generatingDeckId: null, generatingSeriesId: null } });
            }
        }
    }, [addToast, handleUpdateDeck, dispatch]);

    const handleAiAddLevelsToSeries = useCallback(async (seriesId: string) => {
        const { deckSeries, decks } = useStore.getState();
        const series = deckSeries.find(s => s.id === seriesId);
        if (!series) throw new Error("Series not found");
    
        const { newLevels, history } = await generateMoreLevelsForSeries(series, decks.filter(d => d.type === 'quiz') as QuizDeck[]);
        if (!newLevels || newLevels.length === 0) {
            addToast("The AI didn't suggest any new levels.", "info");
            return;
        }
    
        const allNewDecks: QuizDeck[] = [];
        const newSeriesLevels: SeriesLevel[] = newLevels.map((levelData: AIGeneratedLevel) => {
            const decksForLevel: QuizDeck[] = (levelData.decks || []).map((d: AIGeneratedDeck) => ({
                id: crypto.randomUUID(),
                name: d.name,
                description: d.description,
                type: DeckType.Quiz,
                questions: [],
                suggestedQuestionCount: d.suggestedQuestionCount
            }));
            allNewDecks.push(...decksForLevel);
            return {
                title: levelData.title,
                deckIds: decksForLevel.map(deck => deck.id)
            };
        });
    
        const updatedSeries = { ...series, levels: [...series.levels, ...newSeriesLevels], aiChatHistory: history };
        
        await handleAddDecks(allNewDecks);
        await handleUpdateSeries(updatedSeries, { toastMessage: `Added ${newSeriesLevels.length} new level(s) to "${series.name}"!` });
    
    }, [handleAddDecks, handleUpdateSeries, addToast]);
    
    const handleAiAddDecksToLevel = useCallback(async (seriesId: string, levelIndex: number) => {
        const { deckSeries, decks } = useStore.getState();
        const series = deckSeries.find(s => s.id === seriesId);
        if (!series) throw new Error("Series not found");
    
        const { newDecks: newDecksDataFromAI, history } = await generateMoreDecksForLevel(series, levelIndex, decks.filter(d => d.type === 'quiz') as QuizDeck[]);
        if (!newDecksDataFromAI || newDecksDataFromAI.length === 0) {
            addToast("The AI didn't suggest any new decks for this level.", "info");
            return;
        }
        
        const newDecks: QuizDeck[] = newDecksDataFromAI.map((d: AIGeneratedDeck) => ({
            id: crypto.randomUUID(),
            name: d.name,
            description: d.description,
            type: DeckType.Quiz,
            questions: [],
            suggestedQuestionCount: d.suggestedQuestionCount
        }));
    
        await handleAddDecks(newDecks);
        
        const updatedSeries = JSON.parse(JSON.stringify(series));
        const newDeckIds = newDecks.map(d => d.id);
        updatedSeries.levels[levelIndex].deckIds.push(...newDeckIds);
        updatedSeries.aiChatHistory = history;
        
        await handleUpdateSeries(updatedSeries, { toastMessage: `Added ${newDecks.length} new deck(s) to "${series.levels[levelIndex].title}"!` });
    }, [handleAddDecks, handleUpdateSeries, addToast]);

    const handleExecuteAIAction = useCallback(async (action: AIAction) => {
        const { decks, folders, deckSeries } = useStore.getState();
        
        switch (action.action) {
            case AIActionType.CREATE_DECK: {
                const { name, folderId } = action.payload as { name: string; folderId?: string };
                const newDeck: QuizDeck = {
                    id: crypto.randomUUID(),
                    name,
                    description: 'Generated by AI Assistant',
                    type: DeckType.Quiz,
                    questions: [],
                    folderId: folderId || undefined,
                };
                await handleAddDecks([newDeck]);
                addToast(`Deck "${name}" created!`, 'success');
                break;
            }
            case AIActionType.RENAME_DECK: {
                const { deckId, newName } = action.payload as { deckId: string; newName: string };
                const deck = decks.find(d => d.id === deckId);
                if (deck) {
                    await handleUpdateDeck({ ...deck, name: newName }, { toastMessage: `Renamed deck to "${newName}".` });
                } else {
                    addToast(`Could not find deck to rename.`, 'error');
                }
                break;
            }
            case AIActionType.MOVE_DECK_TO_FOLDER: {
                const { deckId, folderId } = action.payload as { deckId: string; folderId: string | null };
                await handleMoveDeck(deckId, folderId);
                break;
            }
            case AIActionType.DELETE_DECK: {
                const { deckId } = action.payload as { deckId: string };
                await handleDeleteDeck(deckId);
                break;
            }
            case AIActionType.CREATE_FOLDER: {
                const { name } = action.payload as { name: string };
                await handleSaveFolder({ id: null, name });
                break;
            }
            case AIActionType.RENAME_FOLDER: {
                const { folderId, newName } = action.payload as { folderId: string; newName: string };
                await handleSaveFolder({ id: folderId, name: newName });
                break;
            }
            case AIActionType.DELETE_FOLDER: {
                 const { folderId } = action.payload as { folderId: string };
                 const folder = folders.find(f => f.id === folderId);
                 if (folder) {
                    await handleDeleteFolder(folderId);
                 } else {
                    addToast(`Could not find folder to delete.`, 'error');
                 }
                break;
            }
            case AIActionType.EXPAND_SERIES_ADD_LEVELS: {
                const { seriesId } = action.payload as { seriesId: string };
                await handleAiAddLevelsToSeries(seriesId);
                break;
            }
            case AIActionType.EXPAND_SERIES_ADD_DECKS: {
                const { seriesId, levelIndex } = action.payload as { seriesId: string, levelIndex: number };
                await handleAiAddDecksToLevel(seriesId, levelIndex);
                break;
            }
            case AIActionType.GENERATE_QUESTIONS_FOR_DECK: {
                const { deckId, count } = action.payload as { deckId: string; count?: number };
                const { decks, deckSeries, aiGenerationStatus, dispatch } = useStore.getState();
                const deck = decks.find(d => d.id === deckId);
            
                if (!deck || deck.type !== DeckType.Quiz) {
                    addToast("Could not find a valid quiz deck to add questions to.", "error");
                    return;
                }
                
                if (aiGenerationStatus.isGenerating) {
                    addToast("An AI generation task is already in progress.", "info");
                    return;
                }
            
                const questionCount = count || deck.suggestedQuestionCount || 15;
                
                dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: true, statusText: `Generating ${questionCount} questions...`, generatingDeckId: deck.id, generatingSeriesId: null } });
            
                const series = deckSeries.find(s => s.levels.some(l => l.deckIds.includes(deck.id)));
                let seriesContext: { series: DeckSeries, allDecks: QuizDeck[] } | undefined = undefined;
                if (series) {
                    const allDecksInSeries = series.levels
                        .flatMap(l => l.deckIds)
                        .map(id => decks.find(d => d.id === id))
                        .filter((d): d is QuizDeck => !!(d && d.type === DeckType.Quiz));
                    seriesContext = { series, allDecks: allDecksInSeries };
                }
            
                try {
                    const { questions: generatedQuestions } = await generateQuestionsForDeck(deck, questionCount, seriesContext);
                    
                    if (!generatedQuestions || generatedQuestions.length === 0) {
                        addToast("The AI didn't return any questions. Please try again.", "info");
                        dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: false, statusText: null, generatingDeckId: null, generatingSeriesId: null } });
                        return;
                    }
            
                    const newQuestions = createQuestionsFromImport(generatedQuestions);
                    const updatedQuestions = [...deck.questions, ...newQuestions];
                    
                    await handleUpdateDeck({ ...deck, questions: updatedQuestions });
                    addToast(`Successfully added ${newQuestions.length} AI-generated questions to "${deck.name}"!`, 'success');
            
                } catch (e) {
                    const message = e instanceof Error ? e.message : "An unknown error occurred during AI generation.";
                    addToast(message, 'error');
                } finally {
                    if (useStore.getState().aiGenerationStatus.generatingDeckId === deck.id) {
                        dispatch({ type: 'SET_AI_GENERATION_STATUS', payload: { isGenerating: false, statusText: null, generatingDeckId: null, generatingSeriesId: null } });
                    }
                }
                break;
            }
            case AIActionType.NO_ACTION:
                // Do nothing
                break;
        }
    }, [addToast, handleAddDecks, handleDeleteDeck, handleDeleteFolder, handleMoveDeck, handleSaveFolder, handleUpdateDeck, handleAiAddDecksToLevel, handleAiAddLevelsToSeries]);

    const handleGenerateQuestionsForEmptyDecksInSeries = useCallback(async (seriesId: string) => {
        const { aiGenerationStatus, deckSeries, decks } = useStore.getState();
        if (aiGenerationStatus.isGenerating) {
            addToast("An AI generation task is already in progress.", "info");
            return;
        }
    
        const series = deckSeries.find(s => s.id === seriesId);
        if (!series) {
            addToast("Could not find the series.", "error");
            return;
        }
        
        const seriesDeckIds = new Set(series.levels.flatMap(level => level.deckIds));
        const emptyDecks = decks.filter(d => 
            seriesDeckIds.has(d.id) &&
            d.type === DeckType.Quiz && 
            (d.questions?.length || 0) === 0
        ) as QuizDeck[];
    
        if (emptyDecks.length === 0) {
            addToast("All quiz decks in this series already have questions.", "info");
            return;
        }
    
        dispatch({
          type: 'SET_AI_GENERATION_STATUS',
          payload: { isGenerating: true, generatingDeckId: emptyDecks[0].id, generatingSeriesId: series.id, statusText: `Generating questions for ${emptyDecks.length} empty decks...` }
        });
        addToast(`AI is generating questions for ${emptyDecks.length} empty decks. This will continue in the background.`, 'info');
        
        (async () => {
            try {
                const history = await generateSeriesQuestionsInBatches(series, emptyDecks, (deckId, questions) => {
                    const newQuestions = createQuestionsFromImport(questions);
                    const deckToUpdate = useStore.getState().decks.find(d => d.id === deckId);
                    
                    if (deckToUpdate && (deckToUpdate.type === DeckType.Quiz || deckToUpdate.type === DeckType.Learning)) {
                        const updatedDeck = { ...deckToUpdate, questions: newQuestions };
                        handleUpdateDeck(updatedDeck as QuizDeck | LearningDeck, { silent: true });
                    }
    
                    const currentIndex = emptyDecks.findIndex(d => d.id === deckId);
                    const nextDeck = emptyDecks[currentIndex + 1];
                    if (nextDeck) {
                        dispatch({
                          type: 'SET_AI_GENERATION_STATUS',
                          payload: { isGenerating: true, generatingDeckId: nextDeck.id, generatingSeriesId: series.id, statusText: `Generating questions for "${nextDeck.name}"...` }
                        });
                    }
                });
    
                handleUpdateSeries({ ...series, aiChatHistory: history }, { silent: true });
                addToast(`Successfully generated questions for all empty decks!`, 'success');
    
            } catch (e) {
                const message = e instanceof Error ? e.message : "An unknown error occurred during AI generation.";
                addToast(message, 'error');
            } finally {
                if (useStore.getState().aiGenerationStatus.generatingSeriesId === series.id) {
                    dispatch({
                      type: 'SET_AI_GENERATION_STATUS',
                      payload: { isGenerating: false, generatingDeckId: null, generatingSeriesId: null, statusText: null }
                    });
                }
            }
        })();
    }, [addToast, dispatch, handleUpdateDeck, handleUpdateSeries]);

    const handleCancelAIGeneration = useCallback(() => {
        dispatch({ type: 'CANCEL_AI_GENERATION' });
        addToast("AI generation cancelled.", "info");
    }, [dispatch, addToast]);
    
    const handleSaveLearningBlock = useCallback(async (deckId: string, blockData: { infoCard: InfoCard; questions: Question[] }) => {
        const deck = useStore.getState().decks.find(d => d.id === deckId);
        if (!deck || deck.type !== DeckType.Learning) {
            addToast("Invalid deck type for saving a learning block.", "error");
            return;
        }

        const { infoCard, questions: blockQuestions } = blockData;
        const infoCardExists = deck.infoCards.some(ic => ic.id === infoCard.id);
        const updatedInfoCards = infoCardExists
            ? deck.infoCards.map(ic => ic.id === infoCard.id ? infoCard : ic)
            : [...deck.infoCards, infoCard];

        const otherQuestions = deck.questions.filter(q => !q.infoCardIds?.includes(infoCard.id));
        const updatedQuestions = [...otherQuestions, ...blockQuestions];

        updatedQuestions.forEach(q => {
            if (blockQuestions.some(bq => bq.id === q.id)) {
                if (!q.infoCardIds?.includes(infoCard.id)) {
                    q.infoCardIds = [...(q.infoCardIds || []), infoCard.id];
                }
            }
        });

        const updatedDeck: LearningDeck = { ...deck, infoCards: updatedInfoCards, questions: updatedQuestions };
        await handleUpdateDeck(updatedDeck, { toastMessage: "Learning block saved." });
    }, [handleUpdateDeck, addToast]);

    const handleDeleteLearningBlock = useCallback(async (deckId: string, infoCardId: string) => {
        const deck = useStore.getState().decks.find(d => d.id === deckId);
        if (!deck || deck.type !== DeckType.Learning) return;
        
        openConfirmModal({
            title: "Delete Learning Block",
            message: "Are you sure you want to delete this info card and all of its associated questions? This action cannot be undone.",
            onConfirm: async () => {
                const updatedDeck: LearningDeck = {
                    ...deck,
                    infoCards: deck.infoCards.filter(ic => ic.id !== infoCardId),
                    questions: deck.questions.filter(q => !q.infoCardIds?.includes(infoCardId)),
                };
                await handleUpdateDeck(updatedDeck, { toastMessage: "Learning block deleted." });
            }
        });
    }, [handleUpdateDeck, openConfirmModal]);

    return {
        updateLastOpened,
        updateLastOpenedSeries,
        handleSessionEnd,
        handleAddDecks,
        handleCreateSampleDeck,
        handleCreateSampleSeries,
        handleRestoreData,
        handleDeleteDeck,
        handleUpdateDeck,
        handleMoveDeck,
        handleItemReviewed,
        handleExportData,
        handleResetDeckProgress,
        handleFactoryReset,
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
        reconcileSeriesProgress,
        handleAiAddLevelsToSeries,
        handleAiAddDecksToLevel,
        handleStudyNextDeckInSeries,
        handleExecuteAIAction,
        handleGenerateWithAI,
        handleGenerateQuestionsForDeck,
        handleGenerateContentForLearningDeck,
        handleGenerateQuestionsForEmptyDecksInSeries,
        handleCancelAIGeneration,
        handleSaveLearningBlock,
        handleDeleteLearningBlock,
    };
};