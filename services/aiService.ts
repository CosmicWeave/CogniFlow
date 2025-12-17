
import { GoogleGenAI, Type, Content } from "@google/genai";
import { AIPersona, AIGenerationParams, AIMessage, Deck, DeckType, QuizDeck, LearningDeck, DeckAnalysisSuggestion, FlashcardDeck, Question, InfoCard } from '../types';
import { ALL_ICONS } from '../components/ui/Icon';

const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AI features are disabled. A Google Gemini API key is required.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Helper Functions for Robust Parsing ---

const cleanJsonString = (text: string): string => {
    let clean = text.trim();
    // Remove markdown code blocks if present
    const codeBlockMatch = clean.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (codeBlockMatch) {
        clean = codeBlockMatch[1].trim();
    }
    return clean;
};

const robustJsonParse = (text: string): any => {
    const clean = cleanJsonString(text);
    try {
        return JSON.parse(clean);
    } catch (e) {
        // If simple parse fails, try to find the outermost object or array
        const startObject = text.indexOf('{');
        const startArray = text.indexOf('[');
        
        let start = -1;
        let end = -1;

        if (startObject !== -1 && (startArray === -1 || startObject < startArray)) {
            start = startObject;
            end = text.lastIndexOf('}');
        } else if (startArray !== -1) {
            start = startArray;
            end = text.lastIndexOf(']');
        }

        if (start !== -1 && end !== -1 && end > start) {
            const extracted = text.substring(start, end + 1);
            try {
                return JSON.parse(extracted);
            } catch (e2) {
                throw e;
            }
        }
        throw e;
    }
};

// --- Prompts ---

const outlineAiPromptTemplate = `Please act as a world-class instructional designer and subject matter expert. Your task is to generate a comprehensive, detailed, and world-class TEXT outline for a learning path. The output must be plain text, not a JSON object.

**Topic:** [TOPIC]
**User's Current Level:** [UNDERSTANDING]
**Desired Comprehensiveness:** [COMPREHENSIVENESS]
[SERIES_CONTEXT]

The goal is to create a structured and progressive learning path that guides the user towards deep, comprehensive mastery of the topic.

**INSTRUCTIONS & REQUIREMENTS:**

1.  **Learning Path Structure:**
    -   Organize the learning path into logical "Levels" (e.g., Level 1, Level 2, up to Level 4 or 5). Each level must have a title and represent a significant step up in knowledge.
    -   Each Level should contain one or more related "Decks".
    -   The name of each deck must reflect this structure, e.g., "Level 1.1: Foundations of X", "Level 1.2: Core Concepts of Y", "Level 2.1: Advanced Techniques in Z".

2.  **High-Quality Content (Crucial):**
    -   **Series Name & Description:** Create a compelling and descriptive name (e.g., "Topic Mastery Path: The Contextual Approach") and a comprehensive summary for the entire learning path. The description can use basic HTML for formatting (e.g., <b>, <i>, <br>).
    -   **Engaging Tone:** All names and descriptions should be written to be engaging and spark curiosity, not just be descriptive. Avoid a dry, academic tone.
    -   **Deck Topics:** For each Deck, provide a detailed, itemized list of specific "Topics" to be covered.
    -   **Progressive Difficulty:** The path must be logically sequenced.
    -   **Approximate [ITEM_LABEL] Count:** Suggest an approximate number of [ITEM_LABEL]s for each deck.

Now, based on all the above requirements, generate the complete text outline.

Finally, at the very end of your response, provide a JSON object with the series name and description you created, like this:
---
{
  "seriesName": "The full series name you generated above",
  "seriesDescription": "The full series description you generated above"
}
`;

const singleDeckOutlineAiPromptTemplate = `Please act as a world-class instructional designer and subject matter expert. Your task is to generate a comprehensive TEXT outline for a single [DECK_TYPE_LABEL]. The output must be plain text, not a JSON object.

**Topic:** [TOPIC]
**User's Current Level:** [UNDERSTANDING]
**Desired Comprehensiveness:** [COMPREHENSIVENESS]
[SERIES_CONTEXT]

The goal is to create a structured outline of topics to be covered in the deck.

**INSTRUCTIONS & REQUIREMENTS:**
1. **Deck Name & Description:** Create a compelling and descriptive name and a comprehensive summary for the deck. The description can use basic HTML for formatting (e.g., <b>, <i>, <br>).
2. **Itemized Topics:** Provide a detailed, itemized list of specific "Topics" to be covered. This should be a bulleted list.
3. **Engaging Tone:** All names and descriptions should be engaging and spark curiosity.
4. **Approximate [ITEM_LABEL] Count:** Suggest an approximate number of [ITEM_LABEL]s for the deck (between 10-50).

Now, based on all the above requirements, generate the complete text outline.

Finally, at the very end of your response, provide a JSON object with the deck name and description you created, like this:
---
{
  "name": "The full deck name you generated above",
  "description": "The full deck description you generated above"
}
`;

