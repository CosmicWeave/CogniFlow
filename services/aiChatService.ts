
import { GoogleGenAI, Type } from "@google/genai";
import { Deck, DeckSeries, Folder, AIActionType, AIAction, DeckType, FlashcardDeck, LearningDeck, QuizDeck } from "../types";

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
                    reworkInstructions: { type: Type.STRING, description: "Detailed instructions for reworking the deck content (e.g. 'Expand info cards')." },
                    persona: { type: Type.STRING, description: "The ID of the persona to use for rework (e.g. 'the_master', 'feynman'). Default to 'default' if not specified." }
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
    
    let activeItemContext = "";
    let seriesOutlineContext = "";

    if (context.activeContext?.deck) {
        const d = context.activeContext.deck;
        activeItemContext = `\n--- START ACTIVE DECK CONTENT ---\nCURRENT OPEN DECK: "${d.name}" (ID: ${d.id})\nTYPE: ${d.type}\n`;
        
        if (d.type === DeckType.Flashcard) {
            const fd = d as FlashcardDeck;
            activeItemContext += `CARDS (${fd.cards.length}):\n` + fd.cards.map(c => `- Front: ${c.front}\n  Back: ${c.back}`).join('\n');
        } else {
            const qd = d as QuizDeck | LearningDeck;
            if (d.type === DeckType.Learning) {
                const ld = d as LearningDeck;
                activeItemContext += `INFO CARDS (${ld.infoCards.length}):\n` + ld.infoCards.map(ic => `- Content: ${ic.content}`).join('\n');
            }
            activeItemContext += `QUESTIONS (${qd.questions.length}):\n` + qd.questions.map(q => `- Question: ${q.questionText}\n  Correct Answer: ${q.options.find(o => o.id === q.correctAnswerId)?.text}`).join('\n');
        }
        activeItemContext += `\n--- END ACTIVE DECK CONTENT ---\n`;
    }

    if (context.activeContext?.series) {
        const s = context.activeContext.series;
        seriesOutlineContext = `\n--- START ACTIVE SERIES CONTEXT ---\nCURRENT OPEN SERIES: "${s.name}" (ID: ${s.id})\n`;
        seriesOutlineContext += `Levels:\n` + s.levels.map((l, i) => {
            const levelDecks = l.deckIds.map(id => context.decks.find(d => d.id === id)).filter(Boolean);
            return `Level ${i}: ${l.title}\n` + levelDecks.map(d => `  - Deck: "${d?.name}" (${d?.description})`).join('\n');
        }).join('\n');
        seriesOutlineContext += `\n--- END ACTIVE SERIES CONTEXT ---\n`;
    }

    const systemPrompt = `
        You are an AI assistant for 'CogniFlow', a spaced repetition app. Your goal is to help users manage their decks and folders.

        **PERSONAS**
        Users can request content generation using specific personas. Available personas:
        - 'default': Helpful and neutral assistant.
        - 'tutor': Friendly, uses analogies, simple language.
        - 'professor': Formal, academic, in-depth, precise.
        - 'author': Concise, fact-focused, no fluff.
        - 'lindstrom': Linguistic, cultural, witty, slightly dry.
        - 'bryson': Sense of wonder, conversational, avoids jargon, dry humor.
        - 'feynman': Simplicity, physical analogies, "why" and "how" focused.
        - 'roach': Intense curiosity, human side of science, funny,Relatable.
        - 'great_teacher': Storytelling, modeling radical curiosity.
        - 'the_master': Ultimate mentor. 5 pillars: Stylist (rhythm), Storyteller (human struggle), Analogy Architect, Provocateur (challenge assumptions), Formatter (aggressive HTML use).

        **CRITICAL: REFERENCING CONTEXT (@)**
        Users may use "@" or "this" to refer to the current deck or series they are viewing.
        ${activeItemContext}
        ${seriesOutlineContext}

        You MUST respond with a JSON array of actions.

        **Capabilities:**
        - Create/rename/move/delete decks & folders.
        - Expand learning series.
        - Generate unique questions for decks using HTML formatting.
        - REWORK content: If a user asks to "improve", "expand", or "rewrite" an existing deck (using a persona or not), use REWORK_DECK.
        - Answer general questions about study materials if context is provided.

        **Instructions:**
        1. Analyze user request. Use active context (marked above) if the user says "@" or "this".
        2. For content rework (e.g. "Expand info cards using the Master persona"), identify the target deck ID, extract any requested persona ID (if requested), and provide the specific instructions.
        3. For conversational replies, use 'NO_ACTION'.
        4. For data modifications, use a clear 'confirmationMessage'.

        **State Summary:**
        Folders: ${foldersContext || 'None'}
        Series: ${context.series.map(s => s.name).join(', ') || 'None'}
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
