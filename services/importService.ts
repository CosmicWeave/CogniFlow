// services/importService.ts

import { ImportedCard, Card, ImportedQuestion, Question, Deck, DeckType, Folder, DeckSeries, ImportedQuizDeck, SeriesLevel, FlashcardDeck, QuizDeck, FullBackupData, LearningDeck } from '../types';
import { INITIAL_EASE_FACTOR } from '../constants.ts';
import { validate } from './jsonValidator.ts';
import { getStockholmDateString } from './time.ts';
import { 
    FullBackupDataSchema, 
    ImportedCardSchema, 
    ImportedQuestionSchema, 
    ImportedQuizDeckSchema, 
    ImportedSeriesSchema 
} from './schemas.ts';
import { z } from 'zod';
import JSZip from 'jszip';
import Papa from 'papaparse';

export type { ImportedQuestion };

/**
 * Migrates older backup formats to the latest version (v9).
 * Handles missing fields, type coercions, and structural changes.
 */
const migrateLegacyBackup = (data: any): any => {
    // 1. Check if it's the legacy array format (v1) - Array of Decks
    if (Array.isArray(data)) {
        console.log("Migrating Legacy Array Backup...");
        // Convert array of decks to full object
        const decks = data.filter(Boolean).map((deck: any) => {
             // Inference logic for deck type
             if (!deck.type) deck.type = Array.isArray(deck.cards) ? DeckType.Flashcard : DeckType.Quiz;
             
             // Ensure content arrays exist
             if (deck.type === DeckType.Flashcard) deck.cards = (deck.cards || []).filter(Boolean);
             else if (deck.type === DeckType.Quiz) deck.questions = (deck.questions || []).filter(Boolean);
             
             // Ensure ID and Name
             deck.id = String(deck.id || crypto.randomUUID());
             if (!deck.name) deck.name = "Untitled Deck";
             
             return deck;
        }).filter((d: any) => d && d.name);

        return {
            version: 9,
            decks,
            folders: [],
            deckSeries: [],
            reviews: [],
            sessions: [],
            seriesProgress: {},
            learningProgress: {},
            aiChatHistory: []
        };
    }

    // 2. Object format migration (v2 - v8)
    if (typeof data === 'object' && data !== null) {
        // Deep clone to avoid mutating original input if it's used elsewhere (unlikely but safe)
        const migrated = { ...data };
        
        // Ensure version exists; assume v2 if object but no version
        if (!migrated.version) migrated.version = 2;

        console.log(`Migrating Backup from v${migrated.version} to v9...`);

        // Ensure all root arrays/objects exist (polyfilling missing stores from older versions)
        if (!migrated.decks) migrated.decks = [];
        if (!migrated.folders) migrated.folders = [];
        if (!migrated.deckSeries) migrated.deckSeries = [];
        if (!migrated.reviews) migrated.reviews = [];
        if (!migrated.sessions) migrated.sessions = [];
        if (!migrated.seriesProgress) migrated.seriesProgress = {};
        if (!migrated.learningProgress) migrated.learningProgress = {}; // Added in v9
        if (!migrated.aiChatHistory) migrated.aiChatHistory = []; // Added in v7

        // Fix Decks (Common issues in older backups: missing types, number IDs)
        migrated.decks = migrated.decks.map((deck: any) => {
            if (!deck) return null;
            
            // Ensure ID is string
            if (deck.id) deck.id = String(deck.id);
            else deck.id = crypto.randomUUID();

            // Fix Types if missing
            if (!deck.type) {
                if (deck.cards && deck.cards.length > 0) deck.type = 'flashcard';
                else if (deck.infoCards && deck.infoCards.length > 0) deck.type = 'learning';
                else deck.type = 'quiz';
            }

            // Ensure content arrays exist
            if (!deck.cards) deck.cards = [];
            if (!deck.questions) deck.questions = [];
            if (!deck.infoCards) deck.infoCards = [];

            // Fix Items inside deck (Cards/Questions)
            const fixReviewable = (item: any) => {
                if (!item) return null;
                // Ensure ID is string
                item.id = String(item.id || crypto.randomUUID());
                
                // Defaults for SRS fields if missing
                if (item.interval === undefined || item.interval === null) item.interval = 0;
                if (item.easeFactor === undefined || item.easeFactor === null) item.easeFactor = 2.5;
                if (item.lapses === undefined || item.lapses === null) item.lapses = 0;
                if (item.masteryLevel === undefined || item.masteryLevel === null) item.masteryLevel = 0;
                if (!item.dueDate) item.dueDate = new Date().toISOString();
                
                return item;
            };

            if (deck.type === 'flashcard') {
                deck.cards = deck.cards.map(fixReviewable).filter(Boolean);
            } else {
                deck.questions = deck.questions.map((q: any) => {
                    const fixed = fixReviewable(q);
                    if(!fixed) return null;
                    // Ensure question-specific fields
                    if (!fixed.questionType) fixed.questionType = 'multipleChoice';
                    if (!fixed.options) fixed.options = [];
                    // Ensure options have IDs
                    fixed.options = fixed.options.map((o: any) => ({
                        ...o,
                        id: String(o.id || crypto.randomUUID())
                    }));
                    return fixed;
                }).filter(Boolean);

                if (deck.type === 'learning') {
                    // Fix InfoCards if any
                    deck.infoCards = deck.infoCards.map((ic: any) => {
                        if (!ic) return null;
                        ic.id = String(ic.id || crypto.randomUUID());
                        if (!ic.unlocksQuestionIds) ic.unlocksQuestionIds = [];
                        return ic;
                    }).filter(Boolean);
                }
            }

            return deck;
        }).filter(Boolean);

        // Fix Series (Ensure IDs are strings, levels exist)
        migrated.deckSeries = migrated.deckSeries.map((s: any) => {
            s.id = String(s.id);
            if (!s.levels) s.levels = [];
            return s;
        });

        // Fix Reviews (Ensure Item/Deck IDs are strings)
        migrated.reviews = migrated.reviews.map((r: any) => {
            r.itemId = String(r.itemId);
            r.deckId = String(r.deckId);
            return r;
        });

        // Fix Sessions (Populate missing itemsCompleted)
        migrated.sessions = migrated.sessions.map((s: any) => {
            if (!s) return null;
            if (s.itemsCompleted === undefined || s.itemsCompleted === null) {
                s.itemsCompleted = s.currentIndex || 0;
            }
            return s;
        }).filter(Boolean);

        // Upgrade Version to current
        migrated.version = 9;
        return migrated;
    }

    return data;
};

