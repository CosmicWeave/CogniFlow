



export enum ReviewRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

// Base interface for any item that can be reviewed with SRS
export interface Reviewable {
  id: string;
  dueDate: string; // ISO string for date
  interval: number; // in days
  easeFactor: number;
  suspended?: boolean;
  masteryLevel?: number; // 0.0 to 1.0, calculated on review
  lastReviewed?: string; // ISO string for date
}

// Traditional flashcard
export interface Card extends Reviewable {
  front: string;
  back: string;
  css?: string;
}

// Multiple choice question
export interface QuestionOption {
  id: string;
  text: string;
  explanation?: string;
}

export interface Question extends Reviewable {
  questionType: 'multipleChoice';
  questionText: string;
  tags: string[];
  detailedExplanation: string;
  options: QuestionOption[];
  correctAnswerId: string;
}

export enum DeckType {
  Flashcard = 'flashcard',
  Quiz = 'quiz',
}

// For organizing decks
export interface Folder {
    id: string;
    name: string;
}

// Base deck properties
interface BaseDeck {
  id:string;
  name: string;
  description?: string;
  lastOpened?: string; // ISO string for date
  folderId?: string | null;
  archived?: boolean;
  deletedAt?: string; // ISO string for date
  locked?: boolean;
}

export interface FlashcardDeck extends BaseDeck {
  type: DeckType.Flashcard;
  cards: Card[];
}

export interface QuizDeck extends BaseDeck {
  type: DeckType.Quiz;
  questions: Question[];
}

export type Deck = FlashcardDeck | QuizDeck;

// A curated, ordered sequence of quiz decks
export interface DeckSeries {
    id: string;
    type: 'series';
    name: string;
    description: string;
    deckIds: string[]; // Ordered array of QuizDeck IDs
    archived?: boolean;
    deletedAt?: string; // ISO string for date
}

// Map of seriesId -> Set of completed deck IDs
export type SeriesProgress = Map<string, Set<string>>;


// Types for importing data
export type ImportedCard = Pick<Card, 'front' | 'back'>;

export type ImportedQuestion = Omit<Question, 'id' | 'dueDate' | 'interval' | 'easeFactor' | 'suspended'>;

// Types for Google Drive integration
export interface GoogleDriveFile {
    id: string;
    name: string;
    modifiedTime: string;
}