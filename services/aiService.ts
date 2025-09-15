// services/aiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { AIGenerationParams, ImportedQuestion, LearningDeck, QuizDeck, DeckSeries, AIGeneratedLevel, AIGeneratedDeck, Question, InfoCard, DeckType } from "../types";
import { createQuestionsFromImport } from './importService';

const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AI features are disabled. A Google Gemini API key is required.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Schemas ---

const questionSchema = {
    type: Type.OBJECT,
    properties: {
        questionType: { type: Type.STRING, enum: ['multipleChoice'] },
        questionText: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        detailedExplanation: { type: Type.STRING },
        options: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    explanation: { type: Type.STRING, description: "A brief explanation for why this specific option is right or wrong." },
                },
                required: ['id', 'text', 'explanation']
            }
        },
        correctAnswerId: { type: Type.STRING }
    },
    required: ['questionType', 'questionText', 'detailedExplanation', 'options', 'correctAnswerId']
};

export const questionGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            items: questionSchema
        }
    },
    required: ['questions']
};

export const seriesScaffoldGenerationSchema = {
    type: Type.OBJECT,
    properties: {
      seriesName: { type: Type.STRING },
      seriesDescription: { type: Type.STRING },
      levels: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            decks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  suggestedQuestionCount: { type: Type.NUMBER },
                },
                required: ['name', 'description', 'suggestedQuestionCount'],
              },
            },
          },
          required: ['title', 'decks'],
        },
      },
    },
    required: ['seriesName', 'seriesDescription', 'levels'],
};

const learningBlockSchema = {
    type: Type.OBJECT,
    properties: {
        infoCardContent: { type: Type.STRING, description: "The HTML content for the info card, explaining a concept." },
        questions: { type: Type.ARRAY, items: questionSchema, description: "A list of questions that test the knowledge presented in the info card." }
    },
    required: ['infoCardContent', 'questions']
};

// --- System Prompts ---

const getSystemPrompt = (task: string, params: AIGenerationParams & { useStrictSources?: boolean }): string => `
You are an expert instructional designer generating content for a spaced repetition learning app called CogniFlow.
Your task is to: ${task}

**Topic:** ${params.topic}
${params.level ? `**Designed for Level:** ${params.level}` : ''}
${params.learningGoal ? `**Learning Goal:** ${params.learningGoal}` : ''}
${params.learningStyle ? `**Learning Style:** ${params.learningStyle}` : ''}
${params.focusTopics ? `**Focus On:** ${params.focusTopics}` : ''}
${params.excludeTopics ? `**Exclude:** ${params.excludeTopics}` : ''}
${params.customInstructions ? `**Additional Instructions:** ${params.customInstructions}` : ''}
${params.language ? `**Output Language:** ${params.language}` : ''}
${(params as any).useStrictSources ? '\n**CRITICAL: You MUST base your response strictly and exclusively on the content of the provided files. Do not use any external knowledge.**' : ''}

**CRITICAL CONTENT QUALITY REQUIREMENTS:**
-   **Engaging & Curiosity-Driven:** All content must be written in an engaging style that sparks curiosity. Avoid a dry, academic tone. Use surprising facts or real-world scenarios.
-   **Factual Accuracy:** All information must be factually correct.
-   **In-Depth Questions:** Questions should cover the topic comprehensively.
-   **Unpredictable Answer Length:** The correct answer's text length must be varied.
-   **Option Explanations:** Every option, correct or incorrect, MUST have a brief \`explanation\` field.
-   **Clarity:** Questions must be unambiguous. When using an acronym, provide the full term in parentheses upon its first use (e.g., 'CPU (Central Processing Unit)').
-   **HTML Formatting:** Use basic HTML for formatting (e.g., <b>, <i>, <code>).

The final output MUST be ONLY a single, raw JSON object conforming to the provided schema. Do not include any surrounding text or markdown.
`;

// --- API Functions ---

export async function generateSeriesScaffoldWithAI(params: AIGenerationParams): Promise<{ seriesName: string, seriesDescription: string, levels: AIGeneratedLevel[] }> {
    console.log('[aiService] Called generateSeriesScaffoldWithAI with params:', params);
    const ai = getAiClient();
    const systemPrompt = getSystemPrompt("Generate a JSON object for a learning series scaffold. A scaffold contains the series name, description, and levels with deck names and descriptions, but no questions.", params);
    
    console.log('[aiService] Sending prompt to Gemini for series scaffold...');
    const prompt = "Please generate the series scaffold based on my requirements.";
    const { sourceParts } = params;
    const contents = sourceParts && sourceParts.length > 0
        ? { parts: [{ text: prompt }, ...sourceParts] }
        : prompt;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: seriesScaffoldGenerationSchema
        }
    });
    
    const result = JSON.parse(response.text);
    console.log('[aiService] Received and parsed series scaffold from Gemini.');
    return result;
}

