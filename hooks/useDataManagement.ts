import { useCallback, useMemo } from 'react';
import { useStore } from '../store/store';
import { useModal } from '../contexts/ModalContext';
import { useToast } from './useToast';
import { useDeckAndFolderHandlers } from './data-management-handlers/deckAndFolder';
import { useSeriesHandlers } from './data-management-handlers/series';
import { useSessionHandlers } from './data-management-handlers/session';
import { useBackupHandlers } from './data-management-handlers/backup';
import { useDriveHandlers } from './data-management-handlers/drive';
import { useAIHandlers } from './data-management-handlers/ai';
import { createCardsFromImport, createQuestionsFromImport } from '../services/importService';
import { Deck, DeckSeries, DeckType, FlashcardDeck, QuizDeck, SeriesLevel } from '../types';
import { useRouter } from '../contexts/RouterContext';

export const useDataManagement = (props: any) => {
    const { dispatch } = useStore();
    const { openModal, closeModal } = useModal();
    const { addToast } = useToast();
    const { navigate } = useRouter();

    const backupHandlers = useBackupHandlers({
        ...props,
        addToast,
        openModal,
        closeModal,
        dispatch,
    });

    const { triggerSync } = backupHandlers;

    const deckAndFolderHandlers = useDeckAndFolderHandlers({ 
        triggerSync, 
        openConfirmModal: (p: any) => openModal('confirm', p)
    });
    
    const seriesHandlers = useSeriesHandlers({ 
        triggerSync, 
        handleAddDecks: deckAndFolderHandlers.handleAddDecks,
        handleUpdateDeck: deckAndFolderHandlers.handleUpdateDeck,
    });
    
    const sessionHandlers = useSessionHandlers({
        ...props,
        handleUpdateDeck: deckAndFolderHandlers.handleUpdateDeck,
    });

    const driveHandlers = useDriveHandlers({
        ...props,
        openConfirmModal: (p: any) => openModal('confirm', p),
        openRestoreFromDriveModal: () => openModal('restoreFromDrive'),
        onRestoreData: backupHandlers.onRestoreData,
    });
    
    const aiHandlers = useAIHandlers({
        handleUpdateDeck: deckAndFolderHandlers.handleUpdateDeck,
        handleAddDecks: deckAndFolderHandlers.handleAddDecks,
        handleAddSeriesWithDecks: seriesHandlers.handleAddSeriesWithDecks,
        handleUpdateSeries: seriesHandlers.handleUpdateSeries,
        openConfirmModal: (p: any) => openModal('confirm', p)
    });

    // FIX: Implemented the logic for handling dropped files.
    const handleDroppedFileConfirm = useCallback(async (analysis: any, deckName?: string) => {
        closeModal();
        if (!analysis) return;
        try {
          if (analysis.type === 'series') {
            const { seriesName, seriesDescription, levels: levelsData } = analysis.data;
            const allNewDecks: Deck[] = [];
            const newLevels: SeriesLevel[] = (levelsData || []).map((levelData: any) => {
              const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck | null => {
                if (d.type === 'quiz') {
                  const newQuizDeck: QuizDeck = {
                    id: crypto.randomUUID(), name: d.name, description: d.description,
                    type: DeckType.Quiz, questions: createQuestionsFromImport(d.questions || [])
                  };
                  return newQuizDeck;
                } else if (d.type === 'flashcard') {
                  const newFlashcardDeck: FlashcardDeck = {
                    id: crypto.randomUUID(), name: d.name, description: d.description,
                    type: DeckType.Flashcard, cards: createCardsFromImport(d.cards || [])
                  };
                  return newFlashcardDeck;
                }
                return null;
              }).filter((d: Deck | null): d is Deck => d !== null);
              
              allNewDecks.push(...decksForLevel);
              return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
            });
            const newSeries: DeckSeries = {
              id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription,
              levels: newLevels, archived: false, createdAt: new Date().toISOString(),
            };
            await seriesHandlers.handleAddSeriesWithDecks(newSeries, allNewDecks);
          } else if (analysis.type === 'quiz') {
            const newDeck: QuizDeck = {
              id: crypto.randomUUID(), name: deckName || analysis.data.name, description: analysis.data.description,
              type: DeckType.Quiz, questions: createQuestionsFromImport(analysis.data.questions)
            };
            await deckAndFolderHandlers.handleAddDecks([newDeck]);
            addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
          } else if (analysis.type === 'flashcard') {
            if (!deckName) {
              addToast('Deck name is required for flashcard import.', 'error');
              return;
            }
            const cards = createCardsFromImport(analysis.data);
            const newDeck: FlashcardDeck = {
              id: crypto.randomUUID(), name: deckName, type: DeckType.Flashcard, cards: cards,
              description: `${cards.length} imported flashcard${cards.length === 1 ? '' : 's'}.`
            };
            await deckAndFolderHandlers.handleAddDecks([newDeck]);
            addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
          }
        } catch (e) {
            addToast((e as Error).message, 'error');
        }
    }, [seriesHandlers, deckAndFolderHandlers, addToast, closeModal]);

    return useMemo(() => ({
        ...deckAndFolderHandlers,
        ...seriesHandlers,
        ...sessionHandlers,
        ...backupHandlers,
        ...driveHandlers,
        ...aiHandlers,
        openModal,
        closeModal,
        handleDroppedFileConfirm,
        // FIX: Add the openConfirmModal convenience function to the returned object, making it available to consumers of the hook.
        openConfirmModal: (p: any) => openModal('confirm', p),
    }), [deckAndFolderHandlers, seriesHandlers, sessionHandlers, backupHandlers, driveHandlers, aiHandlers, openModal, closeModal, handleDroppedFileConfirm]);
};
