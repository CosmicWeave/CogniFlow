import { useCallback, useMemo } from 'react';
import { Deck, Folder, QuizDeck, LearningDeck, InfoCard, Question } from '../../types';
import * as db from '../../services/db';
import { useStore } from '../../store/store';
import { createNatureSampleDeck } from '../../services/sampleData';
import { useToast } from '../useToast';

// This has been refactored into a proper custom hook to follow the Rules of Hooks.
export const useDeckAndFolderHandlers = ({ triggerSync, openConfirmModal }: any) => {
  const { dispatch } = useStore();
  const { addToast } = useToast();

  const handleAddDecks = useCallback(async (decks: Deck[]) => {
    dispatch({ type: 'ADD_DECKS', payload: decks });
    try {
      await db.addDecks(decks);
      triggerSync({ isManual: false });
    } catch (e) {
      addToast('Error saving new deck(s).', 'error');
      console.error(e);
    }
  }, [dispatch, addToast, triggerSync]);

  const handleUpdateDeck = useCallback(async (deck: Deck, options?: { silent?: boolean, toastMessage?: string }) => {
    const updatedDeck = { ...deck, lastModified: Date.now() };
    dispatch({ type: 'UPDATE_DECK', payload: updatedDeck });
    try {
      await db.updateDeck(updatedDeck);
      if (!options?.silent) {
        if (options?.toastMessage) {
          addToast(options.toastMessage, 'success');
        }
        triggerSync({ isManual: false });
      }
    } catch (e) {
      addToast(`Error updating deck "${deck.name}".`, 'error');
      console.error(e);
    }
  }, [dispatch, addToast, triggerSync]);
  
  const handleBulkUpdateDecks = useCallback(async (decks: Deck[], options?: { silent?: boolean }) => {
    const updatedDecks = decks.map(d => ({ ...d, lastModified: Date.now() }));
    dispatch({ type: 'BULK_UPDATE_DECKS', payload: updatedDecks });
    try {
      await db.bulkUpdateDecks(updatedDecks);
      if (!options?.silent) {
        triggerSync({ isManual: false });
      }
    } catch(e) {
      addToast('Error updating decks.', 'error');
    }
  }, [dispatch, triggerSync, addToast]);

  const handleMoveDeck = useCallback(async (deckId: string, folderId: string | null) => {
    const deck = useStore.getState().decks.find(d => d.id === deckId);
    if (deck) {
      await handleUpdateDeck({ ...deck, folderId });
      addToast(`Deck moved.`, 'success');
    }
  }, [handleUpdateDeck, addToast]);

  const handleDeleteDeck = useCallback(async (deckId: string) => {
    const deck = useStore.getState().decks.find(d => d.id === deckId);
    if (deck) {
      const updatedDeck = { ...deck, deletedAt: new Date().toISOString(), archived: false };
      await handleUpdateDeck(updatedDeck, { toastMessage: `Deck "${deck.name}" moved to trash.` });
    }
  }, [handleUpdateDeck]);
  
  const handleRestoreDeck = useCallback(async (deckId: string) => {
      const deck = useStore.getState().decks.find(d => d.id === deckId);
      if (deck) {
          await handleUpdateDeck({ ...deck, deletedAt: null }, { toastMessage: `Deck "${deck.name}" restored.` });
      }
  }, [handleUpdateDeck]);
  
  const handleDeleteDeckPermanently = useCallback(async (deckId: string) => {
      dispatch({ type: 'DELETE_DECK', payload: deckId });
      try {
          await db.deleteDeck(deckId);
          addToast("Deck permanently deleted.", "success");
          triggerSync({ isManual: false });
      } catch (e) {
          addToast("Error deleting deck permanently.", "error");
      }
  }, [dispatch, addToast, triggerSync]);

  const handleSaveFolder = useCallback(async (folderData: { id: string | null; name: string }) => {
    if (folderData.id) { // Existing folder
      const updatedFolder = { id: folderData.id, name: folderData.name };
      dispatch({ type: 'UPDATE_FOLDER', payload: updatedFolder });
      try {
        await db.updateFolder(updatedFolder);
        addToast(`Folder renamed to "${updatedFolder.name}".`, 'success');
        triggerSync({ isManual: false });
      } catch(e) {
        addToast("Error renaming folder.", "error");
      }
    } else { // New folder
      const newFolder: Folder = { id: crypto.randomUUID(), name: folderData.name };
      dispatch({ type: 'ADD_FOLDER', payload: newFolder });
      try {
        await db.addFolder(newFolder);
        addToast(`Folder "${newFolder.name}" created.`, 'success');
        triggerSync({ isManual: false });
      } catch(e) {
        addToast("Error creating folder.", "error");
      }
    }
  }, [dispatch, addToast, triggerSync]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    const folder = useStore.getState().folders.find(f => f.id === folderId);
    if (!folder) return;

    openConfirmModal({
      title: 'Delete Folder',
      message: `Are you sure you want to delete the folder "${folder.name}"? Decks inside will be moved to the main list.`,
      onConfirm: async () => {
        dispatch({ type: 'DELETE_FOLDER', payload: folderId });
        try {
          await db.deleteFolder(folderId);
          const decksToUpdate = useStore.getState().decks.filter(d => d.folderId === folderId);
          if (decksToUpdate.length > 0) {
              await db.bulkUpdateDecks(decksToUpdate.map(d => ({...d, folderId: null})));
          }
          addToast(`Folder "${folder.name}" deleted.`, 'success');
          triggerSync({ isManual: false });
        } catch (e) {
          addToast("Error deleting folder.", "error");
        }
      },
    });
  }, [dispatch, addToast, triggerSync, openConfirmModal]);

  const updateLastOpened = useCallback((deckId: string) => {
    const deck = useStore.getState().decks.find(d => d.id === deckId);
    if (deck && deck.id !== 'general-study-deck') {
      const now = new Date();
      const lastOpenedDate = deck.lastOpened ? new Date(deck.lastOpened) : new Date(0);
      // Only update if it hasn't been updated in the last 5 seconds to prevent re-render loops.
      if (now.getTime() - lastOpenedDate.getTime() > 5000) {
        handleUpdateDeck({ ...deck, lastOpened: now.toISOString() }, { silent: true });
      }
    }
  }, [handleUpdateDeck]);
  
  const handleCreateSampleDeck = useCallback(() => {
    const sampleDeck = createNatureSampleDeck();
    handleAddDecks([sampleDeck]);
    addToast(`Sample deck "${sampleDeck.name}" created.`, 'success');
  }, [handleAddDecks, addToast]);

  const handleSaveLearningBlock = useCallback(async (deckId: string, blockData: { infoCard: InfoCard; questions: Question[] }) => {
    const deck = useStore.getState().decks.find(d => d.id === deckId) as LearningDeck;
    if (!deck) return;
    
    // update or add infoCard
    const currentInfoCards = deck.infoCards || [];
    const infoCardExists = currentInfoCards.some(ic => ic.id === blockData.infoCard.id);
    const updatedInfoCards = infoCardExists
        ? currentInfoCards.map(ic => ic.id === blockData.infoCard.id ? blockData.infoCard : ic)
        : [...currentInfoCards, blockData.infoCard];

    // update or add questions
    const currentQuestions = deck.questions || [];
    const questionsMap = new Map(currentQuestions.map(q => [q.id, q]));
    blockData.questions.forEach(q => questionsMap.set(q.id, q));
    
    const updatedDeck = { ...deck, infoCards: updatedInfoCards, questions: Array.from(questionsMap.values()) };
    await handleUpdateDeck(updatedDeck, { toastMessage: 'Learning block saved.' });
  }, [handleUpdateDeck]);

  const handleDeleteLearningBlock = useCallback(async (deckId: string, infoCardId: string) => {
    const deck = useStore.getState().decks.find(d => d.id === deckId) as LearningDeck;
    if (!deck) return;

    const currentInfoCards = deck.infoCards || [];
    const updatedInfoCards = currentInfoCards.filter(ic => ic.id !== infoCardId);
    const questionIdsToDelete = new Set(currentInfoCards.find(ic => ic.id === infoCardId)?.unlocksQuestionIds || []);
    const updatedQuestions = (deck.questions || []).filter(q => !questionIdsToDelete.has(q.id));
    
    const updatedDeck = { ...deck, infoCards: updatedInfoCards, questions: updatedQuestions };
    await handleUpdateDeck(updatedDeck, { toastMessage: 'Learning block deleted.' });
  }, [handleUpdateDeck]);

  return useMemo(() => ({
    handleAddDecks,
    handleUpdateDeck,
    handleBulkUpdateDecks,
    handleMoveDeck,
    handleDeleteDeck,
    handleRestoreDeck,
    handleDeleteDeckPermanently,
    handleSaveFolder,
    handleDeleteFolder,
    updateLastOpened,
    handleCreateSampleDeck,
    handleSaveLearningBlock,
    handleDeleteLearningBlock,
  }), [
    handleAddDecks, handleUpdateDeck, handleBulkUpdateDecks, handleMoveDeck, handleDeleteDeck, 
    handleRestoreDeck, handleDeleteDeckPermanently, handleSaveFolder, handleDeleteFolder, 
    updateLastOpened, handleCreateSampleDeck, handleSaveLearningBlock, handleDeleteLearningBlock
  ]);
};
