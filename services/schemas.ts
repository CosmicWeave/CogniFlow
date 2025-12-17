
import { z } from 'zod';
import { DeckType, ReviewRating } from '../types';
import { INITIAL_EASE_FACTOR } from '../constants';

// --- Shared Sub-Schemas ---

export const QuestionOptionSchema = z.object({
  // Allow id to be optional/null/number and generate one if missing/invalid
  id: z.union([z.string(), z.number()]).nullable().optional().transform(val => val ? String(val) : crypto.randomUUID()), 
  text: z.preprocess(val => val ?? "", z.string()),
  explanation: z.string().nullable().optional().transform(val => val ?? ""),
});

export const ImportedCardSchema = z.object({
  front: z.preprocess(val => val ?? "", z.string()),
  back: z.preprocess(val => val ?? "", z.string()),
});

export const ImportedQuestionSchema = z.object({
  questionType: z.literal('multipleChoice'),
  questionText: z.preprocess(val => val ?? "", z.string()),
  options: z.preprocess(val => Array.isArray(val) ? val : [], z.array(QuestionOptionSchema)),
  correctAnswerId: z.preprocess(val => val ? String(val) : "", z.string()),
  detailedExplanation: z.string().nullable().optional().transform(val => val ?? ""),
  tags: z.array(z.string()).optional(),
});

export const ImportedQuizDeckSchema = z.object({
  name: z.string(),
  description: z.preprocess(val => val ?? "", z.string()),
  questions: z.array(ImportedQuestionSchema),
});

// --- Internal Data Structures (for Backup Validation) ---

const ReviewableSchema = z.object({
  // Coerce ID to string to handle legacy number IDs
  id: z.coerce.string(),
  dueDate: z.string().nullable().optional().transform(val => val ?? new Date().toISOString()),
  interval: z.number().nullable().optional().transform(val => val ?? 0),
  easeFactor: z.number().nullable().optional().transform(val => val ?? INITIAL_EASE_FACTOR),
  suspended: z.boolean().nullable().optional().transform(val => val ?? false),
  masteryLevel: z.number().nullable().optional().transform(val => val ?? 0),
  lastReviewed: z.string().nullable().optional(),
  lapses: z.number().nullable().optional().transform(val => val ?? 0),
});

export const CardSchema = ReviewableSchema.extend({
  front: z.string().nullable().optional().transform(val => val ?? ""),
  back: z.string().nullable().optional().transform(val => val ?? ""),
  css: z.string().nullable().optional(),
  frontAudio: z.string().nullable().optional(),
  backAudio: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional().transform(val => val ?? []),
});

export const QuestionSchema = ReviewableSchema.extend({
  questionType: z.literal('multipleChoice'),
  questionText: z.string().nullable().optional().transform(val => val ?? ""),
  options: z.array(QuestionOptionSchema).nullable().optional().transform(val => val ?? []),
  correctAnswerId: z.string().nullable().optional().transform(val => val ?? ""),
  detailedExplanation: z.string().nullable().optional().transform(val => val ?? ""),
  tags: z.array(z.string()).nullable().optional().transform(val => val ?? []),
  infoCardIds: z.array(z.string()).nullable().optional().transform(val => val ?? []),
  userSelectedAnswerId: z.string().optional(),
});

export const InfoCardSchema = z.object({
  id: z.coerce.string(),
  content: z.string().nullable().optional().transform(val => val ?? ""),
  unlocksQuestionIds: z.array(z.string()).nullable().optional().transform(val => val ?? []),
});

const DeckBaseSchema = z.object({
  id: z.coerce.string(),
  name: z.coerce.string(),
  // Permissive description: accepts string, null, undefined. Transforms null/undefined to "".
  description: z.string().nullable().optional().transform(val => val ?? ""),
  folderId: z.string().nullable().optional(),
  lastOpened: z.string().nullable().optional(),
  archived: z.boolean().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  lastModified: z.number().nullable().optional(),
  locked: z.boolean().nullable().optional(),
  icon: z.string().nullable().optional(),
  // Allow loose generation params to exist but be optional
  aiGenerationParams: z.any().optional(),
  suggestedQuestionCount: z.number().nullable().optional(),
});

