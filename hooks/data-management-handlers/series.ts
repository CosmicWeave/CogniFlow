
import { useCallback, useMemo } from 'react';
// FIX: Imported 'LearningDeck' to resolve 'Cannot find name' error.
import { Deck, DeckSeries, QuizDeck, DeckType, LearningDeck } from '../../types';
import * as db from '../../services/db';
import { useStore } from '../../store/store';
import { createSampleSeries } from '../../services/sampleData';
import { useToast } from '../useToast';
import { useRouter } from '../../contexts/RouterContext';

export const useSeriesHandlers = ({ triggerSync, handleAddDecks, handleUpdateDeck }: any) => {
  const { dispatch } = useStore();
  const { addToast } = useToast();
  const { navigate } = useRouter();

  const handleAddSeriesWithDecks = useCallback(async (series: DeckSeries, decks: Deck[]) => {
    dispatch({ type: 'ADD_SERIES_WITH_DECKS', payload: { series, decks } });
    try {
      await db.addDeckSeries([series]);
      await db.addDecks(decks);
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
      await db.updateDeckSeries(updatedSeries);
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
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (series) {
      const updatedSeries = { ...series, deletedAt: new Date().toISOString(), archived: false };
      handleUpdateSeries(updatedSeries, { toastMessage: `Series "${series.name}" moved to trash.` });
      
      const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
      const decksToTrash = useStore.getState().decks.filter(d => seriesDeckIds.has(d.id));
      for (const deck of decksToTrash) {
          handleUpdateDeck({ ...deck, deletedAt: new Date().toISOString(), archived: false }, { silent: true });
      }
    }
  }, [handleUpdateSeries, handleUpdateDeck]);
  
  const handleRestoreSeries = useCallback(async (seriesId: string) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (series) {
        handleUpdateSeries({ ...series, deletedAt: null }, { toastMessage: `Series "${series.name}" restored.` });
        
        const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
        const decksToRestore = useStore.getState().decks.filter(d => seriesDeckIds.has(d.id));
        for (const deck of decksToRestore) {
            if (deck.deletedAt) {
                handleUpdateDeck({ ...deck, deletedAt: null }, { silent: true });
            }
        }
    }
  }, [handleUpdateSeries, handleUpdateDeck]);
  
  const handleDeleteSeriesPermanently = useCallback(async (seriesId: string) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (!series) return;

    const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
    const decksToDelete = useStore.getState().decks.filter(d => seriesDeckIds.has(d.id));
    
    dispatch({ type: 'DELETE_SERIES', payload: seriesId });
    for(const deck of decksToDelete) {
        dispatch({ type: 'DELETE_DECK', payload: deck.id });
    }

    try {
        await db.deleteDeckSeries(seriesId);
        for(const deck of decksToDelete) {
            await db.deleteDeck(deck.id);
        }
        addToast("Series and its decks permanently deleted.", "success");
        triggerSync({ isManual: false });
    } catch (e) {
        addToast("Error deleting series permanently.", "error");
    }
  }, [dispatch, addToast, triggerSync]);


  const handleSaveSeries = useCallback(async (data: { id: string | null; name: string; description: string; scaffold?: any; }) => {
    if (data.id) {
      const seriesToUpdate = useStore.getState().deckSeries.find(s => s.id === data.id);
      if (seriesToUpdate) {
        handleUpdateSeries({ ...seriesToUpdate, name: data.name, description: data.description }, { toastMessage: "Series updated." });
      }
    } else {
      if (data.scaffold) {
          const { seriesName, seriesDescription, levels: levelsData } = data.scaffold;
          const allNewDecks: (QuizDeck | LearningDeck)[] = [];
          const newLevels = (levelsData || []).map((levelData: any) => {
              const decksForLevel = (levelData.decks || []).map((d: any) => ({
                  id: crypto.randomUUID(), name: d.name, description: d.description, 
                  type: DeckType.Quiz, // Scaffolds are always Quiz for now
                  questions: [],
                  suggestedQuestionCount: d.suggestedQuestionCount,
              }));
              allNewDecks.push(...decksForLevel);
              return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
          });
          const newSeries: DeckSeries = {
              id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription,
              levels: newLevels, archived: false, createdAt: new Date().toISOString(),
          };
          handleAddSeriesWithDecks(newSeries, allNewDecks);
      } else {
          const newSeries: DeckSeries = {
            id: crypto.randomUUID(), type: 'series', name: data.name, description: data.description,
            levels: [], archived: false, createdAt: new Date().toISOString(),
          };
          dispatch({ type: 'ADD_SERIES', payload: newSeries });
          try {
            await db.addDeckSeries([newSeries]);
            addToast(`Series "${newSeries.name}" created.`, 'success');
            navigate(`/series/${newSeries.id}?edit=true`);
            triggerSync({ isManual: false });
          } catch(e) {
            addToast("Error creating series.", "error");
          }
      }
    }
  }, [dispatch, addToast, navigate, triggerSync, handleUpdateSeries, handleAddSeriesWithDecks]);
  
  const handleAddDeckToSeries = useCallback(async (seriesId: string, newDeck: QuizDeck) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (!series) return;
    
    const updatedLevels = [...(series.levels || [])];
    if (updatedLevels.length === 0) {
        updatedLevels.push({ title: 'Decks', deckIds: [] });
    }
    updatedLevels[updatedLevels.length - 1].deckIds.push(newDeck.id);

    const updatedSeries = { ...series, levels: updatedLevels };
    
    await handleAddDecks([newDeck]);
    await handleUpdateSeries(updatedSeries, { toastMessage: `Deck "${newDeck.name}" added to series.`});

  }, [handleAddDecks, handleUpdateSeries]);

  const updateLastOpenedSeries = useCallback((seriesId: string) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (series) {
        const lastOpened = new Date().toISOString();
        if (series.lastOpened !== lastOpened) {
            handleUpdateSeries({ ...series, lastOpened }, { silent: true });
        }
    }
  }, [handleUpdateSeries]);
  
  const handleCreateSampleSeries = useCallback(() => {
    const { series, decks } = createSampleSeries();
    handleAddSeriesWithDecks(series, decks);
  }, [handleAddSeriesWithDecks]);
  
  return useMemo(() => ({
    handleAddSeriesWithDecks,
    handleUpdateSeries,
    handleDeleteSeries,
    handleSaveSeries,
    handleRestoreSeries,
    handleDeleteSeriesPermanently,
    handleAddDeckToSeries,
    updateLastOpenedSeries,
    handleCreateSampleSeries,
  }), [
    handleAddSeriesWithDecks, handleUpdateSeries, handleDeleteSeries, handleSaveSeries,
    handleRestoreSeries, handleDeleteSeriesPermanently, handleAddDeckToSeries,
    updateLastOpenedSeries, handleCreateSampleSeries
  ]);
};
