import { useCallback, useMemo } from 'react';
import { useStore, AIGenerationTask } from '../../store/store.ts';
import { useToast } from '../useToast.ts';
import * as aiService from '../../services/aiService.ts';
import { createQuestionsFromImport, ImportedQuestion } from '../../services/importService.ts';
import { Deck, DeckSeries, QuizDeck, LearningDeck, DeckType, Question, InfoCard, AIAction, AIActionType } from '../../types.ts';
import { useModal } from '../../contexts/ModalContext.tsx';
import { useRouter } from '../../contexts/RouterContext.tsx';

export const useAIHandlers = ({
  handleUpdateDeck,
  handleAddDecks,
  handleAddSeriesWithDecks,
  handleUpdateSeries,
  openConfirmModal,
}: {
  handleUpdateDeck: (deck: Deck, options?: any) => Promise<void>;
  handleAddDecks: (decks: Deck[]) => Promise<void>;
  handleAddSeriesWithDecks: (series: DeckSeries, decks: Deck[]) => Promise<void>;
  handleUpdateSeries: (series: DeckSeries, options?: any) => Promise<void>;
  openConfirmModal: (props: any) => void;
}) => {
  const { dispatch } = useStore();
  const { addToast } = useToast();
  const { openModal } = useModal();
  const { navigate } = useRouter();

  const handleGenerateWithAI = useCallback((payload: any) => {
    const task: AIGenerationTask = {
      id: crypto.randomUUID(),
      type: payload.generationType === 'series-scaffold' ? 'generateSeriesScaffoldWithAI' : (payload.generationType === 'deck-learning' ? 'generateLearningDeckWithAI' : 'generateDeckWithAI'),
      payload: payload,
      statusText: `Queued: Generate ${payload.generationType.replace(/-/g, ' ')}...`
    };
    dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
    addToast('AI generation task added to queue.', 'info');
    openModal('aiStatus');
  }, [dispatch, addToast, openModal]);

  const onGenerateSeriesScaffold = useCallback(async (payload: any) => {
    dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating scaffold for "${payload.finalTitle}"...` } });

    const processData = async (scaffold: any) => {
        const { seriesName, seriesDescription, levels: levelsData } = scaffold;
        
        const allNewDecks: (QuizDeck | LearningDeck)[] = [];
        const newLevels = (levelsData || []).map((levelData: any) => {
            const decksForLevel = (levelData.decks || []).map((d: any) => ({
                id: crypto.randomUUID(), name: d.name, description: d.description, 
                type: payload.isLearningMode ? DeckType.Learning : DeckType.Quiz,
                questions: [],
                infoCards: [],
                suggestedQuestionCount: d.suggestedQuestionCount,
            }));
            allNewDecks.push(...decksForLevel);
            return { title: levelData.title, deckIds: decksForLevel.map((deck: { id: any; }) => deck.id) };
        });
        const newSeries: DeckSeries = {
            id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription,
            levels: newLevels, archived: false, createdAt: new Date().toISOString(),
        };
        await handleAddSeriesWithDecks(newSeries, allNewDecks);
        addToast('AI Series scaffold created.', 'success');

        const taskType = payload.isLearningMode ? 'generateSeriesLearningContentInBatches' : 'generateSeriesQuestionsInBatches';
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: taskType,
            payload: { seriesId: newSeries.id },
            seriesId: newSeries.id,
            statusText: `Queued: Generate content for "${newSeries.name}"...`
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
    };

    try {
        const scaffold = await aiService.generateSeriesScaffoldWithAI(payload);
        await processData(scaffold);
    } catch (error) {
        if (error instanceof aiService.AIJsonResponseError) {
            addToast('AI response was invalid. Please try to fix it.', 'error');
            openModal('aiResponseFix', {
                badJson: error.rawResponse,
                onRetry: (fixedJson: any) => processData(fixedJson),
            });
        } else {
            throw error;
        }
    }
  }, [dispatch, handleAddSeriesWithDecks, addToast, openModal]);

  const onGenerateDeck = useCallback(async (payload: any) => {
    dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating deck "${payload.finalTitle}"...` } });

    const processData = async (deckData: any) => {
        const newDeck: QuizDeck = {
            id: crypto.randomUUID(),
            name: deckData.name,
            description: deckData.description,
            type: DeckType.Quiz,
            questions: createQuestionsFromImport(deckData.questions || [])
        };
        await handleAddDecks([newDeck]);
        addToast(`Deck "${newDeck.name}" created with AI.`, 'success');
        navigate(`/decks/${newDeck.id}`);
    };

    try {
        const deckData = await aiService.generateDeckWithAI(payload);
        await processData(deckData);
    } catch (error) {
        if (error instanceof aiService.AIJsonResponseError) {
            addToast('AI response was invalid. Please try to fix it.', 'error');
            openModal('aiResponseFix', {
                badJson: error.rawResponse,
                onRetry: (fixedJson: any) => processData(fixedJson),
            });
        } else {
            throw error;
        }
    }
  }, [dispatch, handleAddDecks, addToast, navigate, openModal]);
  
  const onGenerateLearningDeck = useCallback(async (payload: any) => {
    dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating learning deck "${payload.finalTitle}"...` } });
    
    const newDeck: LearningDeck = {
        id: crypto.randomUUID(),
        name: payload.finalTitle,
        description: `An AI-generated learning deck about ${payload.topic}.`,
        type: DeckType.Learning,
        questions: [],
        infoCards: [],
    };
    await handleAddDecks([newDeck]);
    
    const processData = async (content: any) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Formatting content for "${payload.finalTitle}"...`, deckId: newDeck.id } });
        const infoCard: InfoCard = {
            id: crypto.randomUUID(),
            content: content.infoCardContent,
            unlocksQuestionIds: content.questions.map((_: any, i: number) => `${newDeck.id}-q-${i}`)
        };
        // FIX: Replaced unsafe type assertion with a safe reduce operation to filter out malformed questions from the AI response.
        // FIX: Explicitly construct the ImportedQuestion object to satisfy TypeScript's type checker,
        // as spreading the Partial<Question> `q` does not guarantee all required properties are present.
        const importedQuestions: ImportedQuestion[] = (content.questions || []).reduce((acc: ImportedQuestion[], q: Partial<Question>) => {
            if (q.questionText && q.options && q.correctAnswerId && q.detailedExplanation) {
                acc.push({
                    questionType: 'multipleChoice',
                    questionText: q.questionText,
                    options: q.options,
                    correctAnswerId: q.correctAnswerId,
                    detailedExplanation: q.detailedExplanation,
                    tags: q.tags
                });
            }
            return acc;
        }, []);

        const questions = createQuestionsFromImport(importedQuestions).map((q, i) => ({
            ...q,
            id: `${newDeck.id}-q-${i}`,
            infoCardIds: [infoCard.id]
        }));

        const finalDeck: LearningDeck = { ...newDeck, infoCards: [infoCard], questions: questions };
        await handleUpdateDeck(finalDeck);
        addToast(`Learning Deck "${finalDeck.name}" created with AI.`, 'success');
        navigate(`/decks/${finalDeck.id}`);
    };

    try {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating content for "${payload.finalTitle}"...`, deckId: newDeck.id } });
        const content = await aiService.generateLearningDeckWithAI(payload);
        await processData(content);
    } catch (error) {
        if (error instanceof aiService.AIJsonResponseError) {
            addToast('AI response was invalid. Please try to fix it.', 'error');
            openModal('aiResponseFix', {
                badJson: error.rawResponse,
                onRetry: (fixedJson: any) => processData(fixedJson),
            });
        } else {
            throw error;
        }
    }
  }, [dispatch, handleAddDecks, handleUpdateDeck, addToast, navigate, openModal]);

  const onGenerateQuestionsForDeck = useCallback(async (deck: QuizDeck | LearningDeck, count?: number) => {
    dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating questions for "${deck.name}"...`, deckId: deck.id } });
    
    const processData = async (newQuestionsData: Partial<Question>[]) => {
        const importedQuestions: ImportedQuestion[] = newQuestionsData.flatMap(q => {
            const { questionText, options, correctAnswerId, detailedExplanation, tags } = q;
            if (questionText && options && correctAnswerId && detailedExplanation) {
                return [{
                    questionType: 'multipleChoice',
                    questionText, options, correctAnswerId, detailedExplanation, tags,
                }];
            }
            return [];
        });
        const newQuestions = createQuestionsFromImport(importedQuestions);
        const updatedDeck = { ...deck, questions: [...(deck.questions || []), ...newQuestions] };
        await handleUpdateDeck(updatedDeck);
        addToast(`Added ${newQuestions.length} new questions to "${deck.name}".`, 'success');
    };

    try {
        const newQuestionsData = await aiService.generateQuestionsForDeckWithAI(deck, count);
        await processData(newQuestionsData);
    } catch (error) {
        if (error instanceof aiService.AIJsonResponseError) {
            addToast('AI response was invalid. Please try to fix it.', 'error');
            openModal('aiResponseFix', {
                badJson: error.rawResponse,
                onRetry: (fixedJson: any) => processData(fixedJson),
            });
        } else {
            throw error;
        }
    }
  }, [dispatch, handleUpdateDeck, addToast, openModal]);
  
  const handleGenerateQuestionsForDeckTask = useCallback((deck: QuizDeck | LearningDeck, count?: number) => {
     const task: AIGenerationTask = {
      id: crypto.randomUUID(),
      type: 'generateQuestionsForDeck',
      payload: { deck, count },
      deckId: deck.id,
      statusText: `Queued: Add questions to "${deck.name}"...`
    };
    dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
    addToast('AI generation task added to queue.', 'info');
    openModal('aiStatus');
  }, [dispatch, addToast, openModal]);

  const handleGenerateQuestionsForEmptyDecksInSeries = useCallback((seriesId: string) => {
    openConfirmModal({
        title: "Generate All Questions?",
        message: "This will generate questions for all empty decks in this series. This may take some time and consume API credits. Do you want to proceed?",
        onConfirm: () => {
            const task: AIGenerationTask = {
              id: crypto.randomUUID(),
              type: 'generateSeriesQuestionsInBatches',
              payload: { seriesId },
              seriesId: seriesId,
              statusText: `Queued: Generate all questions for series...`
            };
            dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            addToast('Task to generate all series questions has been queued.', 'info');
            openModal('aiStatus');
        }
    });
  }, [dispatch, addToast, openModal, openConfirmModal]);
  
  const onGenerateSeriesQuestionsInBatches = useCallback(async (seriesId: string) => {
    const { decks, deckSeries } = useStore.getState();
    const series = deckSeries.find(s => s.id === seriesId);
    if (!series) {
        addToast('Series not found for AI generation.', 'error');
        return;
    }

    const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
    const decksToProcess = decks.filter(
      (d): d is QuizDeck | LearningDeck =>
          seriesDeckIds.has(d.id) &&
          (d.type === DeckType.Quiz || d.type === DeckType.Learning) &&
          (d.questions?.length || 0) === 0
    );

    for (let i = 0; i < decksToProcess.length; i++) {
        const deck = decksToProcess[i];
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating for "${deck.name}" (${i + 1}/${decksToProcess.length})...`, seriesId, deckId: deck.id } });
        const count = (deck as any).suggestedQuestionCount || 15;
        
        const processData = async (newQuestionsData: Partial<Question>[]) => {
            const importedQuestions: ImportedQuestion[] = newQuestionsData.reduce((acc: ImportedQuestion[], q) => {
                if (q.questionText && q.options && q.correctAnswerId && q.detailedExplanation) {
                    const validQuestion: ImportedQuestion = {
                        questionType: 'multipleChoice',
                        questionText: q.questionText,
                        options: q.options,
                        correctAnswerId: q.correctAnswerId,
                        detailedExplanation: q.detailedExplanation,
                        tags: q.tags,
                    };
                    acc.push(validQuestion);
                } else {
                    addToast(`Warning: A question for "${deck.name}" was malformed by the AI and has been skipped.`, 'info');
                }
                return acc;
            }, []);
                
            const newQuestions = createQuestionsFromImport(importedQuestions);
            const updatedDeck = { ...deck, questions: [...(deck.questions || []), ...newQuestions] };
            await handleUpdateDeck(updatedDeck, { silent: true });
        };

        try {
            const newQuestionsData = await aiService.generateQuestionsForDeckWithAI(deck, count);
            await processData(newQuestionsData);
        } catch (error) {
            if (error instanceof aiService.AIJsonResponseError) {
                addToast(`AI response for "${deck.name}" was invalid. You can fix it to continue.`, 'error');
                const fixedData = await new Promise<any | null>((resolve) => {
                    openModal('aiResponseFix', {
                        badJson: error.rawResponse,
                        onRetry: (fixedJson: any) => resolve(fixedJson),
                        onCancel: () => resolve(null), 
                    });
                });
                
                if (fixedData) {
                    await processData(fixedData);
                } else {
                    addToast(`Skipped question generation for "${deck.name}".`, 'info');
                }
            } else {
                addToast(`Failed to generate questions for "${deck.name}": ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            }
        }
    }
    addToast(`Finished generating questions for series "${series.name}".`, 'success');
  }, [dispatch, handleUpdateDeck, addToast, openModal]);

  const onGenerateSeriesLearningContentInBatches = useCallback(async (seriesId: string) => {
    const { decks, deckSeries } = useStore.getState();
    const series = deckSeries.find(s => s.id === seriesId);
    if (!series) {
        addToast('Series not found for AI generation.', 'error');
        return;
    }

    const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
    const decksToProcess = decks.filter(d => seriesDeckIds.has(d.id) && d.type === DeckType.Learning && (d.infoCards?.length || 0) === 0);

    for (let i = 0; i < decksToProcess.length; i++) {
        const deck = decksToProcess[i] as LearningDeck;
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating for "${deck.name}" (${i + 1}/${decksToProcess.length})...`, seriesId, deckId: deck.id } });
        const count = (deck as any).suggestedQuestionCount || 5;
        
        const processData = async (content: any) => {
            const infoCard: InfoCard = {
                id: crypto.randomUUID(),
                content: content.infoCardContent,
                unlocksQuestionIds: (content.questions || []).map((_: any, idx: number) => `${deck.id}-q-${idx}`)
            };
            const importedQuestions: ImportedQuestion[] = (content.questions || []).reduce((acc: ImportedQuestion[], q: Partial<Question>) => {
              const { questionText, options, correctAnswerId, detailedExplanation, tags } = q;
              if (questionText && options && correctAnswerId && detailedExplanation) {
                const validQuestion: ImportedQuestion = {
                  questionType: 'multipleChoice' as const,
                  questionText,
                  options,
                  correctAnswerId,
                  detailedExplanation,
                  tags,
                };
                acc.push(validQuestion);
              } else {
                addToast(`Warning: A learning deck question for "${deck.name}" was malformed by the AI and skipped.`, 'info');
              }
              return acc;
            }, []);
            const questions = createQuestionsFromImport(importedQuestions).map((q, idx) => ({ ...q, id: `${deck.id}-q-${idx}`, infoCardIds: [infoCard.id] }));
            const updatedDeck = { ...deck, infoCards: [infoCard], questions };
            await handleUpdateDeck(updatedDeck, { silent: true });
        };
        
        try {
            const content = await aiService.generateLearningDeckWithAI({
                topic: deck.name,
                questionCount: count,
                generationType: 'deck-learning',
                understandingLevel: 'Auto',
                learningGoal: 'Auto',
                learningStyle: 'Auto',
                language: 'English',
                tone: 'Auto',
                comprehensiveness: 'Standard',
                isLearningMode: true,
            });
            await processData(content);
        } catch (error) {
             if (error instanceof aiService.AIJsonResponseError) {
                addToast(`AI response for "${deck.name}" was invalid. You can fix it to continue.`, 'error');
                const fixedData = await new Promise<any | null>((resolve) => {
                    openModal('aiResponseFix', {
                        badJson: error.rawResponse,
                        onRetry: (fixedJson: any) => resolve(fixedJson),
                        onCancel: () => resolve(null), 
                    });
                });
                if (fixedData) {
                    await processData(fixedData);
                } else {
                    addToast(`Skipped content generation for "${deck.name}".`, 'info');
                }
            } else {
                addToast(`Failed to generate content for "${deck.name}": ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            }
        }
    }
    addToast(`Finished generating content for series "${series.name}".`, 'success');
  }, [dispatch, handleUpdateDeck, addToast, openModal]);

  const handleRegenerateQuestion = useCallback(async (deck: QuizDeck | LearningDeck, questionToReplace: Question) => {
    try {
        const newQuestionData = await aiService.regenerateQuestionWithAI(deck, questionToReplace);
        const [importedQuestion] = createQuestionsFromImport([{ ...newQuestionData, questionType: 'multipleChoice' }]);
        const finalQuestion: Question = {
            ...questionToReplace, // Keep ID and SRS data
            ...importedQuestion,
            id: questionToReplace.id, // Ensure ID is preserved
        };

        const updatedQuestions = (deck.questions || []).map(q => q.id === finalQuestion.id ? finalQuestion : q);
        const updatedDeck = { ...deck, questions: updatedQuestions };
        await handleUpdateDeck(updatedDeck, { silent: true });
        addToast('Question regenerated.', 'success');
    } catch (error) {
        addToast(`Failed to regenerate question: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [handleUpdateDeck, addToast]);

  const handleExpandText = useCallback(async (topic: string, originalContent: string, selectedText: string): Promise<string | null> => {
    try {
        const result = await aiService.expandOnText(topic, originalContent, selectedText);
        return result;
    } catch (error) {
        addToast(`AI expansion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        return null;
    }
  }, [addToast]);


  const handleAiAddLevelsToSeries = useCallback(async (seriesId: string) => { addToast('AI feature not implemented yet.', 'info'); }, [addToast]);
  const handleAiAddDecksToLevel = useCallback(async (seriesId: string, levelIndex: number) => { addToast('AI feature not implemented yet.', 'info'); }, [addToast]);

  const handleExecuteAIAction = useCallback((action: AIAction) => {
      const { decks, folders, deckSeries } = useStore.getState();
      
      const performAction = async () => {
        try {
            switch (action.action) {
                case AIActionType.CREATE_DECK:
                    await handleAddDecks([{ id: crypto.randomUUID(), name: action.payload.name!, type: DeckType.Flashcard, cards: [], description: 'Created by AI Assistant' }]);
                    break;
                case AIActionType.RENAME_DECK:
                    const deckToRename = decks.find(d => d.id === action.payload.deckId);
                    if (deckToRename) await handleUpdateDeck({ ...deckToRename, name: action.payload.newName! });
                    break;
                case AIActionType.DELETE_DECK:
                    const deckToDelete = decks.find(d => d.id === action.payload.deckId);
                    if(deckToDelete) await handleUpdateDeck({...deckToDelete, deletedAt: new Date().toISOString()});
                    break;
                case AIActionType.CREATE_FOLDER:
                     dispatch({ type: 'ADD_FOLDER', payload: { id: crypto.randomUUID(), name: action.payload.name! } });
                    break;
                case AIActionType.RENAME_FOLDER:
                     const folderToRename = folders.find(f => f.id === action.payload.folderId);
                     if(folderToRename) dispatch({type: 'UPDATE_FOLDER', payload: {...folderToRename, name: action.payload.newName! }});
                    break;
                case AIActionType.DELETE_FOLDER:
                     const folderToDelete = folders.find(f => f.id === action.payload.folderId);
                     if(folderToDelete) dispatch({type: 'DELETE_FOLDER', payload: folderToDelete.id});
                    break;
                case AIActionType.MOVE_DECK_TO_FOLDER:
                    const deckToMove = decks.find(d => d.id === action.payload.deckId);
                    if (deckToMove) await handleUpdateDeck({ ...deckToMove, folderId: action.payload.folderId! });
                    break;
                case AIActionType.GENERATE_QUESTIONS_FOR_DECK:
                    const deckToGenerateFor = decks.find(d => d.id === action.payload.deckId);
                    if(deckToGenerateFor && (deckToGenerateFor.type === DeckType.Quiz || deckToGenerateFor.type === DeckType.Learning)) {
                        handleGenerateQuestionsForDeckTask(deckToGenerateFor as QuizDeck | LearningDeck, action.payload.count);
                    }
                    break;
            }
            addToast('AI action completed!', 'success');
        } catch (e) {
            addToast('AI action failed.', 'error');
        }
      };
      
      openConfirmModal({
        title: 'Confirm AI Action',
        message: action.confirmationMessage,
        onConfirm: performAction,
        confirmText: 'Confirm'
      });
  }, [openConfirmModal, handleAddDecks, handleUpdateDeck, addToast, dispatch, handleGenerateQuestionsForDeckTask]);
  
  const handleCancelAIGeneration = useCallback((taskId?: string) => {
    dispatch({ type: 'CANCEL_AI_TASK', payload: { taskId } });
    addToast('AI task cancelled.', 'info');
  }, [dispatch, addToast]);
  

  return useMemo(() => ({
    handleGenerateWithAI,
    onGenerateSeriesScaffold,
    onGenerateDeck,
    onGenerateLearningDeck,
    onGenerateQuestionsForDeck,
    onGenerateSeriesQuestionsInBatches,
    onGenerateSeriesLearningContentInBatches,
    handleAiAddLevelsToSeries,
    handleAiAddDecksToLevel,
    handleExecuteAIAction,
    handleCancelAIGeneration,
    handleGenerateQuestionsForDeck: handleGenerateQuestionsForDeckTask,
    handleGenerateContentForLearningDeck: (deck: LearningDeck) => handleGenerateQuestionsForDeckTask(deck),
    handleGenerateQuestionsForEmptyDecksInSeries,
    handleRegenerateQuestion,
    handleExpandText,
  }), [
    handleGenerateWithAI, onGenerateSeriesScaffold, onGenerateDeck, onGenerateLearningDeck,
    onGenerateQuestionsForDeck, onGenerateSeriesQuestionsInBatches, onGenerateSeriesLearningContentInBatches,
    handleAiAddLevelsToSeries, handleAiAddDecksToLevel, handleExecuteAIAction,
    handleCancelAIGeneration, handleGenerateQuestionsForDeckTask, handleGenerateQuestionsForEmptyDecksInSeries,
    handleRegenerateQuestion, handleExpandText
  ]);
};
