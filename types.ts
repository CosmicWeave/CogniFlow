// types.ts

export enum DeckType {
  Flashcard = 'flashcard',
  Quiz = 'quiz',
  Learning = 'learning'
}

export enum ReviewRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4
}

export interface Reviewable {
  id: string;
  dueDate: string;
  interval: number;
  easeFactor: number;
  lapses: number;
  masteryLevel?: number;
  suspended?: boolean;
  lastReviewed?: string;
  tags?: string[];
}

export interface Card extends Reviewable {
  front: string;
  back: string;
  css?: string;
  frontAudio?: string;
  backAudio?: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  explanation?: string;
}

export type BloomsLevel = 'Recall' | 'Comprehension' | 'Application' | 'Analysis' | 'Synthesis' | 'Evaluation';

export interface Question extends Reviewable {
  questionType: 'multipleChoice';
  questionText: string;
  options: QuestionOption[];
  correctAnswerId: string;
  detailedExplanation: string;
  infoCardIds?: string[];
  userSelectedAnswerId?: string;
  bloomsLevel?: BloomsLevel;
}

export interface InfoCard {
  id: string;
  content: string;
  unlocksQuestionIds: string[];
  prerequisiteIds?: string[]; // DAG: List of other InfoCard IDs that must be read first
}

export interface DeckBase {
  id: string;
  name: string;
  type: DeckType;
  description: string;
  folderId?: string | null;
  lastOpened?: string;
  archived?: boolean;
  deletedAt?: string | null;
  lastModified?: number;
  locked?: boolean;
  icon?: string;
  // Track AI generation state
  generationStatus?: 'idle' | 'generating' | 'paused' | 'error' | 'complete';
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
  learningMode: 'mixed' | 'separate';
  curriculum?: {
      name: string;
      description: string;
      chapters: Array<{
          id: string; // Course schema ID
          title: string;
          learningObjectives: string[];
          topics: string[];
          prerequisiteChapterIds?: string[]; // IDs from this same array
      }>;
  };
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

export interface ReviewLog {
  id?: string | number;
  itemId: string;
  deckId: string;
  seriesId?: string;
  timestamp: string;
  rating: ReviewRating | null;
  newInterval: number;
  easeFactor: number;
  masteryLevel: number;
}

export interface SessionState {
  id: string;
  reviewQueue: any[];
  currentIndex: number;
  itemsCompleted: number;
  readInfoCardIds?: string[];
  unlockedQuestionIds?: string[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  actions?: AIAction[];
  isLoading?: boolean;
}

export interface AppSettings {
  themeId?: string;
  disableAnimations?: boolean;
  hapticsEnabled?: boolean;
  aiFeaturesEnabled?: boolean;
  veoEnabled?: boolean;
  groundedImagesEnabled?: boolean;
  searchAuditsEnabled?: boolean;
  backupEnabled?: boolean;
  backupApiKey?: string;
  syncOnCellular?: boolean;
  notificationsEnabled?: boolean;
  leechThreshold?: number;
  leechAction?: 'suspend' | 'tag' | 'warn';
  fontFamily?: 'sans' | 'serif' | 'mono';
  encryptionPassword?: string;
}

export interface DeckLearningProgress {
  deckId: string;
  readInfoCardIds: string[];
  unlockedQuestionIds: string[];
  lastReadCardId?: string;
  scrollPosition?: number;
  readerTheme?: 'white' | 'sepia' | 'charcoal' | 'black';
  readerFont?: 'sans' | 'serif';
  cardScrollIndices?: Record<string, number>; // Maps InfoCard ID to topmost element index
}

export interface FullBackupData {
  version: number;
  decks: Deck[];
  folders: Folder[];
  deckSeries: DeckSeries[];
  reviews: ReviewLog[];
  sessions: SessionState[];
  seriesProgress: Record<string, string[]>;
  learningProgress: Record<string, DeckLearningProgress>;
  aiOptions?: any;
  aiChatHistory?: AIMessage[];
  aiTasks?: AIGenerationTask[]; 
  settings?: AppSettings;
}

export interface SyncLogEntry {
  timestamp: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface BackupComparison {
  newDecks: Deck[];
  newSeries: DeckSeries[];
  changedDecks: { local: Deck; backup: Deck; diff: { content: boolean; dueCount: boolean; mastery: boolean } }[];
  changedSeries: { local: DeckSeries; backup: DeckSeries; diff: { structure: boolean; completion: boolean; mastery: boolean } }[];
  dueCounts: Map<string, number>;
  masteryLevels: Map<string, number>;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface AppRouterProps {
  activeDeck: Deck | null;
  activeSeries: DeckSeries | null;
  generalStudyDeck: QuizDeck | null;
  sessionsToResume: Set<string>;
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
  onSync: () => void;
}

export type SeriesProgress = Map<string, Set<string>>;

export interface AIGenerationParams {
  generationType: 'series-scaffold' | 'series-quiz' | 'series-flashcard' | 'series-vocab' | 'series-course' | 'series-auto-fill' | 'level-auto-fill' | 'single-deck-quiz' | 'single-deck-learning' | 'deck-course' | 'deck-flashcard' | 'deck-vocab' | 'deck-atomic' | 'quiz-blooms' | 'add-levels-to-series' | 'add-decks-to-level' | 'generate-questions-for-deck' | 'upgrade-to-learning' | 'rework-deck' | 'deep-course' | 'holistic-expand-item' | 'deep-expand-questions';
  topic: string;
  persona: string;
  understanding: string;
  comprehensiveness: string;
  count?: number;
  imageStyle?: 'none' | 'realistic' | 'creative';
  seriesId?: string;
  levelIndex?: number;
  deckId?: string;
  itemId?: string; 
  reworkInstructions?: string;
  chapterCount?: number;
  targetWordCount?: number;
  sourceMaterial?: string; 
  thinkingBudget?: number; // Added for customization
  analogyIntensity?: 'none' | 'standard' | 'aggressive'; // Added
  partialProgress?: {
      deckId?: string;
      curriculum?: any;
      completedChapterIds?: string[];
      previousSummariesMap?: Record<string, string>;
  };
}

export interface AIGenerationTask {
  id: string;
  type: string;
  payload: any;
  statusText?: string;
  deckId?: string;
  seriesId?: string;
}

export enum AIActionType {
  CREATE_DECK = 'CREATE_DECK',
  RENAME_DECK = 'RENAME_DECK',
  DELETE_DECK = 'DELETE_DECK',
  MOVE_DECK_TO_FOLDER = 'MOVE_DECK_TO_FOLDER',
  CREATE_FOLDER = 'CREATE_FOLDER',
  RENAME_FOLDER = 'RENAME_FOLDER',
  DELETE_FOLDER = 'DELETE_FOLDER',
  EXPAND_SERIES_ADD_LEVELS = 'EXPAND_SERIES_ADD_LEVELS',
  EXPAND_SERIES_ADD_DECKS = 'EXPAND_SERIES_ADD_DECKS',
  GENERATE_QUESTIONS_FOR_DECK = 'GENERATE_QUESTIONS_FOR_DECK',
  UPGRADE_TO_LEARNING = 'UPGRADE_TO_LEARNING',
  REWORK_DECK = 'REWORK_DECK',
  NO_ACTION = 'NO_ACTION'
}

export interface AIAction {
  action: AIActionType;
  payload: any;
  confirmationMessage: string;
}

export interface DeckAnalysisSuggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  rationale: string;
  targetId?: string;
}

export interface ImportedCard {
  front: string;
  back: string;
}

export interface ImportedQuestion {
  id?: string;
  questionType: 'multipleChoice';
  questionText: string;
  options: { id?: string; text: string; explanation?: string }[];
  correctAnswerId: string;
  detailedExplanation?: string;
  tags?: string[];
  infoCardIds?: string[];
  bloomsLevel?: BloomsLevel;
}

export interface ImportedQuizDeck {
  name: string;
  description: string;
  questions: ImportedQuestion[];
  type?: DeckType;
  infoCards?: InfoCard[];
  learningMode?: 'mixed' | 'separate';
  curriculum?: LearningDeck['curriculum'];
  generationStatus?: DeckBase['generationStatus'];
  icon?: string;
}