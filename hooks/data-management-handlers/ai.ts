import { useCallback, useMemo } from 'react';
import { useStore } from '../../store/store';
import { useToast } from '../useToast';
import { DeckType, FlashcardDeck, AIGenerationParams, AIGenerationTask } from '../../types';
import * as aiService from '../../services/aiService';
import { useAIOptions } from '../../hooks/useAIOptions';
import { createCardsFromImport } from '../../services/importService';

export const useAIHandlers = ({ 
  handleAddDecks, 
  handleUpdateDeck,
  // Stubs for other handlers that might exist
  handleGenerateQuestionsForDeck,
  onGenerateLearningDeck,
  onGenerateSeriesScaffold,
  onGenerateFullSeriesFromScaffold,
  onRegenerateQuestion,
  handleExecuteAIAction,
  handleCancelAIGeneration
}: any) => {
    const { dispatch } = useStore();
    const { addToast } = useToast();
    const { options: aiOptions } = useAIOptions();

    const onGenerateFlashcardDeck = useCallback(async (params: AIGenerationParams, abortSignal: AbortSignal) => {
        const taskId = crypto.randomUUID();
        const persona = aiOptions.personas.find(p => p.id === params.persona) || aiOptions.personas[0];
        
        // 1. Create an empty deck immediately for UI feedback
        const tempDeck: FlashcardDeck = {
            id: taskId, // Use task ID as temporary deck ID
            name: `Generating: ${params.topic}`,
            description: 'AI is creating content...',
            type: DeckType.Flashcard,
            cards: [],
            lastModified: Date.now(),
        };
        await handleAddDecks([tempDeck]);

        // 2. Generate flashcard text
        dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: 'Generating card text...', deckId: taskId } });
        const { name, description, cards: textCards } = await aiService.generateFlashcardDeckWithAI(params, persona);
        
        if (abortSignal.aborted) throw new Error("Cancelled by user");

        let finalDeck: FlashcardDeck = {
            ...tempDeck,
            name,
            description,
            cards: createCardsFromImport(textCards),
        };
        await handleUpdateDeck(finalDeck, { silent: true });

        // 3. Generate images if requested
        if (params.imageStyle && params.imageStyle !== 'none') {
            const cardsWithImages = [...finalDeck.cards];
            for (let i = 0; i < finalDeck.cards.length; i++) {
                if (abortSignal.aborted) throw new Error("Cancelled by user");
                
                const card = finalDeck.cards[i];
                dispatch({ type: 'UPDATE_CURRENT_AI_TASK_STATUS', payload: { statusText: `Generating image ${i + 1}/${finalDeck.cards.length}...`, deckId: taskId } });
                
                try {
                    let imagePrompt: string;
                    if (params.imageStyle === 'realistic') {
                        imagePrompt = await aiService.getImageDescriptionForTerm(card.front, params.topic);
                    } else { // creative
                        imagePrompt = card.front;
                    }
                    
                    if (abortSignal.aborted) throw new Error("Cancelled by user");
                    const base64Image = await aiService.generateImageWithImagen(imagePrompt);
                    const imageUrl = `data:image/jpeg;base64,${base64Image}`;
                    const imageHtml = `<img src="${imageUrl}" alt="AI generated image for ${card.front}" style="max-height: 256px; margin: auto; display: block;" />`;
                    
                    cardsWithImages[i] = {
                        ...card,
                        back: `${card.back}<br><br>${imageHtml}`,
                    };

                } catch (e) {
                    console.error(`Failed to generate image for card "${card.front}"`, e);
                    addToast(`Image generation failed for one card.`, 'error');
                    // Keep card without image
                }
                
                // Update deck progress incrementally
                finalDeck = { ...finalDeck, cards: cardsWithImages };
                await handleUpdateDeck(finalDeck, { silent: true });
            }
        }
        
        addToast(`Successfully generated deck: "${finalDeck.name}"`, 'success');
        
    }, [aiOptions.personas, handleAddDecks, handleUpdateDeck, dispatch, addToast]);

    const handleGenerateWithAI = useCallback((params: AIGenerationParams) => {
        let task: AIGenerationTask | null = null;
        const statusText = `Generating content for "${params.topic}"`;

        switch(params.generationType) {
            case 'series-scaffold':
                task = { id: crypto.randomUUID(), type: 'generateSeriesScaffoldWithAI', payload: params, statusText: `Generating series: ${params.topic}` };
                break;
            case 'single-deck-quiz':
                 task = { id: crypto.randomUUID(), type: 'generateDeckWithAI', payload: params, statusText: `Generating quiz: ${params.topic}` };
                break;
            case 'single-deck-learning':
                 task = { id: crypto.randomUUID(), type: 'generateLearningDeckWithAI', payload: params, statusText: `Generating module: ${params.topic}` };
                break;
            case 'deck-flashcard':
                task = {
                    id: crypto.randomUUID(),
                    type: 'generateFlashcardDeckWithAI',
                    payload: params,
                    statusText,
                };
                break;
        }

        if (task) {
            dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            addToast('AI task added to queue.', 'info');
        }
    }, [dispatch, addToast]);

    return useMemo(() => ({
        handleGenerateWithAI,
        onGenerateFlashcardDeck,
        // Stubs
        handleGenerateQuestionsForDeck,
        onGenerateLearningDeck,
        onGenerateSeriesScaffold,
        onGenerateFullSeriesFromScaffold,
        onRegenerateQuestion,
        handleExecuteAIAction,
        handleCancelAIGeneration
    }), [
        handleGenerateWithAI,
        onGenerateFlashcardDeck,
        handleGenerateQuestionsForDeck,
        onGenerateLearningDeck,
        onGenerateSeriesScaffold,
        onGenerateFullSeriesFromScaffold,
        onRegenerateQuestion,
        handleExecuteAIAction,
        handleCancelAIGeneration
    ]);
};