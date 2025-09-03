
import { ImportedCard, Card, ImportedQuestion, Question, Deck, DeckType, Folder, DeckSeries, ImportedQuizDeck, SeriesLevel, FlashcardDeck, QuizDeck } from '../types';
import { INITIAL_EASE_FACTOR } from '../constants';

export const parseAndValidateBackupFile = (jsonString: string): { decks: Deck[], folders: Folder[], deckSeries: DeckSeries[], aiOptions?: any } => {
  try {
    if (!jsonString.trim()) throw new Error("File content is empty.");
    let data = JSON.parse(jsonString);

    // Handle cases where the content is double-stringified JSON
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            // If the inner string is not valid JSON, let it fail at the checks below.
        }
    }

    // Handle cases where the backup data is nested under a `data` or `content` property,
    // which can happen with some API responses.
    if (typeof data === 'object' && data !== null && !('version' in data) && !Array.isArray(data)) {
        if ('data' in data && typeof data.data === 'object') {
            data = data.data;
        } else if ('content' in data && typeof data.content === 'object') {
            data = data.content;
        }
    }


    // Handles modern backup format: { version: 2|3|4, decks: [], ... }
    if (typeof data === 'object' && data !== null && 'version' in data && Array.isArray(data.decks)) {
      if (data.version > 4) throw new Error(`Unsupported backup version: ${data.version}`);
      
      const decks = data.decks as Deck[];
      const folders = (data.folders || []) as Folder[]; // Handles V2 backups without folders
      const aiOptions = data.aiOptions || undefined;
      
      // Transform older DeckSeries format (with `deckIds`) to the new format (with `levels`).
      const deckSeries = (Array.isArray(data.deckSeries) ? data.deckSeries : [])
        .filter((s: any) => s && typeof s.id === 'string' && typeof s.name === 'string')
        .map((s: any) => {
            // If the new 'levels' structure is already present and valid, use it.
            if (Array.isArray(s.levels)) {
                // Ensure sub-structure is also valid for robustness
                s.levels.forEach((level: any) => {
                    if (!Array.isArray(level.deckIds)) level.deckIds = [];
                });
                return s;
            }
            
            // If the old 'deckIds' structure is present, transform it.
            if (Array.isArray(s.deckIds)) {
                const newSeries = { ...s };
                // Create a single level to hold the flat list of deckIds.
                newSeries.levels = [{ title: 'Decks', deckIds: newSeries.deckIds }];
                delete newSeries.deckIds; // Remove the old property to match the new type.
                return newSeries;
            }
        
            // If neither is present, default to an empty levels array for robustness.
            return { ...s, levels: [] };
        }) as DeckSeries[];

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
      
      return { decks, folders, deckSeries, aiOptions };
    }

    // Handles legacy V1 backup format: Deck[]
    if (Array.isArray(data)) {
        // Transform older deck structures to be compatible.
        const transformedDecks = (data as any[]).map(deck => {
          // Infer `type` for very old backups that may not have it.
          if (!deck.type) {
            if (Array.isArray(deck.cards)) {
              deck.type = DeckType.Flashcard;
            } else if (Array.isArray(deck.questions)) {
              deck.type = DeckType.Quiz;
            }
          }
          return deck;
        });

        // Validate the transformed structure.
        for (const deck of transformedDecks) {
            if (typeof deck.id !== 'string' || typeof deck.name !== 'string' || (deck.type !== DeckType.Flashcard && deck.type !== DeckType.Quiz)) {
                throw new Error("Invalid backup file. One or more decks have an incorrect structure.");
            }
        }
        // Return in the modern structure with empty folders/series.
        return { decks: transformedDecks as Deck[], folders: [], deckSeries: [] };
    }
    
    throw new Error("The file is not a valid CogniFlow backup file.");

  } catch (error) {
    console.error("Failed to parse backup file:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Invalid JSON format in the backup file.");
    }
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
        lapses: 0,
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
        // It's a valid backup file.
        return { type: 'backup', data: backupData };
    } catch (e) {
        // Not a backup file, proceed to check other formats.
    }

    // Try parsing as other importable data types.
    try {
        const importData = parseAndValidateImportData(jsonString);
        // It's a valid import file. The type is already determined by the parser.
        // The parser returns `quiz_series`, `quiz`, or `flashcard`.
        return { type: importData.type as AnalyzedFileType, data: importData.data };
    } catch (e) {
        // Not any known valid format.
    }

    return null;
};
