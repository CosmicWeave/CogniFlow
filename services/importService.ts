
// FIX: Corrected import path for types
import { ImportedCard, Card, ImportedQuestion, Question, Deck, DeckType, Folder, DeckSeries, ImportedQuizDeck, SeriesLevel, FlashcardDeck, QuizDeck, FullBackupData, LearningDeck } from '../types';
import { INITIAL_EASE_FACTOR } from '../constants';
import { validate } from './jsonValidator';

export const parseAndValidateBackupFile = (jsonString: string): FullBackupData => {
  const result = validate(jsonString);

  if (!result.isValid && !result.fixedJSON) {
      const errorDetails = result.detailedErrors[0];
      if (errorDetails && errorDetails.friendlyMessage) {
          throw new Error(`Failed to parse backup file: ${errorDetails.friendlyMessage} (Line: ${errorDetails.line})`);
      }
      throw new Error(`Failed to parse backup file: ${result.errors.join(', ')}`);
  }
  
  let data: any = result.parsed;
  if (!data && result.fixedJSON) {
      try {
          data = JSON.parse(result.fixedJSON);
      } catch (e) {
          throw new Error("The backup file had errors that could not be automatically fixed. Please review the file for syntax errors.");
      }
  }

  if (data === null || typeof data === 'undefined') {
    throw new Error("The backup file appears to be empty or invalid after attempting to fix it.");
  }
  
  try {
    // Handle double-stringified JSON which the validator might not catch if the string itself is valid JSON content.
    if (typeof data === 'string') {
        data = JSON.parse(data);
    }
    
    // Handle nested data structures some users might create
    if (typeof data === 'object' && data !== null && !('version' in data) && !Array.isArray(data)) {
        if ('data' in data && typeof data.data === 'object') data = data.data;
        else if ('content' in data && typeof data.content === 'object') data = data.content;
    }

    // --- Validation and Sanitization ---
    
    // Modern backup format (V2-V6)
    if (typeof data === 'object' && data !== null && 'version' in data) {
      if (data.version > 6) throw new Error(`Unsupported backup version: ${data.version}`);
      
      const decks: Deck[] = (Array.isArray(data.decks) ? data.decks : [])
        .filter((d: any): d is Deck => d && typeof d === 'object' && d.id && d.name && d.type)
        .map((d: Deck) => {
            if (d.type === DeckType.Flashcard) {
                d.cards = (d.cards || []).filter(Boolean);
            } else if (d.type === DeckType.Quiz || d.type === DeckType.Learning) {
                (d as QuizDeck | LearningDeck).questions = ((d as QuizDeck | LearningDeck).questions || []).filter(Boolean).map((q: Question) => {
                    if (q) q.options = (q.options || []).filter(Boolean);
                    return q;
                }).filter(Boolean);
            }
            if (d.type === DeckType.Learning) {
                (d as LearningDeck).infoCards = ((d as LearningDeck).infoCards || []).filter(Boolean);
            }
            return d;
        });
      
      const folders: Folder[] = (Array.isArray(data.folders) ? data.folders : [])
        .filter((f: any): f is Folder => f && typeof f === 'object' && f.id && f.name);

      const deckSeries: DeckSeries[] = (Array.isArray(data.deckSeries) ? data.deckSeries : [])
        .filter((s: any): s is DeckSeries => s && typeof s === 'object' && s.id && s.name)
        .map((s: any) => {
            if (Array.isArray(s.levels)) {
                s.levels = (s.levels || []).filter(Boolean).map((level: any) => {
                    if (level) level.deckIds = (level.deckIds || []).filter(Boolean);
                    return level;
                }).filter(Boolean);
            }
            return s;
        });

      return {
          version: data.version,
          decks,
          folders,
          deckSeries,
          reviews: (Array.isArray(data.reviews) ? data.reviews : []).filter(Boolean),
          sessions: (Array.isArray(data.sessions) ? data.sessions : []).filter(Boolean),
          seriesProgress: data.seriesProgress && typeof data.seriesProgress === 'object' ? data.seriesProgress : {},
          aiChatHistory: (Array.isArray(data.aiChatHistory) ? data.aiChatHistory : []).filter(Boolean),
          aiOptions: data.aiOptions || undefined
      };
    }

    // Legacy V1 backup format
    if (Array.isArray(data)) {
        const decks = data.filter(Boolean).map((deck: any) => {
            if (!deck.type) deck.type = Array.isArray(deck.cards) ? DeckType.Flashcard : DeckType.Quiz;
            if (deck.type === DeckType.Flashcard) deck.cards = (deck.cards || []).filter(Boolean);
            else if (deck.type === DeckType.Quiz) deck.questions = (deck.questions || []).filter(Boolean);
            return deck;
        }).filter((d: any): d is Deck => d && d.id && d.name && d.type);
        return { version: 1, decks, folders: [], deckSeries: [], reviews: [], sessions: [], seriesProgress: {}, aiChatHistory: [] };
    }

    throw new Error("The file is not a valid CogniFlow backup file.");

  } catch (validationError) {
      console.error("Failed to validate backup data structure:", validationError);
      throw new Error(validationError instanceof Error ? validationError.message : "Invalid backup file structure.");
  }
};


