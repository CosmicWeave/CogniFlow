
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { 
    AIGenerationParams, Deck, DeckType, FlashcardDeck, QuizDeck, 
    LearningDeck, Question, Card, DeckAnalysisSuggestion, InfoCard 
} from "../types.ts";

// Helper to get AI client safely
const getAiClient = () => {
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
    if (!apiKey) throw new Error("API Key missing from environment (process.env.API_KEY)");
    return new GoogleGenAI({ apiKey });
};

/**
 * Robust JSON parsing that handles formatting issues.
 */
export const robustJsonParse = (text: string): any => {
    if (!text) return null;
    
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (initialError) {
        const firstBrace = text.indexOf('{');
        const firstBracket = text.indexOf('[');
        
        let start = -1;
        let endChar = '';

        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace;
            endChar = '}';
        } else if (firstBracket !== -1) {
            start = firstBracket;
            endChar = ']';
        }

        if (start !== -1) {
            const end = text.lastIndexOf(endChar);
            if (end > start) {
                const potentialJson = text.substring(start, end + 1);
                try {
                    return JSON.parse(potentialJson);
                } catch (retryError) {
                    console.error("JSON repair extraction failed:", retryError);
                    const err = new Error("Malformed JSON response from AI.") as any;
                    err.jsonString = text;
                    throw err;
                }
            }
        }
        const err = new Error("No JSON structure found in AI response.") as any;
        err.jsonString = text;
        throw err;
    }
};

/**
 * Transforms standard text into a holistic instructional guide with custom options.
 */
