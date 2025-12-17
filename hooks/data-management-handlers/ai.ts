
import { useCallback } from 'react';
import { useStore } from '../../store/store';
import { useToast } from '../useToast';
import * as aiService from '../../services/aiService';
import { createQuestionsFromImport, createCardsFromImport } from '../../services/importService';
import { 
    Deck, DeckType, QuizDeck, FlashcardDeck, LearningDeck, 
    SeriesLevel, DeckSeries, AIAction, AIGenerationParams, AIGenerationTask, AIActionType, Card, Question
} from '../../types';

export const useAIHandlers = ({ 
    handleUpdateDeck, 
    handleAddDecks, 
    handleAddSeriesWithDecks, 
    handleUpdateSeries,
    openConfirmModal,
    openModal,
    closeModal
}: any) => {
    const { dispatch } = useStore();
    const { addToast } = useToast();

    const handleStartAIGeneration = useCallback((params: AIGenerationParams) => {
        // Do not call closeModal() here. It causes a race condition where the modal state 
        // might be cleared before the new one is set, or the UI flickers/closes unexpectedly.
        // openModal simply overwrites the current modal state.
        openModal('aiGenerationChat', { params });
    }, [openModal]);

    const handleCancelAIGeneration = useCallback((taskId?: string) => {
        dispatch({ type: 'CANCEL_AI_TASK', payload: { taskId } });
        addToast("Generation cancelled.", "info");
    }, [dispatch, addToast]);

    const handleExecuteAIAction = useCallback(async (action: AIAction) => {
        try {
            switch (action.action) {
                case AIActionType.CREATE_DECK:
                    await handleAddDecks([{
                        id: crypto.randomUUID(),
                        name: action.payload.name,
                        type: DeckType.Flashcard,
                        cards: [],
                        folderId: action.payload.folderId || null,
                        description: 'Created by AI'
                    } as FlashcardDeck]);
                    addToast(`Deck "${action.payload.name}" created.`, 'success');
                    break;
                // Add other action handlers as needed
                default:
                    console.log("Action not implemented yet:", action.action);
                    addToast("This action is not fully implemented yet.", "info");
            }
        } catch (e) {
            addToast(`Failed to execute action: ${(e as Error).message}`, 'error');
        }
    }, [handleAddDecks, addToast]);

    const handleOpenAIGenerationForDeck = useCallback((deck: Deck) => {
        openModal('aiGeneration', { 
            context: { 
                deckId: deck.id, 
                deckName: deck.name,
                deckType: deck.type 
            } 
        });
    }, [openModal]);

    const handleOpenAIGenerationForSeriesLevel = useCallback((seriesId: string, levelIndex: number) => {
        const series = useStore.getState().deckSeries[seriesId];
        openModal('aiGeneration', { 
            initialGenerationType: 'single-deck-quiz',
            context: { 
                seriesId, 
                seriesName: series?.name,
                seriesDescription: series?.description,
                levelIndex 
            } 
        });
    }, [openModal]);

    const handleOpenAIAutoExpandSeries = useCallback((seriesId: string) => {
        const series = useStore.getState().deckSeries[seriesId];
        openModal('aiGeneration', { 
            initialGenerationType: 'series-auto-fill',
            context: { 
                seriesId, 
                seriesName: series?.name,
                seriesDescription: series?.description 
            } 
        });
    }, [openModal]);

    const onGenerateFullSeriesFromScaffold = useCallback(async (payload: { outline: string, generationType: string }, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Structuring series...' } });
        
        const { outline, generationType } = payload;
        
        let targetDeckType = DeckType.Quiz;
        if (generationType && (generationType.includes('flashcard') || generationType.includes('vocab'))) {
            targetDeckType = DeckType.Flashcard;
        } else if (generationType && (generationType.includes('course') || generationType.includes('learning'))) {
            targetDeckType = DeckType.Learning;
        }

        const scaffoldData = await aiService.generateScaffoldFromOutline(outline, targetDeckType);
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        const { seriesName, seriesDescription, levels: levelsData } = scaffoldData;
        const allNewDecks: Deck[] = [];
        const newLevels: SeriesLevel[] = (levelsData || []).map((levelData: any) => {
            const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck | null => {
                if (d.type === 'quiz' || (!d.type && targetDeckType === DeckType.Quiz)) {
                    const newQuizDeck: QuizDeck = {
                        id: crypto.randomUUID(), name: d.name, description: d.description,
                        type: DeckType.Quiz, questions: createQuestionsFromImport(d.questions || [])
                    };
                    return newQuizDeck;
                } else if (d.type === 'flashcard' || (!d.type && targetDeckType === DeckType.Flashcard)) {
                    const newFlashcardDeck: FlashcardDeck = {
                        id: crypto.randomUUID(), name: d.name, description: d.description,
                        type: DeckType.Flashcard, cards: createCardsFromImport(d.cards || [])
                    };
                    return newFlashcardDeck;
                } else if (d.type === 'learning' || (!d.type && targetDeckType === DeckType.Learning)) {
                    const newLearningDeck: LearningDeck = {
                        id: crypto.randomUUID(), name: d.name, description: d.description,
                        type: DeckType.Learning, questions: [], infoCards: []
                    };
                    return newLearningDeck;
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
        await handleAddSeriesWithDecks(newSeries, allNewDecks);
        addToast(`Series "${newSeries.name}" generated!`, 'success');
    }, [dispatch, addToast, handleAddSeriesWithDecks]);

    // --- New Handlers ---

    const handleGenerateAudioForCard = useCallback(async (deckId: string, card: Card, side: 'front' | 'back') => {
        try {
            const text = side === 'front' ? card.front : card.back;
            const cleanText = text.replace(/<[^>]+>/g, '').trim();
            if (!cleanText) return;

            addToast('Generating audio...', 'info');
            const audioData = await aiService.generateSpeech(cleanText);
            
            const currentDeck = useStore.getState().decks[deckId];
            if (currentDeck && currentDeck.type === DeckType.Flashcard) {
                const flashcardDeck = currentDeck as FlashcardDeck;
                const updatedCards = (flashcardDeck.cards || []).map(c => {
                    if (c.id === card.id) {
                        return { 
                            ...c, 
                            [side === 'front' ? 'frontAudio' : 'backAudio']: audioData 
                        };
                    }
                    return c;
                });
                await handleUpdateDeck({ ...flashcardDeck, cards: updatedCards }, { silent: true });
                return audioData;
            }
        } catch (e) {
            addToast(`Audio generation failed: ${(e as Error).message}`, 'error');
        }
    }, [handleUpdateDeck, addToast]);

    const handleSuggestDeckIcon = useCallback(async (deck: Deck) => {
        try {
            addToast('Analyzing deck for icon...', 'info');
            const icon = await aiService.suggestDeckIcon(deck.name, deck.description);
            await handleUpdateDeck({ ...deck, icon });
            addToast('Icon updated!', 'success');
        } catch (e) {
            addToast('Failed to suggest icon.', 'error');
        }
    }, [handleUpdateDeck, addToast]);

    const handleOpenDeckAnalysis = useCallback((deck: Deck) => {
        openModal('deckAnalysis', { deck });
    }, [openModal]);

    const handleAutoTagQuestions = useCallback(async (deck: QuizDeck) => {
        try {
            addToast('Generating tags...', 'info');
            const questionsToTag = deck.questions.map(q => ({ id: q.id, text: q.questionText }));
            const tagsMap = await aiService.generateTagsForQuestions(questionsToTag);
            
            const updatedQuestions = deck.questions.map(q => {
                if (tagsMap[q.id]) {
                    const newTags = Array.from(new Set([...(q.tags || []), ...tagsMap[q.id]]));
                    return { ...q, tags: newTags };
                }
                return q;
            });
            
            await handleUpdateDeck({ ...deck, questions: updatedQuestions });
            addToast('Questions tagged!', 'success');
        } catch (e) {
            addToast(`Tagging failed: ${(e as Error).message}`, 'error');
        }
    }, [handleUpdateDeck, addToast]);

    const handleGenerateCardExamples = useCallback(async (front: string, back: string, context?: string) => {
        return await aiService.generateConcreteExamples(front, back, context);
    }, []);

    const handleHardenDistractors = useCallback(async (question: Question, context?: string) => {
        const currentDistractors = question.options.filter(o => o.id !== question.correctAnswerId).map(o => o.text);
        const correctAnswer = question.options.find(o => o.id === question.correctAnswerId)?.text || '';
        const newDistractors = await aiService.hardenDistractors(question.questionText, correctAnswer, currentDistractors, context);
        
        const correctAnswerObj = question.options.find(o => o.id === question.correctAnswerId);
        if (!correctAnswerObj) throw new Error("Correct answer not found in options");

        return [
            correctAnswerObj,
            ...newDistractors.map(d => ({ id: crypto.randomUUID(), text: d.text, explanation: d.explanation }))
        ].sort(() => Math.random() - 0.5);
    }, []);

    const handleAiAddLevelsToSeries = useCallback(async (seriesId: string) => {
        const series = useStore.getState().deckSeries[seriesId];
        if (!series) return;
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'autoPopulateSeries', // Using this type as it fits expansion
            payload: { seriesId },
            statusText: `Expanding series "${series.name}"...`,
            seriesId
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Series expansion added to queue.', 'info');
    }, [dispatch, addToast]);

    const handleAiAddDecksToLevel = useCallback(async (seriesId: string, levelIndex: number) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'autoPopulateLevel',
            payload: { seriesId, levelIndex },
            statusText: `Adding decks to level ${levelIndex + 1}...`,
            seriesId
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Level population added to queue.', 'info');
    }, [dispatch, addToast]);

    const handleGenerateQuestionsForDeck = useCallback((deck: QuizDeck) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'generateQuestionsForDeck',
            payload: { deck, count: 5 },
            statusText: `Generating questions for "${deck.name}"...`,
            deckId: deck.id
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Question generation added to queue.', 'info');
    }, [dispatch, addToast]);

    const handleGenerateContentForLearningDeck = useCallback((deck: LearningDeck) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'generateSeriesLearningContentInBatches',
            payload: { deck },
            statusText: `Generating content for "${deck.name}"...`,
            deckId: deck.id
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Content generation added to queue.', 'info');
    }, [dispatch, addToast]);

    const handleGenerateQuestionsForEmptyDecksInSeries = useCallback((seriesId: string) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'generateSeriesQuestionsInBatches',
            payload: { seriesId },
            statusText: 'Generating questions for empty decks...',
            seriesId
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Batch generation added to queue.', 'info');
    }, [dispatch, addToast]);

    const handleRegenerateQuestion = useCallback(async (deck: QuizDeck | LearningDeck, question: Question) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'regenerateQuestion',
            payload: { deckId: deck.id, questionId: question.id },
            statusText: 'Regenerating question...',
            deckId: deck.id
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
    }, [dispatch]);

    const handleExpandText = useCallback(async (topic: string, originalContent: string, selectedText: string) => {
        return await aiService.expandText(topic, originalContent, selectedText);
    }, []);

    // --- Task Processors ---

    const onAutoPopulateSeries = useCallback(async (payload: { seriesId: string }, abortSignal: AbortSignal) => {
        const { seriesId } = payload;
        const series = useStore.getState().deckSeries[seriesId];
        if (!series) return;

        let currentSeries = series;
        if ((series.levels || []).length === 0) {
             dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Designing series structure...' } });
             const structure = await aiService.generateSeriesStructure(series.name, series.description);
             if (abortSignal.aborted) return;
             
             const allNewDecks: Deck[] = [];
             const newLevels: SeriesLevel[] = (structure.levels || []).map((levelData: any) => {
                const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck => ({
                    id: crypto.randomUUID(), name: d.name, description: d.description,
                    type: DeckType.Quiz, questions: []
                }));
                allNewDecks.push(...decksForLevel);
                return { title: levelData.title, deckIds: decksForLevel.map(d => d.id) };
             });
             
             currentSeries = { ...series, levels: newLevels };
             await handleAddSeriesWithDecks(currentSeries, allNewDecks);
        }

        if (series.levels.length > 0) {
             dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Expanding series with new levels...' } });
             const currentStructureStr = series.levels.map(l => `${l.title}: ${(l.deckIds||[]).length} decks`).join('\n');
             const newStructure = await aiService.generateSeriesStructure(series.name, series.description, currentStructureStr);
             if (abortSignal.aborted) return;

             if (newStructure.levels && newStructure.levels.length > 0) {
                 const allNewDecks: Deck[] = [];
                 const addedLevels: SeriesLevel[] = (newStructure.levels || []).map((levelData: any) => {
                    const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck => ({
                        id: crypto.randomUUID(), name: d.name, description: d.description,
                        type: DeckType.Quiz, questions: []
                    }));
                    allNewDecks.push(...decksForLevel);
                    return { title: levelData.title, deckIds: decksForLevel.map(d => d.id) };
                 });
                 
                 const updatedSeries = { ...currentSeries, levels: [...currentSeries.levels, ...addedLevels] };
                 await handleAddSeriesWithDecks(updatedSeries, allNewDecks);
             }
        }
    }, [dispatch, handleAddSeriesWithDecks]);

    const onAutoPopulateLevel = useCallback(async (payload: { seriesId: string, levelIndex: number }, abortSignal: AbortSignal) => {
        const { seriesId, levelIndex } = payload;
        const series = useStore.getState().deckSeries[seriesId];
        if (!series || !series.levels[levelIndex]) return;
        
        const level = series.levels[levelIndex];
        const currentDeckNames = level.deckIds.map(id => useStore.getState().decks[id]?.name).filter(Boolean);
        
        const newDecksData = await aiService.generateLevelDecks(series.name, series.description, level.title, currentDeckNames);
        if (abortSignal.aborted) return;

        const newDecks: Deck[] = newDecksData.map((d: any) => ({
            id: crypto.randomUUID(), name: d.name, description: d.description,
            type: DeckType.Quiz, questions: []
        }));
        
        await handleAddDecks(newDecks);
        
        const updatedSeries = {
            ...series,
            levels: series.levels.map((l, i) => i === levelIndex ? { ...l, deckIds: [...l.deckIds, ...newDecks.map(d => d.id)] } : l)
        };
        await handleUpdateSeries(updatedSeries, { silent: true });
    }, [handleAddDecks, handleUpdateSeries]);

    const onGenerateQuestionsForDeck = useCallback(async (deck: QuizDeck, count: number, seriesContext: any, abortSignal: AbortSignal) => {
        const questions = await aiService.generateQuestionsForDeck(deck, count || 5, seriesContext);
        if (abortSignal.aborted) return;
        const newQuestions = createQuestionsFromImport(questions);
        const updatedDeck = { ...deck, questions: [...(deck.questions || []), ...newQuestions] };
        await handleUpdateDeck(updatedDeck, { silent: true });
    }, [handleUpdateDeck]);

    const onGenerateLearningContentForDeck = useCallback(async (payload: { deck: LearningDeck }, abortSignal: AbortSignal) => {
        const { deck } = payload;
        const { infoCards, questions } = await aiService.generateLearningDeckContent(deck.name, deck.description);
        if (abortSignal.aborted) return;
        
        const today = new Date().toISOString();
        const finalInfoCards = infoCards.map((ic: any) => ({
            ...ic,
            unlocksQuestionIds: ic.unlocksQuestionIds || [] 
        }));
        
        const finalQuestions = questions.map((q: any) => ({
            ...q,
            id: q.id || crypto.randomUUID(),
            questionType: 'multipleChoice',
            dueDate: today, interval: 0, easeFactor: 2.5, lapses: 0, masteryLevel: 0, suspended: false,
            options: q.options.map((o: any) => ({ ...o, id: crypto.randomUUID() }))
        }));

        finalQuestions.forEach((q: any) => {
            (q.infoCardIds || []).forEach((icId: string) => {
                const ic = finalInfoCards.find((c: any) => c.id === icId);
                if (ic) {
                    ic.unlocksQuestionIds = Array.from(new Set([...(ic.unlocksQuestionIds || []), q.id]));
                }
            });
        });

        const updatedDeck = { ...deck, infoCards: [...(deck.infoCards||[]), ...finalInfoCards], questions: [...(deck.questions||[]), ...finalQuestions] };
        await handleUpdateDeck(updatedDeck, { silent: true });
    }, [handleUpdateDeck]);

    const onGenerateSeriesQuestionsInBatches = useCallback(async (payload: { seriesId: string }, abortSignal: AbortSignal) => {
        const { seriesId } = payload;
        const series = useStore.getState().deckSeries[seriesId];
        if (!series) return;
        
        const deckIds = (series.levels || []).flatMap(l => l.deckIds);
        const decks = useStore.getState().decks;
        
        for (const deckId of deckIds) {
            if (abortSignal.aborted) return;
            const deck = decks[deckId];
            if (deck && deck.type === DeckType.Quiz && (deck as QuizDeck).questions.length === 0) {
                dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating questions for "${deck.name}"...` } });
                await onGenerateQuestionsForDeck(deck as QuizDeck, 5, { name: series.name, description: series.description }, abortSignal);
            }
        }
    }, [onGenerateQuestionsForDeck, dispatch]);

    const onRegenerateQuestion = useCallback(async (payload: { deckId: string, questionId: string }, abortSignal: AbortSignal) => {
        const { deckId, questionId } = payload;
        const deck = useStore.getState().decks[deckId];
        if (!deck) return;
        
        const questions = (deck as QuizDeck | LearningDeck).questions;
        const question = questions.find(q => q.id === questionId);
        if (!question) return;

        const updatedQuestionData = await aiService.regenerateQuestionWithAI(question, deck.name);
        if (abortSignal.aborted) return;

        const updatedQuestion = { ...question, ...updatedQuestionData };
        const updatedDeck = {
            ...deck,
            questions: questions.map(q => q.id === questionId ? updatedQuestion : q)
        };
        await handleUpdateDeck(updatedDeck, { silent: true });
    }, [handleUpdateDeck]);

    const onGenerateDeckFromOutline = useCallback(async (outline: string, metadata: any, seriesId: string | undefined, levelIndex: number | undefined, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating deck content...' } });
        
        const deckData = await aiService.generateDeckFromOutline(outline, metadata);
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        const newDeck: QuizDeck = {
            id: crypto.randomUUID(),
            name: deckData.name,
            description: deckData.description,
            type: DeckType.Quiz,
            questions: createQuestionsFromImport(deckData.questions || [])
        };

        await handleAddDecks([newDeck]);

        if (seriesId && levelIndex !== undefined) {
            const series = useStore.getState().deckSeries[seriesId];
            if (series && series.levels[levelIndex]) {
                const updatedSeries = {
                    ...series,
                    levels: series.levels.map((l, i) => i === levelIndex ? { ...l, deckIds: [...l.deckIds, newDeck.id] } : l)
                };
                await handleUpdateSeries(updatedSeries, { silent: true });
            }
        }
        
        addToast(`Deck "${newDeck.name}" generated!`, 'success');
    }, [dispatch, handleAddDecks, handleUpdateSeries, addToast]);

    const onGenerateFlashcardDeck = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
         dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating flashcards...' } });
         
         const { persona: personaId } = payload;
         
         const storedOptions = localStorage.getItem('cogniflow-ai-options');
         let personas = [];
         if (storedOptions) {
             personas = JSON.parse(storedOptions).personas || [];
         }
         const selectedPersona = personas.find((p: any) => p.id === personaId) || { name: 'Assistant', instruction: 'You are a helpful assistant.' };

         const deckData = await aiService.generateFlashcardDeckWithAI(payload, selectedPersona);
         
         if (abortSignal.aborted) throw new Error("Cancelled by user");

         const newDeck: FlashcardDeck = {
             id: crypto.randomUUID(),
             name: deckData.name,
             description: deckData.description,
             type: DeckType.Flashcard,
             cards: createCardsFromImport(deckData.cards || [])
         };

         await handleAddDecks([newDeck]);
         addToast(`Deck "${newDeck.name}" generated!`, 'success');
    }, [dispatch, handleAddDecks, addToast]);

    const onGenerateLearningDeckWithAI = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating learning content...' } });
        const isCourse = payload.generationType === 'deck-course';
        const { infoCards, questions } = await aiService.generateLearningDeckContent(payload.topic, undefined, isCourse);
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        const newDeck: LearningDeck = {
            id: crypto.randomUUID(),
            name: payload.topic,
            description: `Generated ${isCourse ? 'course' : 'learning guide'} on ${payload.topic}`,
            type: DeckType.Learning,
            infoCards: infoCards.map(ic => ({ ...ic, unlocksQuestionIds: ic.unlocksQuestionIds || [] })),
            questions: createQuestionsFromImport(questions)
        };
        
        await handleAddDecks([newDeck]);
        addToast(`Learning Deck generated!`, 'success');
    }, [dispatch, handleAddDecks, addToast]);

    return {
        handleStartAIGeneration,
        handleCancelAIGeneration,
        handleExecuteAIAction,
        handleOpenAIGenerationForDeck,
        handleOpenAIGenerationForSeriesLevel,
        handleOpenAIAutoExpandSeries,
        
        handleGenerateAudioForCard,
        handleSuggestDeckIcon,
        handleOpenDeckAnalysis,
        handleAutoTagQuestions,
        handleGenerateCardExamples,
        handleHardenDistractors,
        handleAiAddLevelsToSeries,
        handleAiAddDecksToLevel,
        handleGenerateQuestionsForDeck,
        handleGenerateContentForLearningDeck,
        handleGenerateQuestionsForEmptyDecksInSeries,
        handleRegenerateQuestion,
        handleExpandText,

        onAutoPopulateSeries,
        onAutoPopulateLevel,
        onGenerateQuestionsForDeck,
        onGenerateLearningContentForDeck,
        onGenerateSeriesQuestionsInBatches,
        onRegenerateQuestion,
        onGenerateFullSeriesFromScaffold,
        onGenerateDeckFromOutline,
        onGenerateFlashcardDeck,
        onGenerateLearningDeckWithAI,
    };
};
