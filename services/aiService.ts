
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { ImportedQuizDeck, SeriesLevel, ImportedQuestion, DeckSeries, QuizDeck } from "../types";

export type AIGeneratedSeriesScaffold = {
    seriesName: string;
    seriesDescription: string;
    levels: Array<{
        title: string;
        decks: Array<Omit<ImportedQuizDeck, 'questions'> & { questions: [], suggestedQuestionCount: number }>;
    }>;
};

export type AIGeneratedQuestions = {
    questions: ImportedQuestion[];
};

// New types for extending series
export type AIGeneratedLevel = {
    title: string;
    decks: Array<Omit<ImportedQuizDeck, 'questions'> & { questions: [], suggestedQuestionCount: number }>;
};

export type AIGeneratedDeck = Omit<ImportedQuizDeck, 'questions'> & { questions: [], suggestedQuestionCount: number };


const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AI features are disabled. A Google Gemini API key is required.");
  }
  return new GoogleGenAI({ apiKey });
};

const scaffoldSchema = {
    type: Type.OBJECT,
    properties: {
        seriesName: { type: Type.STRING, description: "A creative and descriptive name for the entire learning series." },
        seriesDescription: { type: Type.STRING, description: "A brief, engaging summary of what the series covers." },
        levels: {
            type: Type.ARRAY,
            description: "An array of 2 to 4 learning levels, progressing in difficulty.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The title for this level (e.g., 'Level 1: Fundamentals')." },
                    decks: {
                        type: Type.ARRAY,
                        description: "An array of 1 to 3 quiz decks for this level.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "The name of the quiz deck, including its level number (e.g., 'Level 1.1: Core Concepts')." },
                                description: { type: Type.STRING, description: "A brief summary of this specific deck's content." },
                                questions: {
                                    type: Type.ARRAY,
                                    description: "This MUST be an empty array: []. The questions will be generated later.",
                                    maxItems: 0,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            // This is a dummy property to satisfy the API's schema validation requirements.
                                            // The model is instructed to return an empty array, and maxItems: 0 enforces this.
                                            question: { type: Type.STRING }
                                        }
                                    }
                                },
                                suggestedQuestionCount: {
                                    type: Type.NUMBER,
                                    description: "A suggested number of questions (e.g., 10, 15, 20) for this deck to ensure comprehensive topic coverage."
                                }
                            },
                            required: ['name', 'description', 'questions', 'suggestedQuestionCount']
                        }
                    }
                },
                required: ['title', 'decks']
            }
        }
    },
    required: ['seriesName', 'seriesDescription', 'levels']
};

const questionsSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "An array of high-quality multiple-choice questions for the deck.",
            items: {
                type: Type.OBJECT,
                properties: {
                    questionText: { type: Type.STRING },
                    detailedExplanation: { type: Type.STRING, description: "A thorough explanation of the correct answer, providing context and educational value." },
                    correctAnswerId: { type: Type.STRING },
                    options: {
                        type: Type.ARRAY,
                        description: "An array of 3 to 4 answer options.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING, description: "A unique identifier for the option (e.g., 'opt1')." },
                                text: { type: Type.STRING },
                            },
                            required: ['id', 'text']
                        }
                    }
                },
                required: ['questionText', 'detailedExplanation', 'correctAnswerId', 'options']
            }
        }
    },
    required: ['questions']
};

// Schemas for extending a series
const levelsSchema = {
    type: Type.ARRAY,
    description: "An array of 1 to 2 new, unique learning levels that logically follow the existing ones.",
    items: scaffoldSchema.properties.levels.items
};

const decksSchema = {
    type: Type.ARRAY,
    description: "An array of 1 to 2 new, unique quiz decks for this level.",
    items: scaffoldSchema.properties.levels.items.properties.decks.items
};


export const generateSeriesScaffoldWithAI = async (
    topic: string, 
    level: string,
    decksPerLevel: number = 5,
    questionsPerDeck: number = 20
): Promise<AIGeneratedSeriesScaffold> => {
    const ai = getAiClient();
    
    // Create a dynamic schema to guide the AI with the correct number of decks.
    const dynamicScaffoldSchema = JSON.parse(JSON.stringify(scaffoldSchema));
    dynamicScaffoldSchema.properties.levels.items.properties.decks.description = `An array of 1 to ${decksPerLevel} quiz decks for this level.`;

    const prompt = `
        Please act as an expert instructional designer. Your task is to generate a JSON object that acts as a scaffold for a learning path.

        **Topic:** ${topic}
        **Target Audience Level:** ${level}
        
        **Instructions:**
        1.  Create a progressive learning path with 2-4 distinct levels.
        2.  Each level should contain 1 to ${decksPerLevel} decks. You should decide the optimal number of decks within this range to properly cover the material for that level.
        3.  For each deck, provide a \`suggestedQuestionCount\`. Aim for approximately ${questionsPerDeck} questions, but you have the flexibility to suggest a higher or lower number if it is better for covering the deck's specific topic comprehensively.
        4.  **Crucially, for every deck object, you must include a "questions" key with an empty array as its value, like this: "questions": []**
        5.  The entire output must conform to the provided JSON schema. Do not output any text or markdown before or after the JSON object.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: dynamicScaffoldSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText) as AIGeneratedSeriesScaffold;

        if (!parsedData.seriesName || !Array.isArray(parsedData.levels)) {
            throw new Error("AI response is missing required series data.");
        }
        
        return parsedData;

    } catch (error) {
        console.error("Error generating series scaffold with AI:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please try a different topic.");
        }
        // Rethrow original error to be caught by UI
        throw error;
    }
};

export const generateMoreLevelsForSeries = async (
    series: DeckSeries,
    allDecksInStore: QuizDeck[]
): Promise<AIGeneratedLevel[]> => {
    const ai = getAiClient();
    const existingLevelsText = series.levels.map((level, index) => {
        const deckNames = level.deckIds.map(id => `- ${allDecksInStore.find(d => d.id === id)?.name}`).join('\n  ');
        return `Level ${index + 1}: ${level.title}\nDecks:\n  ${deckNames}`;
    }).join('\n\n');

    const prompt = `
        You are an expert instructional designer continuing to build a learning path.
        Here is the existing series structure:
        Series Name: ${series.name}
        Series Description: ${series.description}
        
        Existing Levels:
        ${existingLevelsText}

        Your task is to generate 1-2 NEW levels that logically follow the existing ones. Do not repeat topics.
        The new levels should continue the progression of difficulty and knowledge.
        For each new level, suggest 1-3 new decks with names, descriptions, and a suggested question count.
        The entire output must conform to the provided JSON schema, containing only an array of the new levels.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: levelsSchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as AIGeneratedLevel[];
    } catch (error) {
        console.error("Error generating more levels with AI:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings.");
        }
        throw error;
    }
};

