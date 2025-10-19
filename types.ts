// types.ts

// --- Core SRS & Reviewable Types ---

export interface Reviewable {
  id: string;
  dueDate: string; // ISO string
  interval: number; // in days
  easeFactor: number;
  suspended?: boolean;
  masteryLevel?: number; // 0.0 to 1.0
  lastReviewed?: string; // ISO string
  lapses?: number;
}

export enum ReviewRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

// --- Deck & Content Types ---

export enum DeckType {
  Flashcard = 'flashcard',
  Quiz = 'quiz',
  Learning = 'learning',
}

export interface Card extends Reviewable {
  front: string;
  back: string;
  css?: string; // For Anki imports
}

export interface QuestionOption {
  id: string;
  text: string;
  explanation?: string;
}

export interface Question extends Reviewable {
  questionType: 'multipleChoice';
  questionText: string;
  tags?: string[];
  options: QuestionOption[];
  correctAnswerId: string;
  detailedExplanation: string;
  infoCardIds?: string[]; // Link to InfoCards in a LearningDeck
  [key: string]: any; // For dynamic custom fields from AI
}

export interface InfoCard {
  id: string;
  content: string; // HTML content
  unlocksQuestionIds: string[];
}

interface BaseDeck {
  id: string;
  name: string;
  description: string;
  type: DeckType;
  folderId?: string | null;
  lastOpened?: string; // ISO string
  archived?: boolean;
  deletedAt?: string | null; // ISO string for soft delete
  locked?: boolean; // For series progression
  lastModified?: number; // timestamp
  suggestedQuestionCount?: number;
}

export interface FlashcardDeck extends BaseDeck {
  type: DeckType.Flashcard;
  cards: Card[];
}

export interface QuizDeck extends BaseDeck {
  type: DeckType.Quiz;
  questions: Question[];
}

export interface LearningDeck extends BaseDeck {
  type: DeckType.Learning;
  infoCards: InfoCard[];
  questions: Question[];
}

export type Deck = FlashcardDeck | QuizDeck | LearningDeck;

// --- Organizational Types ---

export interface Folder {
  id: string;
  name: string;
}

export interface SeriesLevel {
  title: string;
  deckIds: string[];
}

export interface DeckSeries {
  id: string;
  type: 'series';
  name: string;
  description: string;
  levels: SeriesLevel[];
  lastOpened?: string; // ISO string
  createdAt: string; // ISO string
  archived?: boolean;
  deletedAt?: string | null; // ISO string for soft delete
  lastModified?: number; // timestamp
}

export type SeriesProgress = Map<string, Set<string>>; // Map<seriesId, Set<completedDeckId>>

// --- Import/Export & Backup Types ---

export interface ImportedCard {
  front: string;
  back: string;
}

export interface ImportedQuestion {
  questionType: 'multipleChoice';
  questionText: string;
  options: QuestionOption[];
  correctAnswerId: string;
  detailedExplanation: string;
  tags?: string[];
}

export interface ImportedQuizDeck {
  name: string;
  description: string;
  questions: ImportedQuestion[];
}

export interface AppSettings {
  themeId?: string;
  disableAnimations?: boolean;
  hapticsEnabled?: boolean;
  aiFeaturesEnabled?: boolean;
  backupEnabled?: boolean;
  backupApiKey?: string;
  syncOnCellular?: boolean;
}

export interface FullBackupData {
  version: number;
  decks: Deck[];
  folders: Folder[];
  deckSeries: DeckSeries[];
  reviews?: ReviewLog[];
  sessions?: SessionState[];
  seriesProgress?: Record<string, string[]>;
  aiChatHistory?: AIMessage[];
  aiOptions?: any;
  settings?: AppSettings;
}

export interface DeckComparison {
    local: Deck;
    backup: Deck;
    diff: {
        content: boolean;
        dueCount: boolean;
        mastery: boolean;
    };
}

export interface SeriesComparison {
    local: DeckSeries;
    backup: DeckSeries;
    diff: {
        structure: boolean;
        mastery: boolean;
        completion: boolean;
    };
}

