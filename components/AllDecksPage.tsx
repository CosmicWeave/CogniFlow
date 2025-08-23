
import React, { useState, useMemo } from 'react';
import { Deck, Folder, DeckType, FlashcardDeck, QuizDeck } from '../types';
import DeckList from './DeckList';
import Button from './ui/Button';
import Icon from './ui/Icon';
import DeckSortControl, { SortPreference } from './ui/DeckSortControl';
import { useStore } from '../store/store';

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === 'quiz' ? (deck as QuizDeck).questions : (deck as FlashcardDeck).cards;
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

interface AllDecksPageProps {
  decks: Deck[];
  sessionsToResume: Set<string>;
  sortPreference: SortPreference;
  onSortChange: (pref: SortPreference) => void;
  onUpdateLastOpened: (deckId: string) => void;
  onEditFolder: (folder: Folder) => void;
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
}

const AllDecksPage: React.FC<AllDecksPageProps> = (props) => {
    const [searchTerm, setSearchTerm] = useState('');
    const folders = useStore(state => state.folders);

    const filteredAndSortedDecks = useMemo(() => {
        const filtered = props.decks.filter(deck =>
            deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            deck.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        switch (props.sortPreference) {
            case 'name': return filtered.sort((a, b) => a.name.localeCompare(b.name));
            case 'dueCount': return filtered.sort((a, b) => getDueItemsCount(b) - getDueItemsCount(a));
            case 'lastOpened': default: return filtered.sort((a,b) => (b.lastOpened || '').localeCompare(a.lastOpened || ''));
        }
    }, [props.decks, searchTerm, props.sortPreference]);

    const sortedFolders = useMemo(() => [...folders].sort((a, b) => a.name.localeCompare(b.name)), [folders]);
    
    const hasData = props.decks.length > 0 || folders.length > 0;
    
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
                    {...props}
                />
            )}
        </div>
    );
};

export default AllDecksPage;
