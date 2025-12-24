
import { GoogleGenAI, Type } from "@google/genai";
import { Deck, DeckSeries, Folder, AIActionType, AIAction } from "../types";

const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AI features are disabled. A Google Gemini API key is required.");
  }
  return new GoogleGenAI({ apiKey });
};

const actionSchema = {
    type: Type.ARRAY,
    description: "An array of one or more actions the user wants to perform. If the user is just chatting, return an array with a single NO_ACTION.",
    items: {
        type: Type.OBJECT,
        properties: {
            action: {
                type: Type.STRING,
                enum: Object.values(AIActionType),
                description: "The specific action the user wants to perform. Use NO_ACTION for conversational replies."
            },
            payload: {
                type: Type.OBJECT,
                description: "The data needed to perform the action. Include only necessary fields.",
                properties: {
                    deckId: { type: Type.STRING, description: "The ID of the target deck." },
                    folderId: { type: Type.STRING, description: "The ID of the target folder. Use null to move a deck out of a folder." },
                    name: { type: Type.STRING, description: "The name for a new deck or folder." },
                    newName: { type: Type.STRING, description: "The new name for a deck or folder being renamed." },
                    seriesId: { type: Type.STRING, description: "The ID of the target series for expansion." },
                    levelIndex: { type: Type.NUMBER, description: "The 0-based index of the level within the series to add decks to." },
                    count: { type: Type.NUMBER, description: "The number of questions to generate for a deck." },
                }
            },
            confirmationMessage: {
                type: Type.STRING,
                description: "A friendly message to the user asking them to confirm the action. For a NO_ACTION, this should be the AI's conversational reply."
            }
        },
        required: ['action', 'payload', 'confirmationMessage']
    }
};

export const getAIResponse = async (
    prompt: string,
    context: {
        decks: Deck[];
        folders: Folder[];
        series: DeckSeries[];
        activeContext?: {
            deck?: Deck;
            series?: DeckSeries;
        }
    }
): Promise<AIAction[]> => {
    const ai = getAiClient();

    const decksContext = context.decks.map(d => `- Deck: "${d.name}" (id: ${d.id}, folderId: ${d.folderId || 'none'})`).join('\n');
    const foldersContext = context.folders.map(f => `- Folder: "${f.name}" (id: ${f.id})`).join('\n');
    const seriesContext = context.series.map(s => {
        const levelInfo = (s.levels || []).map((l, i) => `  - Level ${i}: ${l.title} (${(l.deckIds || []).length} decks)`).join('\n');
        return `- Series: "${s.name}" (id: ${s.id})\n${levelInfo}`;
    }).join('\n');

    let activeItemContext = "";
    if (context.activeContext?.deck) {
        const d = context.activeContext.deck;
        activeItemContext = `\nCURRENT OPEN DECK: "${d.name}" (ID: ${d.id})\n`;
        // Include summary of content if small enough
        const itemsCount = d.type === 'flashcard' ? d.cards.length : d.questions.length;
        activeItemContext += `Contains ${itemsCount} items. User might refer to this with "this deck" or "@".\n`;
    }
    if (context.activeContext?.series) {
        const s = context.activeContext.series;
        activeItemContext += `\nCURRENT OPEN SERIES: "${s.name}" (ID: ${s.id})\n`;
        activeItemContext += `User might refer to this with "this series" or "@".\n`;
    }

    const systemPrompt = `
        You are an AI assistant for 'CogniFlow', a spaced repetition app. Your goal is to help users manage their decks and folders.

        **CRITICAL: REFERENCING CONTEXT (@)**
        Users may use "@" or "this" to refer to the current deck or series they are viewing. 
        ${activeItemContext}

        You MUST respond with a JSON array of actions.

        **Capabilities:**
        - Create/rename/move/delete decks & folders.
        - Expand learning series.
        - Generate unique questions for decks using HTML formatting.
        - Answer general questions about study materials if context is provided.

        **Instructions:**
        1. Analyze user request. Use active context (marked above) if the user says "@" or "this".
        2. Find relevant IDs in the application state.
        3. For conversational replies, use 'NO_ACTION'.
        4. For data modifications, use a clear 'confirmationMessage'.

        **State:**
        Folders:
        ${foldersContext || 'None'}
        Decks:
        ${decksContext || 'None'}
        Series:
        ${seriesContext || 'None'}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: actionSchema,
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });

        const jsonText = response.text.trim();
        const parsedActions = JSON.parse(jsonText) as AIAction[];
        
        if (!Array.isArray(parsedActions)) {
            throw new Error("AI response was not a valid array of actions.");
        }
        
        return parsedActions;

    } catch (error) {
        console.error("Error getting AI response:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("Blocked by safety settings.");
        }
        throw new Error("Sorry, I had trouble with that. Try rephrasing?");
    }
};