export const FlashcardDeckSchema = DeckBaseSchema.extend({
  type: z.literal(DeckType.Flashcard),
  cards: z.array(CardSchema).nullable().optional().transform(val => val ?? []),
});

export const QuizDeckSchema = DeckBaseSchema.extend({
  type: z.literal(DeckType.Quiz),
  questions: z.array(QuestionSchema).nullable().optional().transform(val => val ?? []),
});

export const LearningDeckSchema = DeckBaseSchema.extend({
  type: z.literal(DeckType.Learning),
  infoCards: z.array(InfoCardSchema).nullable().optional().transform(val => val ?? []),
  questions: z.array(QuestionSchema).nullable().optional().transform(val => val ?? []),
});

// Preprocess function to handle legacy data structure issues before strict validation
const processDeckData = (val: any) => {
    if (typeof val !== 'object' || val === null) {
        // If the deck entry itself is corrupted (null or not an object), 
        // return a dummy valid placeholder to prevent the entire backup import from failing.
        return {
            id: crypto.randomUUID(),
            name: "Corrupted Deck Entry",
            type: DeckType.Flashcard,
            cards: [],
            description: "This deck entry was corrupted in the source file and could not be restored."
        };
    }
    
    const deck = { ...val };

    // 0. Ensure ID and Name exist
    if (!deck.id) deck.id = crypto.randomUUID();
    deck.id = String(deck.id);

    if (deck.name === null || deck.name === undefined) deck.name = "Untitled Deck";
    deck.name = String(deck.name);

    // 1. Normalize and Infer Type
    if (deck.type && typeof deck.type === 'string') {
        deck.type = deck.type.toLowerCase();
    }

    const validTypes = Object.values(DeckType).map(t => t.toString());
    if (!deck.type || !validTypes.includes(deck.type)) {
        if (Array.isArray(deck.infoCards) && deck.infoCards.length > 0) deck.type = DeckType.Learning;
        else if (Array.isArray(deck.questions) && deck.questions.length > 0) deck.type = DeckType.Quiz;
        else deck.type = DeckType.Flashcard; // Default fallback
    }

    // 2. Normalize Description (older backups might have null)
    if (deck.description === null || deck.description === undefined) {
        deck.description = "";
    }

    // 3. Robust Item Fixer: Ensure items are objects and have IDs
    const fixItem = (item: any) => {
        if (!item || typeof item !== 'object') return null; // Filter out bad items
        // Ensure ID
        if (!item.id) item.id = crypto.randomUUID();
        item.id = String(item.id);
        
        // Ensure required type-specific fields to pass schema
        if (deck.type === DeckType.Flashcard) {
             if (item.front === null || item.front === undefined) item.front = "";
             if (item.back === null || item.back === undefined) item.back = "";
        }
        
        return item;
    };

    if (Array.isArray(deck.cards)) {
        deck.cards = deck.cards.map(fixItem).filter((i: any) => i !== null);
    } else {
        deck.cards = [];
    }

    if (Array.isArray(deck.questions)) {
        deck.questions = deck.questions.map((item: any) => {
            const fixed = fixItem(item);
            if (!fixed) return null;
            // Force questionType for questions, otherwise Zod union discrimination fails
            if (!fixed.questionType) fixed.questionType = 'multipleChoice';
            return fixed;
        }).filter((i: any) => i !== null);
    } else {
        deck.questions = [];
    }

    if (Array.isArray(deck.infoCards)) {
        deck.infoCards = deck.infoCards.map(fixItem).filter((i: any) => i !== null);
    } else {
        deck.infoCards = [];
    }

    return deck;
};

export const DeckSchema = z.preprocess(
    processDeckData, 
    z.union([FlashcardDeckSchema, QuizDeckSchema, LearningDeckSchema])
);

export const FolderSchema = z.object({
  id: z.coerce.string(),
  name: z.coerce.string(),
});

export const SeriesLevelSchema = z.object({
  title: z.string().nullable().optional().transform(val => val ?? "Untitled Level"),
  deckIds: z.array(z.coerce.string()).nullable().optional().transform(val => val ?? []),
});