const bloomsOutlinePromptTemplate = `Please act as a world-class educational psychologist. Your task is to generate a comprehensive TEXT outline for a quiz deck based on Bloom's Taxonomy. The output must be plain text, not a JSON object.

**Topic:** [TOPIC]
**User's Current Level:** [UNDERSTANDING]
[SERIES_CONTEXT]

The goal is to create a quiz that assesses the user across different cognitive levels.

**INSTRUCTIONS & REQUIREMENTS:**
1. **Structure by Cognitive Level:** Organize the outline into distinct sections representing Bloom's Taxonomy levels:
   - **Remembering:** Topics focusing on recalling facts and basic concepts.
   - **Understanding:** Topics requiring explanation of ideas or concepts.
   - **Applying:** Scenarios requiring use of information in new situations.
   - **Analyzing:** Topics requiring drawing connections among ideas.
   - **Evaluating:** Topics requiring justification of a stand or decision.
   - **Creating:** Topics requiring production of new or original work.
2. **Deck Name & Description:** Create a descriptive name (e.g., "Bloom's Analysis of [Topic]") and summary.
3. **Itemized Topics per Level:** For each level, list specific concepts or scenarios to be tested.

Now, based on all the above requirements, generate the complete text outline.

Finally, at the very end of your response, provide a JSON object with the deck name and description you created, like this:
---
{
  "name": "The full deck name you generated above",
  "description": "The full deck description you generated above"
}
`;

const vocabDeckPromptTemplate = `
    You are an expert language tutor. Your persona is: [PERSONA_NAME].
    Instruction: [PERSONA_INSTRUCTION]
    
    Your task is to generate a JSON object for a vocabulary flashcard deck.

    **Topic/Language:** [TOPIC]
    **User's Current Level:** [UNDERSTANDING]
    [SERIES_CONTEXT]

    **REQUIREMENTS:**
    1.  Create a descriptive name and description for the deck.
    2.  Generate between 15 and 30 high-quality vocabulary cards.
    3.  **Front:** The word or phrase in the target language (inferred from topic). Include the part of speech if relevant (e.g., "Gato (n.)").
    4.  **Back:** Must include:
        -   **Definition:** Clear and concise meaning.
        -   **Pronunciation:** IPA or phonetic guide if applicable.
        -   **Example:** A sentence using the word in context, with translation.
        -   Use HTML <br> tags to format these sections clearly on separate lines.
    5.  The content should be accurate and suitable for the user's level.

    **JSON OUTPUT FORMAT:**
    The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`. Do not include any surrounding text or markdown formatting.
`;

const atomicDeckPromptTemplate = `
    You are an expert instructional designer. Your persona is: [PERSONA_NAME].
    Instruction: [PERSONA_INSTRUCTION]
    
    Your task is to generate a JSON object for a flashcard deck focused on **Atomic Concepts**.

    **Topic:** [TOPIC]
    **User's Current Level:** [UNDERSTANDING]
    [SERIES_CONTEXT]

    **REQUIREMENTS:**
    1.  **Principle:** Adhere strictly to the "Minimum Information Principle". Each card must test exactly **one** distinct fact or relationship.
    2.  **Decomposition:** Break down complex ideas into their smallest constituent parts. Do not create cards with lists or multiple answers.
    3.  **Front:** A specific question, cue, or cloze deletion.
    4.  **Back:** A short, direct answer (1-2 sentences max).
    5.  Generate between 15 and 30 cards.
    6.  Create a descriptive name and description for the deck.

    **JSON OUTPUT FORMAT:**
    The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`. Do not include any surrounding text or markdown formatting.
`;

const defaultFlashcardDeckPromptTemplate = `
    You are an expert content creator. Your persona is: [PERSONA_NAME].
    Instruction: [PERSONA_INSTRUCTION]
    
    Your task is to generate a JSON object for a flashcard deck on a given topic.

    **Topic:** [TOPIC]
    **User's Current Level:** [UNDERSTANDING]
    **Desired Comprehensiveness:** [COMPREHENSIVENESS]
    [SERIES_CONTEXT]

    **REQUIREMENTS:**
    1.  Create a descriptive and engaging \`name\` and \`description\` for the deck.
    2.  Generate between 10 and 30 high-quality flashcards.
    3.  Each flashcard in the \`cards\` array must have a \`front\` (the term or question) and a \`back\` (the definition or answer).
    4.  The content should be clear, concise, and factually accurate.
    5.  The difficulty should be appropriate for the user's specified level.

    **JSON OUTPUT FORMAT:**
    The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`. Do not include any surrounding text or markdown formatting.
`;

const scaffoldFromOutlinePromptTemplate = `You are an expert content creator. I have provided a text outline for a learning path. Your task is to convert this outline into a structured JSON object that will serve as a scaffold.

**PRIMARY INSTRUCTIONS:**

1.  **Source Material:** Use ONLY the text outline I've provided as your source.
2.  **Structure:** Create a single JSON object with \`seriesName\`, \`seriesDescription\`, and a \`levels\` array.
3.  **Levels and Decks:** Inside the \`levels\` array, create objects for each level, including its \`title\`. Each level object should have a \`decks\` array. Populate this with deck objects, each containing its \`name\` and \`description\` from the outline.
4.  **Target Type:** [TARGET_TYPE_INSTRUCTION]

**JSON OUTPUT FORMAT:**
The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`. Do not include any surrounding text, explanations, or markdown formatting.
`;

const deckFromOutlinePromptTemplate = `You are an expert content creator. I have provided a text outline for a learning deck. Your task is to generate the JSON for this deck based on the outline.