export const holisticExpandContent = async (
    topic: string, 
    content: string, 
    persona: any,
    options: {
        targetWordCount?: number;
        analogyIntensity?: 'none' | 'standard' | 'aggressive';
        thinkingBudget?: number;
    } = {}
): Promise<string> => {
    const ai = getAiClient();
    
    const analogyPrompt = options.analogyIntensity === 'none' 
        ? "Do not use analogies." 
        : (options.analogyIntensity === 'aggressive' 
            ? "Use multiple, layered physical analogies to explain abstract parts of the concept. Make them vivid and relatable." 
            : "Add a concrete physical analogy for the core concept.");

    const prompt = `
        Act as the following expert persona: ${persona.name}.
        Persona Instructions: ${persona.instruction}
        
        TOPIC: "${topic}"
        CURRENT CONTENT: 
        ${content}
        
        TASK:
        Expand this content into a world-class holistic instructional block. 
        
        REQUIREMENTS:
        1. Target length: Approximately ${options.targetWordCount || 500} words.
        2. Keep all original facts and data.
        3. ${analogyPrompt}
        4. Connect the topic to broader interdisciplinary context (historical, social, or scientific).
        5. Use aggressive HTML formatting (h2, h3, bold, blockquotes) to guide the reader.
        6. The prose should be rhythmic, engaging, and embody the selected persona perfectly.
        
        OUTPUT: Return only the improved HTML.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            thinkingConfig: { 
                thinkingBudget: options.thinkingBudget !== undefined ? options.thinkingBudget : 32768 
            } 
        }
    });
    return response.text || content;
};

/**
 * Generates additional higher-order thinking questions for a specific instructional context.
 */
export const generateDeepAssessments = async (
    topic: string, 
    content: string, 
    count: number,
    bloomsFocus: string = "Analysis, Synthesis, and Evaluation"
): Promise<any[]> => {
    const ai = getAiClient();
    const prompt = `
        You are an expert psychometrician. Analyze this instructional material about "${topic}":
        ${content}
        
        TASK:
        Generate ${count} high-quality multiple-choice questions.
        
        REQUIREMENTS:
        1. Aim for Bloom's Taxonomy: ${bloomsFocus}.
        2. Each option must have a brief pedagogical explanation.
        3. Factual accuracy is paramount.
        
        JSON SCHEMA:
        {
            "questions": [
                {
                    "questionText": "...",
                    "bloomsLevel": "Analysis",
                    "options": [
                        { "id": "1", "text": "...", "explanation": "..." }
                    ],
                    "correctAnswerId": "1",
                    "detailedExplanation": "..."
                }
            ]
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    const parsed = robustJsonParse(response.text || '{}');
    return parsed.questions || [];
};

export const generateCourseCurriculum = async (params: AIGenerationParams, persona: any): Promise<any> => {
    const ai = getAiClient();
    const sourceSection = params.sourceMaterial 
        ? `\nCRITICAL SOURCE MATERIAL (PRIORITIZE THIS):\n${params.sourceMaterial}\n`
        : "";

    const prompt = `
        You are a world-class instructional designer. Create a detailed curriculum for a deep-dive Hyper-Course on: "${params.topic}".
        Target Level: ${params.understanding}
        Persona: ${persona.instruction}
        Target length: Approximately ${params.chapterCount || 12} chapters.
        ${sourceSection}

        TASK:
        1. Generate a professional name and a 3-5 sentence HTML summary.
        2. Design a sequence of chapters (InfoCards) based on the topic ${params.sourceMaterial ? 'and strictly grounded in the provided source material' : ''}.
        3. For each chapter, provide a unique 'id', a title, and a detailed bulleted list of sub-topics.
        4. Define prerequisites using 'prerequisiteChapterIds'.
        5. Generate a "sharedDictionary" of 10-20 core technical terms and their canonical definitions for this course.
        
        JSON SCHEMA:
        {
            "name": "Course Title",
            "description": "Full course summary (HTML)",
            "sharedDictionary": { "TermA": "Definition A", "TermB": "Definition B" },
            "chapters": [
                {
                    "id": "chap-1",
                    "title": "Chapter Title",
                    "learningObjectives": ["Obj 1", "Obj 2"],
                    "topics": ["Topic A", "Topic B"],
                    "prerequisiteChapterIds": []
                }
            ]
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export async function* generateChapterDeepContentStream(
    topic: string, 
    chapterInfo: any, 
    totalChapters: number, 
    chapterIndex: number, 
    persona: any, 
    targetChapterWords: number,
    sharedDictionary: any,
    logicalStateVector: string,
    sourceMaterial?: string
) {
    const ai = getAiClient();
    const sourceSection = sourceMaterial 
        ? `\nCRITICAL SOURCE MATERIAL (STAY FAITHFUL TO THIS):\n${sourceMaterial}\n`
        : "";

    const prompt = `
        Act as an expert subject matter expert and the following persona: ${persona.name}.
        Persona Instructions: ${persona.instruction}
        
        COURSE TOPIC: "${topic}"
        CHAPTER ${chapterIndex + 1}/${totalChapters}: "${chapterInfo.title}"
        LEARNING OBJECTIVES: ${chapterInfo.learningObjectives.join(', ')}
        TOPICS TO COVER: ${chapterInfo.topics.join(', ')}
        ${sourceSection}

        TERMINOLOGY LOCK: ${JSON.stringify(sharedDictionary)}
        COURSE PROGRESS STATE: ${logicalStateVector}
        
        TASK:
        Generate the full, detailed text for this chapter. 
        Target word count: ${targetChapterWords} words.
        
        REQUIREMENTS:
        1. Use aggressive HTML formatting (h2, h3, bold, blockquotes).
        2. If source material was provided, ensure every fact mentioned is grounded in that material. 
        3. Do not re-introduce concepts summarized in the COURSE PROGRESS STATE.
        
        OUTPUT FORMAT: Return raw HTML content.
    `;

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 32768 } }
    });

    for await (const chunk of stream) {
        if (chunk.text) {
            yield (chunk as GenerateContentResponse).text;
        }
    }
}

export const generateChapterDeepContent = async (
    topic: string, 
    chapterInfo: any, 
    totalChapters: number, 
    chapterIndex: number, 
    persona: any, 
    targetChapterWords: number, 
    sharedDictionary: any, 
    logicalStateVector: string, 
    sourceMaterial?: string
): Promise<any> => {
    const ai = getAiClient();
    const sourceSection = sourceMaterial 
        ? `\nCRITICAL SOURCE MATERIAL (STAY FAITHFUL TO THIS):\n${sourceMaterial}\n`
        : "";

    const prompt = `
        Act as an expert subject matter expert and the following persona: ${persona.name}.
        Persona Instructions: ${persona.instruction}
        
        COURSE TOPIC: "${topic}"
        CHAPTER ${chapterIndex + 1}/${totalChapters}: "${chapterInfo.title}"
        ${sourceSection}

        TERMINOLOGY LOCK: ${JSON.stringify(sharedDictionary)}
        COURSE PROGRESS STATE: ${logicalStateVector}
        
        TASK:
        Generate the full, detailed text for this chapter inside a JSON object.
        Target word count: ${targetChapterWords} words.
        
        JSON SCHEMA:
        {
            "content": "Full HTML Content...",
            "summaryForArchivist": "A 1-paragraph summary of what was covered."
        }
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

export const generateLearningDeckContent = async (topic: string, comprehensiveness: string = 'Standard', isCourse?: boolean, sourceMaterial?: string): Promise<any> => {
    const ai = getAiClient();
    const sourceSection = sourceMaterial 
        ? `\nUSER PROVIDED SOURCE MATERIAL (BASE EVERYTHING ON THIS):\n${sourceMaterial}\n`
        : "";

    const prompt = `
        Act as a world-class SME. Create a ${isCourse ? 'deep-dive course' : 'learning guide'} for the topic: "${topic}".
        Desired Depth: ${comprehensiveness}
        ${sourceSection}
        
        REQUIREMENTS:
        1. Generate detailed instructional InfoCards (chapters) using rich HTML.
        2. If source material is provided, ONLY use the concepts found in that material.
        3. For EACH InfoCard, generate 1-4 multiple-choice questions with pedagogical explanations.
        4. Generate a professional name and description.
        
        JSON SCHEMA:
        {
            "name": "The Title",
            "description": "HTML summary",
            "infoCards": [ { "id": "chap-1", "content": "HTML...", "unlocksQuestionIds": ["q-1"] } ],
            "questions": [ { "id": "q-1", "questionText": "...", "options": [...], "correctAnswerId": "...", "detailedExplanation": "..." } ]
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 32768 } }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateOutlineWithAI = async (params: AIGenerationParams, persona: any, seriesContext?: any) => {
    const ai = getAiClient();
    const sourceSection = params.sourceMaterial 
        ? `\nBASED ON THIS SOURCE MATERIAL:\n${params.sourceMaterial}\n` 
        : "";

    const prompt = `Generate a learning outline for ${params.topic} at ${params.understanding} level. ${sourceSection}`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return { outline: response.text || '', metadata: { name: params.topic } };
};

export const generateFlashcardDeckWithAI = async (params: AIGenerationParams, persona: any): Promise<any> => {
    const ai = getAiClient();
    const sourceSection = params.sourceMaterial 
        ? `\nSTAY FAITHFUL TO THIS SOURCE MATERIAL:\n${params.sourceMaterial}\n` 
        : "";

    const prompt = `
        Create a high-quality flashcard deck for: "${params.topic}".
        ${sourceSection}
        JSON SCHEMA: { "name": "...", "description": "...", "cards": [...] }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const testConnectivity = async (): Promise<{ status: 'ok' | 'error'; message: string }> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'ping',
            config: { maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } }
        });
        if (response.text) {
            return { status: 'ok', message: 'Connection established successfully.' };
        }
        return { status: 'error', message: 'Received empty response from AI.' };
    } catch (e: any) {
        console.error("AI Connectivity Test Failed:", e);
        return { status: 'error', message: e.message || 'Unknown error occurred.' };
    }
};

