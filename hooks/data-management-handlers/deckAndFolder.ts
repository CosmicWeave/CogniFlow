
import { useCallback } from 'react';
import { Deck, Folder } from '../../types';
import * as db from '../../services/db';
import { useStore } from '../../store/store';
import { createNatureSampleDeck } from '../../services/sampleData';

// This is not a hook, but a factory function that creates a set of related handlers.
// It helps organize logic that was previously in the monolithic useDataManagement hook.
export const createDeckAndFolderHandlers = ({ dispatch, addToast, triggerSync, openConfirmModal }: any) => {

  const handleUpdateDeck = useCallback(async (deck: Deck, options?: { silent?: boolean; toastMessage?: string }) => {
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
        triggerSync();
    } catch (error) {
        console.error("Failed to update deck:", error);
        addToast("There was an error syncing the deck update.", "error");
    }
  }, [dispatch, addToast, triggerSync]);

  const updateLastOpened = useCallback(async (deckId: string) => {
    const deck = useStore.getState().decks.find(d => d.id === deckId);
    if (deck) {
        const updatedDeck = { ...deck, lastOpened: new Date().toISOString() };
        await handleUpdateDeck(updatedDeck, { silent: true });
    }
  }, [handleUpdateDeck]);

  const handleAddDecks = useCallback(async (decks: Deck[]) => {
    try {
        dispatch({ type: 'ADD_DECKS', payload: decks });
        await db.addDecks(decks);
        triggerSync();
    } catch (error) {
        console.error("Failed to add decks:", error);
        addToast("There was an error saving the new deck(s).", "error");
    }
  }, [dispatch, addToast, triggerSync]);

  const handleCreateSampleDeck = useCallback(() => {
    const sampleDeck = createNatureSampleDeck();
    handleAddDecks([sampleDeck]);
    addToast(`Sample deck "${sampleDeck.name}" created!`, "success");
  }, [handleAddDecks, addToast]);

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

  const handleSaveFolder = useCallback(async (folderData: {id: string | null, name: string}) => {
    try {
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
        triggerSync();
    } catch (error) {
        console.error("Failed to save folder:", error);
        addToast("There was an error saving the folder.", "error");
    }
  }, [dispatch, addToast, triggerSync]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    const { folders, decks } = useStore.getState();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    openConfirmModal({
        title: 'Delete Folder',
        message: `Are you sure you want to delete folder "${folder.name}"? Decks inside will not be deleted.`,
        onConfirm: async () => {
            try {
                dispatch({ type: 'DELETE_FOLDER', payload: folderId });
                addToast(`Folder "${folder.name}" deleted.`, 'success');
                const decksToUpdate = decks.filter(d => d.folderId === folderId).map(d => ({ ...d, folderId: null as (string | null) }));
                if (decksToUpdate.length > 0) await db.bulkUpdateDecks(decksToUpdate);
                await db.deleteFolder(folderId);
                triggerSync();
            } catch (error) {
                console.error("Failed to delete folder:", error);
                addToast("There was an error deleting the folder.", "error");
            }
        }
    });
  }, [dispatch, addToast, triggerSync, openConfirmModal]);

  const handleRestoreDeck = useCallback(async (deckId: string) => {
    const deck = useStore.getState().decks.find(d => d.id === deckId);
    if (!deck) return;
    const { deletedAt, ...restoredDeck } = deck;
    await handleUpdateDeck(restoredDeck, { toastMessage: `Restored deck "${restoredDeck.name}".` });
  }, [handleUpdateDeck]);

  const handleDeleteDeckPermanently = useCallback(async (deckId: string) => {
    try {
        const deckName = useStore.getState().decks.find(d => d.id === deckId)?.name;
        dispatch({ type: 'DELETE_DECK', payload: deckId });
        addToast(`Deck "${deckName || 'Deck'}" permanently deleted.`, 'success');
        await db.deleteDeck(deckId);
        triggerSync();
    } catch (error) {
        console.error("Failed to permanently delete deck:", error);
        addToast("There was an error permanently deleting the deck.", "error");
    }
  }, [dispatch, addToast, triggerSync]);

  return {
    handleUpdateDeck,
    updateLastOpened,
    handleAddDecks,
    handleCreateSampleDeck,
    handleDeleteDeck,
    handleMoveDeck,
    handleSaveFolder,
    handleDeleteFolder,
    handleRestoreDeck,
    handleDeleteDeckPermanently,
  };
};
