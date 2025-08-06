
import { ImportedCard, Card, ImportedQuestion, Question, Deck, DeckType, Folder, DeckSeries, ImportedQuizDeck, SeriesLevel } from '../types';
import { INITIAL_EASE_FACTOR } from '../constants';

export const parseAndValidateBackupFile = (jsonString: string): { decks: Deck[], folders: Folder[], deckSeries: DeckSeries[] } => {
  try {
    if (!jsonString.trim()) throw new Error("File content is empty.");
    const data = JSON.parse(jsonString);

    // New format: { version: 2|3, decks: [], folders: [], deckSeries?: [] }
    if (typeof data === 'object' && data !== null && 'version' in data && Array.isArray(data.decks)) {
      if (data.version > 3) throw new Error(`Unsupported backup version: ${data.version}`);
      
      const decks = data.decks as Deck[];
      const folders = (data.folders || []) as Folder[];
      const deckSeries = (data.deckSeries || []) as DeckSeries[];

      // Basic validation
      for (const deck of decks) {
        if (typeof deck.id !== 'string' || typeof deck.name !== 'string' || !deck.type) {
          throw new Error("Invalid deck structure in backup file.");
        }
      }
      for (const folder of folders) {
        if (typeof folder.id !== 'string' || typeof folder.name !== 'string') {
          throw new Error("Invalid folder structure in backup file.");
        }
      }
       for (const series of deckSeries) {
        if (typeof series.id !== 'string' || typeof series.name !== 'string' || !Array.isArray(series.levels)) {
          throw new Error("Invalid deck series structure in backup file. Expected 'levels' array.");
        }
      }
      return { decks, folders, deckSeries };
    }

    // Old format: Deck[]
    if (Array.isArray(data)) {
        // Check if it looks like a deck array
        if (data.length > 0 && (!('id' in data[0] && 'name' in data[0] && 'type' in data[0]))) {
            throw new Error("The file is not a valid CogniFlow backup file.");
        }
        for (const deck of data) {
            if (typeof deck.id !== 'string' || typeof deck.name !== 'string' || (deck.type !== DeckType.Flashcard && deck.type !== DeckType.Quiz)) {
                throw new Error("Invalid backup file. One or more decks have incorrect structure.");
            }
        }
        return { decks: data as Deck[], folders: [], deckSeries: [] };
    }
    
    throw new Error("The file is not a valid CogniFlow backup file.");

  } catch (error) {
    console.error("Failed to parse backup file:", error);
    throw new Error(error instanceof Error ? error.message : "Invalid JSON format");
  }
};


export type ParsedResult = 
  | { type: DeckType.Flashcard, data: ImportedCard[] }
  | { type: DeckType.Quiz, data: ImportedQuizDeck }
  | { type: 'quiz_series', data: { seriesName: string, seriesDescription: string, levels: Array<{ title: string; decks: ImportedQuizDeck[] }> } };

export const parseAndValidateImportData = (jsonString: string): ParsedResult => {
  try {
    if (!jsonString.trim()) throw new Error("Pasted content is empty.");
    const data = JSON.parse(jsonString);

    // New check for a series object with levels
    if (typeof data === 'object' && data !== null && 'seriesName' in data && 'levels' in data) {
        if (typeof data.seriesName !== 'string' || typeof data.seriesDescription !== 'string' || !Array.isArray(data.levels)) {
            throw new Error("Invalid series format. Must have 'seriesName' (string), 'seriesDescription' (string), and a 'levels' (array).");
        }
        for (const level of data.levels) {
             if (typeof level.title !== 'string' || !Array.isArray(level.decks)) {
                throw new Error("Each level in the series must have a 'title' (string) and a 'decks' (array).");
             }
             for (const deck of level.decks) {
                 if (typeof deck.name !== 'string' || typeof deck.description !== 'string' || !Array.isArray(deck.questions)) {
                    throw new Error("Each deck in a level must be a valid quiz deck object with 'name', 'description', and 'questions' properties.");
                 }
             }
        }
        return { type: 'quiz_series', data: data };
    }

    // Simple flashcard import
    if (Array.isArray(data)) {
      const validatedCards: ImportedCard[] = [];
      for (const item of data) {
        if (typeof item.front !== 'string' || typeof item.back !== 'string') {
          throw new Error("Each item in the array must be an object with 'front' and 'back' string properties.");
        }
        validatedCards.push({ front: item.front, back: item.back });
      }
      return { type: DeckType.Flashcard, data: validatedCards };
    }
    
    // Quiz format check
    if (typeof data === 'object' && data !== null && 'questions' in data) {
      if (typeof data.name !== 'string' || typeof data.description !== 'string' || !Array.isArray(data.questions)) {
        throw new Error("Quiz JSON must be an object with 'name' (string), 'description' (string), and 'questions' (array) properties.");
      }
      for (const q of data.questions) {
        if (typeof q.questionText !== 'string' || !Array.isArray(q.options) || typeof q.correctAnswerId !== 'string') {
          throw new Error("Each question in a quiz must have 'questionText', an 'options' array, and a 'correctAnswerId'.");
        }
      }
      return { type: DeckType.Quiz, data: data };
    }

    throw new Error("Unsupported JSON structure. Expected an array of flashcards, a single quiz object, or a series object.");
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    throw new Error(error instanceof Error ? error.message : "Invalid JSON format");
  }
};

export const parseAndValidateItemsJSON = (jsonString: string, deckType: DeckType): ImportedCard[] | ImportedQuestion[] => {
  try {
    if (!jsonString.trim()) throw new Error("Pasted content is empty.");
    const data = JSON.parse(jsonString);

    if (!Array.isArray(data)) {
      throw new Error("JSON must be an array of items.");
    }
    
    if (data.length === 0) {
        return [];
    }

    if (deckType === DeckType.Flashcard) {
        const validatedCards: ImportedCard[] = [];
        for (const item of data) {
            if (typeof item.front !== 'string' || typeof item.back !== 'string') {
              throw new Error("Each item in the array must be an object with 'front' and 'back' string properties.");
            }
            validatedCards.push({ front: item.front, back: item.back });
        }
        return validatedCards;
    } else { // Quiz type
        const validatedQuestions: ImportedQuestion[] = [];
        for (const q of data) {
            if (typeof q.questionText !== 'string' || !Array.isArray(q.options) || typeof q.correctAnswerId !== 'string') {
              throw new Error("Each question must have 'questionText', an 'options' array, and a 'correctAnswerId'.");
            }
             // We can perform deeper validation here if needed (e.g., on options)
            validatedQuestions.push(q);
        }
        return validatedQuestions;
    }

  } catch (error) {
    console.error("Failed to parse items JSON:", error);
    throw new Error(error instanceof Error ? error.message : "Invalid JSON format");
  }
};


export const createCardsFromImport = (importedCards: ImportedCard[]): Card[] => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return importedCards.map(importedCard => ({
        id: crypto.randomUUID(),
        front: importedCard.front,
        back: importedCard.back,
        dueDate: today.toISOString(),
        interval: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        masteryLevel: 0,
    }));
};

export const createQuestionsFromImport = (importedQuestions: ImportedQuestion[]): Question[] => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return importedQuestions.map(importedQuestion => ({
        ...importedQuestion,
        id: crypto.randomUUID(),
        dueDate: today.toISOString(),
        interval: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        masteryLevel: 0,
    }));
};