export async function generateSeriesQuestionsInBatches(
    seriesId: string,
    onProgress: (progress: { deckId: string; questions: ImportedQuestion[] }) => void
): Promise<void> {
    const { useStore } = await import('../store/store');
    const { decks, deckSeries } = useStore.getState();
    const series = deckSeries.find(s => s.id === seriesId);
    if (!series) throw new Error("Series not found for batch generation.");

    console.log(`[aiService] Starting batch question generation for series "${series.name}"`);
    const seriesDeckIds = new Set((series.levels || []).flatMap(l => l.deckIds || []));
    const emptyDecks = decks.filter(d => seriesDeckIds.has(d.id) && d.type === DeckType.Quiz && (d.questions?.length || 0) === 0) as QuizDeck[];

    for (const deck of emptyDecks) {
        try {
            const count = deck.suggestedQuestionCount || 10;
            console.log(`[aiService] Generating ${count} questions for deck "${deck.name}"...`);
            const response = await generateQuestionsForDeck(deck, count);
            console.log(`[aiService] Received ${response.questions.length} questions for deck "${deck.name}".`);
            onProgress({ deckId: deck.id, questions: response.questions });
        } catch (error) {
            console.error(`[aiService] Failed to generate questions for deck "${deck.name}":`, error);
            // Continue to the next deck even if one fails
        }
    }
    console.log(`[aiService] Finished batch question generation for series "${series.name}"`);
}

export async function generateSeriesLearningContentInBatches(
    seriesId: string,
    onProgress: (progress: { deckId: string; newInfoCards: InfoCard[], newQuestions: Question[] }) => void
): Promise<void> {
     const { useStore } = await import('../store/store');
    const { decks, deckSeries } = useStore.getState();
    const series = deckSeries.find(s => s.id === seriesId);
    if (!series) throw new Error("Series not found for batch generation.");
    
    console.log(`[aiService] Starting batch learning content generation for series "${series.name}"`);
    const seriesDeckIds = new Set((series.levels || []).flatMap(l => l.deckIds || []));
    const emptyDecks = decks.filter(d => seriesDeckIds.has(d.id) && d.type === DeckType.Learning && (d.infoCards?.length || 0) === 0) as LearningDeck[];
    
    for (const deck of emptyDecks) {
        try {
            const { newInfoCards, newQuestions } = await generateContentForLearningDeck(deck, deck.aiGenerationParams || { topic: deck.name });
            onProgress({ deckId: deck.id, newInfoCards, newQuestions });
        } catch (error) {
             console.error(`[aiService] Failed to generate content for learning deck "${deck.name}":`, error);
        }
    }
     console.log(`[aiService] Finished batch learning content generation for series "${series.name}"`);
}

export async function generateQuestionsForDeck(deck: QuizDeck, count: number): Promise<{ questions: ImportedQuestion[] }> {
    console.log(`[aiService] Generating ${count} questions for deck "${deck.name}"`);
    const ai = getAiClient();
    const systemPrompt = getSystemPrompt(`Generate ${count} new, unique questions for an existing quiz deck.`, { topic: deck.name, customInstructions: deck.description, ...deck.aiGenerationParams });
    const { sourceParts } = deck.aiGenerationParams || {};

    const prompt = `The deck already contains these questions (do not repeat them): \n${(deck.questions || []).map(q => `- ${q.questionText}`).join('\n')}`;
    const contents = sourceParts && sourceParts.length > 0
        ? { parts: [{ text: prompt }, ...sourceParts] }
        : prompt;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: questionGenerationSchema
        }
    });

    const result = JSON.parse(response.text);
    if (!result || !Array.isArray(result.questions)) {
        console.warn('[aiService] AI response for questions was missing or not an array. Returning empty array.', result);
        return { questions: [] };
    }
    console.log(`[aiService] Received and parsed ${result.questions.length} questions.`);
    return result;
}

export async function generateContentForLearningDeck(deck: LearningDeck, params: AIGenerationParams): Promise<{ newInfoCards: InfoCard[], newQuestions: Question[] }> {
    console.log(`[aiService] Generating content for learning deck "${deck.name}"...`);
    const systemPrompt = getSystemPrompt("Generate a set of learning blocks for a learning deck. Each block should have an info card and related questions.", params);
    const { sourceParts } = params;
    
    const prompt = `Generate approximately ${deck.suggestedQuestionCount || 10} questions in total, distributed across a few learning blocks.`;
    const contents = sourceParts && sourceParts.length > 0
        ? { parts: [{ text: prompt }, ...sourceParts] }
        : prompt;

    const response = await getAiClient().models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: learningBlockSchema }
        }
    });
    const learningBlocks = JSON.parse(response.text) as { infoCardContent: string; questions: ImportedQuestion[] }[];
    
    if (!Array.isArray(learningBlocks)) {
        console.warn('[aiService] AI response for learning blocks was not an array. Returning empty.', learningBlocks);
        return { newInfoCards: [], newQuestions: [] };
    }

    console.log(`[aiService] Received ${learningBlocks.length} learning blocks for deck "${deck.name}".`);
    
    const newInfoCards: InfoCard[] = [];
    const newQuestions: Question[] = [];

    learningBlocks.forEach(block => {
        if (!block || !block.infoCardContent) return; // Skip malformed blocks
        const infoCardId = crypto.randomUUID();
        const questionsForBlock = createQuestionsFromImport(block.questions || []).map(q => ({...q, infoCardIds: [infoCardId]}));
        const newInfoCard: InfoCard = { id: infoCardId, content: block.infoCardContent, unlocksQuestionIds: questionsForBlock.map(q => q.id) };
        newInfoCards.push(newInfoCard);
        newQuestions.push(...questionsForBlock);
    });

    return { newInfoCards, newQuestions };
}
