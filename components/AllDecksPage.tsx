import React, { useState, useMemo } from 'react';
import { Deck, Folder, DeckType, FlashcardDeck, QuizDeck, Card, Question, LearningDeck } from '../types';
import DeckList from './DeckList';
import Button from './ui/Button';
import Icon from './ui/Icon';
import DeckSortControl, { SortPreference } from './ui/DeckSortControl';
import { useStore, useStandaloneDecks } from '../store/store';
import { stripHtml } from '../services/utils';

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === 'quiz' || deck.type === 'learning' ? (deck as QuizDeck | LearningDeck).questions : (deck as FlashcardDeck).cards;
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

interface AllDecksPageProps {
  sessionsToResume: Set<string>;
  sortPreference: SortPreference;
  onSortChange: (pref: SortPreference) => void;
  onUpdateLastOpened: (deckId: string) => void;
  onDeleteFolder: (folderId: string) => Promise<void>;
  draggedDeckId: string | null;
  onDragStart: (deckId: string) => void;
  onDragEnd: () => void;
  onMoveDeck: (deckId: string, folderId: string | null) => void;
  openFolderIds: Set<string>;
  onToggleFolder: (folderId: string) => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onDeleteDeck: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
  onNewFolder: () => void;
  onImportDecks: () => void;
  onCreateSampleDeck: () => void;
  handleSaveFolder: (folderData: { id: string; name: string; }) => void;
  onGenerateQuestionsForDeck: (deck: QuizDeck) => void;
  onGenerateContentForLearningDeck: (deck: LearningDeck) => void;
  onCancelAIGeneration: () => void;
}

const AllDecksPage: React.FC<AllDecksPageProps> = (props) => {
    const [searchTerm, setSearchTerm] = useState('');
    const folders = useStore(state => state.folders);
    const decks = useStandaloneDecks();

    const filteredAndSortedDecks = useMemo(() => {
        const lowercasedSearchTerm = searchTerm.toLowerCase().trim();

        if (!lowercasedSearchTerm) {
            const sorted = [...decks];
            switch (props.sortPreference) {
                case 'name': return sorted.sort((a, b) => a.name.localeCompare(b.name));
                case 'dueCount': return sorted.sort((a, b) => getDueItemsCount(b) - getDueItemsCount(a));
                case 'lastOpened': default: return sorted.sort((a,b) => (b.lastOpened || '').localeCompare(a.lastOpened || ''));
            }
        }
        
        const searchTokens = lowercasedSearchTerm.split(/\s+/).filter(Boolean);

        const scoredDecks = decks.map(deck => {
            let score = 0;
            const name = deck.name.toLowerCase();
            const description = stripHtml(deck.description).toLowerCase();

            // High score for exact or prefix matches in title
            if (name.startsWith(lowercasedSearchTerm)) score += 20;
            else if (name.includes(lowercasedSearchTerm)) score += 10;
            
            // Lower score for matches in description
            if (description.includes(lowercasedSearchTerm)) score += 2;

            // Score for individual token matches
            for (const token of searchTokens) {
                if (name.includes(token)) score += 5;
                if (description.includes(token)) score += 1;
            }

            // Score for content matches, capped to prevent very large decks from always winning
            const items = deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : (deck.type === DeckType.Learning ? (deck as LearningDeck).questions : (deck as QuizDeck).questions);
            let contentMatchCount = 0;
            if (items) {
                for (const item of items) {
                    let itemText: string;
                    if (deck.type === DeckType.Flashcard) {
                        const card = item as Card;
                        itemText = stripHtml(`${card.front} ${card.back}`).toLowerCase();
                    } else {
                        const question = item as Question;
                        const optionsText = question.options.map(o => o.text).join(' ');
                        itemText = stripHtml(`${question.questionText} ${optionsText} ${question.detailedExplanation}`).toLowerCase();
                    }
                    if (searchTokens.some(token => itemText.includes(token))) {
                        contentMatchCount++;
                    }
                }
            }
            score += Math.min(contentMatchCount, 20) * 0.5; // Up to 10 points for content matches

            return { deck, score };
        }).filter(({ score }) => score > 0);

        // Sort by score descending, then by user's preference
        scoredDecks.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            switch (props.sortPreference) {
                case 'name': return a.deck.name.localeCompare(b.deck.name);
                case 'dueCount': return getDueItemsCount(b.deck) - getDueItemsCount(a.deck);
                case 'lastOpened': default: return (b.deck.lastOpened || '').localeCompare(a.deck.lastOpened || '');
            }
        });

        return scoredDecks.map(({ deck }) => deck);
    }, [decks, searchTerm, props.sortPreference]);

    const sortedFolders = useMemo(() => [...folders].sort((a, b) => a.name.localeCompare(b.name)), [folders]);
    
    const hasData = decks.length > 0 || folders.length > 0;
    
    if (!hasData) {
        return (
            <div className="text-center py-20">
              <Icon name="folder" className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600"/>
              <h2 className="mt-4 text-2xl font-bold text-text-muted">Your deck collection is empty</h2>
              <p className="mt-2 text-text-muted">Create a new deck, import from a file, or try a sample deck to get started.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                <Button onClick={props.onImportDecks}><Icon name="plus" className="w-5 h-5 mr-2" />Create or Import Deck</Button>
                <Button onClick={props.onCreateSampleDeck} variant="secondary"><Icon name="laptop" className="w-5 h-5 mr-2" />Create Sample Deck</Button>
              </div>
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-text">All Decks</h1>
                <Button variant="primary" onClick={props.onImportDecks}>
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    Create / Import Deck
                </Button>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-surface rounded-lg border border-border">
                <div className="relative w-full md:max-w-xs">
                    <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"/>
                    <input
                        type="text"
                        placeholder="Search decks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="ghost" onClick={props.onNewFolder}>
                        <Icon name="folder-plus" className="w-5 h-5 mr-2" />
                        <span className="hidden sm:inline">New Folder</span>
                    </Button>
                    <DeckSortControl currentSort={props.sortPreference} onSortChange={props.onSortChange} />
                </div>
            </div>

            {filteredAndSortedDecks.length === 0 && searchTerm ? (
                <div className="text-center py-20">
                    <Icon name="search" className="w-16 h-16 mx-auto text-text-muted/50"/>
                    <h2 className="mt-4 text-2xl font-bold text-text-muted">No Decks Found</h2>
                    <p className="mt-2 text-text-muted">Your search for "{searchTerm}" did not match any decks.</p>
                    <Button variant="secondary" onClick={() => setSearchTerm('')} className="mt-6">
                        Clear Search
                    </Button>
                </div>
            ) : (
                <DeckList 
                    decks={filteredAndSortedDecks} 
                    folders={sortedFolders}
                    sessionsToResume={props.sessionsToResume}
                    onUpdateLastOpened={props.onUpdateLastOpened}
                    onDeleteFolder={props.onDeleteFolder}
                    draggedDeckId={props.draggedDeckId}
                    onDragStart={props.onDragStart}
                    onDragEnd={props.onDragEnd}
                    onMoveDeck={props.onMoveDeck}
                    openFolderIds={props.openFolderIds}
                    onToggleFolder={props.onToggleFolder}
                    onUpdateDeck={props.onUpdateDeck}
                    onDeleteDeck={props.onDeleteDeck}
                    openConfirmModal={props.openConfirmModal}
                    onSaveFolder={props.handleSaveFolder}
                    onGenerateQuestionsForDeck={props.onGenerateQuestionsForDeck}
                    onGenerateContentForLearningDeck={props.onGenerateContentForLearningDeck}
                />
            )}
        </div>
    );
};

export default AllDecksPage;