**PRIMARY INSTRUCTIONS:**

1.  **Source Material:** Use ONLY the text outline I've provided as your source.
2.  **Question Quantity:** Generate the approximate number of questions specified in the outline for this deck.
3.  **Content Generation:** Create world-class questions and answers based *only* on the "Topics" listed for this specific deck in the outline.

**CRITICAL CONTENT QUALITY REQUIREMENTS:**
- **Factual Accuracy:** This is paramount. The correct answer and all parts of the explanation must be unequivocally correct and verifiable.
- **In-Depth Coverage:** The questions must cover the deck's topics comprehensively.
- **Clarity & Simplicity:** Questions must be easy to understand, unambiguous, and test only one core concept per question.
- **High-Quality Explanations:** The \`detailedExplanation\` is crucial. It must explain the reasoning, principles, or facts behind the correct answer.
- **Option Explanations:** Every option, correct or incorrect, MUST have a brief \`explanation\` field.

**JSON OUTPUT FORMAT:**
The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`. Do not include any surrounding text, explanations, or markdown formatting.
`;

const questionGuardrailPromptTemplate = `
    You are an expert educational content reviewer.
    Your task is to review and refine a list of multiple-choice questions on the topic: "[TOPIC]".

    **INPUT QUESTIONS:**
    [QUESTIONS_JSON]

    **REVIEW CRITERIA:**
    1.  **Fact-Check:** Ensure every question, correct answer, and explanation is 100% factually accurate. Correct any errors.
    2.  **Clarity:** Ensure wording is unambiguous and easy to understand.
    3.  **Relevance:** Ensure questions are directly relevant to the topic. Remove or replace irrelevant ones.
    4.  **Distractors:** Ensure incorrect options are plausible but clearly wrong.
    5.  **Explanations:** Ensure the \`detailedExplanation\` is thorough and educational.

    **OUTPUT:**
    Return the refined list of questions as a JSON array. Preserve the original JSON structure.
`;

const regenerateQuestionPromptTemplate = `
    You are an expert instructional designer.
    I want you to regenerate/rewrite the following question to improve its quality, clarity, or difficulty.

    **Current Question:**
    [QUESTION_JSON]

    **Context:**
    [CONTEXT]

    **INSTRUCTIONS:**
    - Improve the wording for better clarity.
    - Ensure the correct answer is indisputably correct.
    - Make distractors more challenging if they are too obvious.
    - Expand the detailed explanation to be more helpful.
    - Keep the same JSON structure.

    **JSON OUTPUT:**
    Return ONLY the updated question object as raw JSON.
`;

const hardenDistractorsPromptTemplate = `
    You are an expert test creator.
    The user wants to "harden" the distractors (incorrect answers) for a multiple-choice question to make it more challenging.

    **Question:** [QUESTION_TEXT]
    **Correct Answer:** [CORRECT_ANSWER]
    **Current Distractors:** [OPTIONS_LIST]
    **Context:** [CONTEXT_STR]

    **TASK:**
    Generate 3-4 NEW, challenging, but factually incorrect options (distractors) for this question.
    They should be plausible to someone with partial knowledge, but clearly wrong to someone who knows the material.
    Do not reuse the current distractors unless they are already excellent.

    **OUTPUT:**
    Return a JSON array of objects, where each object has:
    - \`text\`: The text of the distractor.
    - \`explanation\`: A brief explanation of why this option is incorrect.
`;

const concreteExamplePromptTemplate = `
    You are a helpful tutor.
    Please provide 2-3 short, concrete, real-world examples (or sentences) that illustrate the following concept/term.

    **Term (Front):** [FRONT]
    **Definition (Back):** [BACK]
    **Context:** [CONTEXT_STR]

    **Format:**
    Return the examples as a simple HTML list (<ul><li>...</li></ul>). Do not include any introductory text.
`;

const learningDeckContentPromptTemplate = `
    You are an expert instructional designer.
    Create a comprehensive "Learning Guide" on the topic: "[TOPIC]".
    Context: [CONTEXT]

    **STRUCTURE:**
    - Break the topic down into logical "Blocks".
    - Each Block should have:
        1.  **Content:** A cohesive paragraph or two of informational text (HTML allowed).
        2.  **Questions:** 1-2 multiple-choice questions that test understanding of *that specific block's content*.

    **JSON OUTPUT FORMAT:**
    The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`.
    Schema:
    {
      "blocks": [
        {
          "content": "HTML string...",
          "questions": [
            {
              "questionText": "...",
              "detailedExplanation": "...",
              "options": [
                { "text": "...", "explanation": "...", "isCorrect": boolean }
              ]
            }
          ]
        }
      ]
    }