export const generateMetadata = async (itemsText: string, contextType: 'deck' | 'series'): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Analyze the following educational content and suggest a high-quality name and a detailed, engaging HTML description.
        
        CONTENT:
        ${itemsText}
        
        TASK:
        1. Suggest a concise, descriptive name (e.g., "Level 1.1: Introduction to X").
        2. Suggest a 2-4 sentence description using HTML tags like <b> and <i> for emphasis.
        
        JSON SCHEMA: { "name": "string", "description": "string (HTML)" }
        ONLY return raw JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateLogicalStateVector = async (topic: string, previousChapters: string[], sharedDictionary: any): Promise<string> => {
    const ai = getAiClient();
    const prompt = `
        You are an Educational Archivist. Review the following summaries of chapters already completed in a course on "${topic}".
        
        SHARED TERMINOLOGY LOCK:
        ${JSON.stringify(sharedDictionary)}
        
        CHAPTER SUMMARIES:
        ${previousChapters.join('\n\n')}
        
        TASK:
        Generate a concise "Logical State Vector" summary.
        
        OUTPUT: Return only the plain text summary.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return response.text || '';
};

export const verifyContentWithSearch = async (topic: string, chapterTitle: string, content: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Analyze this chapter about "${chapterTitle}" in a course on "${topic}".
        CONTENT: ${content}
        TASK: Use Google Search to verify every technical, historical, and scientific claim.
        JSON SCHEMA: { "isAccurate": boolean, "corrections": [ { "originalClaim": "...", "correction": "...", "source": "..." } ] }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json' 
        }
    });
    return robustJsonParse(response.text || '{}');
};

export const refineContentWithCorrections = async (topic: string, originalContent: string, corrections: any[]): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Refine this content about "${topic}" using verified corrections:
        ${JSON.stringify(corrections)}
        ORIGINAL: ${originalContent}
        JSON SCHEMA: { "refinedContent": "..." }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateFactualSVG = async (topic: string, content: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Generate an animated SVG diagram for this topic: ${topic}.
        CONTENT: ${content}
        JSON SCHEMA: { "hasDiagram": boolean, "svgCode": "...", "caption": "..." }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateGroundedFidelityImage = async (topic: string, content: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Generate a high-fidelity grounded image for: ${topic}
        TEXT: ${content}
        TASK: Research the visual appearance and provide an illustration.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
        }
    });

    let imageUrl = null;
    let description = "";

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        else if (part.text) description = part.text;
    }

    return { imageUrl, description };
};

export const generateChapterQuestionsAndAudit = async (topic: string, chapterTitle: string, htmlContent: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Analyze this chapter: "${chapterTitle}" on "${topic}".
        CONTENT: ${htmlContent}
        TASK: Generate 3-5 challenging questions and refine HTML.
        JSON SCHEMA: { "refinedContent": "...", "questions": [...] }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const refineOutlineWithAI = async (messages: any[], params: AIGenerationParams, persona: any) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Refine this outline based on feedback."
    });
    return response.text || '';
};

export const generateDeckFromOutline = async (outline: string, metadata: any): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate questions based on this outline: ${outline}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateScaffoldFromOutline = async (outline: string, targetType: DeckType): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a series scaffold from this outline: ${outline}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const reworkDeckContent = async (deck: Deck, params: AIGenerationParams, persona: any, seriesContext?: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Rework deck "${deck.name}". Instructions: "${params.reworkInstructions}".
        CURRENT CONTENT: ${JSON.stringify(deck)}
        JSON SCHEMA (MATCH ORIGINAL TYPE ${deck.type}): { "name": "...", "description": "...", ... }
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

export const generateQuestionsForDeck = async (deck: Deck, count: number, seriesContext?: any): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate ${count} questions for ${deck.name}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};

export const upgradeDeckToLearning = async (deck: Deck): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Upgrade deck "${deck.name}" into a Learning Deck.
        EXISTING ITEMS: ${JSON.stringify(deck)}
        JSON SCHEMA: { "infoCards": [ { "id": "...", "content": "...", "unlocksQuestionIds": [...] } ] }
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
        contents: `Create a mnemonic for: ${front} means ${back}`
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

export const generateTagsForQuestions = async (questions: { id: string, text: string }[]): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate tags for: ${JSON.stringify(questions)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateConcreteExamples = async (front: string, back: string, context?: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Provide 3 examples for: ${front} / ${back}.`
    });
    return response.text || '';
};

