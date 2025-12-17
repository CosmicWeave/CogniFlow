
import { useCallback, useMemo } from 'react';
import { Deck, Folder, QuizDeck, LearningDeck, InfoCard, Question, DeckType, FlashcardDeck } from '../../types.ts';
import storage from '../../services/storage.ts';
import { useStore } from '../../store/store.ts';
import { createNatureSampleDeck, createSampleFlashcardDeck, createSampleLearningDeck, createSampleCourse } from '../../services/sampleData.ts';
import { useToast } from '../useToast.ts';
import * as exportService from '../../services/exportService.ts';

export const useDeckAndFolderHandlers = ({ triggerSync, openConfirmModal }: any) => {
  const { dispatch } = useStore();
  const { addToast } = useToast();

  const handleAddDecks = useCallback(async (newDecks: Deck[]) => {
    // Name deduplication logic
    const existingDecks = Object.values(useStore.getState().decks) as Deck[];
    const existingNames = new Set(existingDecks.map(d => d.name));

    const sanitizedDecks = newDecks.map(deck => {
        let name = deck.name;
        let counter = 1;
        // If name exists, append (Copy X) until unique
        while (existingNames.has(name)) {
            name = `${deck.name} (Copy ${counter})`;
            counter++;
        }
        existingNames.add(name); // Add to set so subsequent duplicates in this batch are also handled
        return { ...deck, name };
    });

    dispatch({ type: 'ADD_DECKS', payload: sanitizedDecks });
    try {
      await storage.addDecks(sanitizedDecks);
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
      await storage.updateDeck(updatedDeck);
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
      await storage.bulkUpdateDecks(updatedDecks);
      if (!options?.silent) {
        triggerSync({ isManual: false });
      }
    } catch(e) {
      addToast('Error updating decks.', 'error');
    }
  }, [dispatch, triggerSync, addToast]);

  const handleMoveDeck = useCallback(async (deckId: string, folderId: string | null) => {
    const deck = useStore.getState().decks[deckId];
    if (deck) {
      await handleUpdateDeck({ ...deck, folderId });
      addToast(`Deck moved.`, 'success');
    }
  }, [handleUpdateDeck, addToast]);

  const handleDeleteDeck = useCallback(async (deckId: string) => {
    const deck = useStore.getState().decks[deckId];
    if (deck) {
      const updatedDeck = { ...deck, deletedAt: new Date().toISOString(), archived: false };
      await handleUpdateDeck(updatedDeck, { toastMessage: `Deck "${deck.name}" moved to trash.` });
    }
  }, [handleUpdateDeck]);
  
  const handleRestoreDeck = useCallback(async (deckId: string) => {
      const deck = useStore.getState().decks[deckId];
      if (deck) {
          await handleUpdateDeck({ ...deck, deletedAt: null }, { toastMessage: `Deck "${deck.name}" restored.` });
      }
  }, [handleUpdateDeck]);
  
  const handleDeleteDeckPermanently = useCallback(async (deckId: string) => {
      dispatch({ type: 'DELETE_DECK', payload: deckId });
      try {
          await storage.deleteDeck(deckId);
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
        await storage.updateFolder(updatedFolder);
        addToast(`Folder renamed to "${updatedFolder.name}".`, 'success');
        triggerSync({ isManual: false });
      } catch(e) {
        addToast("Error renaming folder.", "error");
      }
    } else { // New folder
      const newFolder: Folder = { id: crypto.randomUUID(), name: folderData.name };
      dispatch({ type: 'ADD_FOLDER', payload: newFolder });
      try {
        await storage.addFolder(newFolder);
        addToast(`Folder "${newFolder.name}" created.`, 'success');
        triggerSync({ isManual: false });
      } catch(e) {
        addToast("Error creating folder.", "error");
      }
    }
  }, [dispatch, addToast, triggerSync]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    const folder = useStore.getState().folders[folderId];
    if (!folder) return;

    openConfirmModal({
      title: 'Delete Folder',
      message: `Are you sure you want to delete the folder "${folder.name}"? Decks inside will be moved to the main list.`,
      onConfirm: async () => {
        dispatch({ type: 'DELETE_FOLDER', payload: folderId });
        try {
          await storage.deleteFolder(folderId);
          const decksToUpdate = (Object.values(useStore.getState().decks) as Deck[]).filter(d => d.folderId === folderId);
          if (decksToUpdate.length > 0) {
              await storage.bulkUpdateDecks(decksToUpdate.map(d => ({...d, folderId: null})));
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
    const deck = useStore.getState().decks[deckId];
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
    addToast(`Sample quiz "${sampleDeck.name}" created.`, 'success');
  }, [handleAddDecks, addToast]);

  const handleCreateSampleQuizDeck = useCallback(() => {
    const sampleDeck = createNatureSampleDeck();
    handleAddDecks([sampleDeck]);
    addToast(`Sample quiz "${sampleDeck.name}" created.`, 'success');
  }, [handleAddDecks, addToast]);

  const handleCreateSampleFlashcardDeck = useCallback(() => {
    const sampleDeck = createSampleFlashcardDeck();
    handleAddDecks([sampleDeck]);
    addToast(`Sample flashcard deck "${sampleDeck.name}" created.`, 'success');
  }, [handleAddDecks, addToast]);

  const handleCreateSampleLearningDeck = useCallback(() => {
    const sampleDeck = createSampleLearningDeck();
    handleAddDecks([sampleDeck]);
    addToast(`Sample learning deck "${sampleDeck.name}" created.`, 'success');
  }, [handleAddDecks, addToast]);

  const handleCreateSampleCourse = useCallback(() => {
    const sampleDeck = createSampleCourse();
    handleAddDecks([sampleDeck]);
    addToast(`Sample course "${sampleDeck.name}" created.`, 'success');
  }, [handleAddDecks, addToast]);

  const handleSaveLearningBlock = useCallback(async (deckId: string, blockData: { infoCard: InfoCard; questions: Question[] }) => {
    const deck = useStore.getState().decks[deckId] as LearningDeck;
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
    const deck = useStore.getState().decks[deckId] as LearningDeck;
    if (!deck) return;

    const currentInfoCards = deck.infoCards || [];
    const updatedInfoCards = currentInfoCards.filter(ic => ic.id !== infoCardId);
    const questionIdsToDelete = new Set(currentInfoCards.find(ic => ic.id === infoCardId)?.unlocksQuestionIds || []);
    const updatedQuestions = (deck.questions || []).filter(q => !questionIdsToDelete.has(q.id));
    
    const updatedDeck = { ...deck, infoCards: updatedInfoCards, questions: updatedQuestions };
    await handleUpdateDeck(updatedDeck, { toastMessage: 'Learning block deleted.' });
  }, [handleUpdateDeck]);

  const handleExportDeck = useCallback((deck: Deck) => {
    try {
        exportService.exportDeck(deck);
        addToast(`Deck "${deck.name}" exported as JSON.`, 'success');
    } catch(e) {
        addToast(`Failed to export deck: ${(e as Error).message}`, 'error');
    }
  }, [addToast]);
  
  const handleExportDeckCSV = useCallback((deck: Deck) => {
    try {
        exportService.exportDeckToCSV(deck);
        addToast(`Deck "${deck.name}" exported as CSV.`, 'success');
    } catch(e) {
        addToast(`Failed to export deck: ${(e as Error).message}`, 'error');
    }
  }, [addToast]);

  const handleShiftSchedule = useCallback(async (days: number) => {
      openConfirmModal({
          title: 'Shift Schedule',
          message: `Are you sure you want to shift all due dates forward by ${days} day(s)? This affects all active cards in all decks.`,
          confirmText: 'Shift Schedule',
          onConfirm: async () => {
              const allDecks = Object.values(useStore.getState().decks) as Deck[];
              const updatedDecks: Deck[] = [];
              let shiftCount = 0;

              allDecks.forEach(deck => {
                  let deckChanged = false;
                  let newDeck = { ...deck };

                  if (deck.type === DeckType.Flashcard) {
                      const flashcardDeck = deck as FlashcardDeck;
                      const newCards = flashcardDeck.cards.map(c => {
                          if (!c.suspended && c.dueDate) {
                              const currentDue = new Date(c.dueDate);
                              currentDue.setDate(currentDue.getDate() + days);
                              shiftCount++;
                              deckChanged = true;
                              return { ...c, dueDate: currentDue.toISOString() };
                          }
                          return c;
                      });
                      if (deckChanged) newDeck = { ...flashcardDeck, cards: newCards };
                  } else {
                      const quizDeck = deck as QuizDeck | LearningDeck;
                      const newQuestions = quizDeck.questions.map(q => {
                          if (!q.suspended && q.dueDate) {
                              const currentDue = new Date(q.dueDate);
                              currentDue.setDate(currentDue.getDate() + days);
                              shiftCount++;
                              deckChanged = true;
                              return { ...q, dueDate: currentDue.toISOString() };
                          }
                          return q;
                      });
                      if (deckChanged) newDeck = { ...quizDeck, questions: newQuestions };
                  }

                  if (deckChanged) {
                      updatedDecks.push(newDeck);
                  }
              });

              if (updatedDecks.length > 0) {
                  await handleBulkUpdateDecks(updatedDecks);
                  addToast(`Schedule shifted! ${shiftCount} items moved forward by ${days} days.`, 'success');
              } else {
                  addToast("No active items found to shift.", 'info');
              }
          }
      });
  }, [openConfirmModal, handleBulkUpdateDecks, addToast]);


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
    handleCreateSampleQuizDeck,
    handleCreateSampleFlashcardDeck,
    handleCreateSampleLearningDeck,
    handleCreateSampleCourse,
    handleSaveLearningBlock,
    handleDeleteLearningBlock,
    handleExportDeck,
    handleExportDeckCSV,
    handleShiftSchedule,
  }), [
    handleAddDecks, handleUpdateDeck, handleBulkUpdateDecks, handleMoveDeck, handleDeleteDeck, 
    handleRestoreDeck, handleDeleteDeckPermanently, handleSaveFolder, handleDeleteFolder, 
    updateLastOpened, handleCreateSampleDeck, handleCreateSampleQuizDeck, handleCreateSampleFlashcardDeck,
    handleCreateSampleLearningDeck, handleCreateSampleCourse, handleSaveLearningBlock, handleDeleteLearningBlock,
    handleExportDeck, handleExportDeckCSV, handleShiftSchedule
  ]);
};