`;

const courseContentPromptTemplate = `
    You are an expert course creator.
    Create a detailed, multi-section course on: "[TOPIC]".
    Context: [CONTEXT]

    **REQUIREMENTS:**
    - The content should be extensive, suitable for a "Reader" mode where users read first, then answer questions.
    - Divide the course into logical sections/chapters.
    - Content should be engaging, well-formatted with HTML (use headers <h3>, bolding, lists).

    **JSON OUTPUT FORMAT:**
    The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`.
    Schema:
    {
      "blocks": [
        {
          "content": "HTML content for this section...",
          "questions": [
            {
              "questionText": "...",
              "detailedExplanation": "...",
              "options": [
                { "text": "...", "explanation": "...", "isCorrect": boolean }
              ]
            }
          ]
        }
      ]
    }
`;

// --- Service Functions ---

export const getTopicSuggestions = async (context: { name: string, description?: string, type: 'deck' | 'series' }): Promise<string[]> => {
    const ai = getAiClient();
    
    let prompt = "";
    if (context.type === 'series') {
        prompt = `Based on the learning series "${context.name}" (${context.description || ''}), suggest 3 specific, distinct, and relevant sub-topics or chapters that would make good additions as new levels or decks. Return ONLY a JSON array of 3 strings. Example: ["The Roman Republic", "Julius Caesar", "The Fall of Rome"]`;
    } else {
        prompt = `Based on the flashcard deck "${context.name}" (${context.description || ''}), suggest 3 specific, distinct, and relevant sub-topics that could be used to expand this deck or create a new related deck. Return ONLY a JSON array of 3 strings. Example: ["Key Battles", "Political Structure", "Daily Life"]`;
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });

    try {
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.warn("Failed to parse topic suggestions", e);
        return [];
    }
};

export const generateSeriesStructure = async (name: string, description: string, currentStructure?: string): Promise<any> => {
    const ai = getAiClient();
    let prompt = `
        You are an expert instructional designer.
        I have a learning series titled "${name}" with the description: "${description}".
    `;

    if (currentStructure) {
        prompt += `
        \n\nCURRENT STRUCTURE:
        ${currentStructure}
        \n\nTASK:
        Based on the current structure above, generate the NEXT logical levels and decks to expand this series.
        Do NOT repeat the existing levels.
        Generate 1-3 new levels that naturally follow the current progression.
        `;
    } else {
        prompt += `
        \n\nTASK:
        Your task is to generate a comprehensive structure for this series.
        Break it down into logical "Levels" (e.g., Beginner, Intermediate, Advanced, or Thematic chapters).
        Inside each level, create specific "Decks" that cover parts of that level.
        `;
    }

    prompt += `
        \n\nReturn a JSON object matching the following schema. The 'questions' array for each deck must be empty.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
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
                                            questions: { type: Type.ARRAY, items: { type: Type.STRING } } // Empty array
                                        },
                                        required: ['name', 'description', 'questions']
                                    }
                                }
                            },
                            required: ['title', 'decks']
                        }
                    }
                },
                required: ['levels']
            },
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });
    
    return robustJsonParse(response.text);
};

export const generateLevelDecks = async (seriesName: string, seriesDescription: string, levelTitle: string, currentDecks: string[]): Promise<any[]> => {
    const ai = getAiClient();
    const prompt = `
        You are an expert instructional designer.
        I have a learning series titled "${seriesName}" (${seriesDescription}).
        I am focusing on the level: "${levelTitle}".
        
        Current decks in this level: ${currentDecks.length > 0 ? currentDecks.join(', ') : 'None'}.

        TASK:
        Generate a list of NEW decks to fully populate this level ("${levelTitle}").
        The decks should cover the remaining necessary topics for this level to ensure comprehensive understanding.
        Do NOT generate decks that duplicate the content of the current decks.
        
        Return a JSON array of deck objects.
        Each deck object must have a "name", "description", and an empty "questions" array.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        questions: { type: Type.ARRAY, items: { type: Type.STRING } } // Empty
                    },
                    required: ['name', 'description', 'questions']
                }
            },
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });

    return robustJsonParse(response.text);
};