export const parseAndValidateBackupFile = async (jsonString: string): Promise<FullBackupData> => {
  let data: any;

  // 1. Try initial parse
  try {
      // Fast path for mostly valid JSON
      data = JSON.parse(jsonString);
  } catch (e) {
      // Fallback to advanced validator/fixer if simple parse fails
      const result = validate(jsonString);
      if (!result.isValid && !result.fixedJSON) {
          const errorDetails = result.detailedErrors[0];
          if (errorDetails && errorDetails.friendlyMessage) {
              throw new Error(`Failed to parse backup file: ${errorDetails.friendlyMessage} (Line: ${errorDetails.line})`);
          }
          throw new Error(`Failed to parse backup file: ${result.errors.join(', ')}`);
      }
      if (!result.parsed && result.fixedJSON) {
          try {
              data = JSON.parse(result.fixedJSON);
          } catch (e) {
              throw new Error("The backup file had errors that could not be automatically fixed.");
          }
      } else {
          data = result.parsed;
      }
  }

  if (data === null || typeof data === 'undefined') {
    throw new Error("The backup file appears to be empty or invalid.");
  }
  
  try {
    // Handle double-stringified JSON
    if (typeof data === 'string') {
        data = JSON.parse(data);
    }
    
    // --- Decompression Logic ---
    if (typeof data === 'object' && data !== null && data.dataType === 'cogniflow-compressed-backup-v1' && typeof data.content === 'string') {
        try {
            const zip = await JSZip.loadAsync(data.content, { base64: true });
            const file = zip.file("backup.json");
            if (file) {
                const text = await file.async("string");
                data = JSON.parse(text);
            } else {
                throw new Error("Compressed backup is missing 'backup.json'.");
            }
        } catch (e) {
            throw new Error(`Failed to decompress backup: ${(e as Error).message}`);
        }
    }

    // Handle nested data structures (legacy wrappers)
    if (typeof data === 'object' && data !== null && !('version' in data) && !Array.isArray(data)) {
        if ('data' in data && typeof data.data === 'object') data = data.data;
        else if ('content' in data && typeof data.content === 'object') data = data.content;
    }

    // --- Migration Step ---
    // This transforms older versions (v7, v8, arrays) into a standard v9 structure
    // BEFORE strict validation. This fixes missing fields like learningProgress.
    data = migrateLegacyBackup(data);

    // --- Validation using Zod ---
    // Now data should be in v9 format.
    
    if (typeof data === 'object' && data !== null && 'version' in data) {
      if (data.version > 9) throw new Error(`Unsupported backup version: ${data.version}. Please check for app updates.`);
      
      const parsed = FullBackupDataSchema.safeParse(data);
      
      if (!parsed.success) {
          // Provide a helpful error message from Zod issues
          const firstError = parsed.error.issues[0];
          throw new Error(`Invalid backup data at ${firstError.path.join('.')}: ${firstError.message}`);
      }

      return parsed.data as FullBackupData;
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
  | { type: 'series', data: { seriesName: string, seriesDescription: string, levels: Array<{ title: string; decks: any[] }> } };

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

  // 1. Try Series
  const seriesParse = ImportedSeriesSchema.safeParse(data);
  if (seriesParse.success) {
      const seriesData = seriesParse.data;
      // Deep validate decks inside series loosely (since they are 'any' in schema)
      // This part remains custom logic because we need to check deck types dynamically
      for (const level of seriesData.levels) {
            for (const deck of level.decks) {
                if (typeof deck.name !== 'string' || !deck.type) {
                    throw new Error(`Each deck in a series must have a 'name' and 'type'.`);
                }
                // Basic structural check
                if (deck.type === 'quiz' && !Array.isArray(deck.questions)) throw new Error(`Quiz deck "${deck.name}" missing 'questions'.`);
                if (deck.type === 'flashcard' && !Array.isArray(deck.cards)) throw new Error(`Flashcard deck "${deck.name}" missing 'cards'.`);
            }
      }
      return { type: 'series', data: seriesData as any };
  }

  // 2. Try Simple Flashcard Array
  const cardsParse = z.array(ImportedCardSchema).safeParse(data);
  if (cardsParse.success) {
    return { type: DeckType.Flashcard, data: cardsParse.data as ImportedCard[] };
  }
  
  // 3. Try Quiz Deck
  const quizParse = ImportedQuizDeckSchema.safeParse(data);
  if (quizParse.success) {
    return { type: DeckType.Quiz, data: quizParse.data as ImportedQuizDeck };
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
      const parsed = z.array(ImportedCardSchema).safeParse(data);
      if (!parsed.success) {
          throw new Error("Invalid flashcard format. Each item must have 'front' and 'back' properties.");
      }
      return parsed.data as ImportedCard[];
  } else { // Quiz type
      const parsed = z.array(ImportedQuestionSchema).safeParse(data);
      if (!parsed.success) {
          // Provide more detail if possible
          const issue = parsed.error.issues[0];
          // Use String() to safely handle potentially symbol types in issue path, though rare with Zod here.
          throw new Error(`Invalid question format at item ${String(issue.path[0])}: ${issue.message}`);
      }
      return parsed.data as ImportedQuestion[];
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
        questionType: 'multipleChoice', 
        dueDate: today.toISOString(),
        interval: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        masteryLevel: 0,
        lapses: 0,
        detailedExplanation: importedQuestion.detailedExplanation || '',
        options: importedQuestion.options.map(o => ({
            id: o.id || crypto.randomUUID(),
            text: o.text,
            explanation: o.explanation
        })) 
    }));
};