export interface BackupComparison {
    newSeries: DeckSeries[];
    newDecks: Deck[];
    changedSeries: SeriesComparison[];
    changedDecks: DeckComparison[];
    dueCounts: Map<string, number>;
    masteryLevels: Map<string, number>;
}

// --- Session & Log Types ---

export interface ReviewLog {
  id?: number; // auto-incremented by DB
  itemId: string;
  deckId: string;
  seriesId?: string;
  timestamp: string; // ISO string
  rating: ReviewRating | null; // null for suspend
  newInterval: number;
  easeFactor: number;
  masteryLevel: number;
}

export interface SessionState {
  id: string;
  reviewQueue: (Card | Question | InfoCard)[];
  currentIndex: number;
  readInfoCardIds?: string[];
  unlockedQuestionIds?: string[];
  itemsCompleted?: number;
}

// --- Google Drive Types ---
export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

// --- AI Related Types ---

export enum AIActionType {
    NO_ACTION = 'NO_ACTION',
    CREATE_DECK = 'CREATE_DECK',
    RENAME_DECK = 'RENAME_DECK',
    DELETE_DECK = 'DELETE_DECK',
    CREATE_FOLDER = 'CREATE_FOLDER',
    RENAME_FOLDER = 'RENAME_FOLDER',
    DELETE_FOLDER = 'DELETE_FOLDER',
    MOVE_DECK_TO_FOLDER = 'MOVE_DECK_TO_FOLDER',
    EXPAND_SERIES_ADD_LEVELS = 'EXPAND_SERIES_ADD_LEVELS',
    EXPAND_SERIES_ADD_DECKS = 'EXPAND_SERIES_ADD_DECKS',
    GENERATE_QUESTIONS_FOR_DECK = 'GENERATE_QUESTIONS_FOR_DECK',
}

export interface AIAction {
    action: AIActionType;
    payload: {
        deckId?: string;
        folderId?: string | null;
        name?: string;
        newName?: string;
        seriesId?: string;
        levelIndex?: number;
        count?: number;
    };
    confirmationMessage: string;
}

export interface AIMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    actions?: AIAction[];
    isLoading?: boolean;
}

export interface AIGenerationParams {
  generationType: 'series-scaffold' | 'deck-quiz' | 'deck-learning';
  topic: string;
  understandingLevel: string;
  learningGoal: string;
  learningStyle: string;
  language: string;
  tone: string;
  comprehensiveness: string;
  isLearningMode?: boolean;
  // For the final generation step
  finalTitle?: string;
  questionCount?: number;
  followUpAnswers?: string;
  sourceContent?: string;
  sourceUrl?: string;
  customInstructions?: string;
  topicsToInclude?: string;
  topicsToExclude?: string;
  brainstormHistory?: string;
  // Fine-tuning parameters
  systemInstruction?: string;
  temperature?: number;
  customFields?: { name: string; type: string; description: string }[];
}

export interface AIGenerationAnalysis {
  interpretation: string;
  titleSuggestions: string[];
  questionCountSuggestions: {
    label: string; // e.g., "Quick Review", "Deep Dive"
    count: number;
  }[];
  followUpQuestions: string[];
}


// --- Component Prop Types ---
export interface AppRouterProps {
  sessionsToResume: Set<string>;
  sortPreference: 'lastOpened' | 'name' | 'dueCount';
  setSortPreference: (pref: 'lastOpened' | 'name' | 'dueCount') => void;
  draggedDeckId: string | null;
  setDraggedDeckId: (id: string | null) => void;
  openFolderIds: Set<string>;
  onToggleFolder: (id: string) => void;
  generalStudyDeck: any | null;
  activeDeck: Deck | null;
  activeSeries: DeckSeries | null;
  onSync: () => void;
  isSyncing: boolean;
  lastSyncStatus: string;
  isGapiReady: boolean;
  isGapiSignedIn: boolean;
  gapiUser: any;
}