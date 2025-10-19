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
    { id: 'author', name: 'Technical Author', instruction: 'You are a technical author. Your style is concise, precise, and fact-focused. You avoid fluff and get straight to the point.' }
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
      return { ...defaultOptions, ...parsed };
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
