
// FIX: Populate `types.ts` with all necessary type definitions for the application.

export enum DeckType {
  Flashcard = 'flashcard',
  Quiz = 'quiz',
  Learning = 'learning',
}

export enum ReviewRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface Reviewable {
  id: string;
  dueDate: string;
  interval: number; // in days
  easeFactor: number;
  suspended?: boolean;
  masteryLevel?: number;
  lastReviewed?: string;
  lapses?: number;
}

export interface Card extends Reviewable {
  front: string;
  back: string;
  css?: string;
  frontAudio?: string; // Base64 encoded raw PCM audio
  backAudio?: string; // Base64 encoded raw PCM audio
  tags?: string[];
}

export interface QuestionOption {
  id: string;
  text: string;
  explanation?: string;
}

export interface Question extends Reviewable {
  questionType: 'multipleChoice'; // Can be expanded later
  questionText: string;
  options: QuestionOption[];
  correctAnswerId: string;
  detailedExplanation: string;
  tags?: string[];
  infoCardIds?: string[];
  userSelectedAnswerId?: string; // For session state
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
  type: DeckType;
  folderId?: string | null;
  lastOpened?: string;
  archived?: boolean;
  deletedAt?: string | null;
  lastModified?: number;
  locked?: boolean;
  icon?: string;
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
  learningMode?: 'mixed' | 'separate'; // Default is 'separate'
}

export type Deck = FlashcardDeck | QuizDeck | LearningDeck;

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
  createdAt: string;
  lastOpened?: string;
  archived?: boolean;
  deletedAt?: string | null;
  lastModified?: number;
}

export interface ImportedCard {
  front: string;
  back: string;
}

export interface ImportedQuestionOption {
  id?: string;
  text: string;
  explanation?: string;
}

export interface ImportedQuestion {
  questionType: 'multipleChoice';
  questionText: string;
  options: ImportedQuestionOption[];
  correctAnswerId: string;
  detailedExplanation?: string;
  tags?: string[];
}

export interface ImportedQuizDeck {
  name: string;
  description: string;
  questions: ImportedQuestion[];
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

// FIX: Add SeriesProgress type definition for use in the store and components.
export type SeriesProgress = Map<string, Set<string>>;

export interface DeckLearningProgress {
  deckId: string;
  readInfoCardIds: string[];
  unlockedQuestionIds: string[];
  lastReadCardId?: string;
}

export interface SessionState {
  id: string;
  reviewQueue: (Card | Question | InfoCard)[];
  currentIndex: number;
  itemsCompleted: number;
  // Legacy fields below, moving to DeckLearningProgress for persistent tracking
  readInfoCardIds?: string[];
  unlockedQuestionIds?: string[];
}

export enum AIActionType {
    NO_ACTION = 'NO_ACTION',
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
}

export interface AIAction {
    action: AIActionType;
    payload: { [key: string]: any };
    confirmationMessage: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  actions?: AIAction[];
  isLoading?: boolean;
}

// FIX: Add AIPersona type definition for use in AI services and hooks.
export interface AIPersona {
  id: string;
  name: string;
  instruction: string;
}

export interface AIGenerationParams {
  generationType: 'series-scaffold' | 'series-quiz' | 'series-flashcard' | 'series-vocab' | 'series-course' | 'series-auto-fill' | 'level-auto-fill' | 'single-deck-quiz' | 'single-deck-learning' | 'deck-course' | 'deck-flashcard' | 'deck-vocab' | 'deck-atomic' | 'quiz-blooms' | 'add-levels-to-series' | 'add-decks-to-level' | 'generate-questions-for-deck';
  topic: string;
  persona: string;
  understanding: string;
  comprehensiveness: string;
  imageStyle?: 'none' | 'realistic' | 'creative';
  // for expansions
  seriesId?: string;
  levelIndex?: number;
  deckId?: string;
}

export interface AIGenerationTask {
  id: string;
  type: 'generateSeriesScaffoldWithAI' | 'generateDeckWithAI' | 'generateLearningDeckWithAI' | 'generateMoreLevelsForSeries' | 'generateMoreDecksForLevel' | 'generateSeriesQuestionsInBatches' | 'generateSeriesLearningContentInBatches' | 'generateQuestionsForDeck' | 'generateFullSeriesFromScaffold' | 'generateFlashcardDeckWithAI' | 'regenerateQuestion' | 'generateDeckFromOutline' | 'autoPopulateSeries' | 'autoPopulateLevel';
  payload: any;
  statusText: string;
  deckId?: string;
  seriesId?: string;
}

export interface DeckAnalysisSuggestion {
    id: string;
    title: string;
    description: string;
    category: 'accuracy' | 'clarity' | 'formatting' | 'completeness';
    rationale: string;
}


export interface AppSettings {
    themeId?: string;
    disableAnimations?: boolean;
    hapticsEnabled?: boolean;
    aiFeaturesEnabled?: boolean;
    backupEnabled?: boolean;
    backupApiKey?: string;
    syncOnCellular?: boolean;
    notificationsEnabled?: boolean;
    // SRS Settings
    leechThreshold?: number;
    leechAction?: 'suspend' | 'tag' | 'warn';
}

export interface FullBackupData {
  version: number;
  decks: Deck[];
  folders: Folder[];
  deckSeries: DeckSeries[];
  reviews?: ReviewLog[];
  sessions?: SessionState[];
  seriesProgress?: Record<string, string[]>;
  learningProgress?: Record<string, DeckLearningProgress>; // New field
  aiChatHistory?: AIMessage[];
  aiOptions?: any;
  settings?: AppSettings;
}

export interface SyncLogEntry {
    timestamp: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
}

export interface GoogleDriveFile {
    id: string;
    name: string;
    modifiedTime: string;
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
        completion: boolean;
        mastery: boolean;
    };
}
export interface BackupComparison {
    newDecks: Deck[];
    newSeries: DeckSeries[];
    changedDecks: DeckComparison[];
    changedSeries: SeriesComparison[];
    dueCounts: Map<string, number>;
    masteryLevels: Map<string, number>;
}

// For AppRouter.tsx
export interface AppRouterProps {
  activeDeck: Deck | null;
  activeSeries: DeckSeries | null;
  generalStudyDeck: QuizDeck | null;
  sessionsToResume: Set<string>;
  onSync: () => void;
  isSyncing: boolean;
  lastSyncStatus: string;
  isGapiReady: boolean;
  isGapiSignedIn: boolean;
  gapiUser: any;
  sortPreference: any;
  setSortPreference: (pref: any) => void;
  draggedDeckId: string | null;
  setDraggedDeckId: (id: string | null) => void;
  openFolderIds: Set<string>;
  onToggleFolder: (id: string) => void;
}