export const parseCSV = (csvString: string): ImportedCard[] => {
    const { data, errors } = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase()
    });
    
    if (errors.length > 0) {
        throw new Error(`CSV Parsing Error: ${errors[0].message}`);
    }

    const cards: ImportedCard[] = (data as any[]).map((row: any) => {
        // Heuristic to find front/back fields if headers are not exact
        const front = row.front || row.question || row.term || row.en || Object.values(row)[0];
        const back = row.back || row.answer || row.definition || row.translation || Object.values(row)[1];

        if (!front || !back) return null;
        return {
            front: String(front).trim(),
            back: String(back).trim()
        };
    }).filter((c): c is ImportedCard => c !== null);

    if (cards.length === 0) throw new Error("No valid cards found in CSV. Ensure columns for Front/Back exist.");
    return cards;
}

export type AnalyzedFileType = 'backup' | 'series' | 'quiz' | 'flashcard' | 'anki' | 'image' | 'csv';

export interface AnalysisResult {
    type: AnalyzedFileType;
    data: any;
    file?: File;
    fileName?: string;
}

export const analyzeFile = async (file: File): Promise<AnalysisResult | null> => {
    const name = file.name.toLowerCase();
    
    // Check for Anki Package
    if (name.endsWith('.apkg') || name.endsWith('.zip')) {
        return { type: 'anki', data: { name: file.name }, file, fileName: file.name };
    }
    
    // Check for Image
    if (name.match(/\.(png|jpg|jpeg|webp|gif)$/)) {
        return { type: 'image', data: { name: file.name, mimeType: file.type }, file, fileName: file.name };
    }
    
    // Check for CSV
    if (name.endsWith('.csv')) {
        try {
            const text = await file.text();
            const cards = parseCSV(text);
            return { type: 'flashcard', data: cards, fileName: file.name };
        } catch (e) {
            console.error("Failed to parse CSV", e);
             // don't return null, maybe just fail to recognize
        }
    }
    
    // Check for JSON based formats
    if (name.endsWith('.json')) {
        try {
            const text = await file.text();
            // First try single-item formats
            try {
                const importData = parseAndValidateImportData(text);
                return { type: importData.type as AnalyzedFileType, data: importData.data, fileName: file.name };
            } catch (e) {
                // Not a standard import format, try backup
            }

            // Try full backup
            try {
                const backupData = await parseAndValidateBackupFile(text);
                return { type: 'backup', data: backupData, fileName: file.name };
            } catch (e) {
                // Not a valid backup either
            }
        } catch (e) {
            console.error("Failed to read file text", e);
        }
    }
    
    return null;
};

// Deprecated: Kept for backward compatibility with pure text drop
export const analyzeFileContent = async (jsonString: string): Promise<AnalysisResult | null> => {
    try {
        const importData = parseAndValidateImportData(jsonString);
        return { type: importData.type as AnalyzedFileType, data: importData.data };
    } catch (e) {
        // Not a standard single-item import format, so we continue.
    }

    try {
        const backupData = await parseAndValidateBackupFile(jsonString);
        return { type: 'backup', data: backupData };
    } catch (e) {
        // It's not a valid backup file either.
    }

    return null;
};