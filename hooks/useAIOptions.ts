
import { useState, useCallback } from 'react';

const AI_OPTIONS_STORAGE_KEY = 'cogniflow-ai-options';

// Default values
const defaultOptions = {
  understandingLevels: ['Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert'],
  comprehensivenessLevels: ['Quick Overview', 'Standard', 'Comprehensive', 'Exhaustive'],
  learningGoalOptions: [
    "Master a subject",
    "Learn for the sake of curiosity",
    "Explore a new interest",
    "Become more informed",
    "Understand a complex topic",
    "Practically learn the topic"
  ],
  learningStyleOptions: ["Conceptual Understanding (Why & How)", "Factual Recall (What, Who, When)", "Practical Application & Scenarios"],
  languageOptions: ["English", "Swedish", "Spanish", "French", "German", "Japanese", "Mandarin", "Russian"],
};

export type AIOptionCategories = keyof typeof defaultOptions;

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

  const addOption = useCallback((category: AIOptionCategories, value: string) => {
    if (!value.trim()) return;
    setOptions(prev => {
      const newCategoryOptions = [...prev[category], value.trim()];
      const newOptions = { ...prev, [category]: newCategoryOptions };
      saveOptions(newOptions);
      return newOptions;
    });
  }, []);
  
  const updateOption = useCallback((category: AIOptionCategories, index: number, newValue: string) => {
    if (!newValue.trim()) return;
    setOptions(prev => {
        const newCategoryOptions = [...prev[category]];
        newCategoryOptions[index] = newValue.trim();
        const newOptions = { ...prev, [category]: newCategoryOptions };
        saveOptions(newOptions);
        return newOptions;
    });
  }, []);

  const deleteOption = useCallback((category: AIOptionCategories, index: number) => {
    setOptions(prev => {
        const newCategoryOptions = prev[category].filter((_, i) => i !== index);
        const newOptions = { ...prev, [category]: newCategoryOptions };
        saveOptions(newOptions);
        return newOptions;
    });
  }, []);

  return { options, addOption, updateOption, deleteOption };
};