export const generateMoreDecksForLevel = async (
    series: DeckSeries,
    levelIndex: number,
    allDecksInStore: QuizDeck[]
): Promise<AIGeneratedDeck[]> => {
    const ai = getAiClient();
    const level = series.levels[levelIndex];
    if (!level) throw new Error("Invalid level index.");

    const existingDecksText = level.deckIds.map(id => `- ${allDecksInStore.find(d => d.id === id)?.name}`).join('\n');

    const prompt = `
        You are an expert instructional designer. I need you to expand a specific level within an existing learning series.

        Series Topic: ${series.name}
        Level to expand: "${level.title}"

        This level currently contains the following decks:
        ${existingDecksText}

        Please generate 1-2 NEW, unique decks that fit logically within this level and do not repeat the topics already covered.
        For each new deck, provide a name, description, and a suggested question count.
        The entire output must conform to the provided JSON schema, containing only an array of the new decks.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: decksSchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as AIGeneratedDeck[];
    } catch (error) {
        console.error("Error generating more decks with AI:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings.");
        }
        throw error;
    }
};


type ProgressCallback = (deckId: string, questions: ImportedQuestion[]) => void;

export const generateSeriesQuestionsInBatches = async (
    series: DeckSeries,
    decksToPopulate: QuizDeck[],
    onProgress: ProgressCallback
): Promise<any[]> => { // Return the chat history
    
    const ai = getAiClient();
    const BATCH_SIZE = 20;

    const chat: Chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: series.aiChatHistory || [], // Initialize with existing history
        config: {
            responseMimeType: "application/json",
            responseSchema: questionsSchema,
        },
    });

    // Only send the initial context-setting prompt if this is a brand new chat session.
    if (!series.aiChatHistory || series.aiChatHistory.length === 0) {
        const decksListText = decksToPopulate.map(d => `- ${d.name}: ${d.description}`).join('\n');
        const initialPrompt = `
            You are an expert instructional designer creating a learning series on the topic: "${series.name}".
            I will ask you to generate questions for the following decks, one by one. Maintain context and avoid creating duplicate questions across the entire series.
            The decks we will populate are:
            ${decksListText}
            
            For each request, you must respond with a JSON object containing a "questions" array.
        `;
        // Send the initial message but don't use its response, just to set context.
        await chat.sendMessage({ message: initialPrompt });
    }

    for (const deck of decksToPopulate) {
        const totalQuestionsNeeded = deck.suggestedQuestionCount || Math.floor(Math.random() * (25 - 15 + 1)) + 15;
        let allGeneratedQuestions: ImportedQuestion[] = [];

        const numBatches = Math.ceil(totalQuestionsNeeded / BATCH_SIZE);

        for (let i = 0; i < numBatches; i++) {
            const questionsInThisBatch = Math.min(BATCH_SIZE, totalQuestionsNeeded - allGeneratedQuestions.length);
            if (questionsInThisBatch <= 0) break;

            const batchPrompt = `
                Now, generate exactly ${questionsInThisBatch} unique, high-quality questions for the deck: "${deck.name}".
                Description: "${deck.description}".
                Ensure these are different from any questions you have generated previously in this conversation.
            `;
            
            try {
                const response = await chat.sendMessage({ message: batchPrompt });
                const jsonText = response.text.trim();
                const parsedData = JSON.parse(jsonText) as AIGeneratedQuestions;
                
                if (Array.isArray(parsedData.questions)) {
                    allGeneratedQuestions.push(...parsedData.questions);
                } else {
                    console.warn(`AI did not return a valid questions array for deck "${deck.name}", batch ${i+1}.`);
                }
            } catch (error) {
                console.error(`Error generating questions for deck "${deck.name}", batch ${i+1}:`, error);
                if (error instanceof Error && error.message.includes('SAFETY')) {
                    throw new Error(`Request for "${deck.name}" was blocked due to safety settings. Please try a different topic.`);
                }
                throw new Error(`An error occurred while communicating with the AI for deck "${deck.name}". Process stopped.`);
            }
        }
        
        onProgress(deck.id, allGeneratedQuestions);
    }
    
    // After populating all decks, return the complete chat history for saving.
    return await chat.getHistory();
};
