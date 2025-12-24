
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
    handleBulkUpdateDecks,
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
        openModal('aiGenerationChat', { params });
    }, [openModal]);

    const handleImmediateAIGeneration = useCallback((params: AIGenerationParams) => {
        const taskId = crypto.randomUUID();
        const { generationType } = params;
        
        let task: AIGenerationTask;
        
        if (generationType.startsWith('series-')) {
            task = {
                id: taskId,
                type: 'autoPopulateSeries', // Skip outline and designed structure for immediate full generation if simple, or start auto-fill
                payload: { topic: params.topic, comprehensiveness: params.comprehensiveness },
                statusText: `Generating series structure for "${params.topic}"`,
            };
        } else if (['deck-flashcard', 'deck-vocab', 'deck-atomic'].includes(generationType)) {
             task = {
                id: taskId,
                type: 'generateFlashcardDeckWithAI',
                payload: params,
                statusText: `Generating flashcards for "${params.topic}"`,
            };
        } else if (['single-deck-learning', 'deck-course'].includes(generationType)) {
             task = {
                id: taskId,
                type: 'generateLearningDeckWithAI',
                payload: params,
                statusText: `Generating course content for "${params.topic}"`,
            };
        } else if (generationType === 'rework-deck') {
            task = {
                id: taskId,
                type: 'rework-deck',
                payload: params,
                statusText: `Reworking "${params.topic}"`,
            };
        } else {
            // Standard Quiz
            task = {
                id: taskId,
                type: 'generateDeckFromOutline', // Reusing logic but passing topic as "outline" for immediate mode fallback
                payload: { 
                    immediate: true,
                    topic: params.topic,
                    understanding: params.understanding,
                    count: params.count
                },
                statusText: `Generating quiz for "${params.topic}"`,
            };
        }
        
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Task added to queue.', 'info');
    }, [dispatch, addToast]);

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
                case AIActionType.UPGRADE_TO_LEARNING:
                    const deck = useStore.getState().decks[action.payload.deckId];
                    if (deck) handleUpgradeDeckToLearning(deck);
                    break;
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
                deckType: deck.type,
                mode: 'expand'
            } 
        });
    }, [openModal]);

    const handleOpenAIReworkForDeck = useCallback((deck: Deck) => {
        openModal('aiGeneration', { 
            context: { 
                deckId: deck.id, 
                deckName: deck.name,
                deckType: deck.type,
                mode: 'rework'
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

    const handleUpgradeDeckToLearning = useCallback((deck: Deck) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'upgradeDeckToLearning',
            payload: { deckId: deck.id },
            statusText: `Transforming "${deck.name}" into a course...`,
            deckId: deck.id
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Curriculum generation added to queue.', 'info');
    }, [dispatch, addToast]);

    const handleHardenAllDistractors = useCallback((deck: QuizDeck | LearningDeck) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'hardenAllDistractors',
            payload: { deckId: deck.id },
            statusText: `Hardening distractors in "${deck.name}"...`,
            deckId: deck.id
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Batch distractor hardening added to queue.', 'info');
    }, [dispatch, addToast]);

    const handleGenerateAudioForAllCards = useCallback((deck: FlashcardDeck) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'generateAudioForAllCards',
            payload: { deckId: deck.id },
            statusText: `Generating audio for "${deck.name}"...`,
            deckId: deck.id
        };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Batch audio generation added to queue.', 'info');
    }, [dispatch, addToast]);

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
                        type: DeckType.Learning, questions: [], infoCards: [],
                        learningMode: 'separate'
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

    const handleAutoTagQuestions = useCallback(async (deck: QuizDeck | LearningDeck) => {
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

    const handleHardenDistractorsForQuestion = useCallback(async (question: Question, context?: string) => {
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
            type: 'autoPopulateSeries', 
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

    const handleGenerateQuestionsForDeck = useCallback((deck: QuizDeck, count: number = 5) => {
        const task: AIGenerationTask = {
            id: crypto.randomUUID(),
            type: 'generateQuestionsForDeck',
            payload: { deck, count },
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

    const onHardenAllDistractors = useCallback(async (payload: { deckId: string }, abortSignal: AbortSignal) => {
        const deck = useStore.getState().decks[payload.deckId];
        if (!deck || (deck.type !== DeckType.Quiz && deck.type !== DeckType.Learning)) return;
        
        const quizDeck = deck as QuizDeck | LearningDeck;
        const total = quizDeck.questions.length;
        const updatedQuestions = [...quizDeck.questions];

        for (let i = 0; i < total; i++) {
            if (abortSignal.aborted) throw new Error("Cancelled by user");
            const q = updatedQuestions[i];
            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Hardening question ${i + 1}/${total}...` } });
            
            try {
                const currentDistractors = q.options.filter(o => o.id !== q.correctAnswerId).map(o => o.text);
                const correctAnswerText = q.options.find(o => o.id === q.correctAnswerId)?.text || '';
                const newDistractors = await aiService.hardenDistractors(q.questionText, correctAnswerText, currentDistractors, deck.name);
                
                const correctAnswerObj = q.options.find(o => o.id === q.correctAnswerId)!;
                updatedQuestions[i] = {
                    ...q,
                    options: [
                        correctAnswerObj,
                        ...newDistractors.map((d: any) => ({ id: crypto.randomUUID(), text: d.text, explanation: d.explanation }))
                    ].sort(() => Math.random() - 0.5)
                };
            } catch (e) {
                console.error(`Failed to harden question ${q.id}`, e);
            }
        }
        
        await handleUpdateDeck({ ...deck, questions: updatedQuestions });
        addToast(`Hardened distractors for all ${total} questions!`, 'success');
    }, [dispatch, handleUpdateDeck, addToast]);

    const onGenerateAudioForAllCards = useCallback(async (payload: { deckId: string }, abortSignal: AbortSignal) => {
        const deck = useStore.getState().decks[payload.deckId];
        if (!deck || deck.type !== DeckType.Flashcard) return;
        
        const flashcardDeck = deck as FlashcardDeck;
        const total = flashcardDeck.cards.length;
        const updatedCards = [...flashcardDeck.cards];
        let count = 0;

        for (let i = 0; i < total; i++) {
            if (abortSignal.aborted) throw new Error("Cancelled by user");
            const c = updatedCards[i];
            
            // Only generate if audio is missing
            if (!c.frontAudio || !c.backAudio) {
                dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating audio for card ${i + 1}/${total}...` } });
                
                try {
                    const frontText = c.front.replace(/<[^>]+>/g, '').trim();
                    const backText = c.back.replace(/<[^>]+>/g, '').trim();
                    
                    const [frontAudio, backAudio] = await Promise.all([
                        c.frontAudio ? Promise.resolve(c.frontAudio) : aiService.generateSpeech(frontText),
                        c.backAudio ? Promise.resolve(c.backAudio) : aiService.generateSpeech(backText)
                    ]);
                    
                    updatedCards[i] = { ...c, frontAudio, backAudio };
                    count++;
                } catch (e) {
                    console.error(`Failed to generate audio for card ${c.id}`, e);
                }
            }
        }
        
        await handleUpdateDeck({ ...deck, cards: updatedCards });
        addToast(`Audio generated for ${count} card sides!`, 'success');
    }, [dispatch, handleUpdateDeck, addToast]);

    const onAutoPopulateSeries = useCallback(async (payload: { seriesId?: string, topic?: string, comprehensiveness?: string }, abortSignal: AbortSignal) => {
        const { seriesId, topic, comprehensiveness } = payload;
        
        let currentSeries: DeckSeries | null = null;
        if (seriesId) {
            currentSeries = useStore.getState().deckSeries[seriesId];
        } else if (topic) {
            // New series from scratch immediately
            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Designing full curriculum...' } });
            const structure = await aiService.generateSeriesStructure(topic, `A comprehensive course about ${topic} at ${comprehensiveness} depth.`);
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
            
            currentSeries = { 
                id: crypto.randomUUID(), 
                type: 'series', 
                name: structure.seriesName || topic, 
                description: structure.seriesDescription || '', 
                levels: newLevels,
                createdAt: new Date().toISOString(),
                archived: false
            };
            await handleAddSeriesWithDecks(currentSeries, allNewDecks);
        }

        if (currentSeries && currentSeries.levels.length > 0 && seriesId) {
             dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Expanding series with new levels...' } });
             const currentStructureStr = currentSeries.levels.map(l => `${l.title}: ${(l.deckIds||[]).length} decks`).join('\n');
             const newStructure = await aiService.generateSeriesStructure(currentSeries.name, currentSeries.description, currentStructureStr);
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

    const onGenerateLearningContentForDeck = useCallback(async (payload: { deck: LearningDeck, comprehensiveness?: string }, abortSignal: AbortSignal) => {
        const { deck, comprehensiveness } = payload;
        const { infoCards, questions, name, description } = await aiService.generateLearningDeckContent(deck.name, comprehensiveness || 'Standard');
        if (abortSignal.aborted) return;
        
        const today = new Date().toISOString();
        const finalInfoCards = (infoCards || []).map((ic: any) => ({
            ...ic,
            unlocksQuestionIds: ic.unlocksQuestionIds || [] 
        }));
        
        const finalQuestions = (questions || []).map((q: any) => ({
            ...q,
            id: q.id || crypto.randomUUID(),
            questionType: 'multipleChoice',
            dueDate: today, interval: 0, easeFactor: 2.5, lapses: 0, masteryLevel: 0, suspended: false,
            options: (q.options || []).map((o: any) => ({ ...o, id: crypto.randomUUID() }))
        }));

        finalQuestions.forEach((q: any) => {
            (q.infoCardIds || []).forEach((icId: string) => {
                const ic = finalInfoCards.find((c: any) => c.id === icId);
                if (ic) {
                    ic.unlocksQuestionIds = Array.from(new Set([...(ic.unlocksQuestionIds || []), q.id]));
                }
            });
        });

        const updatedDeck = { 
            ...deck, 
            name: name || deck.name,
            description: description || deck.description,
            infoCards: [...(deck.infoCards||[]), ...finalInfoCards], 
            questions: [...(deck.questions||[]), ...finalQuestions] 
        };
        await handleUpdateDeck(updatedDeck, { silent: true });
    }, [handleUpdateDeck]);

    const onUpgradeDeckToLearning = useCallback(async (payload: { deckId: string }, abortSignal: AbortSignal) => {
        const deck = useStore.getState().decks[payload.deckId];
        if (!deck) return;

        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Analyzing concepts...' } });
        const upgradeData = await aiService.upgradeDeckToLearning(deck);
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Structuring course...' } });

        let questions: Question[] = [];
        if (deck.type === DeckType.Flashcard) {
            const convertedQuestions = deck.cards.map(c => ({
                id: c.id,
                questionType: 'multipleChoice' as const,
                questionText: c.front,
                options: [
                    { id: crypto.randomUUID(), text: c.back },
                    { id: crypto.randomUUID(), text: 'Incorrect Option A' },
                    { id: crypto.randomUUID(), text: 'Incorrect Option B' },
                ].sort(() => Math.random() - 0.5),
                correctAnswerId: '', 
                detailedExplanation: `Concept: ${c.front} is ${c.back}`,
                dueDate: c.dueDate,
                interval: c.interval,
                easeFactor: c.easeFactor,
                lapses: c.lapses,
                masteryLevel: c.masteryLevel,
                suspended: c.suspended,
                lastReviewed: c.lastReviewed
            }));
            
            convertedQuestions.forEach(q => {
                const correct = q.options.find(o => o.text === deck.cards.find(c => c.id === q.id)?.back);
                q.correctAnswerId = correct?.id || q.options[0].id;
            });
            
            questions = convertedQuestions;
        } else {
            questions = deck.questions;
        }

        const newLearningDeck: LearningDeck = {
            ...deck,
            type: DeckType.Learning,
            infoCards: upgradeData.infoCards.map((ic: any) => ({
                ...ic,
                id: ic.id || crypto.randomUUID(),
                unlocksQuestionIds: ic.unlocksQuestionIds || []
            })),
            questions,
            learningMode: 'separate'
        };

        await handleUpdateDeck(newLearningDeck, { toastMessage: `"${deck.name}" is now a Learning Deck!` });
    }, [dispatch, handleUpdateDeck]);

    const onReworkDeckContent = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        if (!payload.deckId) return;
        const deck = useStore.getState().decks[payload.deckId];
        if (!deck) return;

        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Reworking "${deck.name}" content...` } });
        
        try {
            const reworkedData = await aiService.reworkDeckContent(deck, payload);
            
            if (abortSignal.aborted) throw new Error("Cancelled by user");

            let updatedDeck: Deck;
            if (deck.type === DeckType.Flashcard) {
                updatedDeck = {
                    ...deck,
                    name: reworkedData.name || deck.name,
                    description: reworkedData.description || deck.description,
                    cards: createCardsFromImport(reworkedData.cards || [])
                } as FlashcardDeck;
            } else if (deck.type === DeckType.Quiz) {
                updatedDeck = {
                    ...deck,
                    name: reworkedData.name || deck.name,
                    description: reworkedData.description || deck.description,
                    questions: createQuestionsFromImport(reworkedData.questions || [])
                } as QuizDeck;
            } else {
                // Learning Deck
                updatedDeck = {
                    ...deck,
                    name: reworkedData.name || deck.name,
                    description: reworkedData.description || deck.description,
                    infoCards: (reworkedData.infoCards || []).map((ic: any) => ({ ...ic, id: ic.id || crypto.randomUUID() })),
                    questions: createQuestionsFromImport(reworkedData.questions || [])
                } as LearningDeck;
            }

            await handleUpdateDeck(updatedDeck, { toastMessage: `"${deck.name}" has been reworked!` });
        } catch (e) {
            console.error("Rework failed:", e);
            addToast(`Failed to rework deck: ${(e as Error).message}`, 'error');
        }
    }, [dispatch, handleUpdateDeck, addToast]);

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

    const onGenerateDeckFromOutline = useCallback(async (payload: any, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating deck content...' } });
        
        let deckData: any;
        if (payload.immediate) {
            // In immediate mode, we generate directly from topic
            const res = await aiService.generateLearningDeckContent(payload.topic, 'Standard', false);
            deckData = res;
        } else {
            deckData = await aiService.generateDeckFromOutline(payload.outline, payload.metadata);
        }
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        const existingDeckId = payload.deckId;
        if (existingDeckId) {
            const existingDeck = useStore.getState().decks[existingDeckId];
            if (existingDeck) {
                const newQuestions = createQuestionsFromImport(deckData.questions || []);
                const updatedDeck = {
                    ...existingDeck,
                    questions: [...((existingDeck as QuizDeck).questions || []), ...newQuestions]
                } as QuizDeck;
                await handleUpdateDeck(updatedDeck, { silent: true });
                addToast(`Added content to "${existingDeck.name}"!`, 'success');
                return;
            }
        }

        const newDeck: QuizDeck = {
            id: crypto.randomUUID(),
            name: deckData.name || payload.topic || 'New Quiz',
            description: deckData.description || '',
            type: DeckType.Quiz,
            questions: createQuestionsFromImport(deckData.questions || [])
        };

        await handleAddDecks([newDeck]);

        const { seriesId, levelIndex } = payload;
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
    }, [dispatch, handleAddDecks, handleUpdateSeries, addToast, handleUpdateDeck]);

    const onGenerateFlashcardDeck = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
         dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating flashcards...' } });
         
         const { persona: personaId, deckId: existingDeckId } = payload;
         
         const storedOptions = localStorage.getItem('cogniflow-ai-options');
         let personas = [];
         if (storedOptions) {
             personas = JSON.parse(storedOptions).personas || [];
         }
         const selectedPersona = personas.find((p: any) => p.id === personaId) || { name: 'Assistant', instruction: 'You are a helpful assistant.' };

         const deckData = await aiService.generateFlashcardDeckWithAI(payload, selectedPersona);
         
         if (abortSignal.aborted) throw new Error("Cancelled by user");

         if (existingDeckId) {
             const existingDeck = useStore.getState().decks[existingDeckId];
             if (existingDeck && existingDeck.type === DeckType.Flashcard) {
                 const newCards = createCardsFromImport(deckData.cards || []);
                 const updatedDeck = {
                     ...existingDeck,
                     cards: [...(existingDeck.cards || []), ...newCards]
                 } as FlashcardDeck;
                 await handleUpdateDeck(updatedDeck, { silent: true });
                 addToast(`Added cards to "${existingDeck.name}"!`, 'success');
                 return;
             }
         }

         const newDeck: FlashcardDeck = {
             id: crypto.randomUUID(),
             name: deckData.name || payload.topic,
             description: deckData.description || '',
             type: DeckType.Flashcard,
             cards: createCardsFromImport(deckData.cards || [])
         };

         await handleAddDecks([newDeck]);
         addToast(`Deck "${newDeck.name}" generated!`, 'success');
    }, [dispatch, handleAddDecks, addToast, handleUpdateDeck]);

    const onGenerateLearningDeckWithAI = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating course content...' } });
        const isCourse = payload.generationType === 'deck-course' || payload.generationType === 'single-deck-learning';
        const { infoCards, questions, name, description } = await aiService.generateLearningDeckContent(payload.topic, payload.comprehensiveness, isCourse);
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        const processedInfoCards = (infoCards || []).map(ic => ({ ...ic, id: ic.id || crypto.randomUUID(), unlocksQuestionIds: ic.unlocksQuestionIds || [] }));
        const processedQuestions = createQuestionsFromImport(questions || []);

        if (payload.deckId) {
            const existingDeck = useStore.getState().decks[payload.deckId];
            if (existingDeck && existingDeck.type === DeckType.Learning) {
                const updatedDeck = {
                    ...existingDeck,
                    infoCards: [...(existingDeck.infoCards || []), ...processedInfoCards],
                    questions: [...(existingDeck.questions || []), ...processedQuestions]
                } as LearningDeck;
                await handleUpdateDeck(updatedDeck, { silent: true });
                addToast(`Added content to "${existingDeck.name}"!`, 'success');
                return;
            }
        }

        const newDeck: LearningDeck = {
            id: crypto.randomUUID(),
            name: name || payload.topic,
            description: description || `Generated ${isCourse ? 'course' : 'learning guide'} on ${payload.topic}`,
            type: DeckType.Learning,
            infoCards: processedInfoCards,
            questions: processedQuestions,
            learningMode: 'separate'
        };
        
        await handleAddDecks([newDeck]);
        addToast(`Learning Deck generated!`, 'success');
    }, [dispatch, handleAddDecks, addToast, handleUpdateDeck]);

    return {
        handleStartAIGeneration,
        handleImmediateAIGeneration,
        handleCancelAIGeneration,
        handleExecuteAIAction,
        handleOpenAIGenerationForDeck,
        handleOpenAIReworkForDeck,
        handleOpenAIGenerationForSeriesLevel,
        handleOpenAIAutoExpandSeries,
        
        handleGenerateAudioForCard,
        handleSuggestDeckIcon,
        handleOpenDeckAnalysis,
        handleAutoTagQuestions,
        handleGenerateCardExamples,
        handleHardenDistractorsForQuestion,
        handleHardenAllDistractors,
        handleGenerateAudioForAllCards,
        handleAiAddLevelsToSeries,
        handleAiAddDecksToLevel,
        handleGenerateQuestionsForDeck,
        handleGenerateContentForLearningDeck,
        handleGenerateQuestionsForEmptyDecksInSeries,
        handleRegenerateQuestion,
        handleExpandText,
        handleUpgradeDeckToLearning,

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
        onUpgradeDeckToLearning,
        onHardenAllDistractors,
        onGenerateAudioForAllCards,
        onReworkDeckContent,
    };
};
