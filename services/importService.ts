
// services/importService.ts

import { ImportedCard, Card, ImportedQuestion, Question, Deck, DeckType, Folder, DeckSeries, ImportedQuizDeck, SeriesLevel, FlashcardDeck, QuizDeck, FullBackupData, LearningDeck, InfoCard } from '../types.ts';
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
 * Result of parsing import data.
 */
export type ParsedResult = 
  | { type: 'series'; data: any }
  | { type: DeckType.Flashcard; data: ImportedCard[] }
  | { type: DeckType.Quiz; data: any }
  | { type: DeckType.Learning; data: any };

/**
 * Extracts raw text from various file formats.
 */
export const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'txt' || extension === 'md' || extension === 'markdown' || extension === 'csv') {
        return await file.text();
    }
    
    if (extension === 'rtf') {
        const text = await file.text();
        // Naive RTF text stripping (better than nothing for basic files)
        return text.replace(/\{\\.*?\}/g, '').replace(/\\.*?\s/g, '').trim();
    }

    // For PDF and other binary formats, we'd normally need a lib like pdfjs.
    // In this environment, we'll try to read as text and let the user know if it's binary.
    const text = await file.text();
    if (text.includes('%PDF')) {
        throw new Error("PDF text extraction requires a specialized library. Please copy-paste the text directly into the modal.");
    }
    
    return text;
};

// FIX: Corrected UUID regex to strictly follow 8-4-4-4-12 format.
export const isUUID = (str: string): boolean => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const ensureBatchIdIntegrity = (deck: ImportedQuizDeck): ImportedQuizDeck => {
    const idMap = new Map<string, string>();
    const healedDeck = { ...deck };

    if (healedDeck.infoCards) {
        healedDeck.infoCards.forEach(ic => {
            const newId = crypto.randomUUID();
            if (ic.id) idMap.set(String(ic.id), newId);
            ic.id = newId;
        });
    }

    if (healedDeck.questions) {
        healedDeck.questions.forEach(q => {
            const newId = crypto.randomUUID();
            if (q.id) idMap.set(String(q.id), newId);
            q.id = newId;
        });
    }

    if (healedDeck.infoCards) {
        healedDeck.infoCards.forEach(ic => {
            if (ic.unlocksQuestionIds) {
                ic.unlocksQuestionIds = ic.unlocksQuestionIds
                    .map(oldId => idMap.get(String(oldId)) || null)
                    .filter((id): id is string => id !== null);
            }
            if (ic.prerequisiteIds) {
                ic.prerequisiteIds = ic.prerequisiteIds
                    .map(oldId => idMap.get(String(oldId)) || null)
                    .filter((id): id is string => id !== null);
            }
        });
    }

    if (healedDeck.questions) {
        healedDeck.questions.forEach(q => {
            if (q.infoCardIds) {
                q.infoCardIds = q.infoCardIds
                    .map(oldId => idMap.get(String(oldId)) || null)
                    .filter((id): id is string => id !== null);
            }
            
            if (q.correctAnswerId && !isUUID(q.correctAnswerId)) {
                const indexMatch = String(q.correctAnswerId).match(/^o(\d+)$/i);
                if (indexMatch && q.options) {
                    const idx = parseInt(indexMatch[1], 10) - 1;
                    if (q.options[idx]) {
                        if (!q.options[idx].id) q.options[idx].id = crypto.randomUUID();
                        q.correctAnswerId = q.options[idx].id;
                    }
                }
            }
        });
    }

    if (healedDeck.infoCards?.length && healedDeck.questions?.length) {
        const anyLinksExist = healedDeck.infoCards.some(ic => ic.unlocksQuestionIds?.length > 0);
        if (!anyLinksExist) {
            const itemsPerChapter = Math.ceil(healedDeck.questions.length / healedDeck.infoCards.length);
            healedDeck.infoCards.forEach((ic, index) => {
                const start = index * itemsPerChapter;
                const chunk = healedDeck.questions!.slice(start, start + itemsPerChapter);
                ic.unlocksQuestionIds = chunk.map(q => q.id!);
                chunk.forEach(q => {
                    if (!q.infoCardIds) q.infoCardIds = [];
                    q.infoCardIds.push(ic.id!);
                });
            });
        }
    }

    return healedDeck;
};

// ... (remaining importService methods preserved) ...

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
            version: 9, decks, folders: [], deckSeries: [], reviews: [], sessions: [], seriesProgress: {}, learningProgress: {}, aiChatHistory: []
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
            if (deck.id) deck.id = String(deck.id); else deck.id = crypto.randomUUID();
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

            if (deck.type === 'flashcard') deck.cards = deck.cards.map(fixReviewable).filter(Boolean);
            else {
                deck.questions = deck.questions.map((q: any) => {
                    const fixed = fixReviewable(q);
                    if(!fixed) return null;
                    if (!fixed.questionType) fixed.questionType = 'multipleChoice';
                    if (!fixed.options) fixed.options = [];
                    fixed.options = fixed.options.map((o: any) => ({ ...o, id: String(o.id || crypto.randomUUID()) }));
                    return fixed;
                }).filter(Boolean);
                if (deck.type === 'learning') deck.infoCards = deck.infoCards.map((ic: any) => {
                    if (!ic) return null;
                    ic.id = String(ic.id || crypto.randomUUID());
                    if (!ic.unlocksQuestionIds) ic.unlocksQuestionIds = [];
                    return ic;
                }).filter(Boolean);
            }
            return deck;
        }).filter(Boolean);

        migrated.version = 9;
        return migrated;
    }
    return data;
};

