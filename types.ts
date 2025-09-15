// types.ts

// --- SRS (Spaced Repetition System) ---

export interface Reviewable {
  id: string;
  dueDate: string;
  interval: number; // in days
  easeFactor: number;
  suspended?: boolean;
  masteryLevel?: number; // 0.0 to 1.0
  lastReviewed?: string;
  lapses?: number;
}

export enum ReviewRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

// --- Cards & Decks ---

export enum DeckType {
  Flashcard = 'flashcard',
  Quiz = 'quiz',
  Learning = 'learning',
}

export interface Card extends Reviewable {
  front: string;
  back: string;
  css?: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  explanation?: string;
}

export interface Question extends Reviewable {
  questionType: 'multipleChoice';
  questionText: string;
  options?: QuestionOption[];
  correctAnswerId: string;
  detailedExplanation: string;
  tags?: string[];
  infoCardIds?: string[]; // For Learning Decks
}

export interface InfoCard {
  id: string;
  content: string; // HTML content
  unlocksQuestionIds: string[];
}

interface DeckBase {
  id: string;
  name: string;
  description: string;
  folderId?: string | null;
  archived?: boolean;
  deletedAt?: string | null; // Soft delete timestamp
  lastOpened?: string;
  locked?: boolean; // For series decks
  suggestedQuestionCount?: number; // For AI generation
  aiGenerationParams?: AIGenerationParams;
  aiChatHistory?: any[]; // For series AI generation context
  lastModified?: number;
}

export interface FlashcardDeck extends DeckBase {
  type: DeckType.Flashcard;
  cards: Card[];
}

export interface QuizDeck extends DeckBase {
  type: DeckType.Quiz;
  questions: Question[];
}

export interface LearningDeck extends DeckBase {
  type: DeckType.Learning;
  infoCards: InfoCard[];
  questions: Question[];
}

export type Deck = FlashcardDeck | QuizDeck | LearningDeck;

// --- Folders & Series ---

export interface Folder {
  id: string;
  name: string;
}

export interface SeriesLevel {
  title: string;
  deckIds?: string[];
}

export interface DeckSeries {
  id: string;
  type: 'series';
  name: string;
  description: string;
  levels?: SeriesLevel[];
  archived?: boolean;
  deletedAt?: string | null;
  lastOpened?: string;
  createdAt?: string;
  aiGenerationParams?: AIGenerationParams;
  aiChatHistory?: any[];
  lastModified?: number;
}

export type SeriesProgress = Map<string, Set<string>>;

// --- Import/Export & Data Structures ---

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
    lastModified?: number;
}

// --- Session & Review ---

export interface SessionState {
  id: string;
  reviewQueue: (Card | Question | InfoCard)[];
  currentIndex: number;
  itemsCompleted: number;
  readInfoCardIds?: string[];
  unlockedQuestionIds?: string[];
}

export interface ReviewLog {
  id?: number;
  itemId: string;
  deckId: string;
  seriesId?: string;
  timestamp: string;
  rating: ReviewRating | null;
  newInterval: number;
  easeFactor: number;
  masteryLevel: number;
}


// --- AI Related ---

export enum AIActionType {
    CREATE_DECK = 'CREATE_DECK',
    RENAME_DECK = 'RENAME_DECK',
    MOVE_DECK_TO_FOLDER = 'MOVE_DECK_TO_FOLDER',
    DELETE_DECK = 'DELETE_DECK',
    CREATE_FOLDER = 'CREATE_FOLDER',
    RENAME_FOLDER = 'RENAME_FOLDER',
    DELETE_FOLDER = 'DELETE_FOLDER',
    EXPAND_SERIES_ADD_LEVELS = 'EXPAND_SERIES_ADD_LEVELS',
    EXPAND_SERIES_ADD_DECKS = 'EXPAND_SERIES_ADD_DECKS',
    GENERATE_QUESTIONS_FOR_DECK = 'GENERATE_QUESTIONS_FOR_DECK',
    NO_ACTION = 'NO_ACTION',
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
  isLoading?: boolean;
  actions?: AIAction[];
}

export interface GenerativePart {
  inlineData: {
    mimeType: string;
    data: string; // base64 encoded string
  };
}

export interface AIGenerationParams {
  topic: string;
  level?: string;
  comprehensiveness?: string;
  customInstructions?: string;
  learningGoal?: string;
  learningStyle?: string;
  focusTopics?: string;
  excludeTopics?: string;
  language?: string;
  sourceParts?: GenerativePart[];
  // FIX: Added 'useStrictSources' to allow for strict source-based AI generation.
  useStrictSources?: boolean;
}

export interface AIGeneratedDeck extends Omit<ImportedQuizDeck, 'questions'> {
  questions: [];
  suggestedQuestionCount: number;
}

export interface AIGeneratedLevel {
  title: string;
  decks: AIGeneratedDeck[];
}

// --- Google Drive ---

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

// --- AppRouter Props ---
export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

export interface AppRouterProps {
    sessionsToResume: Set<string>;
    sortPreference: SortPreference;
    setSortPreference: (pref: SortPreference) => void;
    draggedDeckId: string | null;
    setDraggedDeckId: (id: string | null) => void;
    openFolderIds: Set<string>;
    onToggleFolder: (folderId: string) => void;
    generalStudyDeck: QuizDeck | null;
    activeDeck: Deck | null;
    activeSeries: DeckSeries | null;
    onSync: () => void;
    isSyncing: boolean;
    lastSyncStatus: string;
    isGapiReady: boolean;
    isGapiSignedIn: boolean;
    gapiUser: any;
}