export const generateOutlineWithAI = async (
    params: AIGenerationParams,
    persona: AIPersona,
    seriesContext?: { name: string; description: string }
): Promise<{ outline: string; metadata: { name?: string; description?: string; seriesName?: string; seriesDescription?: string } }> => {
    const ai = getAiClient();
    const { topic, understanding, comprehensiveness, generationType } = params;

    let template: string;
    let itemLabel = "Question";
    let deckTypeLabel = "Quiz Deck";

    // Detect if we are generating flashcards or learning decks to adjust the language
    if (generationType.includes('flashcard') || generationType.includes('vocab')) {
        itemLabel = "Flashcard";
        deckTypeLabel = "Flashcard Deck";
    } else if (generationType.includes('learning') || generationType.includes('course')) {
        itemLabel = "Page/Section";
        deckTypeLabel = "Learning Guide";
    }

    if (generationType.startsWith('series-')) {
        template = outlineAiPromptTemplate;
    } else if (generationType === 'quiz-blooms') {
        template = bloomsOutlinePromptTemplate;
    } else {
        template = singleDeckOutlineAiPromptTemplate;
    }

    const contextStr = seriesContext 
        ? `**Context:** This content is part of the series "${seriesContext.name}" (${seriesContext.description}). Ensure the generated outline fits within this context and does not duplicate broader series topics unnecessarily.` 
        : '';

    const prompt = template
        .replace('[TOPIC]', topic)
        .replace('[UNDERSTANDING]', understanding)
        .replace('[COMPREHENSIVENESS]', comprehensiveness)
        .replace('[SERIES_CONTEXT]', contextStr)
        .replace(/\[ITEM_LABEL\]/g, itemLabel)
        .replace(/\[DECK_TYPE_LABEL\]/g, deckTypeLabel);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            systemInstruction: `You are an expert content creator. Your persona is: ${persona.name}. Instruction: ${persona.instruction}`,
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    const fullText = response.text.trim();
    let outline = fullText;
    let metadata = {};

    // Strategy 1: Look for explicit separator
    const separatorRegex = /\n---\n([\s\S]*)$/;
    const match = fullText.match(separatorRegex);

    if (match) {
        // Found separator
        outline = fullText.substring(0, match.index).trim();
        const jsonCandidate = match[1].trim();
        try {
            metadata = robustJsonParse(jsonCandidate);
        } catch (e) {
            console.warn("Found separator but failed to parse metadata JSON.", e);
        }
    } else {
        // Strategy 2: Look for the last JSON object block in the text
        const lastJsonBlockRegex = /(\{([^{}]|(\{[^{}]*\}))*\})\s*$/;
        const codeMatch = fullText.match(lastJsonBlockRegex);
        
        if (codeMatch) {
             const potentialJson = codeMatch[0];
             try {
                 const parsed = robustJsonParse(potentialJson);
                 // Heuristic: check if it has likely keys to confirm it's our metadata and not just part of the text
                 if (parsed.name || parsed.seriesName) {
                     metadata = parsed;
                     outline = fullText.substring(0, codeMatch.index).trim();
                 }
             } catch (e) {
                 console.warn("Found trailing block but failed to parse JSON.", e);
             }
        }
    }

    return { outline, metadata };
};

export const refineOutlineWithAI = async (
    history: AIMessage[],
    originalParams: AIGenerationParams,
    persona: AIPersona
): Promise<string> => {
    const ai = getAiClient();
    
    const systemInstruction = `You are an expert instructional designer helping a user refine a learning path outline. Your persona is: ${persona.name}. Instruction: ${persona.instruction}.
    The user's original request was for a topic on "${originalParams.topic}" at a "${originalParams.understanding}" level.
    Based on the user's new message, update and return the complete, refined text outline. Do not include the metadata JSON block in your response.`;

    const contents: Content[] = history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
    }));

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: contents,
        config: {
            systemInstruction,
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    return response.text.trim();
};

export const generateScaffoldFromOutline = async (outlineText: string, targetDeckType: DeckType = DeckType.Quiz): Promise<any> => {
    const ai = getAiClient();
    
    let targetTypeInstruction = "";
    if (targetDeckType === DeckType.Flashcard) {
        targetTypeInstruction = `For every deck object, include a \`"type": "flashcard"\` and a \`"cards": []\` key-value pair. The cards array MUST be empty.`;
    } else if (targetDeckType === DeckType.Learning) {
        targetTypeInstruction = `For every deck object, include a \`"type": "learning"\`, a \`"infoCards": []\` and a \`"questions": []\` key-value pair. The arrays MUST be empty.`;
    } else {
        targetTypeInstruction = `For every deck object, include a \`"type": "quiz"\` and a \`"questions": []\` key-value pair. The questions array MUST be empty.`;
    }

    const instruction = scaffoldFromOutlinePromptTemplate.replace('[TARGET_TYPE_INSTRUCTION]', targetTypeInstruction);

    // Schema definition for the scaffold
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
                                    type: { type: Type.STRING },
                                    // Optional fields based on type, but defining them allows the AI to populate them if prompted
                                    questions: { type: Type.ARRAY, items: { type: Type.STRING } }, 
                                    cards: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    infoCards: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ['name', 'description', 'type']
                            }
                        }
                    },
                    required: ['title', 'decks']
                }
            }
        },
        required: ['seriesName', 'seriesDescription', 'levels']
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Here is the outline:\n\n${outlineText}`,
        config: {
            systemInstruction: instruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });
    
    return robustJsonParse(response.text);
};

export const generateDeckFromOutline = async (outlineText: string, metadata: { name: string, description: string }): Promise<any> => {
    const ai = getAiClient();

    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            questions: {
                type: Type.ARRAY,
                items: {
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
                                    explanation: { type: Type.STRING },
                                },
                                required: ['id', 'text', 'explanation']
                            }
                        },
                        correctAnswerId: { type: Type.STRING }
                    },
                    required: ['questionType', 'questionText', 'detailedExplanation', 'options', 'correctAnswerId']
                }
            }
        },
        required: ['name', 'description', 'questions']
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Here is the outline:\n\n${outlineText}`,
        config: {
            systemInstruction: deckFromOutlinePromptTemplate,
            responseMimeType: 'application/json',
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });
    
    const parsed = robustJsonParse(response.text);
    
    // Ensure the name/description from the outline metadata is used if available
    if (metadata && metadata.name) parsed.name = metadata.name;
    if (metadata && metadata.description) parsed.description = metadata.description;
    
    return parsed;
};

