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
 * Verifies if the API key is valid by performing a minimal request.
 */
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

/**
 * Robust JSON parsing that handles:
 * 1. Markdown code blocks (```json ... ```)
 * 2. Leading/Trailing conversational text
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

export const generateMetadata = async (itemsText: string, contextType: 'deck' | 'series'): Promise<any> => {
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

export const generateCourseCurriculum = async (params: AIGenerationParams, persona: any): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        You are a world-class instructional designer. Create a detailed curriculum for a deep-dive Hyper-Course on: "${params.topic}".
        Target Level: ${params.understanding}
        Persona: ${persona.instruction}
        Target length: Approximately ${params.chapterCount || 12} chapters.
        
        TASK:
        1. Generate a professional name and a 3-5 sentence HTML summary.
        2. Design a sequence of ${params.chapterCount || 12} chapters (InfoCards).
        3. For each chapter, provide a unique 'id' (e.g., 'chap-intro'), a title, and a detailed bulleted list of sub-topics.
        4. Define prerequisites using 'prerequisiteChapterIds'.
        5. CRITICAL: Generate a "sharedDictionary" of 10-20 core technical terms and their canonical definitions for this course. This serves as a "Terminology Lock" to ensure consistency across chapters.
        
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

export const generateLogicalStateVector = async (topic: string, previousChapters: string[], sharedDictionary: any): Promise<string> => {
    const ai = getAiClient();
    const prompt = `
        You are an Educational Archivist. Review the following summaries of chapters already completed in a course on "${topic}".
        
        SHARED TERMINOLOGY LOCK:
        ${JSON.stringify(sharedDictionary)}
        
        CHAPTER SUMMARIES:
        ${previousChapters.join('\n\n')}
        
        TASK:
        Generate a concise "Logical State Vector". This is a dense summary of:
        1. Core concepts already defined.
        2. Prerequisites established.
        3. Specific narrative threads or case studies introduced.
        
        This vector will be fed into the next chapter's generation agent to prevent redundant introductions and ensure narrative flow.
        
        OUTPUT: Return only the plain text summary (max 500 words).
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return response.text || '';
};

/**
 * Live Synthesis Engine: Streaming Chapter Draft
 */
