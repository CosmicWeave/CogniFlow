import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { ImportedQuizDeck, SeriesLevel, ImportedQuestion, DeckSeries, QuizDeck, AIGeneratedDeck, AIGeneratedLevel, AIGenerationParams, DeckType, InfoCard, Question, LearningDeck } from "../types";

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


const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AI features are disabled. A Google Gemini API key is required.");
  }
  return new GoogleGenAI({ apiKey });
};

const buildContextFromParams = (params: AIGenerationParams): string => {
    const {
        topic, level, comprehensiveness, customInstructions,
        learningGoal, learningStyle, focusTopics, excludeTopics, language
    } = params;

    const languageText = language ? `**Language:** All content must be in ${language}.` : '';
    const levelText = level ? `**Target Audience Level:** ${level}` : '';
    const comprehensivenessText = comprehensiveness ? `**Comprehensiveness:** ${comprehensiveness}` : '';
    const goalText = learningGoal ? `**User's Learning Goal:** ${learningGoal}` : '';
    const styleText = learningStyle ? `**Preferred Learning Style:** ${learningStyle}` : '';
    const focusText = focusTopics ? `**Specific Topics to Focus On:** ${focusTopics}` : '';
    const excludeText = excludeTopics ? `**Topics to Exclude:** ${excludeTopics}` : '';
    const instructionsText = customInstructions ? `**Additional Instructions:** ${customInstructions}` : '';

    return [
        `**Main Topic:** ${topic}`,
        languageText,
        levelText,
        comprehensivenessText,
        goalText,
        styleText,
        focusText,
        excludeText,
        instructionsText
    ].filter(Boolean).join('\n');
};

const scaffoldSchema = {
    type: Type.OBJECT,
    properties: {
        seriesName: { type: Type.STRING, description: "A creative and descriptive name for the entire learning series." },
        seriesDescription: { type: Type.STRING, description: "A brief, engaging summary of what the series covers. Can include basic HTML (<b>, <i>)." },
        levels: {
            type: Type.ARRAY,
            description: "An array of 2 to 10 learning levels, progressing in difficulty.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The title for this level (e.g., 'Level 1: Fundamentals')." },
                    decks: {
                        type: Type.ARRAY,
                        description: "An array of 1 to 6 quiz decks for this level.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "The name of the quiz deck, including its level number (e.g., 'Level 1.1: Core Concepts')." },
                                description: { type: Type.STRING, description: "A brief summary of this specific deck's content. Can include basic HTML (<b>, <i>)." },
                                questions: {
                                    type: Type.ARRAY,
                                    description: "This MUST be an empty array: []. The questions will be generated later.",
                                    maxItems: 0,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
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
                    questionText: { type: Type.STRING, description: "The question text. Can include HTML for formatting (e.g., <b>, <i>, <ruby>)." },
                    detailedExplanation: { type: Type.STRING, description: "A thorough explanation of the correct answer, providing context and educational value. Can include HTML for rich formatting." },
                    correctAnswerId: { type: Type.STRING },
                    options: {
                        type: Type.ARRAY,
                        description: "An array of 3 to 4 answer options.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING, description: "A unique identifier for the option (e.g., 'opt1')." },
                                text: { type: Type.STRING, description: "The answer option text. Can include HTML for formatting." },
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

const deckSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "A creative and descriptive name for the quiz deck." },
        description: { type: Type.STRING, description: "A brief, engaging summary of what the deck covers. Can include basic HTML (<b>, <i>)." },
        questions: questionsSchema.properties.questions
    },
    required: ['name', 'description', 'questions']
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

const learningDeckContentSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "A creative and descriptive name for the learning deck." },
        description: { type: Type.STRING, description: "A brief, engaging summary of what the deck covers. Can include basic HTML (<b>, <i>)." },
        learningContent: {
            type: Type.ARRAY,
            description: "An array of learning blocks. Each block must contain one informational card and 3-15 questions related to it.",
            items: {
                type: Type.OBJECT,
                properties: {
                    infoCardContent: {
                        type: Type.STRING,
                        description: "The informational content for this block. Can be a paragraph or a few. Should be rich with HTML formatting for clarity (<b>, <i>, <ul>, <li>)."
                    },
                    questions: {
                        type: Type.ARRAY,
                        description: "An array of 3-15 questions related to the info card.",
                        items: questionsSchema.properties.questions.items
                    }
                },
                required: ['infoCardContent', 'questions']
            }
        }
    },
    required: ['name', 'description', 'learningContent']
};