export const generateQuestionsForDeck = async (
    deck: Deck, 
    count: number,
    seriesContext?: { name: string; description: string }
): Promise<any[]> => {
    const ai = getAiClient();
    const contextStr = seriesContext 
        ? `\n**Context:** This deck is part of the series "${seriesContext.name}" (${seriesContext.description}). The questions should be relevant to this series context and appropriate for the level implied by the deck's placement in the series.`
        : '';

    const prompt = `
        You are an expert instructional designer.
        I have a deck titled "${deck.name}" with the description: "${deck.description}".
        ${contextStr}

        **TASK:**
        Generate ${count} high-quality multiple-choice questions for this deck.
        
        **CONTENT REQUIREMENTS:**
        -   **Factual Accuracy:** Must be unequivocally correct.
        -   **Relevance:** Directly relevant to the deck title and description.
        -   **Clarity:** Easy to understand and unambiguous.
        -   **Explanations:** Provide detailed explanations for the correct answer.
        -   **Distractors:** Incorrect options should be plausible but clearly wrong. Provide an explanation for why each option is right or wrong.

        **JSON OUTPUT FORMAT:**
        Return a JSON array of question objects.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
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
                                    text: { type: Type.STRING },
                                    explanation: { type: Type.STRING },
                                    isCorrect: { type: Type.BOOLEAN }
                                },
                                required: ['text', 'explanation', 'isCorrect']
                            }
                        }
                    },
                    required: ['questionType', 'questionText', 'detailedExplanation', 'options']
                }
            },
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    return robustJsonParse(response.text);
};

export const validateAndRefineQuestions = async (questions: any[], topic: string): Promise<any[]> => {
    const ai = getAiClient();
    const prompt = questionGuardrailPromptTemplate
        .replace('[TOPIC]', topic)
        .replace('[QUESTIONS_JSON]', JSON.stringify(questions));

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        questionType: { type: Type.STRING },
                        questionText: { type: Type.STRING },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        detailedExplanation: { type: Type.STRING },
                        options: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    explanation: { type: Type.STRING },
                                    isCorrect: { type: Type.BOOLEAN }
                                },
                                required: ['text', 'explanation', 'isCorrect']
                            }
                        }
                    },
                    required: ['questionText', 'detailedExplanation', 'options']
                }
            },
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    return robustJsonParse(response.text);
};

export const regenerateQuestionWithAI = async (question: Question, context?: string): Promise<any> => {
    const ai = getAiClient();
    const prompt = regenerateQuestionPromptTemplate
        .replace('[QUESTION_JSON]', JSON.stringify({
            questionText: question.questionText,
            detailedExplanation: question.detailedExplanation,
            options: question.options.map(o => ({ 
                text: o.text, 
                explanation: o.explanation, 
                isCorrect: o.id === question.correctAnswerId 
            })),
            tags: question.tags
        }))
        .replace('[CONTEXT]', context || 'General Knowledge');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    questionText: { type: Type.STRING },
                    detailedExplanation: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    options: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                explanation: { type: Type.STRING },
                                isCorrect: { type: Type.BOOLEAN }
                            },
                            required: ['text', 'explanation', 'isCorrect']
                        }
                    }
                },
                required: ['questionText', 'detailedExplanation', 'options']
            },
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    return robustJsonParse(response.text);
};

export const hardenDistractors = async (
    questionText: string,
    correctAnswerText: string,
    currentDistractors: string[],
    context?: string
): Promise<Array<{ text: string; explanation: string }>> => {
    const ai = getAiClient();
    const prompt = hardenDistractorsPromptTemplate
        .replace('[QUESTION_TEXT]', questionText)
        .replace('[CORRECT_ANSWER]', correctAnswerText)
        .replace('[OPTIONS_LIST]', currentDistractors.join(', '))
        .replace('[CONTEXT_STR]', context || 'General Knowledge');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        explanation: { type: Type.STRING }
                    },
                    required: ['text', 'explanation']
                }
            },
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    return robustJsonParse(response.text);
};

export const generateConcreteExamples = async (front: string, back: string, context?: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = concreteExamplePromptTemplate
        .replace('[FRONT]', front)
        .replace('[BACK]', back)
        .replace('[CONTEXT_STR]', context || 'General Learning');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return response.text.trim();
};

export const generateLearningDeckContent = async (topic: string, context?: string, isCourseMode = false): Promise<{ infoCards: any[], questions: any[] }> => {
    const ai = getAiClient();
    const template = isCourseMode ? courseContentPromptTemplate : learningDeckContentPromptTemplate;
    const prompt = template
        .replace('[TOPIC]', topic)
        .replace('[CONTEXT]', context || 'General Learning');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    blocks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                content: { type: Type.STRING },
                                questions: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            questionText: { type: Type.STRING },
                                            detailedExplanation: { type: Type.STRING },
                                            options: {
                                                type: Type.ARRAY,
                                                items: {
                                                    type: Type.OBJECT,
                                                    properties: {
                                                        text: { type: Type.STRING },
                                                        explanation: { type: Type.STRING },
                                                        isCorrect: { type: Type.BOOLEAN }
                                                    },
                                                    required: ['text', 'explanation', 'isCorrect']
                                                }
                                            }
                                        },
                                        required: ['questionText', 'detailedExplanation', 'options']
                                    }
                                }
                            },
                            required: ['content', 'questions']
                        }
                    }
                },
                required: ['blocks']
            },
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    const parsed = robustJsonParse(response.text);
    
    // Flatten into InfoCards and Questions, linking them
    const infoCards: any[] = [];
    const questions: any[] = [];

    if (parsed.blocks && Array.isArray(parsed.blocks)) {
        parsed.blocks.forEach((block: any) => {
            const infoCardId = crypto.randomUUID();
            const blockQuestions: any[] = [];
            
            if (block.questions && Array.isArray(block.questions)) {
                block.questions.forEach((q: any) => {
                    blockQuestions.push({
                        ...q,
                        infoCardIds: [infoCardId]
                    });
                });
            }
            
            questions.push(...blockQuestions);
            infoCards.push({
                id: infoCardId,
                content: block.content,
                unlocksQuestionIds: [] // Will be populated by the IDs generated later when saving
            });
        });
    }

    return { infoCards, questions };
};

export const generateFlashcardDeckWithAI = async (
  params: AIGenerationParams,
  persona: AIPersona,
  seriesContext?: { name: string; description: string }
): Promise<{ name: string; description: string; cards: Array<{ front: string; back: string }> }> => {
  const ai = getAiClient();
  const { topic, understanding, comprehensiveness, generationType } = params;

  let template: string;
  if (generationType === 'deck-vocab' || generationType === 'series-vocab') {
      template = vocabDeckPromptTemplate;
  } else if (generationType === 'deck-atomic') {
      template = atomicDeckPromptTemplate;
  } else {
      template = defaultFlashcardDeckPromptTemplate;
  }

  const contextStr = seriesContext 
      ? `**Context:** This deck is part of the series "${seriesContext.name}" (${seriesContext.description}). Ensure the content fits this context.` 
      : '';

  const systemPrompt = template
    .replace('[PERSONA_NAME]', persona.name)
    .replace('[PERSONA_INSTRUCTION]', persona.instruction)
    .replace('[TOPIC]', topic)
    .replace('[UNDERSTANDING]', understanding)
    .replace('[COMPREHENSIVENESS]', comprehensiveness)
    .replace('[SERIES_CONTEXT]', contextStr);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: 'Generate the flashcard deck.',
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING }
              },
              required: ['front', 'back']
            }
          }
        },
        required: ['name', 'description', 'cards']
      },
      thinkingConfig: { thinkingBudget: 32768 },
    }
  });

  return robustJsonParse(response.text);
};

export const getImageDescriptionForTerm = async (
    term: string,
    context: string
): Promise<string> => {
    const ai = getAiClient();
    const prompt = `
        Based on the flashcard deck context "${context}", create a detailed, photorealistic image generation prompt for the term "${term}". 
        The prompt should be descriptive, focusing on visual details to create a clear, representative image. 
        Describe a scene, an object, or a concept visually. Avoid using text in the prompt.
        Example for term "Mitochondria": "A detailed, realistic micrograph of a single mitochondrion inside an animal cell, showing the outer membrane, the folded inner membrane creating cristae, and the matrix within. Labeled parts should not be included."
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    
    return response.text.trim();
};