export async function* generateChapterDeepContentStream(
    topic: string, 
    chapterInfo: any, 
    totalChapters: number, 
    chapterIndex: number, 
    persona: any, 
    targetChapterWords: number,
    sharedDictionary: any,
    logicalStateVector: string
) {
    const ai = getAiClient();
    const prompt = `
        Act as an expert subject matter expert and the following persona: ${persona.name}.
        Persona Instructions: ${persona.instruction}
        
        COURSE TOPIC: "${topic}"
        CHAPTER ${chapterIndex + 1}/${totalChapters}: "${chapterInfo.title}"
        LEARNING OBJECTIVES: ${chapterInfo.learningObjectives.join(', ')}
        TOPICS TO COVER: ${chapterInfo.topics.join(', ')}
        
        TERMINOLOGY LOCK (You MUST adhere to these definitions):
        ${JSON.stringify(sharedDictionary)}
        
        COURSE PROGRESS STATE (What has already been covered):
        ${logicalStateVector}
        
        TASK:
        Generate the full, detailed text for this chapter. 
        Target word count: ${targetChapterWords} words.
        
        REQUIREMENTS:
        1. Use aggressive HTML formatting (h2, h3 headers, bolding for key terms, blockquotes for important quotes/principles).
        2. The text MUST be dense, informative, and flow like a high-quality textbook. 
        3. Include historical context, theoretical foundations, and practical edge-cases.
        
        OUTPUT FORMAT: Return raw HTML content. Do NOT wrap in JSON for this stream.
    `;

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            thinkingConfig: { thinkingBudget: 32768 }
        }
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
    logicalStateVector: string
): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Act as an expert subject matter expert and the following persona: ${persona.name}.
        Persona Instructions: ${persona.instruction}
        
        COURSE TOPIC: "${topic}"
        CHAPTER ${chapterIndex + 1}/${totalChapters}: "${chapterInfo.title}"
        LEARNING OBJECTIVES: ${chapterInfo.learningObjectives.join(', ')}
        TOPICS TO COVER: ${chapterInfo.topics.join(', ')}
        
        TERMINOLOGY LOCK (You MUST adhere to these definitions):
        ${JSON.stringify(sharedDictionary)}
        
        COURSE PROGRESS STATE (What has already been covered):
        ${logicalStateVector}
        
        TASK:
        Generate the full, detailed text for this chapter. 
        Target word count: ${targetChapterWords} words.
        
        REQUIREMENTS:
        1. Use aggressive HTML formatting (h2, h3 headers, bolding for key terms, blockquotes for important quotes/principles).
        2. The text MUST be dense, informative, and flow like a high-quality textbook. 
        3. Do not re-introduce concepts summarized in the COURSE PROGRESS STATE unless deepening the explanation.
        4. Include historical context, theoretical foundations, practical edge-cases, and deep-dive technical nuances.
        
        OUTPUT: Return only the HTML content string inside a JSON object.
        {
            "content": "Full HTML Content Here...",
            "summaryForArchivist": "A 1-paragraph summary of what was covered for the next chapter's state vector."
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

export const verifyContentWithSearch = async (topic: string, chapterTitle: string, content: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        You are a Fact-Checker (Agent B). Analyze this chapter about "${chapterTitle}" in a course on "${topic}".
        
        CONTENT:
        ${content}
        
        TASK:
        1. Use Google Search to verify every technical, historical, and scientific claim.
        2. Identify any inaccuracies, oversimplifications, or hallucinations.
        3. Provide a detailed list of required corrections with citations if possible.
        
        JSON SCHEMA:
        {
            "isAccurate": boolean,
            "corrections": [
                { "originalClaim": "...", "correction": "...", "source": "..." }
            ],
            "overallQualityScore": number (1-10)
        }
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
        Refine the following educational content about "${topic}" by applying the verified corrections provided.
        
        ORIGINAL CONTENT:
        ${originalContent}
        
        CORRECTIONS TO APPLY:
        ${JSON.stringify(corrections)}
        
        TASK:
        Rewrite the content to be 100% factually accurate while maintaining the original tone and formatting.
        
        JSON SCHEMA:
        {
            "refinedContent": "Full HTML..."
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 16384 }
        }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateFactualSVG = async (topic: string, content: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Based on the following educational content about "${topic}", identify ONE complex process, structure, or system that needs a visual aid.
        
        CONTENT:
        ${content}
        
        TASK:
        1. Design a factual, clean, and pedagogical SVG diagram (e.g., a process flow, a structural diagram, or a timeline).
        2. The diagram MUST be factually accurate and use standard conventions.
        3. **CRITICAL (Animated Kinetics)**: Include CSS <style> block inside the SVG using @keyframes to animate motion (e.g., arrows moving along a path, pulse effects on key nodes, spinning orbits). The animations should be slow and educational.
        4. **CRITICAL (Explorable Visuals)**: Assign unique, descriptive \`id\` attributes to every major component, group (\`<g>\`), or node in the SVG (e.g., \`id="vascular-bundle"\`, \`id="electron-transport-chain"\`).
        5. Use professional, modern design with clear labels. 
        6. Return the SVG code embedded in a JSON object.
        
        JSON SCHEMA:
        {
            "hasDiagram": boolean,
            "svgCode": "<svg ...>...</svg>",
            "caption": "Factual description of the diagram"
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

/**
 * Veo Process Integration: Generates a 5s high-fidelity loop for complex dynamic transformations.
 */
export const generateProcessVideo = async (topic: string, content: string): Promise<any> => {
    const ai = getAiClient();
    
    // Step 1: Filter - Identify if a dynamic video loop is pedagogy-enhancing
    const analysisResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this educational text about "${topic}". Identify ONE highly complex dynamic transformation or microscopic process that is difficult to visualize with a static image but would be perfect for a 5-second educational video loop.
        
        TEXT:
        ${content}
        
        If found, provide a detailed, cinematic video prompt for Veo 3.1.
        
        JSON SCHEMA:
        {
            "isHighComplexity": boolean,
            "videoPrompt": "Cinematic 3D render of [process]...",
            "educationalReasoning": "How this video helps the learner..."
        }`,
        config: { responseMimeType: 'application/json' }
    });
    
    const analysis = robustJsonParse(analysisResponse.text);
    if (!analysis?.isHighComplexity || !analysis.videoPrompt) return null;

    // Step 2: Veo Generation
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `Educational scientific animation: ${analysis.videoPrompt}. High fidelity, 4K render style, slow motion, detailed textures, clear visualization.`,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    });

    // Step 3: Poll for Completion
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
    }

    // Step 4: Fetch and convert to Data URL for offline storage
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
    const videoResponse = await fetch(`${downloadLink}&key=${apiKey}`);
    const blob = await videoResponse.blob();
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ 
            dataUrl: reader.result, 
            caption: analysis.educationalReasoning 
        });
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Global Course Consistency Auditor Pass.
 * Runs after the entire course has been synthesized.
 */