const learningBlockSchema = { // This schema is for generating content to INJECT into an existing deck
    type: Type.OBJECT,
    properties: {
        learningContent: learningDeckContentSchema.properties.learningContent
    },
    required: ['learningContent']
};



export const generateSeriesScaffoldWithAI = async (params: AIGenerationParams): Promise<AIGeneratedSeriesScaffold> => {
    const ai = getAiClient();
    const generationContext = buildContextFromParams(params);

    const prompt = `
        Please act as an expert instructional designer. Your task is to generate a JSON object that acts as a scaffold for a learning path based on the user's request.

        **User Request:**
        ${generationContext}
        
        **Instructions:**
        1.  Create a progressive learning path with 2-10 distinct levels.
        2.  Each level should contain 1-6 decks. Decide the optimal number of decks to properly cover the material for that level.
        3.  For each deck, provide a \`suggestedQuestionCount\`. Aim for approximately 15-25 questions, but suggest a higher or lower number if it's better for the topic.
        4.  Deck and Series descriptions can use basic HTML like <b> and <i> for formatting.
        5.  **Crucially, for every deck object, include a "questions" key with an empty array: "questions": []**
        6.  All generated content must prefer the metric system (e.g., meters, kilograms, Celsius).
        7.  The entire output must conform to the provided JSON schema. Do not output any text or markdown before or after the JSON object.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: scaffoldSchema,
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
        throw error;
    }
};

export const generateDeckWithAI = async (params: AIGenerationParams): Promise<ImportedQuizDeck> => {
    const ai = getAiClient();
    const generationContext = buildContextFromParams(params);
    const questionCount = {
        "Quick Overview": "10-15",
        "Standard": "15-30",
        "Comprehensive": "30-50",
        "Exhaustive": "50-75"
    }[params.comprehensiveness || 'Standard'] || '15-30';


    const prompt = `
        You are an expert content creator. Generate a single, complete quiz deck in JSON format based on the user's request.

        **User Request:**
        ${generationContext}

        **Instructions & Quality Requirements:**
        1.  **Generate ${questionCount} high-quality questions.**
        2.  **Factual Accuracy:** All information must be factually correct and verifiable.
        3.  **HTML Formatting:** Use HTML tags like \`<b>\`, \`<i>\`, and \`<ruby>\` for rich text formatting in questions, options, and explanations. This is especially important for language learning.
        4.  **In-Depth Explanations:** The \`detailedExplanation\` is crucial. It must thoroughly explain the correct answer.
        5.  **Plausible Distractors:** Incorrect options should be plausible but clearly wrong.
        6.  **Metric System:** Prefer the metric system for all units.
        7.  The entire output must be a single JSON object conforming to the provided schema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: deckSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText) as ImportedQuizDeck;

        if (!parsedData.name || !Array.isArray(parsedData.questions)) {
            throw new Error("AI response is missing required deck data.");
        }
        
        return parsedData;

    } catch (error) {
        console.error("Error generating deck with AI:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please try a different topic.");
        }
        throw error;
    }
};

export const generateLearningDeckWithAI = async (params: AIGenerationParams): Promise<any> => {
    const ai = getAiClient();
    const generationContext = buildContextFromParams(params);
    const blockCount = {
        "Quick Overview": "3-5",
        "Standard": "5-8",
        "Comprehensive": "8-12",
        "Exhaustive": "12-15"
    }[params.comprehensiveness || 'Standard'] || '5-8';

    const prompt = `
        You are an expert instructional designer. Generate a complete "Learning Deck" in JSON format. A learning deck teaches a topic progressively with informational cards followed by questions.

        **User Request:**
        ${generationContext}

        **Instructions & Quality Requirements:**
        1.  **Structure:** Create ${blockCount} learning blocks. Each block must consist of:
            a. A single \`infoCardContent\` field with well-written, informative text (using HTML for formatting).
            b. An array of 3-5 high-quality \`questions\` that are directly based on the information in the \`infoCardContent\`.
        2.  **Progressive Learning:** The blocks should be ordered logically to guide the user from basic concepts to more complex ones.
        3.  **Content Quality:** All information must be factually correct. Explanations must be thorough. Incorrect options for questions must be plausible.
        4.  **HTML Formatting:** Use HTML tags like \`<b>\`, \`<i>\`, \`<ul>\`, \`<li>\`, and \`<ruby>\` extensively for rich text formatting.
        5.  **Metric System:** Prefer the metric system for all units.
        6.  The entire output must be a single JSON object conforming to the provided schema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: learningDeckContentSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);

        if (!parsedData.name || !Array.isArray(parsedData.learningContent)) {
            throw new Error("AI response is missing required learning deck data.");
        }
        
        return parsedData;

    } catch (error) {
        console.error("Error generating learning deck with AI:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please try a different topic.");
        }
        throw error;
    }
};


export const generateMoreLevelsForSeries = async (
    series: DeckSeries,
    allDecksInStore: QuizDeck[]
): Promise<{ newLevels: AIGeneratedLevel[], history: any[] }> => {
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
        For each new level, suggest 1-3 new decks with names, descriptions, and a suggested question count. Descriptions can include basic HTML (<b>, <i>).
        All generated content should prefer the metric system (e.g., meters, kilograms, Celsius).
        The entire output must conform to the provided JSON schema, containing only an array of the new levels.
    `;
    
    const chat: Chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: series.aiChatHistory || [],
        config: {
            responseMimeType: "application/json",
            responseSchema: levelsSchema,
        },
    });

    try {
        const response = await chat.sendMessage({ message: prompt });
        const jsonText = response.text.trim();
        const newLevels = JSON.parse(jsonText) as AIGeneratedLevel[];
        const history = await chat.getHistory();
        return { newLevels, history };
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
): Promise<{ newDecks: AIGeneratedDeck[], history: any[] }> => {
    const ai = getAiClient();
    const level = series.levels[levelIndex];
    if (!level) throw new Error("Invalid level index.");

    const existingDecksText = level.deckIds.map(id => `- ${allDecksInStore.find(d => d.id === id)?.name}`).join('\n');

    const prompt = `
        You are an expert instructional designer. I need you to expand a specific level within an existing learning series.

        Series Topic: ${series.name}
        Level to expand: "${level.title}"

        This level currently contains the following decks:
        ${existingDecksText || '(No decks yet)'}

        Please generate 1-2 NEW, unique decks that fit logically within this level and do not repeat the topics already covered.
        For each new deck, provide a name, description, and a suggested question count. Descriptions can include basic HTML (<b>, <i>).
        All generated content should prefer the metric system (e.g., meters, kilograms, Celsius).
        The entire output must conform to the provided JSON schema, containing only an array of the new decks.
    `;
    
    const chat: Chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: series.aiChatHistory || [],
        config: {
            responseMimeType: "application/json",
            responseSchema: decksSchema,
        },
    });

    try {
        const response = await chat.sendMessage({ message: prompt });
        const jsonText = response.text.trim();
        const newDecks = JSON.parse(jsonText) as AIGeneratedDeck[];
        const history = await chat.getHistory();
        return { newDecks, history };
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
): Promise<any[]> => {
    
    const ai = getAiClient();
    const BATCH_SIZE = 20;

    const chat: Chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: series.aiChatHistory || [],
        config: {
            responseMimeType: "application/json",
            responseSchema: questionsSchema,
        },
    });

    if (!series.aiChatHistory || series.aiChatHistory.length === 0) {
        const generationContext = series.aiGenerationParams 
            ? buildContextFromParams(series.aiGenerationParams)
            : `You are an expert instructional designer creating a learning series on the topic: "${series.name}".`;

        const decksListText = decksToPopulate.map(d => `- ${d.name}: ${d.description}`).join('\n');
        const initialPrompt = `
            ${generationContext}
            I will ask you to generate questions for the following decks, one by one. Maintain context and avoid creating duplicate questions across the entire series.
            
            **Important Rule:** All generated content must prefer the metric system (e.g., meters, kilograms, Celsius).
            **HTML Formatting:** Use tags like \`<b>\`, \`<i>\`, and \`<ruby>\` for rich text formatting. For example, use <ruby>漢字<rt>かんじ</rt></ruby> for Japanese Kanji. This is highly encouraged for language-learning content.

            The decks we will populate are:
            ${decksListText}
            
            For each request, you must respond with a JSON object containing a "questions" array.
        `;
        await chat.sendMessage({ message: initialPrompt });
    }

    for (const deck of decksToPopulate) {
        const totalQuestionsNeeded = deck.suggestedQuestionCount || 15;
        let allGeneratedQuestions: ImportedQuestion[] = [];

        const numBatches = Math.ceil(totalQuestionsNeeded / BATCH_SIZE);

        for (let i = 0; i < numBatches; i++) {
            const questionsInThisBatch = Math.min(BATCH_SIZE, totalQuestionsNeeded - allGeneratedQuestions.length);
            if (questionsInThisBatch <= 0) break;

            const batchPrompt = `
                Now, generate exactly ${questionsInThisBatch} unique, high-quality questions for the deck: "${deck.name}".
                Description: "${deck.description}".
                Ensure these are different from any questions you have generated previously in this conversation and align with the series context.
                Remember to prefer the metric system and use HTML formatting where appropriate.
            `;
            
            try {
                const response = await chat.sendMessage({ message: batchPrompt });
                const jsonText = response.text.trim();
                const parsedData = JSON.parse(jsonText) as AIGeneratedQuestions;
                
                if (!Array.isArray(parsedData.questions)) {
                    console.error(`AI response for deck "${deck.name}" did not contain a valid 'questions' array. Response:`, jsonText);
                    throw new Error(`The AI returned an invalid data structure for deck "${deck.name}".`);
                }
                allGeneratedQuestions.push(...parsedData.questions);
                
            } catch (error) {
                console.error(`Error generating questions for deck "${deck.name}", batch ${i+1}:`, error);
                if (error instanceof Error && error.message.includes('SAFETY')) {
                    throw new Error(`Request for "${deck.name}" was blocked. Please try a different topic.`);
                }
                throw new Error(`AI error for deck "${deck.name}". Process stopped.`);
            }
        }
        
        onProgress(deck.id, allGeneratedQuestions);
    }
    
    return await chat.getHistory();
};

