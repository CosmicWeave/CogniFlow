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

/**
 * Helper to retry an operation with exponential backoff.
 */
async function retryWithBackoff<T>(operation: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (retries <= 0) throw error;
        const delay = initialDelay * (Math.pow(2, 3 - retries));
        console.warn(`Operation failed, retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(operation, retries - 1, initialDelay);
    }
}

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
    const { veoEnabled, groundedImagesEnabled, searchAuditsEnabled } = useSettings();

    /**
     * Hyper-Course Synthesis Engine.
     * Implements a DAG-based Parallel Execution Graph with Epistemic Grounding and Live Streaming.
     */
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

        // --- STEP 1: CURRICULUM ARCHITECTURE (Phase 0) ---
        let curriculum = payload.partialProgress?.curriculum;
        let deckId = payload.partialProgress?.deckId;
        // Tracking completed chapters for DAG logic
        let completedChapterIds = new Set<string>((payload.partialProgress as any)?.completedChapterIds || []);
        let previousSummariesMap = (payload.partialProgress as any)?.previousSummariesMap || {}; // id -> summary string
        let chapterRetryCounts = new Map<string, number>();

        if (!curriculum) {
            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Architecting Hyper-Course schema & shared terminology...' } });
            try {
                const curriculumResponse: any = await aiService.generateCourseCurriculum(payload, selectedPersona);
                curriculum = curriculumResponse;
                
                deckId = crypto.randomUUID();
                const initialDeck: LearningDeck = {
                    id: deckId,
                    name: curriculum.name || payload.topic,
                    description: curriculum.description || `Generating: ${payload.topic}...`,
                    type: DeckType.Learning,
                    infoCards: [],
                    questions: [],
                    learningMode: 'separate',
                    curriculum: curriculum,
                    generationStatus: 'generating'
                };
                await handleAddDecks([initialDeck]);

                dispatch({ 
                    type: 'UPDATE_CURRENT_AI_TASK_STATUS', 
                    payload: { 
                        payload: { 
                            ...payload, 
                            partialProgress: { 
                                ...payload.partialProgress, 
                                curriculum, 
                                deckId, 
                                completedChapterIds: [],
                                previousSummariesMap: {}
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
        }
        if (abortSignal.aborted) return;

        const allChapters = curriculum.chapters as any[];
        const totalChapters = allChapters.length;
        const targetChapterWords = Math.floor((payload.targetWordCount || 10000) / totalChapters);
        const sharedDictionary = curriculum.sharedDictionary || {};

        // Active Tasks Management
        const activeTaskIds = new Set<string>();
        
        /**
         * Orchestration Loop
         * We run until all chapters are in completedChapterIds
         */
        while (completedChapterIds.size < totalChapters) {
            if (abortSignal.aborted) break;

            // 1. Identify chapters ready to be generated
            const readyChapters = allChapters.filter(ch => {
                if (completedChapterIds.has(ch.id)) return false;
                if (activeTaskIds.has(ch.id)) return false;
                const retryCount = chapterRetryCounts.get(ch.id) || 0;
                if (retryCount >= MAX_RETRIES_PER_CHAPTER) return false;

                const prereqs = ch.prerequisiteChapterIds || [];
                return prereqs.every((pId: string) => completedChapterIds.has(pId));
            });

            if (readyChapters.length === 0 && activeTaskIds.size === 0) {
                const failedNodes = allChapters.filter(ch => !completedChapterIds.has(ch.id) && (chapterRetryCounts.get(ch.id) || 0) >= MAX_RETRIES_PER_CHAPTER);
                if (failedNodes.length > 0) {
                    console.error("Hyper-Course stalled due to isolated node failures:", failedNodes.map(n => n.title));
                    addToast(`Course synthesis partially failed for ${failedNodes.length} chapters.`, 'warning');
                } else {
                    console.error("Hyper-Course Deadlock detected in Curriculum DAG.");
                }
                break;
            }

            // 2. Start new concurrent tasks if within limit
            const slotsAvailable = MAX_CONCURRENT_CHAPTERS - activeTaskIds.size;
            const toStart = readyChapters.slice(0, slotsAvailable);

            toStart.forEach(chapterInfo => {
                activeTaskIds.add(chapterInfo.id);
                
                // --- CHAPTER AGENT PIPELINE ---
                (async () => {
                    try {
                        const chapterIndex = allChapters.indexOf(chapterInfo);
                        
                        // A. Logical State Vector Synchronization
                        const relevantPrereqSummaries = (chapterInfo.prerequisiteChapterIds || []).map((id: string) => previousSummariesMap[id]).filter(Boolean);
                        const logicalStateVector = await aiService.generateLogicalStateVector(payload.topic, relevantPrereqSummaries, sharedDictionary);
                        
                        // B. Live Synthesis: Master Draft (Streaming)
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'drafting' } });
                        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Streaming Draft: "${chapterInfo.title}"...` } });
                        
                        let currentChapterHTML = '';
                        await retryWithBackoff(async () => {
                             const stream = aiService.generateChapterDeepContentStream(
                                payload.topic, 
                                chapterInfo, 
                                totalChapters, 
                                chapterIndex, 
                                selectedPersona, 
                                targetChapterWords,
                                sharedDictionary,
                                logicalStateVector
                            );

                            for await (const chunk of stream) {
                                if (abortSignal.aborted) return;
                                currentChapterHTML += chunk;
                                dispatch({ 
                                    type: 'UPDATE_STREAMING_DRAFT', 
                                    payload: { chapterId: chapterInfo.id, text: currentChapterHTML } 
                                });
                            }
                        }, MAX_RETRIES_PER_CHAPTER);
                        
                        if (abortSignal.aborted) return;

                        // C. Agent Refinement Phase
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'finalizing' } });
                        const finalDraftResult: any = await aiService.generateChapterDeepContent(
                            payload.topic, 
                            chapterInfo, 
                            totalChapters, 
                            chapterIndex, 
                            selectedPersona, 
                            targetChapterWords,
                            sharedDictionary,
                            logicalStateVector
                        );
                        currentChapterHTML = finalDraftResult.content;
                        const currentSummary = finalDraftResult.summaryForArchivist;

                        // D. Fact-Checker / Auditor (Agent B)
                        if (searchAuditsEnabled) {
                            dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'auditing' } });
                            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Fact-checking: "${chapterInfo.title}"...` } });
                            let auditResponse: any = await aiService.verifyContentWithSearch(payload.topic, chapterInfo.title, currentChapterHTML);
                            
                            if (auditResponse.corrections && auditResponse.corrections.length > 0) {
                                dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Refining: "${chapterInfo.title}" (Found ${auditResponse.corrections.length} fixes)...` } });
                                let refinement: any = await aiService.refineContentWithCorrections(payload.topic, currentChapterHTML, auditResponse.corrections);
                                currentChapterHTML = refinement.refinedContent;
                            }
                        }
                        if (abortSignal.aborted) return;

                        // E. Visual Enrichment Phase
                        // E.1 SVG (Always enabled for Hyper-Courses as it's logic-based)
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'illustrating' } });
                        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Illustrating (SVG): "${chapterInfo.title}"...` } });
                        let svgResponse: any = await aiService.generateFactualSVG(payload.topic, currentChapterHTML);
                        if (svgResponse.hasDiagram && svgResponse.svgCode) {
                            const svgBlock = `<div class="factual-diagram my-8 flex flex-col items-center bg-surface-dark p-4 rounded-xl border border-border shadow-inner"><div class="max-w-full overflow-x-auto">${svgResponse.svgCode}</div><p class="text-xs text-text-muted mt-3 italic text-center max-w-sm">${svgResponse.caption}</p></div>`;
                            const headerMatch = currentChapterHTML.match(/<\/h[23]>/);
                            if (headerMatch) currentChapterHTML = currentChapterHTML.replace(/(<\/h[23]>)/, `$1\n${svgBlock}\n`);
                            else currentChapterHTML = svgBlock + "\n" + currentChapterHTML;
                        }
                        if (abortSignal.aborted) return;

                        // E.2 High-Fidelity Grounded Image
                        const hasPaidKey = await (window as any).aistudio?.hasSelectedApiKey();
                        if (hasPaidKey && groundedImagesEnabled) {
                            dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'illustrating' } });
                            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Illustrating (High-Fidelity): "${chapterInfo.title}"...` } });
                            try {
                                let imageResponse: any = await aiService.generateGroundedFidelityImage(payload.topic, currentChapterHTML);
                                if (imageResponse.imageUrl) {
                                    const imgBlock = `<div class="grounded-image my-10 flex flex-col items-center"><img src="${imageResponse.imageUrl}" class="rounded-xl shadow-2xl max-w-full h-auto border border-border" /><p class="text-xs text-text-muted mt-4 italic text-center max-w-md bg-background/50 p-2 rounded">${imageResponse.description}</p></div>`;
                                    currentChapterHTML += `\n${imgBlock}\n`;
                                }
                            } catch (imgErr) {
                                console.warn("Grounded image synthesis failed", imgErr);
                            }
                        }

                        // E.3 Dynamic Process loop (Veo)
                        if (hasPaidKey && veoEnabled) {
                            dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'illustrating' } });
                            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating process loop (Veo): "${chapterInfo.title}"...` } });
                            try {
                                const videoData: any = await aiService.generateProcessVideo(payload.topic, currentChapterHTML);
                                if (videoData) {
                                    const videoBlock = `<div class="veo-process my-10 flex flex-col items-center"><video src="${videoData.dataUrl}" controls loop autoplay muted playsinline class="rounded-xl shadow-2xl border border-border w-full max-w-2xl"></video><p class="text-xs text-text-muted mt-3 italic text-center max-w-sm font-semibold">${videoData.caption}</p></div>`;
                                    currentChapterHTML += `\n${videoBlock}\n`;
                                }
                            } catch (veoErr) {
                                console.warn("Veo generation failed", veoErr);
                            }
                        }

                        // F. Pedagogy & Assessment (Bloom's Taxonomy)
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'finalizing' } });
                        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Final Audit: "${chapterInfo.title}"...` } });
                        let finalPass: any = await aiService.generateChapterQuestionsAndAudit(payload.topic, chapterInfo.title, currentChapterHTML);
                        if (abortSignal.aborted) return;

                        // --- TRANSACTIONAL CHECKPOINT ---
                        const chapterId = chapterInfo.id || crypto.randomUUID();
                        const today = new Date().toISOString();
                        const processedQuestions = finalPass.questions.map((q: any) => ({
                            ...q,
                            id: q.id || crypto.randomUUID(),
                            questionType: 'multipleChoice',
                            dueDate: today, interval: 0, easeFactor: 2.5, lapses: 0, masteryLevel: 0, suspended: false,
                            infoCardIds: [chapterId],
                            options: (q.options || []).map((o: any) => ({ ...o, id: crypto.randomUUID() })),
                            bloomsLevel: q.bloomsLevel
                        }));

                        const currentDeck = useStore.getState().decks[deckId!] as LearningDeck;
                        if (currentDeck) {
                            const updatedDeck: LearningDeck = {
                                ...currentDeck,
                                infoCards: [...currentDeck.infoCards, {
                                    id: chapterId,
                                    content: finalPass.refinedContent || currentChapterHTML,
                                    unlocksQuestionIds: processedQuestions.map((q: any) => q.id),
                                    prerequisiteIds: chapterInfo.prerequisiteChapterIds || []
                                }],
                                questions: [...currentDeck.questions, ...processedQuestions],
                                lastModified: Date.now()
                            };
                            await handleUpdateDeck(updatedDeck, { silent: true });
                        }

                        completedChapterIds.add(chapterInfo.id);
                        previousSummariesMap[chapterId] = currentSummary;
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'complete' } });

                        dispatch({ 
                            type: 'UPDATE_CURRENT_AI_TASK_STATUS', 
                            payload: { 
                                payload: { 
                                    ...payload, 
                                    partialProgress: { 
                                        ...payload.partialProgress, 
                                        completedChapterIds: Array.from(completedChapterIds), 
                                        previousSummariesMap
                                    } 
                                } 
                            } 
                        });

                    } catch (taskErr) {
                        console.error(`Task for chapter "${chapterInfo.title}" failed:`, taskErr);
                        chapterRetryCounts.set(chapterInfo.id, (chapterRetryCounts.get(chapterInfo.id) || 0) + 1);
                        dispatch({ type: 'UPDATE_CHAPTER_PHASE', payload: { chapterId: chapterInfo.id, phase: 'failed' } });
                    } finally {
                        activeTaskIds.delete(chapterInfo.id);
                    }
                })();
            });

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // --- STEP 2: GLOBAL EPISTEMIC CONSISTENCY AUDIT ---
        if (!abortSignal.aborted) {
            let finalDeck = useStore.getState().decks[deckId!] as LearningDeck;
            if (finalDeck && finalDeck.infoCards.length > 1) {
                if (searchAuditsEnabled) {
                    dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Performing Global Consistency Audit...` } });
                    try {
                        const auditResults: any = await aiService.globalCourseAudit(payload.topic, finalDeck.name, finalDeck.infoCards, sharedDictionary);
                        
                        // --- AGENTIC SELF-CORRECTION LOOP ---
                        if (auditResults.suggestions && auditResults.suggestions.length > 0) {
                            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Self-Correcting ${auditResults.suggestions.length} Inconsistencies...` } });
                            
                            let refinedInfoCards = [...finalDeck.infoCards];
                            
                            for (const suggestion of auditResults.suggestions) {
                                const cardIndex = refinedInfoCards.findIndex(c => c.id === suggestion.chapterId);
                                if (cardIndex !== -1) {
                                    const card = refinedInfoCards[cardIndex];
                                    dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Perfecting Chapter: ${suggestion.chapterId}...` } });
                                    
                                    try {
                                        const refinement: any = await aiService.applyAuditRefinement(payload.topic, card.content, suggestion);
                                        refinedInfoCards[cardIndex] = { ...card, content: refinement.refinedContent };
                                    } catch (e) {
                                        console.warn(`Refinement failed for card ${suggestion.chapterId}`, e);
                                    }
                                }
                            }
                            
                            // Apply all refined cards at once
                            finalDeck = { ...finalDeck, infoCards: refinedInfoCards, lastModified: Date.now() };
                            await handleUpdateDeck(finalDeck, { silent: true });
                        }
                    } catch (auditErr) {
                        console.warn("Global consistency audit failed", auditErr);
                    }
                }
                
                await handleUpdateDeck({ ...finalDeck, generationStatus: 'complete' }, { toastMessage: `Hyper-Course "${finalDeck.name}" successfully constructed!` });
            }
            dispatch({ type: 'CLEAR_STREAMING_DRAFTS' });
        }
    }, [dispatch, handleAddDecks, handleUpdateDeck, openModal, addToast, veoEnabled, groundedImagesEnabled, searchAuditsEnabled]);

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

    const onUpgradeDeckToLearning = useCallback(async (payload: { deckId: string }, abortSignal: AbortSignal) => {
        const deck = useStore.getState().decks[payload.deckId];
        if (!deck) return;

        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Analyzing concepts...' } });
        const upgradeData: any = await aiService.upgradeDeckToLearning(deck);
        
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
                suspended: false, // Default to false
                lastReviewed: c.lastReviewed
            }));
            
            convertedQuestions.forEach(q => {
                const correct = q.options.find(o => o.text === deck.cards.find(c => c.id === q.id)?.back);
                q.correctAnswerId = correct?.id || q.options[0].id;
            });
            
            questions = convertedQuestions as any[];
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

    // --- Core Action Handlers ---

    const handleStartAIGeneration = useCallback((params: AIGenerationParams) => {
        openModal('aiGenerationChat', { params });
    }, [openModal]);

    const handleImmediateAIGeneration = useCallback(async (params: AIGenerationParams) => {
        const taskId = crypto.randomUUID();
        const { generationType } = params;
        
        // Safety check for paid model features
        if (generationType === 'deep-course') {
            const needsPaidKey = veoEnabled || groundedImagesEnabled || searchAuditsEnabled;
            
            if (needsPaidKey) {
                const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
                if (!hasKey) {
                    openConfirmModal({
                        title: 'API Key Required',
                        message: 'Deep Course generation uses premium features like Process Visualization Loops (Veo), Grounded Fidelity Images, and Search Audits. Please select your paid Gemini API key from Google AI Studio to continue.',
                        confirmText: 'Select API Key',
                        onConfirm: async () => {
                            await (window as any).aistudio?.openSelectKey();
                            const task: AIGenerationTask = {
                                id: taskId,
                                type: 'generateDeepCourse',
                                payload: params,
                                statusText: `Architecting deep course on "${params.topic}"...`,
                            };
                            dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
                        }
                    });
                    return;
                }
            }
        }

        let task: AIGenerationTask;
        
        if (generationType === 'deep-course') {
            task = {
                id: taskId,
                type: 'generateDeepCourse',
                payload: params,
                statusText: `Architecting deep course on "${params.topic}"...`,
            };
        } else if (generationType.startsWith('series-')) {
            task = {
                id: taskId,
                type: 'autoPopulateSeries', 
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
            task = {
                id: taskId,
                type: 'generateDeckFromOutline',
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
    }, [dispatch, addToast, openConfirmModal, veoEnabled, groundedImagesEnabled, searchAuditsEnabled]);

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
                    const deckToUpgrade = useStore.getState().decks[action.payload.deckId];
                    if (deckToUpgrade) onUpgradeDeckToLearning({ deckId: deckToUpgrade.id }, new AbortController().signal);
                    break;
                case AIActionType.REWORK_DECK:
                    const deckToRework = useStore.getState().decks[action.payload.deckId];
                    if (deckToRework) {
                        const params: AIGenerationParams = {
                            generationType: 'rework-deck',
                            topic: deckToRework.name,
                            deckId: deckToRework.id,
                            reworkInstructions: action.payload.reworkInstructions || "Improve and expand the content.",
                            persona: action.payload.persona || "default",
                            understanding: "Intermediate", 
                            comprehensiveness: "Standard" 
                        };
                        handleImmediateAIGeneration(params);
                    }
                    break;
                default:
                    console.log("Action not implemented yet:", action.action);
                    addToast("This action is not fully implemented yet.", "info");
            }
        } catch (e) {
            addToast(`Failed to execute action: ${(e as Error).message}`, 'error');
        }
    }, [handleAddDecks, addToast, onUpgradeDeckToLearning, handleImmediateAIGeneration]);

    const handleCancelAIGeneration = useCallback((taskId?: string) => {
        dispatch({ type: 'CANCEL_AI_TASK', payload: { taskId } });
        addToast("Generation cancelled.", "info");
    }, [dispatch, addToast]);

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

    const onReworkDeckContent = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
        if (!payload.deckId) return;
        const state = useStore.getState();
        const deck = state.decks[payload.deckId];
        if (!deck) return;

        const personaId = payload.persona || 'default';
        const storedOptions = localStorage.getItem('cogniflow-ai-options');
        let personas = [];
        if (storedOptions) {
            personas = JSON.parse(storedOptions).personas || [];
        }
        const selectedPersona = personas.find((p: any) => p.id === personaId) || { name: 'Assistant', instruction: 'You are a helpful assistant.' };

        let seriesContext = "";
        const parentSeries = Object.values(state.deckSeries).find(s => (s.levels || []).some(l => (l.deckIds || []).includes(deck.id)));
        if (parentSeries) {
            seriesContext = `Parent Series: "${parentSeries.name}"\nDescription: ${parentSeries.description}\nDecks in this series:\n` + (parentSeries.levels || []).map(l => {
                const decks = (l.deckIds || []).map(id => state.decks[id]).filter(Boolean);
                return `Level: ${l.title}\n` + (decks as Deck[]).map(d => ` - Deck: "${d.name}" (${d.description})`).join('\n');
            }).join('\n');
        }

        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Reworking "${deck.name}"...` } });
        
        try {
            const reworkedDataResponse: any = await aiService.reworkDeckContent(deck, payload, selectedPersona, seriesContext);
            const reworkedData = reworkedDataResponse;
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
                updatedDeck = {
                    ...deck,
                    name: reworkedData.name || deck.name,
                    description: reworkedData.description || deck.description,
                    infoCards: (reworkedData.infoCards || []).map((ic: any) => ({ ...ic, id: ic.id || crypto.randomUUID() })),
                    questions: createQuestionsFromImport(reworkedData.questions || [])
                } as LearningDeck;
            }

            await handleUpdateDeck(updatedDeck, { toastMessage: `"${deck.name}" reworked successfully!` });
        } catch (e) {
            console.error("Rework failed:", e);
            addToast(`Failed to rework deck: ${(e as Error).message}`, 'error');
        }
    }, [dispatch, handleUpdateDeck, addToast]);

    const onAutoPopulateSeries = useCallback(async (payload: { seriesId?: string, topic?: string, comprehensiveness?: string }, abortSignal: AbortSignal) => {
        const { seriesId, topic, comprehensiveness } = payload;
        const state = useStore.getState();
        
        // FIX: Properly type currentSeries as DeckSeries | null to fix Property 'name'/'description'/'levels' does not exist on type 'unknown' errors.
        let currentSeries: DeckSeries | null = null;
        if (seriesId) {
            currentSeries = (state.deckSeries as Record<string, DeckSeries>)[seriesId] || null;
        } else if (topic) {
            dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Designing full curriculum...' } });
            const structure: any = await aiService.generateSeriesStructure(topic, `A comprehensive course about ${topic} at ${comprehensiveness} depth.`);
            if (abortSignal.aborted) return;
            
            const allNewDecks: Deck[] = [];
            const newLevels: SeriesLevel[] = (((structure as any).levels || []) as any[]).map((levelData: any) => {
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
                name: (structure as any).name || (structure as any).seriesName || topic, 
                description: (structure as any).description || (structure as any).seriesDescription || '', 
                levels: newLevels,
                createdAt: new Date().toISOString(),
                archived: false
            };
            await handleAddSeriesWithDecks(currentSeries, allNewDecks);
        }

        if (currentSeries && seriesId) {
             dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Expanding levels...' } });
             // FIX: Correctly access properties on currentSeries which is now correctly typed as DeckSeries.
             const currentStructureStr = (currentSeries.levels || []).map((l: SeriesLevel) => `${l.title}: ${(l.deckIds||[]).length} decks`).join('\n');
             const newStructure: any = await aiService.generateSeriesStructure(currentSeries.name, currentSeries.description, currentStructureStr);
             if (abortSignal.aborted) return;

             if (newStructure && (newStructure as any).levels && Array.isArray((newStructure as any).levels) && (newStructure as any).levels.length > 0) {
                 const allNewDecks: Deck[] = [];
                 const addedLevels: SeriesLevel[] = ((newStructure as any).levels as any[]).map((levelData: any) => {
                    const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck => ({
                        id: crypto.randomUUID(), name: d.name, description: d.description,
                        type: DeckType.Quiz, questions: []
                    }));
                    allNewDecks.push(...decksForLevel);
                    return { title: levelData.title, deckIds: decksForLevel.map(d => d.id) };
                 });
                 
                 const updatedSeries: DeckSeries = { 
                     ...currentSeries, 
                     levels: [...(currentSeries.levels || []), ...addedLevels] 
                 };
                 await handleAddSeriesWithDecks(updatedSeries, allNewDecks);
             }
        }
    }, [dispatch, handleAddSeriesWithDecks, handleAddDecks, handleUpdateSeries]);

    const onAutoPopulateLevel = useCallback(async (payload: { seriesId: string, levelIndex: number }, abortSignal: AbortSignal) => {
        const { seriesId, levelIndex } = payload;
        const series = (useStore.getState().deckSeries as any)[seriesId];
        if (!series || !(series as any).levels[levelIndex]) return;
        
        const level = (series as any).levels[levelIndex];
        const currentDeckNames = (level.deckIds as string[]).map((id: string) => (useStore.getState().decks as any)[id]?.name).filter(Boolean);
        
        const newDecksDataResponse: any = await aiService.generateLevelDecks((series as any).name, (series as any).description, level.title, currentDeckNames as string[]);
        const newDecksData = newDecksDataResponse;
        if (abortSignal.aborted) return;

        const newDecks: Deck[] = (newDecksData as any[]).map((d: any) => ({
            id: crypto.randomUUID(), name: d.name, description: d.description,
            type: DeckType.Quiz, questions: []
        }));
        
        await handleAddDecks(newDecks);
        
        const updatedSeries = {
            ...series,
            levels: (series as any).levels.map((l: any, i: number) => i === levelIndex ? { ...l, deckIds: [...l.deckIds, ...newDecks.map(d => d.id)] } : l)
        };
        await handleUpdateSeries(updatedSeries, { silent: true });
    }, [handleAddDecks, handleUpdateSeries]);

    const onGenerateQuestionsForDeck = useCallback(async (deck: QuizDeck, count: number, seriesContext: any, abortSignal: AbortSignal) => {
        const questionsResponse: any = await aiService.generateQuestionsForDeck(deck, count || 5, seriesContext);
        const questions = questionsResponse;
        if (abortSignal.aborted) return;
        const newQuestions = createQuestionsFromImport(questions);
        const updatedDeck = { ...deck, questions: [...(deck.questions || []), ...newQuestions] };
        await handleUpdateDeck(updatedDeck, { silent: true });
    }, [handleUpdateDeck]);

    const onGenerateLearningContentForDeck = useCallback(async (payload: { deck: LearningDeck, comprehensiveness?: string }, abortSignal: AbortSignal) => {
        const { deck, comprehensiveness } = payload;
        const responseData: any = await aiService.generateLearningDeckContent(deck.name, comprehensiveness || 'Standard');
        const { infoCards, questions, name, description } = responseData;
        if (abortSignal.aborted) return;
        
        const today = new Date().toISOString();
        const finalInfoCards = (infoCards || []).map((ic: any) => ({
            ...ic,
            id: ic.id || crypto.randomUUID(),
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

    const onGenerateSeriesQuestionsInBatches = useCallback(async (payload: { seriesId: string }, abortSignal: AbortSignal) => {
        const { seriesId } = payload;
        const series = (useStore.getState().deckSeries as any)[seriesId];
        if (!series) return;
        
        const deckIds = ((series as any).levels || []).flatMap((l: any) => l.deckIds);
        const decks = useStore.getState().decks;
        
        for (const deckId of deckIds) {
            if (abortSignal.aborted) return;
            const deck = decks[deckId];
            if (deck && deck.type === DeckType.Quiz && (deck as QuizDeck).questions.length === 0) {
                dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating questions for "${deck.name}"...` } });
                await onGenerateQuestionsForDeck(deck as QuizDeck, 5, { name: (series as any).name, description: (series as any).description }, abortSignal);
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

        const updatedQuestionDataResponse: any = await aiService.regenerateQuestionWithAI(question, deck.name);
        const updatedQuestionData = updatedQuestionDataResponse;
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
            deckData = (await aiService.generateLearningDeckContent(payload.topic, 'Standard', false)) as any;
        } else {
            deckData = (await aiService.generateDeckFromOutline(payload.outline, payload.metadata)) as any;
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
            if (series && (series as any).levels[levelIndex]) {
                const updatedSeries = {
                    ...series,
                    levels: (series as any).levels.map((l: any, i: number) => i === levelIndex ? { ...l, deckIds: [...l.deckIds, newDeck.id] } : l)
                };
                await handleUpdateSeries(updatedSeries, { silent: true });
            }
        }
        
        addToast(`Deck "${newDeck.name}" generated!`, 'success');
    }, [dispatch, handleAddDecks, handleUpdateSeries, addToast, handleUpdateDeck]);

    const onGenerateFlashcardDeck = useCallback(async (payload: AIGenerationParams, abortSignal: AbortSignal) => {
         dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating flashcards...' } });
         
         const personaId = payload.persona || 'default';
         const storedOptions = localStorage.getItem('cogniflow-ai-options');
         let personas = [];
         if (storedOptions) {
             personas = JSON.parse(storedOptions).personas || [];
         }
         const selectedPersona = personas.find((p: any) => p.id === personaId) || { name: 'Assistant', instruction: 'You are a helpful assistant.' };

         const deckData: any = await aiService.generateFlashcardDeckWithAI(payload, selectedPersona);
         if (abortSignal.aborted) throw new Error("Cancelled by user");

         if (payload.deckId) {
             const existingDeck = useStore.getState().decks[payload.deckId];
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
        const responseData: any = await aiService.generateLearningDeckContent(payload.topic, payload.comprehensiveness, isCourse);
        const { infoCards, questions, name, description } = responseData;
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        const processedInfoCards = (infoCards || []).map((ic: any) => ({ ...ic, id: ic.id || crypto.randomUUID(), unlocksQuestionIds: ic.unlocksQuestionIds || [] }));
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
            description: description || `Generated course on ${payload.topic}`,
            type: DeckType.Learning,
            infoCards: processedInfoCards,
            questions: processedQuestions,
            learningMode: 'separate'
        };
        
        await handleAddDecks([newDeck]);
        addToast(`Learning Deck generated!`, 'success');
    }, [dispatch, handleAddDecks, addToast, handleUpdateDeck]);

    const onGenerateFullSeriesFromScaffold = useCallback(async (payload: { outline: string, generationType: string }, abortSignal: AbortSignal) => {
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Creating series structure...' } });
        
        const targetType = payload.generationType.includes('flashcard') ? DeckType.Flashcard : DeckType.Quiz;
        const structure: any = await aiService.generateScaffoldFromOutline(payload.outline, targetType);
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        const allNewDecks: Deck[] = [];
        const newLevels: SeriesLevel[] = ((structure as any).levels || []).map((levelData: any) => {
            const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck => {
                const deckBase = {
                    id: crypto.randomUUID(),
                    name: d.name,
                    description: d.description,
                };
                if (targetType === DeckType.Flashcard) {
                    return { ...deckBase, type: DeckType.Flashcard, cards: [] } as FlashcardDeck;
                } else {
                    return { ...deckBase, type: DeckType.Quiz, questions: [] } as QuizDeck;
                }
            });
            allNewDecks.push(...decksForLevel);
            return { title: levelData.title, deckIds: decksForLevel.map(d => d.id) };
        });

        const newSeries: DeckSeries = {
            id: crypto.randomUUID(),
            type: 'series',
            name: structure.seriesName || structure.name || 'New Series',
            description: structure.seriesDescription || structure.description || '',
            levels: newLevels,
            createdAt: new Date().toISOString(),
            archived: false
        };

        await handleAddSeriesWithDecks(newSeries, allNewDecks);
    }, [dispatch, handleAddSeriesWithDecks]);

    const handleAutoTagQuestions = useCallback(async (deck: QuizDeck | LearningDeck) => {
        const questions = deck.questions.map(q => ({ id: q.id, text: q.questionText }));
        if (questions.length === 0) return;

        addToast('Categorizing questions...', 'info');
        try {
            const tagsData: any = await aiService.generateTagsForQuestions(questions);
            const updatedQuestions = deck.questions.map(q => ({
                ...q,
                tags: Array.from(new Set([...(q.tags || []), ...(tagsData[q.id] || [])]))
            }));
            await handleUpdateDeck({ ...deck, questions: updatedQuestions });
            addToast('Questions tagged successfully!', 'success');
        } catch (e) {
            addToast('Failed to generate tags.', 'error');
        }
    }, [handleUpdateDeck, addToast]);

    const handleSuggestDeckIcon = useCallback(async (deck: Deck) => {
        try {
            const icon = await aiService.suggestDeckIcon(deck.name, deck.description);
            await handleUpdateDeck({ ...deck, icon });
            addToast(`Updated icon to: ${icon}`, 'success');
        } catch (e) {
            addToast('Failed to suggest icon.', 'error');
        }
    }, [handleUpdateDeck, addToast]);

    const handleExpandText = useCallback(async (topic: string, originalContent: string, selectedText: string) => {
        try {
            return await aiService.expandText(topic, originalContent, selectedText);
        } catch (e) {
            addToast("Failed to expand text.", "error");
            return null;
        }
    }, [addToast]);

    const handleGenerateCardExamples = useCallback(async (front: string, back: string, context?: string) => {
        try {
            const examples = await aiService.generateConcreteExamples(front, back, context);
            return examples;
        } catch (e) {
            addToast("Failed to generate examples.", "error");
            return null;
        }
    }, [addToast]);

    const handleHardenDistractors = useCallback(async (question: Question, context?: string) => {
        try {
            const distractors = question.options.filter(o => o.id !== question.correctAnswerId).map(o => o.text);
            const correct = question.options.find(o => o.id === question.correctAnswerId)?.text || '';
            const newDistractors: any[] = await aiService.hardenDistractors(question.questionText, correct, distractors, context);
            
            const correctAnswerObj = question.options.find(o => o.id === question.correctAnswerId)!;
            return [
                correctAnswerObj,
                ...newDistractors.map(d => ({ id: crypto.randomUUID(), text: d.text, explanation: d.explanation }))
            ].sort(() => Math.random() - 0.5);
        } catch (e) {
            addToast("Failed to harden distractors.", "error");
            return null;
        }
    }, [addToast]);

    return {
        onGenerateDeepCourse,
        onHardenAllDistractors,
        onGenerateAudioForAllCards,
        onUpgradeDeckToLearning,
        handleStartAIGeneration,
        handleImmediateAIGeneration,
        handleExecuteAIAction,
        handleCancelAIGeneration,
        handleOpenAIGenerationForDeck,
        handleOpenAIReworkForDeck,
        handleOpenAIGenerationForSeriesLevel,
        handleOpenAIAutoExpandSeries,
        onReworkDeckContent,
        onAutoPopulateSeries,
        onAutoPopulateLevel,
        onGenerateQuestionsForDeck,
        onGenerateLearningContentForDeck,
        onGenerateSeriesQuestionsInBatches,
        onRegenerateQuestion,
        onGenerateDeckFromOutline,
        onGenerateFlashcardDeck,
        onGenerateLearningDeckWithAI,
        onGenerateFullSeriesFromScaffold,
        handleAutoTagQuestions,
        handleSuggestDeckIcon,
        handleExpandText,
        handleGenerateCardExamples,
        handleHardenDistractors,
    };
};
