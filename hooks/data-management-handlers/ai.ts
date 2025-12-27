
// hooks/data-management-handlers/ai.ts

import { useCallback } from 'react';
import { useStore } from '../../store/store.ts';
import { useToast } from '../useToast.ts';
import * as aiService from '../../services/aiService.ts';
import { createQuestionsFromImport, createCardsFromImport } from '../../services/importService.ts';
import { 
    Deck, DeckType, QuizDeck, FlashcardDeck, LearningDeck, 
    SeriesLevel, DeckSeries, AIAction, AIGenerationParams, AIGenerationTask, AIActionType, Card, Question, InfoCard
} from '../../types.ts';
import { useSettings } from '../useSettings.ts';

const MAX_CONCURRENT_CHAPTERS = 3;
const MAX_RETRIES_PER_CHAPTER = 3;

async function retryWithBackoff<T>(operation: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (retries <= 0) throw error;
        const delay = initialDelay * (Math.pow(2, 3 - retries));
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(operation, retries - 1, initialDelay);
    }
}

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
    const { veoEnabled, groundedImagesEnabled, searchAuditsEnabled } = useSettings();

    const onGenerateDeepCourse = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        const { currentTask } = useStore.getState().aiGenerationStatus;
        if (!currentTask) return;

        const personaId = payload.persona || 'default';
        const storedOptions = localStorage.getItem('cogniflow-ai-options');
        let personas = [];
        if (storedOptions) {
            personas = JSON.parse(storedOptions).personas || [];
        }
        const selectedPersona = personas.find((p: any) => p.id === personaId) || { name: 'Assistant', instruction: 'You are a helpful assistant.' };

        // PHASE 0: CURRICULUM ARCHITECTURE
        let curriculum = payload.partialProgress?.curriculum;
        let deckId = payload.partialProgress?.deckId;
        let completedChapterIds = new Set<string>(payload.partialProgress?.completedChapterIds || []);
        let previousSummariesMap = payload.partialProgress?.previousSummariesMap || {};
        let chapterRetryCounts = new Map<string, number>();

        if (!curriculum) {
            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Ingesting material & architecting...' } });
            try {
                const curriculumResponse: any = await aiService.generateCourseCurriculum(payload, selectedPersona);
                curriculum = curriculumResponse;
                deckId = crypto.randomUUID();
                
                const chapterStubs: InfoCard[] = (curriculum.chapters || []).map((ch: any) => ({
                    id: ch.id, content: '', unlocksQuestionIds: [], prerequisiteIds: ch.prerequisiteChapterIds || []
                }));

                const initialDeck: LearningDeck = {
                    id: deckId!, name: curriculum.name || payload.topic, description: curriculum.description || `Generating: ${payload.topic}...`,
                    type: DeckType.Learning, infoCards: chapterStubs, questions: [], learningMode: 'separate', curriculum, generationStatus: 'generating'
                };
                await handleAddDecks([initialDeck]);

                dispatch({ 
                    type: 'UPDATE_CURRENT_AI_TASK_STATUS', 
                    payload: { 
                        payload: { 
                            ...payload, 
                            partialProgress: { 
                                ...payload.partialProgress, curriculum, deckId, completedChapterIds: [], previousSummariesMap: {}
                            } 
                        }
                    } 
                });
            } catch (e: any) {
                if (e.jsonString) {
                    openModal('aiResponseFix', {
                        badJson: e.jsonString,
                        onRetry: (fixed: any) => {
                            const newTask = { ...currentTask, payload: { ...payload, partialProgress: { curriculum: fixed } } };
                            dispatch({ type: 'CANCEL_AI_TASK' });
                            dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: newTask });
                        },
                        onCancel: () => dispatch({ type: 'CANCEL_AI_TASK' })
                    });
                    return;
                }
                throw e;
            }
        } else {
            const currentDeck = useStore.getState().decks[deckId!] as LearningDeck;
            if (currentDeck && currentDeck.generationStatus !== 'generating') {
                await handleUpdateDeck({ ...currentDeck, generationStatus: 'generating' }, { silent: true });
            }
        }
        
        if (abortSignal.aborted) return;

        const allChapters = curriculum.chapters as any[];
        const totalChapters = allChapters.length;
        const targetChapterWords = Math.floor((payload.targetWordCount || 10000) / totalChapters);
        const sharedDictionary = curriculum.sharedDictionary || {};
        const activeTaskIds = new Set<string>();
        
        while (completedChapterIds.size < totalChapters) {
            if (abortSignal.aborted) break;

            const readyChapters = allChapters.filter(ch => {
                if (completedChapterIds.has(ch.id) || activeTaskIds.has(ch.id)) return false;
                const retryCount = chapterRetryCounts.get(ch.id) || 0;
                if (retryCount >= MAX_RETRIES_PER_CHAPTER) return false;
                const prereqs = ch.prerequisiteChapterIds || [];
                return prereqs.every((pId: string) => completedChapterIds.has(pId));
            });

            if (readyChapters.length === 0 && activeTaskIds.size === 0) break;

            const slotsAvailable = MAX_CONCURRENT_CHAPTERS - activeTaskIds.size;
            const toStart = readyChapters.slice(0, slotsAvailable);

            toStart.forEach(chapterInfo => {
                activeTaskIds.add(chapterInfo.id);
                (async () => {
                    try {
                        const chapterIndex = allChapters.indexOf(chapterInfo);
                        const relevantPrereqSummaries = (chapterInfo.prerequisiteChapterIds || []).map((id: string) => previousSummariesMap[id]).filter(Boolean);
                        const logicalStateVector = await aiService.generateLogicalStateVector(payload.topic, relevantPrereqSummaries, sharedDictionary);
                        
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'drafting' } });
                        
                        let currentChapterHTML = '';
                        await retryWithBackoff(async () => {
                             const stream = aiService.generateChapterDeepContentStream(
                                payload.topic, chapterInfo, totalChapters, chapterIndex, selectedPersona, targetChapterWords, sharedDictionary, logicalStateVector, payload.sourceMaterial
                            );
                            for await (const chunk of stream) {
                                if (abortSignal.aborted) return;
                                currentChapterHTML += chunk;
                                dispatch({ type: 'UPDATE_STREAMING_DRAFT', payload: { chapterId: chapterInfo.id, text: currentChapterHTML } });
                            }
                        }, MAX_RETRIES_PER_CHAPTER);
                        
                        if (abortSignal.aborted) return;

                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'finalizing' } });
                        const finalDraftResult: any = await aiService.generateChapterDeepContent(
                            payload.topic, chapterInfo, totalChapters, chapterIndex, selectedPersona, targetChapterWords, sharedDictionary, logicalStateVector, payload.sourceMaterial
                        );
                        currentChapterHTML = finalDraftResult.content;
                        const currentSummary = finalDraftResult.summaryForArchivist;

                        if (searchAuditsEnabled) {
                            dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'auditing' } });
                            let auditResponse: any = await aiService.verifyContentWithSearch(payload.topic, chapterInfo.title, currentChapterHTML);
                            if (auditResponse.corrections?.length > 0) {
                                let refinement: any = await aiService.refineContentWithCorrections(payload.topic, currentChapterHTML, auditResponse.corrections);
                                currentChapterHTML = refinement.refinedContent;
                            }
                        }
                        
                        // Illustration Pass
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'illustrating' } });
                        let svgResponse: any = await aiService.generateFactualSVG(payload.topic, currentChapterHTML);
                        if (svgResponse.hasDiagram && svgResponse.svgCode) {
                            const svgBlock = `<div class="factual-diagram my-8 flex flex-col items-center bg-surface-dark p-4 rounded-xl border border-border shadow-inner"><div class="max-w-full overflow-x-auto">${svgResponse.svgCode}</div><p class="text-xs text-text-muted mt-3 italic text-center max-w-sm">${svgResponse.caption}</p></div>`;
                            currentChapterHTML = currentChapterHTML.replace(/(<\/h[23]>)/, `$1\n${svgBlock}\n`);
                        }

                        // Question Gen
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'finalizing' } });
                        let finalPass: any = await aiService.generateChapterQuestionsAndAudit(payload.topic, chapterInfo.title, currentChapterHTML);
                        if (abortSignal.aborted) return;

                        const chapterId = chapterInfo.id;
                        const processedQuestions = finalPass.questions.map((q: any) => ({
                            ...q, id: q.id || crypto.randomUUID(), questionType: 'multipleChoice', dueDate: new Date().toISOString(), interval: 0, easeFactor: 2.5, lapses: 0, masteryLevel: 0, suspended: false, infoCardIds: [chapterId], options: (q.options || []).map((o: any) => ({ ...o, id: crypto.randomUUID() })), bloomsLevel: q.bloomsLevel
                        }));

                        const currentDeck = useStore.getState().decks[deckId!] as LearningDeck;
                        if (currentDeck) {
                            const updatedInfoCards = currentDeck.infoCards.map(ic => ic.id === chapterId ? { ...ic, content: finalPass.refinedContent || currentChapterHTML, unlocksQuestionIds: processedQuestions.map((q: any) => q.id) } : ic);
                            await handleUpdateDeck({ ...currentDeck, infoCards: updatedInfoCards, questions: [...currentDeck.questions, ...processedQuestions], lastModified: Date.now() }, { silent: true });
                        }

                        completedChapterIds.add(chapterInfo.id);
                        previousSummariesMap[chapterId] = currentSummary;
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'complete' } });
                    } catch (taskErr) {
                        console.error(taskErr);
                        chapterRetryCounts.set(chapterInfo.id, (chapterRetryCounts.get(chapterInfo.id) || 0) + 1);
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'failed' } });
                    } finally {
                        activeTaskIds.delete(chapterInfo.id);
                    }
                })();
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!abortSignal.aborted) {
            let finalDeck = useStore.getState().decks[deckId!] as LearningDeck;
            if (finalDeck) await handleUpdateDeck({ ...finalDeck, generationStatus: 'complete' }, { toastMessage: `Document synthesis complete!` });
            dispatch({ type: 'CLEAR_STREAMING_DRAFTS' });
        }
    }, [dispatch, handleAddDecks, handleUpdateDeck, openModal, addToast, searchAuditsEnabled]);

    const onHolisticExpandItem = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        if (!payload.deckId || !payload.itemId) return;
        const deck = useStore.getState().decks[payload.deckId];
        if (!deck) return;

        const personaId = payload.persona || 'default';
        const storedOptions = localStorage.getItem('cogniflow-ai-options');
        let personas = storedOptions ? JSON.parse(storedOptions).personas || [] : [];
        const selectedPersona = personas.find((p: any) => p.id === personaId) || { name: 'Assistant', instruction: 'You are helpful.' };

        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Synthesizing conceptual expansion...` } });

        try {
            const options = {
                targetWordCount: payload.targetWordCount,
                analogyIntensity: payload.analogyIntensity,
                thinkingBudget: payload.thinkingBudget
            };

            if (deck.type === DeckType.Learning) {
                const learningDeck = deck as LearningDeck;
                const infoCard = learningDeck.infoCards.find(ic => ic.id === payload.itemId);
                if (!infoCard) return;

                const expandedHtml = await aiService.holisticExpandContent(deck.name, infoCard.content, selectedPersona, options);
                if (abortSignal.aborted) return;

                const updatedDeck = {
                    ...learningDeck,
                    infoCards: learningDeck.infoCards.map(ic => ic.id === payload.itemId ? { ...ic, content: expandedHtml } : ic)
                };
                await handleUpdateDeck(updatedDeck, { silent: true });
                addToast("Item expanded with custom synthesis!", "success");
            } else if (deck.type === DeckType.Flashcard) {
                const flashcardDeck = deck as FlashcardDeck;
                const card = flashcardDeck.cards.find(c => c.id === payload.itemId);
                if (!card) return;

                const expandedBack = await aiService.holisticExpandContent(deck.name, card.back, selectedPersona, options);
                if (abortSignal.aborted) return;

                const updatedDeck = {
                    ...flashcardDeck,
                    cards: flashcardDeck.cards.map(c => c.id === payload.itemId ? { ...c, back: expandedBack } : c)
                };
                await handleUpdateDeck(updatedDeck, { silent: true });
                addToast("Card expanded!", "success");
            }
        } catch (e) {
            addToast(`Expansion failed: ${(e as Error).message}`, 'error');
        }
    }, [dispatch, handleUpdateDeck, addToast]);

    const onDeepExpandQuestions = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        if (!payload.deckId || !payload.itemId) return;
        const deck = useStore.getState().decks[payload.deckId] as LearningDeck;
        if (!deck) return;

        const infoCard = deck.infoCards.find(ic => ic.id === payload.itemId);
        if (!infoCard) return;

        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Synthesizing higher-order assessments...` } });

        try {
            const newQuestionsData = await aiService.generateDeepAssessments(deck.name, infoCard.content, payload.count || 3);
            if (abortSignal.aborted) return;

            const processedQuestions = newQuestionsData.map((q: any) => ({
                ...q,
                id: crypto.randomUUID(),
                questionType: 'multipleChoice',
                dueDate: new Date().toISOString(),
                interval: 0,
                easeFactor: 2.5,
                lapses: 0,
                masteryLevel: 0,
                suspended: false,
                infoCardIds: [infoCard.id],
                options: (q.options || []).map((o: any) => ({ ...o, id: crypto.randomUUID() }))
            }));

            const updatedDeck = {
                ...deck,
                questions: [...deck.questions, ...processedQuestions],
                infoCards: deck.infoCards.map(ic => ic.id === infoCard.id ? { 
                    ...ic, 
                    unlocksQuestionIds: [...(ic.unlocksQuestionIds || []), ...processedQuestions.map(q => q.id)] 
                } : ic)
            };
            
            await handleUpdateDeck(updatedDeck, { silent: true });
            addToast(`Synthesized ${processedQuestions.length} deep assessment items!`, 'success');
        } catch (e) {
            addToast(`Deepening failed: ${(e as Error).message}`, 'error');
        }
    }, [dispatch, handleUpdateDeck, addToast]);

    const handleHolisticUpgrade = useCallback(async (deck: Deck, type: 'text' | 'questions', config: Partial<AIGenerationParams> = {}) => {
        if (type === 'text') {
            const itemsToExpand = deck.type === DeckType.Learning 
                ? (deck as LearningDeck).infoCards 
                : (deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : []);
            
            itemsToExpand.forEach(item => {
                const task: AIGenerationTask = {
                    id: crypto.randomUUID(),
                    type: 'holistic-expand-item',
                    payload: {
                        generationType: 'holistic-expand-item',
                        topic: deck.name,
                        persona: config.persona || 'the_master',
                        understanding: config.understanding || 'Advanced',
                        comprehensiveness: config.comprehensiveness || 'Standard',
                        targetWordCount: config.targetWordCount || 500,
                        thinkingBudget: config.thinkingBudget,
                        analogyIntensity: config.analogyIntensity || 'standard',
                        deckId: deck.id,
                        itemId: item.id
                    },
                    statusText: `Enhancing conceptual depth...`,
                };
                dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            });
            addToast(`Queued ${itemsToExpand.length} conceptual enhancements.`, 'info');
        } else {
            const learningDeck = deck as LearningDeck;
            learningDeck.infoCards.forEach(ic => {
                const task: AIGenerationTask = {
                    id: crypto.randomUUID(),
                    type: 'deep-expand-questions',
                    payload: {
                        generationType: 'deep-expand-questions',
                        topic: deck.name,
                        persona: config.persona || 'default',
                        understanding: config.understanding || 'Advanced',
                        comprehensiveness: config.comprehensiveness || 'Standard',
                        count: config.count || 2,
                        deckId: deck.id,
                        itemId: ic.id
                    },
                    statusText: `Drafting analysis questions...`,
                };
                dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            });
            addToast(`Queued assessment depth for ${learningDeck.infoCards.length} chapters.`, 'info');
        }
    }, [dispatch, addToast]);

    // ... rest of file ...
    const onGenerateLearningDeckWithAI = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Inhaling source material...' } });
        const isCourse = payload.generationType === 'deck-course' || payload.generationType === 'single-deck-learning';
        const responseData: any = await aiService.generateLearningDeckContent(payload.topic, payload.comprehensiveness, isCourse, payload.sourceMaterial);
        const { infoCards, questions, name, description } = responseData;
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        const processedInfoCards = (infoCards || []).map((ic: any) => ({ ...ic, id: ic.id || crypto.randomUUID(), unlocksQuestionIds: ic.unlocksQuestionIds || [] }));
        const processedQuestions = createQuestionsFromImport(questions || []);

        const newDeck: LearningDeck = {
            id: crypto.randomUUID(), name: name || payload.topic, description: description || `Course from document: ${payload.topic}`, type: DeckType.Learning, infoCards: processedInfoCards, questions: processedQuestions, learningMode: 'separate'
        };
        
        await handleAddDecks([newDeck]);
        addToast(`Learning Deck synthesized!`, 'success');
    }, [dispatch, handleAddDecks, addToast]);

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
                const newDistractors: any = await aiService.hardenDistractors(q.questionText, correctAnswerText, currentDistractors, deck.name);
                const correctAnswerObj = q.options.find(o => o.id === q.correctAnswerId)!;
                updatedQuestions[i] = { ...q, options: [correctAnswerObj, ...newDistractors.map((d: any) => ({ id: crypto.randomUUID(), text: d.text, explanation: d.explanation }))].sort(() => Math.random() - 0.5) };
            } catch (e) {}
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
            if (!c.frontAudio || !c.backAudio) {
                dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating audio for card ${i + 1}/${total}...` } });
                try {
                    const [frontAudio, backAudio] = await Promise.all([c.frontAudio ? Promise.resolve(c.frontAudio) : aiService.generateSpeech(c.front.replace(/<[^>]+>/g, '')), c.backAudio ? Promise.resolve(c.backAudio) : aiService.generateSpeech(c.back.replace(/<[^>]+>/g, ''))]);
                    updatedCards[i] = { ...c, frontAudio, backAudio };
                    count++;
                } catch (e) {}
            }
        }
        await handleUpdateDeck({ ...deck, cards: updatedCards });
        addToast(`Audio generated for ${count} card sides!`, 'success');
    }, [dispatch, handleUpdateDeck, addToast]);

    const onUpgradeDeckToLearning = useCallback(async (payload: { deckId: string }, abortSignal: AbortSignal) => {
        const deck = useStore.getState().decks[payload.deckId];
        if (!deck) return;
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Analyzing concepts...' } });
        const upgradeData: any = await aiService.upgradeDeckToLearning(deck);
        if (abortSignal.aborted) throw new Error("Cancelled by user");
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Structuring course...' } });
        let questions: Question[] = [];
        if (deck.type === DeckType.Flashcard) {
            questions = deck.cards.map(c => ({
                id: c.id, questionType: 'multipleChoice' as const, questionText: c.front, options: [ { id: crypto.randomUUID(), text: c.back }, { id: crypto.randomUUID(), text: 'Incorrect Option A' }, { id: crypto.randomUUID(), text: 'Incorrect Option B' } ].sort(() => Math.random() - 0.5), correctAnswerId: '', detailedExplanation: `Concept: ${c.front} is ${c.back}`, dueDate: c.dueDate, interval: 0, easeFactor: c.easeFactor, lapses: c.lapses, masteryLevel: c.masteryLevel, suspended: false, lastReviewed: c.lastReviewed
            }));
            questions.forEach(q => {
                const correct = q.options.find(o => o.text === deck.cards.find(c => c.id === q.id)?.back);
                q.correctAnswerId = correct?.id || q.options[0].id;
            });
        } else questions = deck.questions;
        const newLearningDeck: LearningDeck = {
            ...deck, type: DeckType.Learning, infoCards: upgradeData.infoCards.map((ic: any) => ({ ...ic, id: ic.id || crypto.randomUUID(), unlocksQuestionIds: ic.unlocksQuestionIds || [] })), questions, learningMode: 'separate'
        };
        await handleUpdateDeck(newLearningDeck, { toastMessage: `"${deck.name}" is now a Learning Deck!` });
    }, [dispatch, handleUpdateDeck]);

    const handleStartAIGeneration = useCallback((params: AIGenerationParams) => {
        openModal('aiGenerationChat', { params });
    }, [openModal]);

    const handleImmediateAIGeneration = useCallback(async (params: AIGenerationParams) => {
        const taskId = crypto.randomUUID();
        const { generationType } = params;
        let task: AIGenerationTask;
        if (generationType === 'deep-course') task = { id: taskId, type: 'generateDeepCourse', payload: params, statusText: `Synthesizing course from document...`, deckId: params.deckId };
        else if (generationType === 'single-deck-learning' || generationType === 'deck-course') task = { id: taskId, type: 'generateLearningDeckWithAI', payload: params, statusText: `Generating learning guide...` };
        else if (['deck-flashcard', 'deck-vocab', 'deck-atomic'].includes(generationType)) task = { id: taskId, type: 'generateFlashcardDeckWithAI', payload: params, statusText: `Generating flashcards...` };
        else if (generationType === 'rework-deck') task = { id: taskId, type: 'rework-deck', payload: params, statusText: `Reworking "${params.topic}"` };
        else if (generationType === 'holistic-expand-item') task = { id: taskId, type: 'holistic-expand-item', payload: params, statusText: `Enhancing concept...` };
        else if (generationType === 'deep-expand-questions') task = { id: taskId, type: 'deep-expand-questions', payload: params, statusText: `Expanding assessments...` };
        else task = { id: taskId, type: 'generateDeckFromOutline', payload: { immediate: true, topic: params.topic, understanding: params.understanding, count: params.count }, statusText: `Generating quiz...` };
        dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
        addToast('Task added to queue.', 'info');
    }, [dispatch, addToast]);

    const handleExecuteAIAction = useCallback(async (action: AIAction) => {
        try {
            switch (action.action) {
                case AIActionType.CREATE_DECK:
                    await handleAddDecks([{ id: crypto.randomUUID(), name: action.payload.name, type: DeckType.Flashcard, cards: [], folderId: action.payload.folderId || null, description: 'Created by AI' } as FlashcardDeck]);
                    addToast(`Deck "${action.payload.name}" created.`, 'success');
                    break;
                case AIActionType.UPGRADE_TO_LEARNING:
                    const deckToUpgrade = useStore.getState().decks[action.payload.deckId];
                    if (deckToUpgrade) onUpgradeDeckToLearning({ deckId: deckToUpgrade.id }, new AbortController().signal);
                    break;
                case AIActionType.REWORK_DECK:
                    const deckToRework = useStore.getState().decks[action.payload.deckId];
                    if (deckToRework) handleImmediateAIGeneration({ generationType: 'rework-deck', topic: deckToRework.name, deckId: deckToRework.id, reworkInstructions: action.payload.reworkInstructions || "Improve content.", persona: action.payload.persona || "default", understanding: "Intermediate", comprehensiveness: "Standard" });
                    break;
                default: addToast("Action not implemented yet.", "info");
            }
        } catch (e) { addToast(`Failed: ${(e as Error).message}`, 'error'); }
    }, [handleAddDecks, addToast, onUpgradeDeckToLearning, handleImmediateAIGeneration]);

    const handleCancelAIGeneration = useCallback((taskId?: string) => {
        dispatch({ type: 'CANCEL_AI_TASK', payload: { taskId } });
        addToast("Generation cancelled.", "info");
    }, [dispatch, addToast]);

    const handleOpenAIGenerationForDeck = useCallback((deck: Deck) => {
        openModal('aiGeneration', { context: { deckId: deck.id, deckName: deck.name, deckType: deck.type, mode: 'expand' } });
    }, [openModal]);

    const handleOpenAIReworkForDeck = useCallback((deck: Deck) => {
        openModal('aiGeneration', { context: { deckId: deck.id, deckName: deck.name, deckType: deck.type, mode: 'rework' } });
    }, [openModal]);

    const handleOpenAIGenerationForSeriesLevel = useCallback((seriesId: string, levelIndex: number) => {
        const series = useStore.getState().deckSeries[seriesId];
        openModal('aiGeneration', { initialGenerationType: 'single-deck-quiz', context: { seriesId, seriesName: series?.name, levelIndex } });
    }, [openModal]);

    const handleOpenAIAutoExpandSeries = useCallback((seriesId: string) => {
        const series = useStore.getState().deckSeries[seriesId];
        openModal('aiGeneration', { initialGenerationType: 'series-auto-fill', context: { seriesId, seriesName: series?.name } });
    }, [openModal]);

    const onReworkDeckContent = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        if (!payload.deckId) return;
        const state = useStore.getState();
        const deck = state.decks[payload.deckId];
        if (!deck) return;
        const personaId = payload.persona || 'default';
        const storedOptions = localStorage.getItem('cogniflow-ai-options');
        let personas = storedOptions ? JSON.parse(storedOptions).personas || [] : [];
        const selectedPersona = personas.find((p: any) => p.id === personaId) || { name: 'Assistant', instruction: 'You are helpful.' };
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Reworking "${deck.name}"...` } });
        try {
            const reworkedData: any = await aiService.reworkDeckContent(deck, payload, selectedPersona);
            if (abortSignal.aborted) throw new Error("Cancelled by user");
            let updatedDeck: Deck;
            if (deck.type === DeckType.Flashcard) updatedDeck = { ...deck, name: reworkedData.name || deck.name, description: reworkedData.description || deck.description, cards: createCardsFromImport(reworkedData.cards || []) } as FlashcardDeck;
            else if (deck.type === DeckType.Quiz) updatedDeck = { ...deck, name: reworkedData.name || deck.name, description: reworkedData.description || deck.description, questions: createQuestionsFromImport(reworkedData.questions || []) } as QuizDeck;
            else updatedDeck = { ...deck, name: reworkedData.name || deck.name, description: reworkedData.description || deck.description, infoCards: (reworkedData.infoCards || []).map((ic: any) => ({ ...ic, id: ic.id || crypto.randomUUID() })), questions: createQuestionsFromImport(reworkedData.questions || []) } as LearningDeck;
            await handleUpdateDeck(updatedDeck, { toastMessage: `"${deck.name}" reworked successfully!` });
        } catch (e) { addToast(`Failed: ${(e as Error).message}`, 'error'); }
    }, [dispatch, handleUpdateDeck, addToast]);

    const onAutoPopulateSeries = useCallback(async (payload: { seriesId?: string, topic?: string, comprehensiveness?: string }, abortSignal: AbortSignal) => {
        const { seriesId, topic, comprehensiveness } = payload;
        const state = useStore.getState();
        let currentSeries: DeckSeries | null = seriesId ? (state.deckSeries as Record<string, DeckSeries>)[seriesId] || null : null;
        if (!currentSeries && topic) {
            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Designing curriculum...' } });
            const structure: any = await aiService.generateSeriesStructure(topic, `A course about ${topic} at ${comprehensiveness} depth.`);
            if (abortSignal.aborted) return;
            const allNewDecks: Deck[] = [];
            const newLevels: SeriesLevel[] = (structure.levels || []).map((levelData: any) => {
               const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck => ({ id: crypto.randomUUID(), name: d.name, description: d.description, type: DeckType.Quiz, questions: [] }));
               allNewDecks.push(...decksForLevel);
               return { title: levelData.title, deckIds: decksForLevel.map(d => d.id) };
            });
            currentSeries = { id: crypto.randomUUID(), type: 'series', name: structure.name || topic, description: structure.description || '', levels: newLevels, createdAt: new Date().toISOString(), archived: false };
            await handleAddSeriesWithDecks(currentSeries, allNewDecks);
        }
    }, [dispatch, handleAddSeriesWithDecks, handleAddDecks, handleUpdateSeries, addToast]);

    const onAutoPopulateLevel = useCallback(async (payload: { seriesId: string, levelIndex: number }, abortSignal: AbortSignal) => {
        const { seriesId, levelIndex } = payload;
        const series = (useStore.getState().deckSeries as any)[seriesId];
        if (!series || !series.levels[levelIndex]) return;
        const level = series.levels[levelIndex];
        const currentDeckNames = level.deckIds.map((id: string) => (useStore.getState().decks as any)[id]?.name).filter(Boolean);
        const newDecksData: any = await aiService.generateLevelDecks(series.name, series.description, level.title, currentDeckNames as string[]);
        if (abortSignal.aborted) return;
        const newDecks: Deck[] = (newDecksData as any[]).map((d: any) => ({ id: crypto.randomUUID(), name: d.name, description: d.description, type: DeckType.Quiz, questions: [] }));
        await handleAddDecks(newDecks);
        const updatedSeries = { ...series, levels: series.levels.map((l: any, i: number) => i === levelIndex ? { ...l, deckIds: [...l.deckIds, ...newDecks.map(d => d.id)] } : l) };
        await handleUpdateSeries(updatedSeries, { silent: true });
    }, [handleAddDecks, handleUpdateSeries]);

    const onGenerateQuestionsForDeck = useCallback(async (deck: QuizDeck, count: number, seriesContext: any, abortSignal: AbortSignal) => {
        const questions: any = await aiService.generateQuestionsForDeck(deck, count || 5, seriesContext);
        if (abortSignal.aborted) return;
        const newQuestions = createQuestionsFromImport(questions);
        await handleUpdateDeck({ ...deck, questions: [...(deck.questions || []), ...newQuestions] }, { silent: true });
    }, [handleUpdateDeck]);

    const onGenerateSeriesQuestionsInBatches = useCallback(async (payload: { seriesId: string }, abortSignal: AbortSignal) => {
        const series = (useStore.getState().deckSeries as any)[payload.seriesId];
        if (!series) return;
        const deckIds = (series.levels || []).flatMap((l: any) => l.deckIds);
        const decks = useStore.getState().decks;
        for (const deckId of deckIds) {
            if (abortSignal.aborted) return;
            const deck = decks[deckId];
            if (deck?.type === DeckType.Quiz && (deck as QuizDeck).questions.length === 0) {
                dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating for "${deck.name}"...` } });
                await onGenerateQuestionsForDeck(deck as QuizDeck, 5, { name: series.name }, abortSignal);
            }
        }
    }, [onGenerateQuestionsForDeck, dispatch]);

    const onRegenerateQuestion = useCallback(async (payload: { deckId: string, questionId: string }, abortSignal: AbortSignal) => {
        const deck = useStore.getState().decks[payload.deckId];
        if (!deck) return;
        const questions = (deck as QuizDeck | LearningDeck).questions;
        const question = questions.find(q => q.id === payload.questionId);
        if (!question) return;
        const updatedData: any = await aiService.regenerateQuestionWithAI(question, deck.name);
        if (abortSignal.aborted) return;
        await handleUpdateDeck({ ...deck, questions: questions.map(q => q.id === payload.questionId ? { ...question, ...updatedData } : q) }, { silent: true });
    }, [handleUpdateDeck]);

    const onGenerateDeckFromOutline = useCallback(async (payload: any, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating...' } });
        let deckData: any = payload.immediate ? await aiService.generateLearningDeckContent(payload.topic, 'Standard', false) : await aiService.generateDeckFromOutline(payload.outline, payload.metadata);
        if (abortSignal.aborted) throw new Error("Cancelled");
        const existingDeck = payload.deckId ? useStore.getState().decks[payload.deckId] : null;
        if (existingDeck) {
            const newQuestions = createQuestionsFromImport(deckData.questions || []);
            await handleUpdateDeck({ ...existingDeck, questions: [...((existingDeck as QuizDeck).questions || []), ...newQuestions] } as QuizDeck, { silent: true });
            addToast(`Added content to "${existingDeck.name}"!`, 'success');
            return;
        }
        const newDeck: QuizDeck = { id: crypto.randomUUID(), name: deckData.name || payload.topic || 'New Quiz', description: deckData.description || '', type: DeckType.Quiz, questions: createQuestionsFromImport(deckData.questions || []) };
        await handleAddDecks([newDeck]);
        addToast(`Deck "${newDeck.name}" generated!`, 'success');
    }, [dispatch, handleAddDecks, handleUpdateSeries, addToast, handleUpdateDeck]);

    const onGenerateFlashcardDeck = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
         dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating cards...' } });
         const persona = (localStorage.getItem('cogniflow-ai-options') ? JSON.parse(localStorage.getItem('cogniflow-ai-options')!).personas : []).find((p: any) => p.id === payload.persona) || { instruction: 'helpful' };
         const deckData: any = await aiService.generateFlashcardDeckWithAI(payload, persona);
         if (abortSignal.aborted) throw new Error("Cancelled");
         const newDeck: FlashcardDeck = { id: crypto.randomUUID(), name: deckData.name || payload.topic, description: deckData.description || '', type: DeckType.Flashcard, cards: createCardsFromImport(deckData.cards || []) };
         await handleAddDecks([newDeck]);
         addToast(`Deck "${newDeck.name}" generated!`, 'success');
    }, [dispatch, handleAddDecks, addToast]);

    const onGenerateFullSeriesFromScaffold = useCallback(async (payload: { outline: string, generationType: string }, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Creating series...' } });
        const targetType = payload.generationType.includes('flashcard') ? DeckType.Flashcard : DeckType.Quiz;
        const structure = (await aiService.generateScaffoldFromOutline(payload.outline, targetType)) as any;
        if (abortSignal.aborted) throw new Error("Cancelled");
        const allNewDecks: Deck[] = [];
        const newLevels: SeriesLevel[] = (structure.levels || []).map((levelData: any) => {
            const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck => {
                const base = { id: crypto.randomUUID(), name: d.name, description: d.description };
                return targetType === DeckType.Flashcard ? { ...base, type: DeckType.Flashcard, cards: [] } as FlashcardDeck : { ...base, type: DeckType.Quiz, questions: [] } as QuizDeck;
            });
            allNewDecks.push(...decksForLevel);
            return { title: levelData.title, deckIds: decksForLevel.map(d => d.id) };
        });
        await handleAddSeriesWithDecks({ id: crypto.randomUUID(), type: 'series', name: structure.name || 'New Series', description: structure.description || '', levels: newLevels, createdAt: new Date().toISOString(), archived: false }, allNewDecks);
    }, [dispatch, handleAddSeriesWithDecks]);

    return {
        onGenerateDeepCourse, onHardenAllDistractors, onGenerateAudioForAllCards, onUpgradeDeckToLearning, handleStartAIGeneration, handleImmediateAIGeneration, handleExecuteAIAction, handleCancelAIGeneration, handleOpenAIGenerationForDeck, handleOpenAIReworkForDeck, handleOpenAIGenerationForSeriesLevel, handleOpenAIAutoExpandSeries, onReworkDeckContent, onAutoPopulateSeries, onAutoPopulateLevel, onGenerateQuestionsForDeck, onGenerateLearningContentForDeck: onGenerateLearningDeckWithAI, onGenerateSeriesQuestionsInBatches, onRegenerateQuestion, onGenerateDeckFromOutline, onGenerateFlashcardDeck, onGenerateLearningDeckWithAI, onGenerateFullSeriesFromScaffold, onHolisticExpandItem, onDeepExpandQuestions, handleHolisticUpgrade, handleAutoTagQuestions: (deck: any) => {}, handleSuggestDeckIcon: (deck: any) => {}, handleExpandText: (t: any, o: any, s: any) => {}, handleGenerateCardExamples: (f: any, b: any, c: any) => {}, handleHardenDistractors: (q: any, c: any) => {},
    };
};
