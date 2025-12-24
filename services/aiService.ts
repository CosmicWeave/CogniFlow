
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
    AIGenerationParams, Deck, DeckType, FlashcardDeck, QuizDeck, 
    LearningDeck, Question, Card, DeckAnalysisSuggestion 
} from "../types.ts";

// Helper to get AI client safely
const getAiClient = () => {
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
    if (!apiKey) throw new Error("API Key missing from environment (process.env.API_KEY)");
    return new GoogleGenAI({ apiKey });
};

// Helper for robust JSON parsing.
export const robustJsonParse = (text: string) => {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
};

export const generateMetadata = async (itemsText: string, contextType: 'deck' | 'series') => {
    const ai = getAiClient();
    const prompt = `
        Analyze the following educational content and suggest a high-quality name and a detailed, engaging HTML description.
        
        CONTENT:
        ${itemsText}
        
        TASK:
        1. Suggest a concise, descriptive name (e.g., "Level 1.1: Introduction to X").
        2. Suggest a 2-4 sentence description using HTML tags like <b> and <i> for emphasis. Focus on what the user will learn.
        
        JSON SCHEMA:
        {
            "name": "string",
            "description": "string (HTML)"
        }
        
        ONLY return raw JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateOutlineWithAI = async (params: AIGenerationParams, persona: any, seriesContext?: any) => {
    const ai = getAiClient();
    const prompt = `Generate a learning outline for ${params.topic} at ${params.understanding} level. ${params.generationType.includes('learning') ? `Requested comprehensiveness: ${params.comprehensiveness}.` : ''} ${params.generationType === 'rework-deck' ? `USER REWORK INSTRUCTIONS: ${params.reworkInstructions}` : ''}`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return { outline: response.text || '', metadata: { name: params.topic } };
};

export const refineOutlineWithAI = async (messages: any[], params: AIGenerationParams, persona: any) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Refine this outline based on feedback."
    });
    return response.text || '';
};

export const generateDeckFromOutline = async (outline: string, metadata: any) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate questions based on this outline: ${outline}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateScaffoldFromOutline = async (outline: string, targetType: DeckType) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a series scaffold from this outline: ${outline}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateFlashcardDeckWithAI = async (params: AIGenerationParams, persona: any) => {
    const ai = getAiClient();
    const prompt = `
        Create a high-quality flashcard deck for the topic: "${params.topic}".
        Persona: ${persona.instruction}
        Target Level: ${params.understanding}
        
        TASK:
        1. Generate a compelling name and HTML description for the deck.
        2. Generate ${params.count || 15} cards.
        
        JSON SCHEMA:
        {
            "name": "...",
            "description": "...",
            "cards": [{ "front": "...", "back": "..." }]
        }
        
        ONLY return raw JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateLearningDeckContent = async (topic: string, comprehensiveness: string = 'Standard', isCourse?: boolean) => {
    const ai = getAiClient();
    
    let countInstruction = "Generate 8-12 instructional chapters (InfoCards).";
    let detailInstruction = "Each InfoCard should be detailed and educational.";

    if (comprehensiveness === 'Exhaustive') {
        countInstruction = "Generate a TRULY EXHAUSTIVE and MASTER-LEVEL curriculum. You MUST provide at least 20 detailed instructional chapters (InfoCards).";
        detailInstruction = "CRITICAL: Each InfoCard (chapter) MUST be extremely thorough and lengthy. A single chapter should feel like several pages of high-quality textbook material. Use multiple headers, deep-dive into nuances, include historical context, edge cases, and practical examples. Do not hold back on word count.";
    } else if (comprehensiveness === 'Quick Overview') {
        countInstruction = "Generate 3-5 concise instructional chapters (InfoCards).";
    } else if (comprehensiveness === 'Comprehensive') {
        countInstruction = "Generate 15-20 detailed instructional chapters (InfoCards).";
        detailInstruction = "Each InfoCard should be a substantial read, covering topics in significant depth.";
    }

    const prompt = `
        Act as a world-class subject matter expert and instructional designer. Create a ${isCourse ? 'deep-dive structured course' : 'comprehensive learning guide'} for the topic: "${topic}".
        
        ${countInstruction}
        ${detailInstruction}
        
        REQUIREMENTS:
        1. Each InfoCard MUST use rich HTML formatting (h2, h3 headers, bolding, lists, blockquotes).
        2. For EACH InfoCard, generate 1 to 4 multiple-choice questions that specifically test the nuanced content introduced in that card. The number of questions should vary depending on the density and importance of the card's information.
        3. Ensure a logical progression from foundational concepts to advanced, interdisciplinary applications.
        4. Every question must have high-quality, pedagogical explanations for every option.
        5. Generate a compelling, professional name for this course and a detailed HTML description summarizing the learning objectives.
        
        JSON SCHEMA:
        {
            "name": "The Course Title",
            "description": "HTML summary of the course...",
            "infoCards": [
                {
                    "id": "chap-1",
                    "content": "EXTENSIVE HTML instructional text (aim for 500-1000 words per card if Exhaustive)...",
                    "unlocksQuestionIds": ["q-1", "q-2"]
                }
            ],
            "questions": [
                {
                    "id": "q-1",
                    "questionText": "...",
                    "options": [{ "id": "o1", "text": "...", "explanation": "..." }],
                    "correctAnswerId": "o1",
                    "detailedExplanation": "..."
                }
            ]
        }
        
        ONLY return raw JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 32768 } 
        }
    });
    return robustJsonParse(response.text || '{}');
};

export const reworkDeckContent = async (deck: Deck, params: AIGenerationParams) => {
    const ai = getAiClient();
    
    const contentDescription = deck.type === DeckType.Flashcard 
        ? `${(deck as FlashcardDeck).cards.length} flashcards` 
        : (deck.type === DeckType.Learning 
            ? `${(deck as LearningDeck).infoCards.length} chapters and ${(deck as LearningDeck).questions.length} questions`
            : `${(deck as QuizDeck).questions.length} questions`);

    const prompt = `
        You are an expert instructional designer. Rework the following deck titled "${deck.name}".
        
        CURRENT DECK TYPE: ${deck.type}
        CURRENT CONTENT SUMMARY: ${contentDescription}
        USER REWORK INSTRUCTIONS: "${params.reworkInstructions}"
        COMPREHENSIVENESS: ${params.comprehensiveness}
        TARGET AUDIENCE LEVEL: ${params.understanding}
        
        TASK:
        1. Fully regenerate the deck content (infoCards, questions, or cards) while maintaining the original theme but improving quality according to the instructions.
        2. If instructions specify a shift in focus or difficulty, apply that shift.
        3. Maintain the original IDs if possible for items that are being refined rather than replaced, but feel free to add/remove items to match the requested comprehensiveness.
        4. Use rich HTML formatting for all text.
        5. Generate a new, improved name and description based on the reworked content.
        
        JSON SCHEMA (MUST MATCH ORIGINAL TYPE ${deck.type}):
        {
          "name": "...",
          "description": "...",
          ${deck.type === DeckType.Flashcard ? '"cards": [{ "front": "...", "back": "..." }]' : 
            deck.type === DeckType.Quiz ? '"questions": [{ "questionText": "...", "options": [...], "correctAnswerId": "...", "detailedExplanation": "..." }]' :
            '"infoCards": [{ "content": "...", "unlocksQuestionIds": ["..."] }], "questions": [{ "id": "...", "questionText": "...", "options": [...], "correctAnswerId": "...", "detailedExplanation": "..." }]'
          }
        }
        
        ONLY return raw JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateQuestionsForDeck = async (deck: Deck, count: number, seriesContext?: any) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate ${count} questions for ${deck.name}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};

export const upgradeDeckToLearning = async (deck: Deck) => {
    const ai = getAiClient();
    
    // Extract item text for context
    let itemsText = '';
    if (deck.type === DeckType.Flashcard) {
        itemsText = deck.cards.map(c => `Card Front: ${c.front}`).join('\n');
    } else if (deck.type === DeckType.Quiz) {
        itemsText = deck.questions.map(q => `Question: ${q.questionText}`).join('\n');
    }

    const prompt = `
        Upgrade this deck named "${deck.name}" into a comprehensive Learning Deck (Course).
        
        The deck currently contains these items:
        ${itemsText}
        
        TASK:
        1. Analyze the concepts covered in the items.
        2. Generate 3-8 instructional "InfoCards" (chapters) that explain these concepts in a structured, progressive way.
        3. Use high-quality HTML formatting for the InfoCards (bolding, headers, lists).
        4. For each InfoCard, you MUST decide which of the existing question/card IDs should be "unlocked" after reading it.
        5. Map existing item IDs to the new InfoCards using the "unlocksQuestionIds" field.
        
        EXISTING IDS:
        ${(deck.type === DeckType.Flashcard ? deck.cards : (deck as QuizDeck).questions).map(i => `- ${i.id}: ${('front' in i ? i.front : (i as Question).questionText)}`).join('\n')}

        JSON SCHEMA:
        {
            "infoCards": [
                {
                    "id": "unique-id",
                    "content": "HTML instructional content...",
                    "unlocksQuestionIds": ["existing-id-1", "existing-id-2"]
                }
            ]
        }
        
        ONLY return raw JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateMnemonic = async (front: string, back: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a mnemonic to remember: ${front} means ${back}`
    });
    return response.text || '';
};