export const hardenDistractors = async (question: string, correct: string, distractors: string[], context?: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Harden distractors for: ${question}.`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};

export const expandText = async (topic: string, originalContent: string, selectedText: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Expand on "${selectedText}" in ${topic}.`
    });
    return response.text || '';
};

export const generateSeriesStructure = async (name: string, description: string, currentStructure?: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate structure for ${name}.`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateLevelDecks = async (seriesName: string, seriesDesc: string, levelTitle: string, currentDecks: string[]): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest decks for ${levelTitle} in ${seriesName}.`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};

export const regenerateQuestionWithAI = async (question: Question, deckName: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Regenerate question for ${deckName}: ${JSON.stringify(question)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const analyzeDeckContent = async (deck: Deck): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analyze deck quality: ${deck.name}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]') as DeckAnalysisSuggestion[];
};

export const applyDeckImprovements = async (deck: Deck, suggestions: DeckAnalysisSuggestion[]): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Improve deck based on suggestions: ${JSON.stringify(suggestions)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}') as Deck;
};

export const generateDeckFromImage = async (base64Data: string, mimeType: string, hint: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: `Create deck from image. Hint: ${hint}` }
            ]
        }
    });
    return robustJsonParse(response.text || '{}');
};

export const getTopicSuggestions = async (context: any): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest topics for: ${JSON.stringify(context)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};