export const generateSeriesLearningContentInBatches = async (
    series: DeckSeries,
    decksToPopulate: LearningDeck[],
    onProgress: (deckId: string, content: any) => void
): Promise<any[]> => {
    
    const ai = getAiClient();

    const chat: Chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: series.aiChatHistory || [],
        config: {
            responseMimeType: "application/json",
            responseSchema: learningBlockSchema,
        },
    });

    if (!series.aiChatHistory || series.aiChatHistory.length === 0) {
        const generationContext = series.aiGenerationParams 
            ? buildContextFromParams(series.aiGenerationParams)
            : `You are an expert instructional designer creating a learning series on the topic: "${series.name}".`;
        
        const decksListText = decksToPopulate.map(d => `- ${d.name}: ${d.description}`).join('\n');
        const initialPrompt = `
            ${generationContext}
            I will ask you to generate learning content (informational cards and related questions) for the following decks, one by one. Maintain context and ensure a logical progression of topics across the entire series.
            
            **Important Rule:** All generated content must prefer the metric system (e.g., meters, kilograms, Celsius).
            **HTML Formatting:** Use tags like \`<b>\`, \`<i>\`, \`<ul>\`, \`<li>\`, and \`<ruby>\` for rich text formatting.

            The decks we will populate are:
            ${decksListText}
            
            For each request, you must respond with a JSON object containing a "learningContent" array.
        `;
        await chat.sendMessage({ message: initialPrompt });
    }

    for (const deck of decksToPopulate) {
        const blockCount = {
            "Quick Overview": "3-5",
            "Standard": "5-8",
            "Comprehensive": "8-12",
            "Exhaustive": "12-15"
        }[deck.aiGenerationParams?.comprehensiveness || 'Standard'] || '5-8';

        const prompt = `
            Now, generate the learning content for the deck: "${deck.name}".
            Description: "${deck.description}".
            Create ${blockCount} learning blocks. Each block should have an 'infoCardContent' and an array of 3-5 'questions' directly related to it.
            Ensure the content is unique and fits logically within the series.
        `;
        
        try {
            const response = await chat.sendMessage({ message: prompt });
            const jsonText = response.text.trim();
            const parsedData = JSON.parse(jsonText);
            
            if (!parsedData.learningContent || !Array.isArray(parsedData.learningContent)) {
                 console.error(`AI response for learning deck "${deck.name}" did not contain a valid 'learningContent' array. Response:`, jsonText);
                 throw new Error(`The AI returned an invalid data structure for learning deck "${deck.name}".`);
            }
            onProgress(deck.id, parsedData.learningContent);
            
        } catch (error) {
            console.error(`Error generating content for learning deck "${deck.name}":`, error);
            if (error instanceof Error && error.message.includes('SAFETY')) {
                throw new Error(`Request for "${deck.name}" was blocked. Please try a different topic.`);
            }
            throw new Error(`AI error for deck "${deck.name}". Process stopped.`);
        }
    }
    
    return await chat.getHistory();
};

