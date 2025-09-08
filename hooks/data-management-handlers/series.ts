
import { useCallback } from 'react';
import { Deck, DeckSeries, QuizDeck, DeckType, Reviewable, FlashcardDeck, LearningDeck, SeriesLevel } from '../../types';
import * as db from '../../services/db';
import { useStore } from '../../store/store';
import { createQuestionsFromImport } from '../../services/importService';
import { createSampleSeries } from '../../services/sampleData';

// This is not a hook, but a factory function that creates a set of related handlers.
export const createSeriesHandlers = ({ dispatch, addToast, navigate, triggerSync, handleAddDecks, handleUpdateDeck }: any) => {

  const handleUpdateSeries = useCallback(async (series: DeckSeries, options?: { silent?: boolean; toastMessage?: string }) => {
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
        triggerSync();
    } catch (error) {
        console.error("Failed to update series:", error);
        addToast("There was an error updating the series.", "error");
    }
  }, [dispatch, addToast, triggerSync]);
  
  const updateLastOpenedSeries = useCallback(async (seriesId: string) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (series) {
        const updatedSeries = { ...series, lastOpened: new Date().toISOString() };
        await handleUpdateSeries(updatedSeries, { silent: true });
    }
  }, [handleUpdateSeries]);
  
  const handleAddSeriesWithDecks = useCallback(async (series: DeckSeries, decks: Deck[]) => {
    try {
        dispatch({ type: 'ADD_SERIES_WITH_DECKS', payload: { series, decks }});
        await Promise.all([
            db.addDecks(decks),
            db.addDeckSeries([series])
        ]);
        triggerSync();
        addToast(`Successfully imported series "${series.name}" with ${decks.length} decks.`, "success");
    } catch (error) {
        console.error("Failed to create series with decks:", error);
        addToast("There was an error creating the new series.", "error");
    }
  }, [dispatch, addToast, triggerSync]);

  const handleCreateSampleSeries = useCallback(() => {
    const { series, decks } = createSampleSeries();
    handleAddSeriesWithDecks(series, decks);
    addToast(`Sample series "${series.name}" created!`, "success");
    navigate(`/series/${series.id}`);
  }, [handleAddSeriesWithDecks, addToast, navigate]);
  
  const handleSaveSeries = useCallback(async (data: { id: string | null, name: string, description: string, scaffold?: any }) => {
    try {
        if (data.id) {
            const seriesToUpdate = useStore.getState().deckSeries.find(s => s.id === data.id);
            if (seriesToUpdate) {
                const updatedSeries = { ...seriesToUpdate, name: data.name, description: data.description };
                await handleUpdateSeries(updatedSeries);
            }
        } else {
            if (data.scaffold && Array.isArray(data.scaffold.levels)) {
                const { levels: levelsData } = data.scaffold;
                const allNewDecks: QuizDeck[] = [];
                const newLevels: SeriesLevel[] = levelsData.map((levelData: any) => {
                    const decksForLevel: QuizDeck[] = (levelData.decks || []).map((d: any) => ({
                        id: crypto.randomUUID(), name: d.name, description: d.description, type: DeckType.Quiz,
                        questions: createQuestionsFromImport(Array.isArray(d.questions) ? d.questions : [])
                    }));
                    allNewDecks.push(...decksForLevel);
                    return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
                });
                const newSeries: DeckSeries = {
                    id: crypto.randomUUID(), type: 'series', name: data.name, description: data.description, levels: newLevels,
                    archived: false, createdAt: new Date().toISOString(),
                };
                await handleAddSeriesWithDecks(newSeries, allNewDecks);
                addToast(`Series "${newSeries.name}" created from scaffold.`, 'success');
                navigate(`/series/${newSeries.id}?edit=true`);
            } else {
                const newSeries: DeckSeries = { id: crypto.randomUUID(), type: 'series', name: data.name, description: data.description, levels: [], createdAt: new Date().toISOString() };
                dispatch({ type: 'ADD_SERIES', payload: newSeries });
                addToast(`Series "${newSeries.name}" created.`, 'success');
                await db.addDeckSeries([newSeries]);
                triggerSync();
                navigate(`/series/${newSeries.id}?edit=true`);
            }
        }
    } catch (error) {
        console.error("Failed to save series:", error);
        addToast("There was an error saving the series.", "error");
    }
  }, [addToast, handleUpdateSeries, dispatch, navigate, handleAddSeriesWithDecks, triggerSync]);
  
  const handleDeleteSeries = useCallback(async (seriesId: string) => {
    const { deckSeries, decks } = useStore.getState();
    const series = deckSeries.find(s => s.id === seriesId);
    if (!series) return;
    const deckIdsToDelete = series.levels.flatMap(level => level.deckIds);
    const decksToTrash = decks
        .filter(d => deckIdsToDelete.includes(d.id))
        .map(d => ({ ...d, deletedAt: new Date().toISOString(), archived: false }));
    const updatedSeries = { ...series, deletedAt: new Date().toISOString(), archived: false };
    dispatch({ type: 'BULK_UPDATE_DECKS', payload: decksToTrash });
    dispatch({ type: 'UPDATE_SERIES', payload: updatedSeries });
    addToast(`Series "${series.name}" and its ${decksToTrash.length} deck(s) moved to Trash.`, 'success');
    try {
        await Promise.all([
            db.bulkUpdateDecks(decksToTrash),
            db.updateDeckSeries(updatedSeries)
        ]);
        triggerSync();
    } catch (error) {
        console.error("Failed to move series and its decks to trash:", error);
        addToast("Error moving series to trash.", "error");
    }
  }, [dispatch, addToast, triggerSync]);

  const handleAddDeckToSeries = useCallback(async (seriesId: string, newDeck: QuizDeck) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (!series) return;
    await handleAddDecks([newDeck]);
    const newLevel: SeriesLevel = { title: newDeck.name, deckIds: [newDeck.id] };
    const updatedSeries = { ...series, levels: [...series.levels, newLevel] };
    await handleUpdateSeries(updatedSeries);
  }, [handleAddDecks, handleUpdateSeries]);
  
  const handleRestoreSeries = useCallback(async (seriesId: string) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (!series) return;
    const { deletedAt, ...restoredSeries } = series;
    await handleUpdateSeries(restoredSeries, { toastMessage: `Restored series "${restoredSeries.name}".` });
  }, [handleUpdateSeries]);

  const handleDeleteSeriesPermanently = useCallback(async (seriesId: string) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (!series) return;
    const deckIdsToDelete = series.levels.flatMap(level => level.deckIds);
    const seriesName = series.name;
    try {
        deckIdsToDelete.forEach(deckId => {
            dispatch({ type: 'DELETE_DECK', payload: deckId });
        });
        dispatch({ type: 'DELETE_SERIES', payload: seriesId });
        addToast(`Series "${seriesName}" and its ${deckIdsToDelete.length} deck(s) permanently deleted.`, 'success');
        await Promise.all([
            ...deckIdsToDelete.map(deckId => db.deleteDeck(deckId)),
            db.deleteDeckSeries(seriesId)
        ]);
        triggerSync();
    } catch (error) {
        console.error("Failed to permanently delete series and its decks:", error);
        addToast("There was an error permanently deleting the series.", "error");
    }
  }, [dispatch, addToast, triggerSync]);

  const reconcileSeriesProgress = useCallback(() => {
    const { deckSeries, decks, seriesProgress } = useStore.getState();
    if (!deckSeries.length || !decks.length) return;
    let anySeriesUpdated = false;
    // FIX: Explicitly type newProgressMap to ensure type safety for its keys and values.
    const newProgressMap: Map<string, Set<string>> = new Map(seriesProgress);
    for (const series of deckSeries) {
        if (series.archived || series.deletedAt) continue;
        const progressValue = newProgressMap.get(series.id);
        // FIX: Ensure progressValue is iterable and handle potential non-Set objects.
        const completedInSeries = new Set(progressValue instanceof Set ? progressValue : []);
        let seriesWasUpdated = false;
        const flatDeckIds = series.levels.flatMap(l => l.deckIds || []).filter((id): id is string => typeof id === 'string');
        for (const deckId of flatDeckIds) {
            if (completedInSeries.has(deckId)) continue;
            const deck = decks.find(d => d.id === deckId);
            if (!deck) continue;
            let items: Reviewable[] | undefined;
            if (deck.type === DeckType.Flashcard) items = (deck as FlashcardDeck).cards;
            else if (deck.type === DeckType.Quiz || deck.type === DeckType.Learning) items = (deck as QuizDeck | LearningDeck).questions;
            if (!items) continue;
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
        const savePromises = Array.from(newProgressMap.entries()).map(([seriesId, completedIds]) => {
            return db.saveSeriesProgress(seriesId, completedIds);
        });
        Promise.all(savePromises).catch(e => console.error("Could not save reconciled series progress to DB", e));
        addToast("Unlocked decks based on your progress.", "info");
        dispatch({ type: 'SET_SERIES_PROGRESS', payload: newProgressMap });
    }
  }, [addToast, dispatch]);

  return {
    handleUpdateSeries,
    updateLastOpenedSeries,
    handleAddSeriesWithDecks,
    handleCreateSampleSeries,
    handleSaveSeries,
    handleDeleteSeries,
    handleAddDeckToSeries,
    handleRestoreSeries,
    handleDeleteSeriesPermanently,
    reconcileSeriesProgress,
  };
};