export const generateImageWithImagen = async (
    prompt: string
): Promise<string> => {
    const ai = getAiClient();
    
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '4:3',
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages[0].image.imageBytes;
    }

    throw new Error('Image generation failed.');
};

export const expandText = async (topic: string, originalContent: string, selectedText: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `You are an expert on ${topic}. The user has selected the text "${selectedText}" from the following content:\n\n${originalContent}\n\nPlease provide a more detailed explanation of the selected text in a few paragraphs. Format your response as HTML.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt
    });

    return response.text.trim();
};

export const explainConcept = async (concept: string, context: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Explain the following concept like I'm 5 years old. Keep it simple, engaging, and use an analogy if possible.
    
    **Concept:** ${concept}
    **Context:** ${context}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return response.text.trim();
};

export const generateMnemonic = async (front: string, back: string, context?: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Create a short, catchy, and memorable mnemonic to help a student remember the connection between the following term and its definition/answer.
    
    **Term (Front):** ${front}
    **Definition (Back):** ${back}
    ${context ? `**Context:** ${context}` : ''}
    
    Output ONLY the mnemonic. Use HTML bold tags <b> to highlight key parts.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return response.text.trim();
};

export const generateSpeech = async (text: string, voice: string = 'Kore'): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text }] },
        config: {
            responseModalities: ['AUDIO'] as any, // Cast as any because the type definition might imply enum usage but string is accepted in config
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice }
                }
            }
        }
    });
    
    // The response structure for audio
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
        throw new Error("Failed to generate speech. No audio data received.");
    }
    return audioData;
};

export const generateDeckFromImage = async (
    imageBase64: string,
    mimeType: string,
    hint?: string
): Promise<{ name: string; description: string; cards: Array<{ front: string; back: string }> }> => {
    const ai = getAiClient();
    const prompt = `Analyze this image and create a flashcard deck from its content. ${hint ? `Focus on: ${hint}` : ''}.
    Return a JSON object with a 'name', 'description', and a 'cards' array where each card has a 'front' and 'back'.
    The 'front' should be a question or term found in or inferred from the image.
    The 'back' should be the answer or definition.
    Make the content educational and accurate.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: imageBase64
                    }
                },
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    cards: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                front: { type: Type.STRING },
                                back: { type: Type.STRING }
                            },
                            required: ['front', 'back']
                        }
                    }
                },
                required: ['name', 'description', 'cards']
            }
        }
    });

    return robustJsonParse(response.text);
};

