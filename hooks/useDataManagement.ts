
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
import { createCardsFromImport, createQuestionsFromImport, AnalysisResult } from '../services/importService';
import { parseAnkiPkg, parseAnkiPkgMainThread } from '../services/ankiImportService';
import { generateDeckFromImage } from '../services/aiService';
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
        openConfirmModal: (p: any) => openModal('confirm', p),
        openModal,
        closeModal,
    });

    // FIX: Implemented logic for all file types including Anki and Images
    const handleDroppedFileConfirm = useCallback(async (analysis: AnalysisResult, options: { deckName?: string; imageHint?: string } = {}) => {
        closeModal();
        if (!analysis) return;
        const { deckName, imageHint } = options;

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
          } else if (analysis.type === 'anki' && analysis.file) {
              addToast('Processing Anki package...', 'info');
              const buffer = await analysis.file.arrayBuffer();
              // Buffer needs to be copied if we use the worker because it gets transferred
              // But since we are only using it once here, it should be fine.
              let decks: Deck[] = [];
              try {
                  decks = await parseAnkiPkg(buffer);
              } catch (workerError) {
                  console.warn("Anki worker failed, trying fallback:", workerError);
                  // Need a fresh buffer for fallback if the first one was transferred
                  const freshBuffer = await analysis.file.arrayBuffer();
                  decks = await parseAnkiPkgMainThread(freshBuffer);
              }

              if (decks.length > 0) {
                  await deckAndFolderHandlers.handleAddDecks(decks);
                  addToast(`Successfully imported ${decks.length} deck(s) from Anki package.`, 'success');
              } else {
                  addToast('No valid decks found in the Anki package.', 'error');
              }
          } else if (analysis.type === 'image' && analysis.file) {
              addToast('Analyzing image with AI...', 'info');
              const reader = new FileReader();
              reader.readAsDataURL(analysis.file);
              reader.onload = async () => {
                  try {
                      const base64Data = (reader.result as string).split(',')[1];
                      const { name, description, cards } = await generateDeckFromImage(base64Data, analysis.file!.type, imageHint);
                      
                      const newDeck: FlashcardDeck = {
                          id: crypto.randomUUID(),
                          name: name || `Image Deck - ${analysis.file!.name}`,
                          description: description || `Generated from ${analysis.file!.name}`,
                          type: DeckType.Flashcard,
                          cards: createCardsFromImport(cards)
                      };
                      await deckAndFolderHandlers.handleAddDecks([newDeck]);
                      addToast(`Deck "${newDeck.name}" generated successfully.`, 'success');
                  } catch (e) {
                      console.error(e);
                      addToast(`Image generation failed: ${(e as Error).message}`, 'error');
                  }
              };
              reader.onerror = () => addToast('Failed to read image file.', 'error');
          } else if (analysis.type === 'backup' && analysis.data) {
              // Redirect to standard restore logic
              await backupHandlers.onRestoreData(analysis.data);
          }
        } catch (e) {
            addToast((e as Error).message, 'error');
        }
    }, [seriesHandlers, deckAndFolderHandlers, backupHandlers, addToast, closeModal]);

    return useMemo(() => ({
        ...props, // Pass through state variables passed as props
        ...deckAndFolderHandlers,
        ...seriesHandlers,
        ...sessionHandlers,
        ...backupHandlers,
        ...driveHandlers,
        ...aiHandlers,
        openModal,
        closeModal,
        handleDroppedFileConfirm,
        openConfirmModal: (p: any) => openModal('confirm', p),
        addToast,
    }), [props, deckAndFolderHandlers, seriesHandlers, sessionHandlers, backupHandlers, driveHandlers, aiHandlers, openModal, closeModal, handleDroppedFileConfirm, addToast]);
};