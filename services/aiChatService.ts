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
    }
): Promise<AIAction[]> => {
    const ai = getAiClient();

    const decksContext = context.decks.map(d => `- Deck: "${d.name}" (id: ${d.id}, folderId: ${d.folderId || 'none'})`).join('\n');
    const foldersContext = context.folders.map(f => `- Folder: "${f.name}" (id: ${f.id})`).join('\n');
    const seriesContext = context.series.map(s => {
        const levelInfo = (s.levels || []).map((l, i) => `  - Level ${i}: ${l.title} (${(l.deckIds || []).length} decks)`).join('\n');
        return `- Series: "${s.name}" (id: ${s.id})\n${levelInfo}`;
    }).join('\n');

    const systemPrompt = `
        You are an AI assistant for the 'CogniFlow' flashcard app. Your goal is to help users manage their decks and folders by interpreting their natural language requests.

        You MUST respond with a JSON object that is an array of actions, conforming to the provided schema.

        **Your Capabilities:**
        - Create, rename, move, and delete decks.
        - Create, rename, and delete folders.
        - Analyze and expand learning series by adding new levels or decks.
        - Generate new, unique questions for a specific quiz deck, with support for HTML formatting (e.g., \`<b>\`, \`<i>\`, \`<ruby>\`).

        **Instructions:**
        1.  Analyze the user's request.
        2.  Analyze the provided application state to find the relevant IDs for decks and folders mentioned by name.
        3.  If the user's request is ambiguous (e.g., "delete the history deck" when multiple exist), ask for clarification by using the 'NO_ACTION' type and formulating a question in the 'confirmationMessage'.
        4.  If the user is just chatting or asking a question you can't perform an action for, use the 'NO_ACTION' type and provide a helpful response in the 'confirmationMessage'.
        5.  For any action that modifies data, construct a clear and concise 'confirmationMessage' that will be presented as a button for the user to approve. Example: "Delete 'Ancient Rome' Deck?" or "Create 'Languages' Folder?".
        6.  For MOVE_DECK_TO_FOLDER, if the user wants to move a deck out of a folder, the 'folderId' in the payload should be \`null\`.
        7.  For EXPAND_SERIES_ADD_DECKS, you must identify the correct series by name to get its ID, and determine the correct 0-based 'levelIndex' from the user's request (e.g., "add a deck to the first level" means levelIndex: 0).
        8.  For GENERATE_QUESTIONS_FOR_DECK, identify the target deck by name to get its ID. If the user specifies a number (e.g., "add 10 questions"), include it in the 'count' payload property. The generated content should leverage HTML formatting where appropriate for clarity (e.g., using <b> for emphasis or <ruby> for annotations in language decks).

        **Current Application State:**
        
        **Folders:**
        ${foldersContext || 'No folders exist.'}
        
        **Decks:**
        ${decksContext || 'No decks exist.'}

        **Series:**
        ${seriesContext || 'No series exist.'}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: actionSchema,
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
            throw new Error("The request was blocked due to safety settings. Please try a different request.");
        }
        throw new Error("Sorry, I had trouble understanding that. Could you try rephrasing?");
    }
};