export const parseAndValidateBackupFile = async (jsonString: string): Promise<FullBackupData> => {
  let data: any;
  try { data = JSON.parse(jsonString); } catch (e) {
      const result = validate(jsonString);
      if (!result.isValid && !result.fixedJSON) throw new Error("Failed to parse backup file.");
      data = result.parsed || JSON.parse(result.fixedJSON!);
  }
  if (!data) throw new Error("The backup file appears to be empty or invalid.");
  if (typeof data === 'string') data = JSON.parse(data);
  if (typeof data === 'object' && data !== null && data.dataType === 'cogniflow-compressed-backup-v1' && typeof data.content === 'string') {
      const zip = await JSZip.loadAsync(data.content, { base64: true });
      const file = zip.file("backup.json");
      if (file) data = JSON.parse(await file.async("string"));
  }
  data = migrateLegacyBackup(data);
  if (typeof data === 'object' && data !== null && 'version' in data) {
    const parsed = FullBackupDataSchema.safeParse(data);
    if (!parsed.success) throw new Error(`Invalid backup data at ${parsed.error.issues[0].path.join('.')}`);
    return parsed.data as FullBackupData;
  }
  throw new Error("The file is not a valid CogniFlow backup file.");
};

export const parseAndValidateImportData = (jsonString: string): ParsedResult => {
  if (!jsonString.trim()) throw new Error("Pasted content is empty.");
  const result = validate(jsonString);
  if (!result.isValid) throw new Error("Invalid JSON.");
  const data = result.parsed;
  const seriesParse = ImportedSeriesSchema.safeParse(data);
  if (seriesParse.success) return { type: 'series', data: seriesParse.data as any };
  const cardsParse = z.array(ImportedCardSchema).safeParse(data);
  if (cardsParse.success) return { type: DeckType.Flashcard, data: cardsParse.data as ImportedCard[] };
  const quizParse = ImportedQuizDeckSchema.safeParse(data);
  if (quizParse.success) {
    let validatedData = quizParse.data as any;
    const isLearning = validatedData.type === 'learning' || (Array.isArray(validatedData.infoCards) && validatedData.infoCards.length > 0);
    if (isLearning) {
        validatedData = ensureBatchIdIntegrity(validatedData);
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
    const today = new Date(); today.setHours(0,0,0,0);
    return importedCards.map(importedCard => ({
        id: crypto.randomUUID(), front: importedCard.front, back: importedCard.back, dueDate: today.toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR, masteryLevel: 0, lapses: 0,
    }));
};

export const createQuestionsFromImport = (importedQuestions: ImportedQuestion[]): Question[] => {
    const today = new Date(); today.setHours(0,0,0,0);
    return importedQuestions.map(importedQuestion => {
        const oldCorrectId = importedQuestion.correctAnswerId;
        const options = (importedQuestion.options || []).map(o => ({ ...o, id: o.id && isUUID(String(o.id)) ? String(o.id) : crypto.randomUUID(), text: o.text || '', explanation: o.explanation || '' }));
        let correctAnswerId = '';
        if (oldCorrectId) {
            const found = options.find(o => o.id === String(oldCorrectId));
            if (found) correctAnswerId = found.id;
            else {
                const indexMatch = String(oldCorrectId).match(/^o(\d+)$/i);
                if (indexMatch && options[parseInt(indexMatch[1], 10) - 1]) correctAnswerId = options[parseInt(indexMatch[1], 10) - 1].id;
            }
        }
        if (!correctAnswerId) {
            const correctOpt = options.find(o => o.explanation?.toLowerCase().includes('correct') || o.text?.toLowerCase().startsWith('correct'));
            if (correctOpt) correctAnswerId = correctOpt.id;
        }
        if (!correctAnswerId && options.length > 0) correctAnswerId = options[0].id;
        return {
            ...importedQuestion, id: importedQuestion.id && isUUID(String(importedQuestion.id)) ? String(importedQuestion.id) : crypto.randomUUID(), questionType: 'multipleChoice', dueDate: today.toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR, masteryLevel: 0, lapses: 0, detailedExplanation: importedQuestion.detailedExplanation || '', correctAnswerId, options
        };
    });
};

export const parseCSV = (csvString: string): ImportedCard[] => {
    const { data, errors } = Papa.parse(csvString, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
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

export type AnalyzedFileType = 'backup' | 'series' | 'quiz' | 'flashcard' | 'anki' | 'image' | 'csv' | 'learning' | 'document';

export interface AnalysisResult {
    type: AnalyzedFileType;
    data: any;
    file?: File;
    fileName?: string;
}

export const analyzeFile = async (file: File): Promise<AnalysisResult | null> => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.apkg') || name.endsWith('.zip')) return { type: 'anki', data: { name: file.name }, file, fileName: file.name };
    if (name.match(/\.(png|jpg|jpeg|webp|gif)$/)) return { type: 'image', data: { name: file.name, mimeType: file.type }, file, fileName: file.name };
    if (name.match(/\.(txt|md|markdown|rtf|pdf)$/)) return { type: 'document', data: { name: file.name }, file, fileName: file.name };
    if (name.endsWith('.csv')) {
        try { return { type: 'flashcard', data: parseCSV(await file.text()), fileName: file.name }; } catch (e) { console.error(e); }
    }
    try {
        const text = await file.text();
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { const importData = parseAndValidateImportData(text); return { type: importData.type as AnalyzedFileType, data: importData.data, fileName: file.name }; } catch (e) {}
            try { const backupData = await parseAndValidateBackupFile(text); return { type: 'backup', data: backupData, fileName: file.name }; } catch (e) {}
        }
    } catch (e) {}
    return null;
};
