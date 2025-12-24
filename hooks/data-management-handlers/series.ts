
import { useCallback, useMemo } from 'react';
import { Deck, DeckSeries, QuizDeck, DeckType, LearningDeck } from '../../types.ts';
import storage from '../../services/storage.ts';
import { useStore } from '../../store/store.ts';
import { createSampleSeries } from '../../services/sampleData.ts';
import { useToast } from '../useToast.ts';
import { useRouter } from '../../contexts/RouterContext.tsx';
import * as exportService from '../../services/exportService.ts';

export const useSeriesHandlers = ({ triggerSync, handleAddDecks, handleUpdateDeck }: any) => {
  const { dispatch } = useStore();
  const { addToast } = useToast();
  const { navigate } = useRouter();

  const handleAddSeriesWithDecks = useCallback(async (series: DeckSeries, decks: Deck[]) => {
    dispatch({ type: 'ADD_SERIES_WITH_DECKS', payload: { series, decks } });
    try {
      await storage.addDeckSeries([series]);
      await storage.addDecks(decks);
      addToast(`Series "${series.name}" created with ${decks.length} deck(s).`, 'success');
      navigate(`/series/${series.id}`);
      triggerSync({ isManual: false });
    } catch(e) {
      addToast("Error creating new series.", "error");
    }
  }, [dispatch, addToast, navigate, triggerSync]);

  const handleUpdateSeries = useCallback(async (series: DeckSeries, options?: { silent?: boolean, toastMessage?: string }) => {
    const updatedSeries = { ...series, lastModified: Date.now() };
    dispatch({ type: 'UPDATE_SERIES', payload: updatedSeries });
    try {
      await storage.updateDeckSeries(updatedSeries);
      if (!options?.silent) {
          if (options?.toastMessage) {
            addToast(options.toastMessage, 'success');
          }
          triggerSync({ isManual: false });
      }
    } catch(e) {
      addToast(`Error updating series "${series.name}".`, 'error');
    }
  }, [dispatch, addToast, triggerSync]);
  
  const handleDeleteSeries = useCallback(async (seriesId: string) => {
    const series = useStore.getState().deckSeries[seriesId];
    if (series) {
      const updatedSeries = { ...series, deletedAt: new Date().toISOString(), archived: false };
      handleUpdateSeries(updatedSeries, { toastMessage: `Series "${series.name}" moved to trash.` });
      
      const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
      const decksToTrash = (Object.values(useStore.getState().decks) as Deck[]).filter(d => seriesDeckIds.has(d.id));
      for (const deck of decksToTrash) {
          handleUpdateDeck({ ...deck, deletedAt: new Date().toISOString(), archived: false }, { silent: true });
      }
    }
  }, [handleUpdateSeries, handleUpdateDeck]);
  
  const handleRestoreSeries = useCallback(async (seriesId: string) => {
    const series = useStore.getState().deckSeries[seriesId];
    if (series) {
        handleUpdateSeries({ ...series, deletedAt: null }, { toastMessage: `Series "${series.name}" restored.` });
        
        const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
        const decksToRestore = (Object.values(useStore.getState().decks) as Deck[]).filter(d => seriesDeckIds.has(d.id));
        for (const deck of decksToRestore) {
            if (deck.deletedAt) {
                handleUpdateDeck({ ...deck, deletedAt: null }, { silent: true });
            }
        }
    }
  }, [handleUpdateSeries, handleUpdateDeck]);
  
  const handleDeleteSeriesPermanently = useCallback(async (seriesId: string) => {
    const series = useStore.getState().deckSeries[seriesId];
    if (!series) return;

    const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
    const decksToDelete = (Object.values(useStore.getState().decks) as Deck[]).filter(d => seriesDeckIds.has(d.id));
    
    dispatch({ type: 'DELETE_SERIES', payload: seriesId });
    for(const deck of decksToDelete) {
        dispatch({ type: 'DELETE_DECK', payload: deck.id });
    }

    try {
        await storage.deleteDeckSeries(seriesId);
        for(const deck of decksToDelete) {
            await storage.deleteDeck(deck.id);
        }
        addToast("Series and its decks permanently deleted.", "success");
        triggerSync({ isManual: false });
    } catch (e) {
        addToast("Error deleting series permanently.", "error");
    }
  }, [dispatch, addToast, triggerSync]);


  const handleSaveSeries = useCallback(async (data: { id: string | null; name: string; description: string; scaffold?: any; }) => {
    if (data.id) { // Existing series
      const seriesToUpdate = useStore.getState().deckSeries[data.id];
      if (seriesToUpdate) {
        handleUpdateSeries({ ...seriesToUpdate, name: data.name, description: data.description });
      }
    } else { // New series
        if (data.scaffold) {
            const { seriesName, seriesDescription, levels: levelsData } = data.scaffold;
            const allNewDecks: Deck[] = [];
            const newLevels = (levelsData || []).map((levelData: any) => {
                const decksForLevel = (levelData.decks || []).map((d: any): Deck | null => {
                    const newDeckBase = { id: crypto.randomUUID(), name: d.name, description: d.description };
                    if (d.type === DeckType.Quiz) return { ...newDeckBase, type: DeckType.Quiz, questions: d.questions || [] };
                    // FIX: Added default learningMode for Learning decks
                    if (d.type === DeckType.Learning) return { ...newDeckBase, type: DeckType.Learning, questions: d.questions || [], infoCards: d.infoCards || [], learningMode: d.learningMode || 'separate' };
                    if (d.type === DeckType.Flashcard) return { ...newDeckBase, type: DeckType.Flashcard, cards: d.cards || [] };
                    return null;
                }).filter((d: Deck | null): d is Deck => d !== null);
                allNewDecks.push(...decksForLevel);
                return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
            });

            const newSeries: DeckSeries = {
                id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription,
                levels: newLevels, archived: false, createdAt: new Date().toISOString(),
            };
            await handleAddSeriesWithDecks(newSeries, allNewDecks);
        } else {
            const newSeries: DeckSeries = {
                id: crypto.randomUUID(), type: 'series', name: data.name, description: data.description,
                levels: [], createdAt: new Date().toISOString(), archived: false
            };
            dispatch({ type: 'ADD_SERIES', payload: newSeries });
            try {
                await storage.addDeckSeries([newSeries]);
                addToast(`Series "${newSeries.name}" created.`, 'success');
                navigate(`/series/${newSeries.id}`);
            } catch (e) {
                addToast('Error saving new series.', 'error');
            }
        }
    }
  }, [dispatch, addToast, navigate, handleUpdateSeries, handleAddSeriesWithDecks]);

  const handleCreateSampleSeries = useCallback(() => {
    const { series, decks } = createSampleSeries();
    handleAddSeriesWithDecks(series, decks);
  }, [handleAddSeriesWithDecks]);

  const updateLastOpenedSeries = useCallback((seriesId: string) => {
    const series = useStore.getState().deckSeries[seriesId];
    if (series) {
      const now = new Date();
      const lastOpenedDate = new Date(series.lastOpened || 0);
      if (now.getTime() - lastOpenedDate.getTime() > 5000) {
        handleUpdateSeries({ ...series, lastOpened: now.toISOString() }, { silent: true });
      }
    }
  }, [handleUpdateSeries]);
  
  const handleAddDeckToSeries = useCallback(async (seriesId: string, newDeck: QuizDeck) => {
      const series = useStore.getState().deckSeries[seriesId];
      if (!series) {
          addToast("Could not find the series to add the deck to.", "error");
          return;
      }
      await handleAddDecks([newDeck]);
      const lastLevel = series.levels[series.levels.length - 1];
      if (lastLevel) {
          const updatedSeries = {
              ...series,
              levels: [
                  ...series.levels.slice(0, -1),
                  { ...lastLevel, deckIds: [...lastLevel.deckIds, newDeck.id] }
              ]
          };
          handleUpdateSeries(updatedSeries);
      }
  }, [handleAddDecks, handleUpdateSeries, addToast]);

  const handleExportSeries = useCallback((series: DeckSeries) => {
    try {
        const allDecks = Object.values(useStore.getState().decks) as Deck[];
        exportService.exportSeries(series, allDecks);
        addToast(`Series "${series.name}" exported.`, 'success');
    } catch(e) {
        addToast(`Failed to export series: ${(e as Error).message}`, 'error');
    }
  }, [addToast]);


  return useMemo(() => ({
    handleAddSeriesWithDecks,
    handleUpdateSeries,
    handleDeleteSeries,
    handleRestoreSeries,
    handleDeleteSeriesPermanently,
    handleSaveSeries,
    handleCreateSampleSeries,
    updateLastOpenedSeries,
    handleAddDeckToSeries,
    handleExportSeries,
  }), [
    handleAddSeriesWithDecks, handleUpdateSeries, handleDeleteSeries, handleRestoreSeries, handleDeleteSeriesPermanently,
    handleSaveSeries, handleCreateSampleSeries, updateLastOpenedSeries, handleAddDeckToSeries, handleExportSeries,
  ]);
};
