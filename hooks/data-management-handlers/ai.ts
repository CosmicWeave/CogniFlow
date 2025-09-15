import { useCallback, useMemo } from 'react';
import { AIGenerationParams, DeckType, QuizDeck, LearningDeck, DeckSeries, ImportedQuestion, InfoCard, Question, GenerativePart } from '../../types';
import * as aiService from '../../services/aiService';
// FIX: Imported 'AIGenerationTask' to resolve typing errors.
import { useStore, AIGenerationTask } from '../../store/store';
import { createQuestionsFromImport } from '../../services/importService';
import { useToast } from '../useToast';

const filesToGenerativeParts = async (files: File[]): Promise<GenerativePart[]> => {
    const parts: GenerativePart[] = [];
    for (const file of files) {
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
        parts.push({
            inlineData: {
                mimeType: file.type,
                data: base64,
            },
        });
    }
    return parts;
};

export const useAIHandlers = ({ deckAndFolderHandlers, seriesHandlers }: any) => {
  const { dispatch } = useStore();
  const { addToast } = useToast();
  const { handleAddDecks, handleUpdateDeck } = deckAndFolderHandlers;
  const { handleAddSeriesWithDecks } = seriesHandlers;

  const onGenerateSeriesScaffold = useCallback(async (payload: { params: AIGenerationParams, generateQuestions?: boolean, isLearningMode?: boolean }) => {
    const { params, generateQuestions, isLearningMode } = payload;
    const { seriesName, seriesDescription, levels } = await aiService.generateSeriesScaffoldWithAI(params);
    const allNewDecks: (QuizDeck | LearningDeck)[] = [];
    const newLevels = levels.map(levelData => {
        // FIX: Refactored to help TypeScript correctly infer the discriminated union type.
        const decksForLevel = levelData.decks.map((d): QuizDeck | LearningDeck => {
            const baseDeck = {
                id: crypto.randomUUID(),
                name: d.name,
                description: d.description,
                questions: [],
                suggestedQuestionCount: d.suggestedQuestionCount,
                aiGenerationParams: params,
            };
            if (isLearningMode) {
                return {
                    ...baseDeck,
                    type: DeckType.Learning,
                    infoCards: [],
                };
            } else {
                return {
                    ...baseDeck,
                    type: DeckType.Quiz,
                };
            }
        });
        allNewDecks.push(...decksForLevel);
        return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
    });
    const newSeries: DeckSeries = {
        id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription,
        levels: newLevels, archived: false, createdAt: new Date().toISOString(), aiGenerationParams: params,
    };
    await handleAddSeriesWithDecks(newSeries, allNewDecks);

    if (generateQuestions) {
        const taskType = isLearningMode ? 'generateSeriesLearningContentInBatches' : 'generateSeriesQuestionsInBatches';
        const taskId = crypto.randomUUID();
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: {
            id: taskId,
            type: taskType,
            payload: { seriesId: newSeries.id },
            statusText: `Queueing content generation for '${newSeries.name}'...`,
            seriesId: newSeries.id
        }});
    }
  }, [handleAddSeriesWithDecks, dispatch]);

  const onGenerateSeriesQuestionsInBatches = useCallback(async (seriesId: string) => {
    const onProgress = ({ deckId, questions }: { deckId: string; questions: ImportedQuestion[] }) => {
        const { decks } = useStore.getState();
        const deck = decks.find(d => d.id === deckId) as QuizDeck;
        if (deck) {
            const newQuestions = createQuestionsFromImport(questions);
            const currentQuestions = deck.questions || [];
            const updatedDeck = { ...deck, questions: [...currentQuestions, ...newQuestions] };
            handleUpdateDeck(updatedDeck, { silent: true });
            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { 
                statusText: `Generated ${currentQuestions.length + newQuestions.length} / ${deck.suggestedQuestionCount || '?'} questions for '${deck.name}'...`
            }});
        }
    };
    await aiService.generateSeriesQuestionsInBatches(seriesId, onProgress);
  }, [handleUpdateDeck, dispatch]);

  const onGenerateSeriesLearningContentInBatches = useCallback(async (seriesId: string) => {
    const onProgress = ({ deckId, newInfoCards, newQuestions }: { deckId: string; newInfoCards: InfoCard[], newQuestions: Question[] }) => {
        const { decks } = useStore.getState();
        const deck = decks.find(d => d.id === deckId) as LearningDeck;
        if (deck) {
            const updatedDeck = { 
                ...deck, 
                infoCards: [...(deck.infoCards || []), ...newInfoCards],
                questions: [...(deck.questions || []), ...newQuestions],
            };
            handleUpdateDeck(updatedDeck, { silent: true });
             dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { 
                statusText: `Generated ${updatedDeck.infoCards.length} learning blocks for '${deck.name}'...`
            }});
        }
    };
    await aiService.generateSeriesLearningContentInBatches(seriesId, onProgress);
  }, [handleUpdateDeck, dispatch]);
  
  const onGenerateQuestionsForDeck = useCallback(async (deck: QuizDeck, count: number) => {
      const { questions } = await aiService.generateQuestionsForDeck(deck, count);
      const newQuestions = createQuestionsFromImport(questions);
      const currentQuestions = deck.questions || [];
      const updatedDeck = { ...deck, questions: [...currentQuestions, ...newQuestions] };
      await handleUpdateDeck(updatedDeck, { toastMessage: `Added ${newQuestions.length} new questions to "${deck.name}".` });
  }, [handleUpdateDeck]);
  
  const onGenerateDeck = useCallback(async (payload: { params: AIGenerationParams }) => {
    const { params } = payload;
    const newDeck: QuizDeck = {
        id: crypto.randomUUID(),
        name: params.topic,
        description: `An AI-generated quiz deck about ${params.topic}.`,
        type: DeckType.Quiz,
        questions: [],
        aiGenerationParams: params,
        suggestedQuestionCount: params.comprehensiveness === 'Standard' ? 25 : (params.comprehensiveness === 'Quick Overview' ? 10 : 40),
    };
    await handleAddDecks([newDeck]);

    dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { 
        statusText: `Generating questions for '${newDeck.name}'...`,
        deckId: newDeck.id
    }});
    
    await onGenerateQuestionsForDeck(newDeck, newDeck.suggestedQuestionCount || 10);
  }, [handleAddDecks, dispatch, onGenerateQuestionsForDeck]);
  
  const onGenerateLearningDeck = useCallback(async (payload: { deck?: LearningDeck, params: AIGenerationParams }) => {
    const { deck: existingDeck, params } = payload;
    
    const deckToProcess = existingDeck || {
        id: crypto.randomUUID(),
        name: params.topic,
        description: `An AI-generated learning deck about ${params.topic}.`,
        type: DeckType.Learning,
        infoCards: [],
        questions: [],
        aiGenerationParams: params,
        suggestedQuestionCount: params.comprehensiveness === 'Comprehensive' ? 20 : 10,
    } as LearningDeck;

    if (!existingDeck) {
        await handleAddDecks([deckToProcess]);
    }

    dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { 
        statusText: `Generating content for '${deckToProcess.name}'...`,
        deckId: deckToProcess.id
    }});
    
    const { newInfoCards, newQuestions } = await aiService.generateContentForLearningDeck(deckToProcess, params);

    const updatedDeck = { 
        ...deckToProcess, 
        infoCards: [...(deckToProcess.infoCards || []), ...newInfoCards],
        questions: [...(deckToProcess.questions || []), ...newQuestions],
    };

    await handleUpdateDeck(updatedDeck, { toastMessage: `Generated ${newInfoCards.length} learning blocks for "${deckToProcess.name}".` });
  }, [handleUpdateDeck, handleAddDecks, dispatch]);

  const handleGenerateWithAI = useCallback(async (config: AIGenerationParams & { 
    generationType: 'series' | 'deck', 
    isLearningMode: boolean,
    generateQuestions?: boolean,
    sourceFiles?: File[],
    useStrictSources?: boolean
  }) => {
    const taskId = crypto.randomUUID();
    const { generationType, isLearningMode, generateQuestions, sourceFiles, useStrictSources, ...aiParams } = config;
    
    let taskType: AIGenerationTask['type'];
    let statusText: string;
    let taskPayload: any;
    
    const sourceParts = sourceFiles ? await filesToGenerativeParts(sourceFiles) : undefined;
    const finalParams: AIGenerationParams = { ...aiParams, sourceParts, useStrictSources };

    console.log('[AI Handler] Creating new AI task with params:', finalParams);

    if (generationType === 'series') {
        taskType = 'generateSeriesScaffoldWithAI';
        taskPayload = { params: finalParams, generateQuestions, isLearningMode };
        statusText = `Initializing AI generation for '${aiParams.topic}' ${isLearningMode ? 'learning ' : ''}series...`;
    } else { // 'deck'
        taskType = isLearningMode ? 'generateLearningDeckWithAI' : 'generateDeckWithAI';
        taskPayload = { params: finalParams };
        statusText = `Initializing AI generation for '${aiParams.topic}' ${isLearningMode ? 'learning ' : ''}deck...`;
    }

    dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: { id: taskId, type: taskType, payload: taskPayload, statusText } });
    addToast('AI generation task has been added to the queue.', 'info');
  }, [dispatch, addToast]);

  const handleGenerateQuestionsForDeck = useCallback((deck: QuizDeck) => {
    const taskId = crypto.randomUUID();
    // FIX: Explicitly typed the 'task' object to ensure it conforms to the AIGenerationTask interface.
    const task: AIGenerationTask = {
        id: taskId,
        type: 'generateQuestionsForDeck',
        payload: { deck, count: deck.suggestedQuestionCount || 10 },
        statusText: `Generating questions for '${deck.name}'...`,
        deckId: deck.id
    };
    dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
    addToast(`AI is now generating questions for "${deck.name}".`, 'info');
  }, [dispatch, addToast]);

  const handleGenerateContentForLearningDeck = useCallback((deck: LearningDeck) => {
    const taskId = crypto.randomUUID();
    // FIX: Explicitly typed the 'task' object to ensure it conforms to the AIGenerationTask interface.
    const task: AIGenerationTask = {
        id: taskId,
        type: 'generateLearningDeckWithAI',
        payload: { deck, params: deck.aiGenerationParams || { topic: deck.name } },
        statusText: `Generating content for '${deck.name}'...`,
        deckId: deck.id
    };
    dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
    addToast(`AI is now generating content for "${deck.name}".`, 'info');
  }, [dispatch, addToast]);
  
  const handleGenerateQuestionsForEmptyDecksInSeries = useCallback((seriesId: string) => {
    const series = useStore.getState().deckSeries.find(s => s.id === seriesId);
    if (!series) {
        addToast("Series not found.", "error");
        return;
    }
    const taskId = crypto.randomUUID();
    dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: {
        id: taskId,
        type: 'generateSeriesQuestionsInBatches',
        payload: { seriesId },
        statusText: `Queueing question generation for '${series.name}'...`,
        seriesId: seriesId
    }});
    addToast('AI task to generate questions has been queued.', 'info');
  }, [dispatch, addToast]);

  const handleAiAddLevelsToSeries = useCallback(async (seriesId: string) => {
    addToast('This feature is coming soon!', 'info');
  }, [addToast]);
  
  const handleAiAddDecksToLevel = useCallback(async (seriesId: string, levelIndex: number) => {
    addToast('This feature is coming soon!', 'info');
  }, [addToast]);

  const handleCancelAIGeneration = useCallback((taskId?: string) => {
    dispatch({ type: 'CANCEL_AI_TASK', payload: { taskId }});
    if (taskId) {
        addToast('Task removed from queue.', 'info');
    } else {
        addToast('Cancelling current AI task.', 'info');
    }
  }, [dispatch, addToast]);
  
  const handleExecuteAIAction = useCallback((action: any) => {
      addToast(`Action: ${action.confirmationMessage}`, 'info');
      // Placeholder for future implementation
  }, [addToast]);

  return useMemo(() => ({
    handleGenerateWithAI,
    handleGenerateQuestionsForDeck,
    handleGenerateContentForLearningDeck,
    handleGenerateQuestionsForEmptyDecksInSeries,
    handleAiAddLevelsToSeries,
    handleAiAddDecksToLevel,
    handleCancelAIGeneration,
    handleExecuteAIAction,
    onGenerateSeriesScaffold,
    onGenerateSeriesQuestionsInBatches,
    onGenerateSeriesLearningContentInBatches,
    onGenerateDeck,
    onGenerateLearningDeck,
    onGenerateQuestionsForDeck,
  }), [
    handleGenerateWithAI, handleGenerateQuestionsForDeck, handleGenerateContentForLearningDeck,
    handleGenerateQuestionsForEmptyDecksInSeries, handleAiAddLevelsToSeries, handleAiAddDecksToLevel,
    handleCancelAIGeneration, handleExecuteAIAction, onGenerateSeriesScaffold, onGenerateSeriesQuestionsInBatches,
    onGenerateSeriesLearningContentInBatches, onGenerateDeck, onGenerateLearningDeck, onGenerateQuestionsForDeck
  ]);
};
