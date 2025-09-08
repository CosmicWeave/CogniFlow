
export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

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

export enum QuestionType {
  MultipleChoice = 'multipleChoice',
}

export interface Reviewable {
  id: string;
  dueDate: string;
  interval: number;
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
}

export interface QuestionOption {
  id: string;
  text: string;
  explanation?: string;
}

export interface Question extends Reviewable {
  questionType: QuestionType | string;
  questionText: string;
  options: QuestionOption[];
  correctAnswerId: string;
  detailedExplanation: string;
  tags?: string[];
  infoCardIds?: string[];
}

export interface InfoCard {
  id: string;
  content: string;
  unlocksQuestionIds: string[];
}

interface DeckBase {
  id: string;
  name: string;
  description?: string;
  folderId?: string | null;
  lastOpened?: string;
  archived?: boolean;
  deletedAt?: string | null;
  locked?: boolean;
  aiGenerationParams?: AIGenerationParams;
  suggestedQuestionCount?: number;
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
  aiGenerationParams?: AIGenerationParams;
  aiChatHistory?: any[];
}

export type SeriesProgress = Map<string, Set<string>>;

export interface ImportedCard {
  front: string;
  back: string;
}

export interface ImportedQuestion {
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

export interface SessionState {
  id: string;
  reviewQueue: (Card | Question | InfoCard)[];
  currentIndex: number;
  readInfoCardIds?: string[];
  unlockedQuestionIds?: string[];
  itemsCompleted?: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  actions?: AIAction[];
}

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
  payload: any;
  confirmationMessage: string;
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
}

export interface AIGeneratedDeck {
    name: string;
    description: string;
    suggestedQuestionCount: number;
}

export interface AIGeneratedLevel {
    title: string;
    decks: AIGeneratedDeck[];
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface FullBackupData {
  version: number;
  decks: Deck[];
  folders: Folder[];
  deckSeries: DeckSeries[];
  reviews: ReviewLog[];
  sessions: SessionState[];
  seriesProgress: Record<string, string[]>;
  aiChatHistory?: AIMessage[];
  aiOptions?: any;
}

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