export type ParsedResult = 
  | { type: DeckType.Flashcard, data: ImportedCard[] }
  | { type: DeckType.Quiz, data: ImportedQuizDeck }
  | { type: 'quiz_series', data: { seriesName: string, seriesDescription: string, levels: Array<{ title: string; decks: ImportedQuizDeck[] }> } };

export const parseAndValidateImportData = (jsonString: string): ParsedResult => {
  if (!jsonString.trim()) throw new Error("Pasted content is empty.");
  
  const result = validate(jsonString);

  if (!result.isValid) {
      const errorDetails = result.detailedErrors[0];
      if (errorDetails && errorDetails.friendlyMessage) {
          throw new Error(`Invalid JSON: ${errorDetails.friendlyMessage}`);
      }
      throw new Error(`Invalid JSON: ${result.errors.join(', ')}`);
  }
  
  const data = result.parsed;

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
};

export const parseAndValidateItemsJSON = (jsonString: string, deckType: DeckType): ImportedCard[] | ImportedQuestion[] => {
  if (!jsonString.trim()) throw new Error("Pasted content is empty.");
  
  const result = validate(jsonString);
  
  if (!result.isValid) {
      const errorDetails = result.detailedErrors[0];
      if (errorDetails && errorDetails.friendlyMessage) {
          throw new Error(`Invalid JSON: ${errorDetails.friendlyMessage}`);
      }
      throw new Error(`Invalid JSON: ${result.errors.join(', ')}`);
  }

  const data = result.parsed;
  
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
        lapses: 0,
    }));
};

export const createQuestionsFromImport = (importedQuestions: ImportedQuestion[]): Question[] => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return importedQuestions.map(importedQuestion => ({
        ...importedQuestion,
        id: crypto.randomUUID(),
        questionType: 'multipleChoice', // FIX: Added missing 'questionType' property
        dueDate: today.toISOString(),
        interval: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        masteryLevel: 0,
        lapses: 0,
    }));
};

export type AnalyzedFileType = 'backup' | 'quiz_series' | 'quiz' | 'flashcard';

export interface AnalysisResult {
    type: AnalyzedFileType;
    data: any;
}

export const analyzeFileContent = (jsonString: string): AnalysisResult | null => {
    // Try parsing as a backup file first, as it's the most encompassing format.
    try {
        const backupData = parseAndValidateBackupFile(jsonString);
        return { type: 'backup', data: backupData };
    } catch (e) {
        // Not a backup file, try other formats.
    }

    // Try parsing as other importable data types.
    try {
        const importData = parseAndValidateImportData(jsonString);
        return { type: importData.type as AnalyzedFileType, data: importData.data };
    } catch (e) {
        // Not any known valid format.
    }

    return null;
};