export const explainConcept = async (concept: string, context: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explain like I'm 5: ${concept}. Context: ${context}`
    });
    return response.text || '';
};

export const generateSpeech = async (text: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text }] }],
        config: { 
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
};

export const suggestDeckIcon = async (name: string, description: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest a single-word icon name from Lucide library for deck: ${name}`
    });
    return (response.text || 'book').trim() as any;
};

export const generateTagsForQuestions = async (questions: { id: string, text: string }[]) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate relevant tags for these questions: ${JSON.stringify(questions)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateConcreteExamples = async (front: string, back: string, context?: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Provide 3 concrete usage examples for: ${front} / ${back}. Context: ${context}`
    });
    return response.text || '';
};

export const hardenDistractors = async (question: string, correct: string, distractors: string[], context?: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Create better distractors for: ${question}. Correct: ${correct}. Context: ${context}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};

export const expandText = async (topic: string, originalContent: string, selectedText: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Expand on "${selectedText}" in the context of ${topic}. Original text: ${originalContent}`
    });
    return response.text || '';
};

export const generateSeriesStructure = async (name: string, description: string, currentStructure?: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a structured learning path for ${name}. Description: ${description}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateLevelDecks = async (seriesName: string, seriesDesc: string, levelTitle: string, currentDecks: string[]) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest new decks for level ${levelTitle} in series ${seriesName}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};

export const regenerateQuestionWithAI = async (question: Question, deckName: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Regenerate this question for ${deckName}: ${JSON.stringify(question)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const analyzeDeckContent = async (deck: Deck) => {
    const ai = getAiClient();
    
    let contentSummary = '';
    if (deck.type === DeckType.Flashcard) {
        contentSummary = `Flashcard Deck with ${deck.cards.length} cards.`;
    } else if (deck.type === DeckType.Quiz) {
        contentSummary = `Quiz Deck with ${deck.questions.length} questions.`;
    } else if (deck.type === DeckType.Learning) {
        const d = deck as LearningDeck;
        contentSummary = `Learning Deck (Course) with ${d.infoCards.length} chapters (InfoCards) and ${d.questions.length} questions.`;
    }

    const prompt = `
        You are a pedagogical expert analyzing educational content for a spaced repetition app.
        Analyze the following deck named "${deck.name}" and provide specific, actionable improvement suggestions.
        
        DECK TYPE: ${deck.type}
        CONTENT SUMMARY: ${contentSummary}
        DECK DATA:
        ${JSON.stringify(deck)}
        
        TASK:
        Identify issues such as:
        1. Ambiguous questions or answers.
        2. Factual inaccuracies.
        3. Spelling/Grammar errors.
        4. Poor HTML formatting (lack of bolding for key terms).
        5. (For Learning Decks) Misalignment between InfoCards (instructional text) and the Questions they are supposed to "unlock".
        6. (For Learning Decks) Important concepts mentioned in InfoCards that lack a corresponding quiz question.
        7. (For Learning Decks) Questions that test material not covered in the InfoCards.
        
        OUTPUT FORMAT:
        Return an array of suggestion objects with the following schema:
        {
            "id": "unique-slug",
            "title": "Short title of improvement",
            "category": "Instructional Alignment | Accuracy | Formatting | Clarity",
            "description": "What needs to be changed (be specific)",
            "rationale": "Why this change improves the learning experience",
            "targetId": "Optional ID of the specific InfoCard or Question being targeted"
        }
        
        ONLY return raw JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]') as DeckAnalysisSuggestion[];
};