export const analyzeDeckContent = async (deck: Deck): Promise<DeckAnalysisSuggestion[]> => {
    const ai = getAiClient();
    const items = deck.type === 'flashcard' ? (deck as FlashcardDeck).cards : (deck as QuizDeck | LearningDeck).questions;
    
    if (!items || items.length === 0) return [];

    const prompt = `
        You are an expert editor and instructional designer.
        Analyze the following deck content for accuracy, clarity, formatting consistency, and completeness.
        
        Deck Name: "${deck.name}"
        Description: "${deck.description}"
        Content Sample: ${JSON.stringify(items.slice(0, 50))}

        Identify issues and suggest specific improvements. 
        Return a JSON array of suggestions.
        Each suggestion must have:
        - id: A unique string ID.
        - title: Short title of the issue.
        - description: Description of what is wrong and how to fix it.
        - category: One of ['accuracy', 'clarity', 'formatting', 'completeness'].
        - rationale: Why this change improves learning.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        category: { type: Type.STRING, enum: ['accuracy', 'clarity', 'formatting', 'completeness'] },
                        rationale: { type: Type.STRING }
                    },
                    required: ['id', 'title', 'description', 'category', 'rationale']
                }
            },
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    return robustJsonParse(response.text);
};

export const applyDeckImprovements = async (deck: Deck, suggestions: DeckAnalysisSuggestion[]): Promise<Deck> => {
    const ai = getAiClient();
    // This is a simplified "apply" logic. In a real scenario, the AI would need to know WHICH items to update specifically.
    // For this implementation, we will ask the AI to regenerate the *entire* deck content based on the accepted suggestions.
    
    const items = deck.type === 'flashcard' ? (deck as FlashcardDeck).cards : (deck as QuizDeck | LearningDeck).questions;
    
    const prompt = `
        You are an expert editor.
        I have a deck of learning content. I want you to rewrite it to apply the following improvements:
        
        IMPROVEMENTS TO APPLY:
        ${JSON.stringify(suggestions)}

        CURRENT CONTENT:
        ${JSON.stringify(items)}

        Return the FULL updated content in the same JSON structure as the input (array of cards or questions).
        Do not change IDs. Only update text fields.
    `;

    // Schema depends on deck type
    let responseSchema;
    if (deck.type === 'flashcard') {
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    front: { type: Type.STRING },
                    back: { type: Type.STRING }
                },
                required: ['id', 'front', 'back']
            }
        };
    } else {
        // Quiz/Learning question schema
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    questionText: { type: Type.STRING },
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
                    }
                },
                required: ['id', 'questionText', 'detailedExplanation', 'options']
            }
        };
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema as any,
            thinkingConfig: { thinkingBudget: 32768 },
        }
    });

    const updatedItems = robustJsonParse(response.text);
    
    // Merge back into deck, preserving other fields
    if (deck.type === 'flashcard') {
        return {
            ...deck,
            cards: (deck as FlashcardDeck).cards.map(c => {
                const updated = updatedItems.find((u: any) => u.id === c.id);
                return updated ? { ...c, ...updated } : c;
            })
        } as FlashcardDeck;
    } else {
        return {
            ...deck,
            questions: (deck as QuizDeck | LearningDeck).questions.map(q => {
                const updated = updatedItems.find((u: any) => u.id === q.id);
                return updated ? { ...q, ...updated } : q;
            })
        } as QuizDeck | LearningDeck;
    }
};

export const suggestDeckIcon = async (name: string, description: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `
        Suggest the single most appropriate icon name from the following list for a flashcard deck titled "${name}" (${description}).
        
        Available Icons: ${ALL_ICONS.join(', ')}
        
        Return ONLY the icon name as a JSON string.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json'
        }
    });
    
    return JSON.parse(response.text);
};

export const generateTagsForQuestions = async (questions: { id: string, text: string }[]): Promise<Record<string, string[]>> => {
    const ai = getAiClient();
    const prompt = `
        Analyze the following questions and generate 1-3 relevant, concise tags for each.
        Tags should be single words or short phrases (lowercase).
        
        Questions:
        ${JSON.stringify(questions)}
        
        Return a JSON object where keys are question IDs and values are arrays of tags.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                additionalProperties: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            } as any
        }
    });
    
    return robustJsonParse(response.text);
};