export const globalCourseAudit = async (topic: string, courseName: string, chapters: InfoCard[], sharedDictionary: any): Promise<any> => {
    const ai = getAiClient();
    const courseSkeleton = chapters.map((c, i) => `Chapter ${i+1}: ${c.content.substring(0, 300)}...`).join('\n\n');
    
    const prompt = `
        You are a Master Epistemic Auditor. Review the following synthesized course on "${topic}".
        
        COURSE NAME: "${courseName}"
        TERMINOLOGY LOCK: ${JSON.stringify(sharedDictionary)}
        
        CHAPTER SUMMARIES:
        ${courseSkeleton}
        
        TASK:
        1. Ensure consistent use of Technical Terminology throughout all chapters.
        2. Identify any logical contradictions between Chapter 1 and subsequent chapters.
        3. Check for thematic cohesion and narrative flow.
        4. If issues are found, provide a list of refinement suggestions for specific chapters.
        
        JSON SCHEMA:
        {
            "isConsistent": boolean,
            "suggestions": [
                { "chapterId": "string", "issue": "string", "fix": "string" }
            ],
            "finalSummary": "Final verdict on course quality."
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 16384 }
        }
    });
    return robustJsonParse(response.text || '{}');
};

/**
 * Agentic Self-Correction: Apply global audit suggestions to a specific chapter.
 */
export const applyAuditRefinement = async (topic: string, content: string, suggestion: any): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Refine the following educational text about "${topic}" based on a Global Consistency Audit suggestion.
        
        ORIGINAL TEXT:
        ${content}
        
        AUDIT ISSUE: ${suggestion.issue}
        REQUIRED FIX: ${suggestion.fix}
        
        TASK:
        Rewrite the text to resolve the issue while maintaining style, formatting, and all pedagogical elements (diagrams, etc).
        
        JSON SCHEMA:
        {
            "refinedContent": "Full HTML..."
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 16384 }
        }
    });
    return robustJsonParse(response.text || '{}');
};

/**
 * High-Fidelity Grounded Image Generation Agent.
 * Uses gemini-3-pro-image-preview with googleSearch for maximum factual accuracy.
 */
export const generateGroundedFidelityImage = async (topic: string, content: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        Based on the following educational text about "${topic}", identify a key historical figure, artifact, scientific entity, or landscape that would benefit from a high-fidelity photographic or realistic illustration.
        
        TEXT:
        ${content}
        
        TASK:
        1. Use Google Search to research the AUTHENTIC visual appearance of this entity (e.g., correct clothing for the period, correct biological colors, specific geological features).
        2. Generate a high-fidelity, realistic image of this entity. 
        3. The image MUST be scientifically or historically accurate based on your search findings.
        4. Provide a text explanation of the factual details included.
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
        if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        } else if (part.text) {
            description = part.text;
        }
    }

    return { imageUrl, description };
};

export const generateChapterQuestionsAndAudit = async (topic: string, chapterTitle: string, htmlContent: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = `
        You are a pedagogical auditor. Analyze the following chapter from a course on "${topic}".
        CHAPTER TITLE: "${chapterTitle}"
        CONTENT: 
        ${htmlContent}
        
        TASK 1: GENERATE QUESTIONS
        Generate 3-5 challenging, high-quality multiple-choice questions that specifically test the deep nuances presented in the text.
        CRITICAL: Classify each question using Bloom's Taxonomy: 'Recall', 'Comprehension', 'Application', 'Analysis', 'Synthesis', or 'Evaluation'. Ensure a mix of levels.
        
        TASK 2: QUALITY AUDIT
        Refine the provided HTML content to ensure maximum pedagogical clarity. Ensure key terms are consistently bolded and headers are logically nested.
        
        JSON SCHEMA:
        {
            "refinedContent": "...",
            "questions": [
                {
                    "questionText": "...",
                    "bloomsLevel": "Recall | Comprehension | Application | Analysis | Synthesis | Evaluation",
                    "options": [{ "id": "o1", "text": "...", "explanation": "..." }],
                    "correctAnswerId": "o1",
                    "detailedExplanation": "Thorough explanation citing the chapter's specific details."
                }
            ]
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 16384 }
        }
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

