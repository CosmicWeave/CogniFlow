// services/aiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { AIGenerationParams, AIGenerationAnalysis, AIMessage, QuizDeck, LearningDeck, Question, Deck } from '../types.ts';
import { stripHtml } from "./utils.ts";

const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AI features are disabled. A Google Gemini API key is required.");
  }
  return new GoogleGenAI({ apiKey });
};

export class AIJsonResponseError extends Error {
    constructor(message: string, public rawResponse: string) {
        super(message);
        this.name = 'AIJsonResponseError';
    }
}

async function getAndParseJson(model: string, systemInstruction: string, userPrompt: string, schema: any, temperature?: number): Promise<any> {
    const ai = getAiClient();
    let jsonText = '';
    try {
        const response = await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: temperature,
            },
        });
        jsonText = response.text.trim();
        if (!jsonText) {
            throw new Error("AI returned an empty response.");
        }
        return JSON.parse(jsonText);
    } catch (error: any) {
        console.error("Error getting AI response:", error);
        if (error instanceof SyntaxError && jsonText) {
            throw new AIJsonResponseError("AI returned malformed JSON. You may be able to fix it manually.", jsonText);
        }
        if (error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please try a different request.");
        }
        if (error.message.includes('Rpc failed due to xhr error')) {
            throw new Error("A network error occurred while communicating with the AI service. Please check your connection and try again. The service may be temporarily unavailable.");
        }
        throw new Error(`AI generation failed: ${error.message}`);
    }
}

const getBasePrompt = (params: AIGenerationParams): string => {
    let prompt = `Generate content based on the following parameters:\n- Topic: ${params.topic}\n- User's Understanding Level: ${params.understandingLevel}\n- User's Learning Goal: ${params.learningGoal}\n- Comprehensiveness: ${params.comprehensiveness}\n- Language: ${params.language}\n`;

    if (params.sourceContent) prompt += `- Provided Text Content: ${params.sourceContent.substring(0, 4000)}...\n`;
    if (params.sourceUrl) prompt += `- Provided URL: ${params.sourceUrl}\n`;
    if (params.topicsToInclude) prompt += `- Topics to Include: ${params.topicsToInclude}\n`;
    if (params.topicsToExclude) prompt += `- Topics to Exclude: ${params.topicsToExclude}\n`;

    if (params.brainstormHistory) {
      prompt += `\nHere is the brainstorming conversation we had to refine the plan:\n${params.brainstormHistory}`;
    }
    return prompt;
};

export const getTopicSuggestions = async (topic: string): Promise<{ topicsToInclude: string[]; topicsToExclude: string[] }> => {
    const systemInstruction = `You are a topic suggestion engine. Based on a primary topic, generate a list of related sub-topics to include for a comprehensive study guide, and a list of related but distinct topics to exclude to maintain focus.`;
    const userPrompt = `Primary topic: "${topic}"`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            topicsToInclude: { type: Type.ARRAY, items: { type: Type.STRING } },
            topicsToExclude: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['topicsToInclude', 'topicsToExclude']
    };
    return getAndParseJson('gemini-2.5-flash', systemInstruction, userPrompt, schema);
};

export const getAIGenerationAnalysis = async (params: AIGenerationParams): Promise<AIGenerationAnalysis> => {
    const { topic, sourceContent, sourceUrl, understandingLevel, learningGoal } = params;
    const systemInstruction = `You are an instructional design expert. Your task is to analyze a user's request for generating learning content and provide structured suggestions to kickstart a conversation.`;
    let userPrompt = `Analyze the following request for generating a learning module:\n- Topic: ${topic}\n- User's Understanding Level: ${understandingLevel}\n- User's Learning Goal: ${learningGoal}\n`;
    if (sourceContent) userPrompt += `- Provided Text Content: ${sourceContent.substring(0, 2000)}...\n`;
    if (sourceUrl) userPrompt += `- Provided URL: ${sourceUrl}\n`;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            interpretation: { type: Type.STRING, description: "A brief interpretation of the user's request and the source material." },
            titleSuggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 creative and descriptive title suggestions." },
            questionCountSuggestions: { 
                type: Type.ARRAY, 
                items: {
                    type: Type.OBJECT,
                    properties: {
                        label: { type: Type.STRING },
                        count: { type: Type.NUMBER }
                    },
                    required: ['label', 'count']
                },
                description: "Suggestions for content scope, like 'Quick Review (10 questions)', 'Standard (25 questions)', 'Deep Dive (50 questions)'."
            },
            followUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A few clarifying questions to ask the user to improve the generation." }
        },
        required: ['interpretation', 'titleSuggestions', 'questionCountSuggestions', 'followUpQuestions']
    };

    return getAndParseJson('gemini-2.5-flash', systemInstruction, userPrompt, schema, params.temperature);
};

export const brainstormWithAI = async (params: AIGenerationParams, history: AIMessage[]): Promise<string> => {
    try {
        const ai = getAiClient();
        const systemInstruction = `You are an instructional design expert. Your task is to have a brief, helpful conversation with a user to refine their request for learning content. Ask clarifying questions based on the initial request and the conversation so far. Keep your responses concise and conversational.`;

        const historyString = history.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
        
        let userPrompt = `This is the user's initial request:\n- Topic: ${params.topic}\n- User's Understanding Level: ${params.understandingLevel}\n- User's Learning Goal: ${params.learningGoal}\n`;
        if (params.sourceContent) userPrompt += `- Provided Text Content: (summary is sufficient)\n`;
        if (params.sourceUrl) userPrompt += `- Provided URL: ${params.sourceUrl}\n`;
        userPrompt += `\nThis is our conversation so far:\n${historyString}\n\nYour turn to respond:`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: { systemInstruction, temperature: 0.5 },
        });
        
        return response.text;
    } catch (error: any) {
        console.error("Error in brainstormWithAI:", error);
        if (error.message.includes('Rpc failed due to xhr error')) {
            throw new Error("A network error occurred while communicating with the AI service. Please check your connection and try again.");
        }
        throw error;
    }
};