export const generateQuestionsForDeck = async (
    deck: QuizDeck,
    count: number,
    seriesContext?: { series: DeckSeries; allDecks: QuizDeck[] }
): Promise<AIGeneratedQuestions> => {
    const ai = getAiClient();

    let existingQuestionsContext = "This deck is currently empty.";
    if (deck.questions && deck.questions.length > 0) {
        existingQuestionsContext = `This deck already contains the following questions. DO NOT create questions on these specific topics:\n` +
            deck.questions.map(q => `- ${q.questionText}`).slice(0, 50).join('\n');
    }
    
    const baseContext = deck.aiGenerationParams ? buildContextFromParams(deck.aiGenerationParams) : `**Main Topic:** ${deck.name}`;

    let generationContext = `You are an expert instructional designer. Your task is to generate a JSON object containing high-quality, unique questions for a flashcard deck.\n\n**Deck Context:**\n${baseContext}`;
    
    if (seriesContext?.series) {
        if (seriesContext.series.aiGenerationParams) {
             generationContext += '\n\n**Overall Series Context:**\n' + buildContextFromParams(seriesContext.series.aiGenerationParams);
        }
        const otherDecks = seriesContext.allDecks.filter(d => d.id !== deck.id);
        if (otherDecks.length > 0) {
            generationContext += `
                \nThis deck is part of a larger series called "${seriesContext.series.name}".
                Be aware of the other decks in this series to avoid repetition:
                ${otherDecks.map(d => `- ${d.name}: ${d.description}`).join('\n')}
            `;
        }
    }
    
    const prompt = `
        ${generationContext}

        **Number of New Questions to Generate:** ${count}
        
        **Existing Questions in this Deck:**
        ${existingQuestionsContext}
        
        **Instructions & Quality Requirements:**
        1.  **Generate UNIQUE Content:** Create **${count} NEW and UNIQUE** questions that are not duplicates of the "Existing Questions" listed above.
        2.  **Factual Accuracy:** All information must be factually correct and verifiable.
        3.  **HTML Formatting:** Use HTML tags like \`<b>\`, \`<i>\`, and \`<ruby>\` for rich text formatting. For example, use <ruby>漢字<rt>かんじ</rt></ruby> for Japanese Kanji.
        4.  **In-Depth Explanations:** The \`detailedExplanation\` is crucial and must be thorough.
        5.  **Plausible Distractors:** Incorrect options should be plausible but clearly wrong.
        6.  **Metric System:** Prefer the metric system for all units.
        7.  The entire output must be a single JSON object conforming to the provided schema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: questionsSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText) as AIGeneratedQuestions;

        if (!Array.isArray(parsedData.questions)) {
            throw new Error("AI response did not contain a valid 'questions' array.");
        }
        
        return parsedData;

    } catch (error) {
        console.error("Error generating deck questions with AI:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please try a different topic.");
        }
        throw error;
    }
};