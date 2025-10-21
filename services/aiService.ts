import { GoogleGenAI, Type } from "@google/genai";
import { AIPersona, AIGenerationParams } from '../types';

const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AI features are disabled. A Google Gemini API key is required.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateFlashcardDeckWithAI = async (
  params: AIGenerationParams,
  persona: AIPersona
): Promise<{ name: string; description: string; cards: Array<{ front: string; back: string }> }> => {
  const ai = getAiClient();
  const { topic, understanding, comprehensiveness } = params;

  const systemPrompt = `
    You are an expert content creator. Your persona is: ${persona.name}.
    Instruction: ${persona.instruction}
    
    Your task is to generate a JSON object for a flashcard deck on a given topic.

    **Topic:** ${topic}
    **User's Current Level:** ${understanding}
    **Desired Comprehensiveness:** ${comprehensiveness}

    **REQUIREMENTS:**
    1.  Create a descriptive and engaging \`name\` and \`description\` for the deck.
    2.  Generate between 10 and 30 high-quality flashcards.
    3.  Each flashcard in the \`cards\` array must have a \`front\` (the term or question) and a \`back\` (the definition or answer).
    4.  The content should be clear, concise, and factually accurate.
    5.  The difficulty should be appropriate for the user's specified level.

    **JSON OUTPUT FORMAT:**
    The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`. Do not include any surrounding text or markdown formatting.
  `;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
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
      }
    }
  });

  const jsonText = response.text.trim();
  return JSON.parse(jsonText);
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