export const generateFlashcardDeckWithAI = async (params: AIGenerationParams, persona: any): Promise<any> => {
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

export const generateLearningDeckContent = async (topic: string, comprehensiveness: string = 'Standard', isCourse?: boolean): Promise<any> => {
    const ai = getAiClient();
    
    let countInstruction = "Generate 8-12 instructional chapters (InfoCards).";
    let detailInstruction = "Each InfoCard should be detailed and educational.";

    if (comprehensiveness === 'Exhaustive') {
        countInstruction = "Generate a TRULY EXHAUSTIVE and MASTER-LEVEL curriculum. You MUST provide at least 20 detailed instructional chapters (InfoCards).";
        detailInstruction = "CRITICAL: Each InfoCard (chapter) MUST be extremely thorough and lengthy. A single chapter should feel like many pages of high-quality textbook material. Use multiple headers (h2, h3), deep-dive into nuances, include historical context, edge cases, and practical examples. Word count for each card should be substantial (500-1000 words).";
    } else if (comprehensiveness === 'Quick Overview') {
        countInstruction = "Generate 3-5 concise instructional chapters (InfoCards).";
    } else if (comprehensiveness === 'Comprehensive') {
        countInstruction = "Generate 15-20 detailed instructional chapters (InfoCards).";
        detailInstruction = "Each InfoCard should be a substantial read, covering topics in significant depth with rich detail.";
    }

    const prompt = `
        Act as a world-class subject matter expert and instructional designer. Create a ${isCourse ? 'deep-dive structured course' : 'comprehensive learning guide'} for the topic: "${topic}".
        
        ${countInstruction}
        ${detailInstruction}
        
        REQUIREMENTS:
        1. Each InfoCard MUST use rich HTML formatting (h2, h3 headers, bolding, lists, blockquotes).
        2. For EACH InfoCard, generate 1 to 4 multiple-choice questions that specifically test the nuanced content introduced in that card.
        3. Ensure a logical progression from foundational concepts to advanced applications.
        4. Every question must have high-quality, pedagogical explanations for every option.
        5. Generate a professional name for this course and a detailed HTML description summarizing the learning objectives.
        
        JSON SCHEMA:
        {
            "name": "The Course Title",
            "description": "HTML summary of the course...",
            "infoCards": [
                {
                    "id": "chap-1",
                    "content": "EXTENSIVE HTML instructional text (textbook chapter style)...",
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
            thinkingConfig: { thinkingBudget: 32768 } 
        }
    });
    return robustJsonParse(response.text || '{}');
};

export const reworkDeckContent = async (deck: Deck, params: AIGenerationParams, persona: any, seriesContext?: string): Promise<any> => {
    const ai = getAiClient();
    
    const prompt = `
        Act as a world-class instructional designer and the following persona: ${persona.name}.
        Persona Instructions: ${persona.instruction}

        TASK: Rework and improve the following deck titled "${deck.name}".
        
        CURRENT DECK TYPE: ${deck.type}
        USER REWORK INSTRUCTIONS: "${params.reworkInstructions}"
        COMPREHENSIVENESS: ${params.comprehensiveness}
        TARGET AUDIENCE LEVEL: ${params.understanding}
        
        ${seriesContext ? `SERIES CONTEXT: This deck is part of a larger series. Related decks/structure:\n${seriesContext}\n` : ''}
        
        CRITICAL INSTRUCTIONS:
        1. Fully regenerate the deck content (infoCards, questions, or cards) improving quality according to the instructions and persona.
        2. If the user asks to "expand", significantly increase the depth. InfoCards should become extensive textbook-style chapters (multi-page equivalent).
        3. Maintain original IDs where possible, but feel free to add/remove items to match the requested depth.
        4. Generate a new, improved name and description based on the reworked content.
        
        CURRENT CONTENT:
        ${JSON.stringify(deck)}

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
        2. Generate 3-8 instructional "InfoCards" (chapters) that explain these concepts in a structured way.
        3. For each InfoCard, map existing item IDS to the "unlocksQuestionIds" field.
        
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

export const generateTagsForQuestions = async (questions: { id: string, text: string }[]): Promise<any> => {
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

export const hardenDistractors = async (question: string, correct: string, distractors: string[], context?: string): Promise<any> => {
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

export const generateSeriesStructure = async (name: string, description: string, currentStructure?: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a structured learning path for ${name}. Description: ${description}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const generateLevelDecks = async (seriesName: string, seriesDesc: string, levelTitle: string, currentDecks: string[]): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest new decks for level ${levelTitle} in series ${seriesName}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};

export const regenerateQuestionWithAI = async (question: Question, deckName: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Regenerate this question for ${deckName}: ${JSON.stringify(question)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '{}');
};

export const analyzeDeckContent = async (deck: Deck): Promise<any> => {
    const ai = getAiClient();
    
    const prompt = `
        You are a pedagogical expert analyzing educational content for a spaced repetition app.
        Analyze the following deck named "${deck.name}" and provide specific, actionable improvement suggestions.
        
        DECK TYPE: ${deck.type}
        DECK DATA:
        ${JSON.stringify(deck)}
        
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

export const applyDeckImprovements = async (deck: Deck, suggestions: DeckAnalysisSuggestion[]): Promise<any> => {
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
        3. Maintain all existing IDs where possible.
        
        ONLY return the raw JSON for the updated deck.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
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
                { text: `Create a flashcard deck from this image. Topic hint: ${hint}` }
            ]
        }
    });
    return robustJsonParse(response.text || '{}');
};

export const getTopicSuggestions = async (context: any): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest related learning topics for: ${JSON.stringify(context)}`,
        config: { responseMimeType: 'application/json' }
    });
    return robustJsonParse(response.text || '[]');
};