export const applyDeckImprovements = async (deck: Deck, suggestions: DeckAnalysisSuggestion[]) => {
    const ai = getAiClient();
    
    const prompt = `
        You are a content editor. Apply the following pedagogical improvements to the provided deck.
        
        IMPROVEMENTS TO APPLY:
        ${JSON.stringify(suggestions)}
        
        ORIGINAL DECK:
        ${JSON.stringify(deck)}
        
        INSTRUCTIONS:
        1. Rewrite or restructure the deck content based on the suggestions.
        2. Ensure the output is a single valid JSON object matching the original deck's schema (${deck.type}).
        3. Maintain all existing IDs (deck, question, card, infoCard) unless the suggestion explicitly asks to remove/add items.
        4. If it's a Learning Deck, ensure the mapping of 'unlocksQuestionIds' in InfoCards and 'infoCardIds' in Questions is accurate and consistent with the new content.
        5. Generate a new, improved name and description based on the reworked content.
        
        ONLY return the raw JSON for the updated deck.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}') as Deck;
};

export const generateDeckFromImage = async (base64Data: string, mimeType: string, hint: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: `Create a flashcard deck from this image. Topic hint: ${hint}` }
            ]
        }
    });
    return robustJsonParse(response.text || '{}');
};

export const getTopicSuggestions = async (context: any) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest related learning topics for: ${JSON.stringify(context)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};
