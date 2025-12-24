// services/importService.ts

import { ImportedCard, Card, ImportedQuestion, Question, Deck, DeckType, Folder, DeckSeries, ImportedQuizDeck, SeriesLevel, FlashcardDeck, QuizDeck, FullBackupData, LearningDeck } from '../types.ts';
import { INITIAL_EASE_FACTOR } from '../constants.ts';
import { validate } from './jsonValidator.ts';
import { getStockholmDateString } from './time.ts';
import { 
    FullBackupDataSchema, 
    ImportedCardSchema, 
    ImportedQuestionSchema, 
    ImportedQuizDeckSchema, 
    ImportedSeriesSchema,
    InfoCardSchema
} from './schemas.ts';
import { z } from 'zod';
import JSZip from 'jszip';
import Papa from 'papaparse';

export type { ImportedQuestion };

/**
 * Migrates older backup formats to the latest version (v9).
 */
const migrateLegacyBackup = (data: any): any => {
    if (Array.isArray(data)) {
        const decks = data.filter(Boolean).map((deck: any) => {
             if (!deck.type) deck.type = Array.isArray(deck.cards) ? DeckType.Flashcard : DeckType.Quiz;
             if (deck.type === DeckType.Flashcard) deck.cards = (deck.cards || []).filter(Boolean);
             else if (deck.type === DeckType.Quiz) deck.questions = (deck.questions || []).filter(Boolean);
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

    if (typeof data === 'object' && data !== null) {
        const migrated = { ...data };
        if (!migrated.version) migrated.version = 2;

        if (!migrated.decks) migrated.decks = [];
        if (!migrated.folders) migrated.folders = [];
        if (!migrated.deckSeries) migrated.deckSeries = [];
        if (!migrated.reviews) migrated.reviews = [];
        if (!migrated.sessions) migrated.sessions = [];
        if (!migrated.seriesProgress) migrated.seriesProgress = {};
        if (!migrated.learningProgress) migrated.learningProgress = {}; 
        if (!migrated.aiChatHistory) migrated.aiChatHistory = [];

        migrated.decks = migrated.decks.map((deck: any) => {
            if (!deck) return null;
            if (deck.id) deck.id = String(deck.id);
            else deck.id = crypto.randomUUID();

            if (!deck.type) {
                if (deck.cards && deck.cards.length > 0) deck.type = 'flashcard';
                else if (deck.infoCards && deck.infoCards.length > 0) deck.type = 'learning';
                else deck.type = 'quiz';
            }

            if (!deck.cards) deck.cards = [];
            if (!deck.questions) deck.questions = [];
            if (!deck.infoCards) deck.infoCards = [];

            const fixReviewable = (item: any) => {
                if (!item) return null;
                item.id = String(item.id || crypto.randomUUID());
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
                    if (!fixed.questionType) fixed.questionType = 'multipleChoice';
                    if (!fixed.options) fixed.options = [];
                    fixed.options = fixed.options.map((o: any) => ({
                        ...o,
                        id: String(o.id || crypto.randomUUID())
                    }));
                    return fixed;
                }).filter(Boolean);

                if (deck.type === 'learning') {
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

        migrated.deckSeries = migrated.deckSeries.map((s: any) => {
            s.id = String(s.id);
            if (!s.levels) s.levels = [];
            return s;
        });

        migrated.reviews = migrated.reviews.map((r: any) => {
            r.itemId = String(r.itemId);
            r.deckId = String(r.deckId);
            return r;
        });

        migrated.sessions = migrated.sessions.map((s: any) => {
            if (!s) return null;
            if (s.itemsCompleted === undefined || s.itemsCompleted === null) {
                s.itemsCompleted = s.currentIndex || 0;
            }
            return s;
        }).filter(Boolean);

        migrated.version = 9;
        return migrated;
    }

    return data;
};

export const parseAndValidateBackupFile = async (jsonString: string): Promise<FullBackupData> => {
  let data: any;

  try {
      data = JSON.parse(jsonString);
  } catch (e) {
      const result = validate(jsonString);
      if (!result.isValid && !result.fixedJSON) {
          throw new Error("Failed to parse backup file.");
      }
      data = result.parsed || JSON.parse(result.fixedJSON!);
  }

  if (!data) throw new Error("The backup file appears to be empty or invalid.");
  
  if (typeof data === 'string') data = JSON.parse(data);
    
  if (typeof data === 'object' && data !== null && data.dataType === 'cogniflow-compressed-backup-v1' && typeof data.content === 'string') {
      const zip = await JSZip.loadAsync(data.content, { base64: true });
      const file = zip.file("backup.json");
      if (file) {
          const text = await file.async("string");
          data = JSON.parse(text);
      }
  }

  if (typeof data === 'object' && data !== null && !('version' in data) && !Array.isArray(data)) {
      if ('data' in data && typeof data.data === 'object') data = data.data;
      else if ('content' in data && typeof data.content === 'object') data = data.content;
  }

  data = migrateLegacyBackup(data);
    
  if (typeof data === 'object' && data !== null && 'version' in data) {
    if (data.version > 9) throw new Error(`Unsupported backup version: ${data.version}.`);
    const parsed = FullBackupDataSchema.safeParse(data);
    if (!parsed.success) throw new Error(`Invalid backup data at ${parsed.error.issues[0].path.join('.')}`);
    return parsed.data as FullBackupData;
  }

  throw new Error("The file is not a valid CogniFlow backup file.");
};


export type ParsedResult = 
  | { type: DeckType.Flashcard, data: ImportedCard[] }
  | { type: DeckType.Quiz, data: ImportedQuizDeck }
  | { type: DeckType.Learning, data: ImportedQuizDeck }
  | { type: 'series', data: { seriesName: string, seriesDescription: string, levels: Array<{ title: string; decks: any[] }> } };

export const parseAndValidateImportData = (jsonString: string): ParsedResult => {
  if (!jsonString.trim()) throw new Error("Pasted content is empty.");
  
  const result = validate(jsonString);
  if (!result.isValid) throw new Error("Invalid JSON.");
  
  const data = result.parsed;

  // 1. Try Series
  const seriesParse = ImportedSeriesSchema.safeParse(data);
  if (seriesParse.success) {
      const seriesData = seriesParse.data;
      return { type: 'series', data: seriesData as any };
  }

  // 2. Try Simple Flashcard Array
  const cardsParse = z.array(ImportedCardSchema).safeParse(data);
  if (cardsParse.success) {
    return { type: DeckType.Flashcard, data: cardsParse.data as ImportedCard[] };
  }
  
  // 3. Try Quiz/Learning Deck
  const quizParse = ImportedQuizDeckSchema.safeParse(data);
  if (quizParse.success) {
    // Post-analysis stricter check for questions array
    const questionsParse = z.array(ImportedQuestionSchema).safeParse(data.questions);
    const infoCardsParse = z.array(InfoCardSchema).optional().safeParse(data.infoCards);
    
    if (!questionsParse.success) {
        console.warn("Questions failed deep validation:", questionsParse.error);
    }
    
    const validatedData = {
        ...quizParse.data,
        questions: questionsParse.success ? questionsParse.data : data.questions,
        infoCards: infoCardsParse.success ? infoCardsParse.data : data.infoCards
    } as ImportedQuizDeck;

    if (validatedData.type === 'learning' || (Array.isArray(validatedData.infoCards) && validatedData.infoCards.length > 0)) {
        // Ensure cross-linking between infoCards and questions if links exist in the source JSON
        const questions = validatedData.questions || [];
        const infoCards = validatedData.infoCards || [];
        
        infoCards.forEach(ic => {
            if (Array.isArray(ic.unlocksQuestionIds)) {
                ic.unlocksQuestionIds.forEach(qId => {
                    const question = questions.find(q => q.id === qId);
                    if (question) {
                        if (!question.infoCardIds) question.infoCardIds = [];
                        if (!question.infoCardIds.includes(ic.id)) {
                            question.infoCardIds.push(ic.id);
                        }
                    }
                });
            }
        });

        return { type: DeckType.Learning, data: validatedData };
    }
    return { type: DeckType.Quiz, data: validatedData };
  }

  throw new Error("Unsupported JSON structure.");
};

export const parseAndValidateItemsJSON = (jsonString: string, deckType: DeckType): ImportedCard[] | ImportedQuestion[] => {
  if (!jsonString.trim()) throw new Error("Pasted content is empty.");
  const result = validate(jsonString);
  if (!result.isValid) throw new Error("Invalid JSON.");

  const data = result.parsed;
  if (!Array.isArray(data)) throw new Error("JSON must be an array of items.");
  if (data.length === 0) return [];

  if (deckType === DeckType.Flashcard) {
      const parsed = z.array(ImportedCardSchema).safeParse(data);
      if (!parsed.success) throw new Error("Invalid flashcard format.");
      return parsed.data as ImportedCard[];
  } else { 
      const parsed = z.array(ImportedQuestionSchema).safeParse(data);
      if (!parsed.success) throw new Error(`Invalid question format: ${parsed.error.issues[0].message}`);
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

    return importedQuestions.map(importedQuestion => {
        const oldCorrectId = importedQuestion.correctAnswerId;
        
        const options = (importedQuestion.options || []).map(o => ({
            ...o,
            id: o.id || crypto.randomUUID(),
            text: o.text || '',
            explanation: o.explanation || ''
        }));

        // Heuristic to fix missing or broken correctAnswerId
        let correctAnswerId = '';
        
        // 1. Try to find the option that matches the old ID (if any)
        if (oldCorrectId) {
            const found = options.find(o => o.id === oldCorrectId);
            if (found) correctAnswerId = found.id;
        }
        
        // 2. Keyword heuristic: If correctAnswerId is empty, look for an option with "Correct" in its fields
        if (!correctAnswerId) {
            const correctOpt = options.find(o => 
                o.explanation?.toLowerCase().includes('correct') || 
                o.text?.toLowerCase().startsWith('correct') ||
                o.explanation?.toLowerCase().startsWith('correct')
            );
            if (correctOpt) {
                correctAnswerId = correctOpt.id;
            }
        }
        
        // 3. Last fallback: default to first option so the question isn't unanswerable
        if (!correctAnswerId && options.length > 0) {
            correctAnswerId = options[0].id;
        }

        return {
            ...importedQuestion,
            id: importedQuestion.id || crypto.randomUUID(), 
            questionType: 'multipleChoice', 
            dueDate: today.toISOString(),
            interval: 0,
            easeFactor: INITIAL_EASE_FACTOR,
            masteryLevel: 0,
            lapses: 0,
            detailedExplanation: importedQuestion.detailedExplanation || '',
            correctAnswerId,
            options
        };
    });
};

export const parseCSV = (csvString: string): ImportedCard[] => {
    const { data, errors } = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase()
    });
    if (errors.length > 0) throw new Error(`CSV Parsing Error: ${errors[0].message}`);

    const cards: ImportedCard[] = (data as any[]).map((row: any) => {
        const front = row.front || row.question || row.term || row.en || Object.values(row)[0];
        const back = row.back || row.answer || row.definition || row.translation || Object.values(row)[1];
        if (!front || !back) return null;
        return { front: String(front).trim(), back: String(back).trim() };
    }).filter((c): c is ImportedCard => c !== null);

    if (cards.length === 0) throw new Error("No valid cards found in CSV.");
    return cards;
}

export type AnalyzedFileType = 'backup' | 'series' | 'quiz' | 'flashcard' | 'anki' | 'image' | 'csv' | 'learning';

export interface AnalysisResult {
    type: AnalyzedFileType;
    data: any;
    file?: File;
    fileName?: string;
}

export const analyzeFile = async (file: File): Promise<AnalysisResult | null> => {
    const name = file.name.toLowerCase();
    
    if (name.endsWith('.apkg') || name.endsWith('.zip')) {
        return { type: 'anki', data: { name: file.name }, file, fileName: file.name };
    }
    
    if (name.match(/\.(png|jpg|jpeg|webp|gif)$/)) {
        return { type: 'image', data: { name: file.name, mimeType: file.type }, file, fileName: file.name };
    }
    
    if (name.endsWith('.csv')) {
        try {
            const text = await file.text();
            const cards = parseCSV(text);
            return { type: 'flashcard', data: cards, fileName: file.name };
        } catch (e) {
            console.error("Failed to parse CSV", e);
        }
    }
    
    try {
        const text = await file.text();
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const importData = parseAndValidateImportData(text);
                return { type: importData.type as AnalyzedFileType, data: importData.data, fileName: file.name };
            } catch (e) {
                console.debug("JSON: Not a standard import format, checking if backup...", e);
            }

            try {
                const backupData = await parseAndValidateBackupFile(text);
                return { type: 'backup', data: backupData, fileName: file.name };
            } catch (e) {
                console.debug("JSON: Not a valid backup format.", e);
            }
        }
    } catch (e) {
        console.error("Failed to read file text for JSON check", e);
    }
    
    return null;
};