export const DeckSeriesSchema = z.object({
  id: z.coerce.string(),
  type: z.literal('series'),
  name: z.string(),
  description: z.string().nullable().optional().transform(val => val ?? ""),
  levels: z.array(SeriesLevelSchema).nullable().optional().transform(val => val ?? []),
  createdAt: z.string().nullable().optional().transform(val => val ?? new Date().toISOString()),
  lastOpened: z.string().nullable().optional(),
  archived: z.boolean().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  lastModified: z.number().nullable().optional(),
  aiGenerationParams: z.any().optional(),
  aiChatHistory: z.array(z.any()).optional(),
});

export const ReviewLogSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(), // Updated: allow string or number
  itemId: z.coerce.string(),
  deckId: z.coerce.string(),
  seriesId: z.string().optional(),
  timestamp: z.string(),
  rating: z.nativeEnum(ReviewRating).nullable().optional(), // Allow null for legacy/suspend logs
  newInterval: z.number(),
  easeFactor: z.number(),
  // Mastery level optional for backward compatibility with v6-8
  masteryLevel: z.number().nullable().optional().transform(val => val ?? 0),
});

export const SessionStateSchema = z.object({
  id: z.string(),
  reviewQueue: z.array(z.any()).transform(items => {
      // Manual discrimination because schemas are too permissive for z.union
      if (!Array.isArray(items)) return [];
      return items.map(item => {
          if (!item || typeof item !== 'object') return null;
          
          if ('questionType' in item) {
              const res = QuestionSchema.safeParse(item);
              return res.success ? res.data : null;
          }
          if ('content' in item || 'unlocksQuestionIds' in item) {
              const res = InfoCardSchema.safeParse(item);
              return res.success ? res.data : null;
          }
          // Default to Card if it looks like one or generic
          const res = CardSchema.safeParse(item);
          return res.success ? res.data : null;
      }).filter((i): i is (z.infer<typeof CardSchema> | z.infer<typeof QuestionSchema> | z.infer<typeof InfoCardSchema>) => i !== null);
  }),
  currentIndex: z.number(),
  itemsCompleted: z.number().nullable().optional().transform(val => val ?? 0),
  readInfoCardIds: z.array(z.string()).optional(),
  unlockedQuestionIds: z.array(z.string()).optional(),
});

export const AIMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'model']),
  text: z.string(),
  actions: z.array(z.any()).optional(), // Actions are complex, keeping as any for now
  isLoading: z.boolean().optional(),
});

export const DeckLearningProgressSchema = z.object({
  deckId: z.string(),
  readInfoCardIds: z.array(z.string()).nullable().optional().transform(val => val ?? []),
  unlockedQuestionIds: z.array(z.string()).nullable().optional().transform(val => val ?? []),
  lastReadCardId: z.string().optional(),
});

// Full Backup Schema
export const FullBackupDataSchema = z.object({
  version: z.number(),
  decks: z.array(DeckSchema),
  folders: z.array(FolderSchema).nullable().optional().transform(val => val ?? []),
  deckSeries: z.array(DeckSeriesSchema).nullable().optional().transform(val => val ?? []),
  reviews: z.array(ReviewLogSchema).nullable().optional().transform(val => val ?? []),
  sessions: z.array(SessionStateSchema).nullable().optional().transform(val => val ?? []),
  seriesProgress: z.record(z.string(), z.array(z.string())).nullable().optional().transform(val => val ?? {}),
  // New in v9
  learningProgress: z.record(z.string(), DeckLearningProgressSchema).nullable().optional().transform(val => val ?? {}),
  aiChatHistory: z.array(AIMessageSchema).nullable().optional().transform(val => val ?? []),
  aiOptions: z.any().optional(),
  settings: z.any().optional(),
});

// Import Structures
export const ImportedSeriesLevelSchema = z.object({
    title: z.string().nullable().optional().transform(val => val ?? "Untitled Level"),
    decks: z.array(z.any()), // We validate items inside manually or loosely because import format varies slightly
});

export const ImportedSeriesSchema = z.object({
    seriesName: z.string(),
    seriesDescription: z.preprocess(val => val ?? "", z.string()),
    levels: z.array(ImportedSeriesLevelSchema),
});