export const generateSeriesScaffoldWithAI = async (params: AIGenerationParams): Promise<any> => {
    const { systemInstruction: personaInstruction, temperature } = params;
    const systemInstruction = `${personaInstruction}\n\nYou are a world-class instructional designer. Your task is to generate a comprehensive, structured learning path scaffold in JSON format based on the user's request and our brainstorming conversation. The path should be broken into logical 'levels', and each level into 'decks'. Provide a name and description for the series, and for each level and deck.`;
    const userPrompt = getBasePrompt(params);
    
    const schema = {
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
                                    suggestedQuestionCount: { type: Type.NUMBER }
                                },
                                required: ['name', 'description']
                            }
                        }
                    },
                    required: ['title', 'decks']
                }
            }
        },
        required: ['seriesName', 'seriesDescription', 'levels']
    };

    return getAndParseJson('gemini-2.5-pro', systemInstruction, userPrompt, schema, temperature);
};

const questionSchema = {
    type: Type.OBJECT,
    properties: {
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
                    explanation: { type: Type.STRING }
                },
                required: ['id', 'text', 'explanation']
            }
        },
        correctAnswerId: { type: Type.STRING }
    },
    required: ['questionText', 'detailedExplanation', 'options', 'correctAnswerId']
};

export const generateDeckWithAI = async (params: AIGenerationParams): Promise<any> => {
    const { systemInstruction: personaInstruction, temperature } = params;
    const systemInstruction = `${personaInstruction}\n\nYou generate high-quality quiz decks in JSON format based on the user's request and our brainstorming conversation. Each question must have multiple options, a correct answer, and a detailed explanation.`;
    const userPrompt = getBasePrompt(params);

    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            questions: {
                type: Type.ARRAY,
                items: questionSchema
            }
        },
        required: ['name', 'description', 'questions']
    };
    return getAndParseJson('gemini-2.5-pro', systemInstruction, userPrompt, schema, temperature);
};

export const generateLearningDeckWithAI = async (params: AIGenerationParams): Promise<any> => {
    const { systemInstruction: personaInstruction, temperature } = params;
    const systemInstruction = `${personaInstruction}\n\nYou create learning modules in JSON format based on the user's request and our brainstorming conversation. Each module consists of an informational HTML content block followed by several multiple-choice questions that test understanding of that content.`;
    const userPrompt = getBasePrompt(params);

    const schema = {
        type: Type.OBJECT,
        properties: {
            infoCardContent: { type: Type.STRING, description: "Well-formatted HTML content explaining the topic." },
            questions: {
                type: Type.ARRAY,
                items: questionSchema
            }
        },
        required: ['infoCardContent', 'questions']
    };
    return getAndParseJson('gemini-2.5-pro', systemInstruction, userPrompt, schema, temperature);
};

export const generateQuestionsForDeckWithAI = async (deck: QuizDeck | LearningDeck, count?: number): Promise<Partial<Question>[]> => {
    const systemInstruction = `You are an expert at creating quiz questions. Given a deck's title, description, and existing questions, generate new, unique, high-quality questions in JSON format.`;
    const existingQuestions = (deck.questions || []).map(q => `- ${stripHtml(q.questionText)}`).join('\n');
    const userPrompt = `Deck Name: "${deck.name}"\nDeck Description: "${deck.description}"\n\nExisting questions to avoid duplicating:\n${existingQuestions}\n\nGenerate ${count || 10} new questions based on the deck's topic.`;

    const schema = {
        type: Type.ARRAY,
        items: questionSchema
    };

    return getAndParseJson('gemini-2.5-pro', systemInstruction, userPrompt, schema);
};

export const regenerateQuestionWithAI = async (deck: QuizDeck | LearningDeck, questionToReplace: Question): Promise<Partial<Question>> => {
    const systemInstruction = `You are an expert at improving quiz questions. Given a question, regenerate it to be clearer, more accurate, or more challenging, while keeping the same core topic. Output a single JSON question object.`;
    const userPrompt = `Regenerate this question:\n\n${JSON.stringify({
        questionText: questionToReplace.questionText,
        options: questionToReplace.options,
        correctAnswerId: questionToReplace.correctAnswerId
    }, null, 2)}`;
    
    return getAndParseJson('gemini-2.5-flash', systemInstruction, userPrompt, questionSchema);
};

export const expandOnText = async (topic: string, originalContent: string, selectedText: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const systemInstruction = `You are a helpful assistant that expands on a selected piece of text within a larger context. Provide a more detailed explanation of the selected text as a single block of HTML.`;
        const userPrompt = `Topic: ${topic}\n\nOriginal Content:\n"""\n${stripHtml(originalContent)}\n"""\n\nSelected Text to Expand On:\n"""\n${selectedText}\n"""\n\nProvide a detailed explanation:`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: { systemInstruction },
        });
        
        return response.text;
    } catch (error: any) {
        console.error("Error in expandOnText:", error);
        if (error.message.includes('Rpc failed due to xhr error')) {
            throw new Error("A network error occurred. Please check your connection and try again.");
        }
        throw error;
    }
};