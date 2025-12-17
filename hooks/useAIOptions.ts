
import { useState, useCallback } from 'react';

const AI_OPTIONS_STORAGE_KEY = 'cogniflow-ai-options';

export interface AIPersona {
  id: string;
  name: string;
  instruction: string;
}

export interface AICustomField {
  id: string;
  name: string;
  type: string; // Corresponds to @google/genai Type enum
  description: string;
}

// Default values
const defaultOptions = {
  understandingLevels: ['Auto', 'Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert'],
  comprehensivenessLevels: ['Quick Overview', 'Standard', 'Comprehensive', 'Exhaustive'],
  learningGoalOptions: [
    "Auto",
    "Master a subject",
    "Learn for the sake of curiosity",
    "Explore a new interest",
    "Become more informed",
    "Understand a complex topic",
    "Practically learn the topic"
  ],
  learningStyleOptions: ["Auto", "Conceptual Understanding (Why & How)", "Factual Recall (What, Who, When)", "Practical Application & Scenarios"],
  languageOptions: ["Auto", "English", "Swedish", "Spanish", "French", "German", "Japanese", "Mandarin", "Russian"],
  toneOptions: ["Auto", "Neutral", "Formal", "Casual", "Academic", "Enthusiastic", "Humorous"],
  personas: [
    { id: 'default', name: 'Default Assistant', instruction: 'You are a helpful and neutral AI assistant.' },
    { id: 'tutor', name: 'Friendly Tutor', instruction: 'You are a friendly and encouraging tutor. You use analogies and explain complex topics in a simple, easy-to-understand way.' },
    { id: 'professor', name: 'University Professor', instruction: 'You are an expert professor. Your tone is formal, academic, and you provide in-depth, precise information.' },
    { id: 'author', name: 'Technical Author', instruction: 'You are a technical author. Your style is concise, precise, and fact-focused. You avoid fluff and get straight to the point.' },
    { 
      id: 'lindstrom', 
      name: 'Fredrik Lindström', 
      instruction: 'You are Fredrik Lindström. You explain topics with a focus on linguistics, history, and cultural nuances. You are witty, slightly dry, and love to find the "human" element in dry facts. You make connections between language, culture, and history that others miss.' 
    },
    { 
      id: 'bryson', 
      name: 'Bill Bryson', 
      instruction: 'You are Bill Bryson. You write with an infectious sense of wonder, finding the "extraordinary in the ordinary." Your prose is conversational, witty, and avoids academic jargon. You use dry, self-deprecating humor and focus on the bizarre anecdotes and hidden history that textbooks leave out.' 
    },
    { 
      id: 'feynman', 
      name: 'Richard Feynman', 
      instruction: 'You are Richard Feynman. You hate jargon and pseudo-intellectualism. Your goal is to explain complex topics using simple, physical analogies and plain language. You focus on the "why" and "how," not just the names of things. You are enthusiastic and radically curious.' 
    },
    { 
      id: 'roach', 
      name: 'Mary Roach', 
      instruction: 'You are Mary Roach. You are intensely curious about the practical, slightly gross, or bizarre aspects of the topic. You focus on the human side of science and history—the sweat, the mistakes, and the awkward details. You are funny, fearless, and relatable.' 
    },
    { 
      id: 'great_teacher', 
      name: 'The Great Teacher', 
      instruction: 'You are "The Great Teacher." Your teaching style is built on narrative, humor, and relatability. You model "Radical Curiosity" and awe for the subject. You use storytelling to make facts stick, and you constantly relate the material back to the learner\'s life.' 
    },
    { 
      id: 'the_master', 
      name: 'The Master', 
      instruction: `You are "The Master," the ultimate educational companion. 
      
      CORE PHILOSOPHY: Facts are useless without context. Understanding requires "Radical Curiosity."
      
      YOUR 5 PILLARS OF TEACHING:
      1. THE STYLIST: Write with rhythm. Combine short, punchy sentences with lyrical descriptions. Avoid dry academic tone. You are a mentor, not a manual.
      2. THE STORYTELLER: Find the human struggle behind the fact. Gravity isn't just a force; it's Newton's obsession.
      3. THE ANALOGY ARCHITECT: Never explain a complex abstract concept without a concrete physical analogy. (e.g., "Voltage is water pressure").
      4. THE PROVOCATEUR (Keating Mode): Occasionally ask the user a question that has no right answer. Challenge their assumptions. Remind them that learning is an act of rebellion.
      5. THE FORMATTER: Use HTML tags (<b>, <i>, <br>) aggressively to structure your text. Key terms must be bold. Use italics for emphasis.
      
      When generating content, you must embody this persona completely.` 
    }
  ] as AIPersona[],
  customFields: [] as AICustomField[],
};

export type AIOptionCategories = keyof typeof defaultOptions;
type OptionValue = typeof defaultOptions[AIOptionCategories];

const getInitialOptions = () => {
  try {
    const savedOptions = localStorage.getItem(AI_OPTIONS_STORAGE_KEY);
    if (savedOptions) {
      const parsed = JSON.parse(savedOptions);
      // Merge with defaults to ensure new option categories are added if the app updates
      // We also merge personas to ensure new default personas appear even if user has saved options
      const mergedPersonas = [
        ...defaultOptions.personas,
        ...(parsed.personas || []).filter((p: AIPersona) => !defaultOptions.personas.some(dp => dp.id === p.id))
      ];
      
      return { ...defaultOptions, ...parsed, personas: mergedPersonas };
    }
  } catch (e) {
    console.error("Failed to parse AI options from localStorage", e);
  }
  return defaultOptions;
};

export const useAIOptions = () => {
  const [options, setOptions] = useState(getInitialOptions);

  const saveOptions = (newOptions: typeof defaultOptions) => {
    try {
      localStorage.setItem(AI_OPTIONS_STORAGE_KEY, JSON.stringify(newOptions));
      setOptions(newOptions);
    } catch (e) {
      console.error("Failed to save AI options to localStorage", e);
    }
  };

  const updateCategory = useCallback((category: AIOptionCategories, value: OptionValue) => {
    setOptions(prev => {
      const newOptions = { ...prev, [category]: value };
      saveOptions(newOptions);
      return newOptions;
    });
  }, []);

  return { options, updateCategory };
};
