



import React, { useMemo } from 'react';
import { useRouter } from '../contexts/RouterContext';
import { Deck, DeckType, Folder, DeckSeries, QuizDeck, SeriesProgress, Reviewable, Card, FlashcardDeck, Question, ReviewRating } from '../types';
import { RestoreData } from '../services/googleDriveService';
import { getEffectiveMasteryLevel } from '../services/srs';

import Button from './ui/Button';
import Icon from './ui/Icon';
import StudySession from './StudySession';
import { SettingsPage } from './SettingsPage';
import DeckDetailsPage from './DeckDetailsPage';
import JsonInstructionsPage from './JsonInstructionsPage';
import SeriesOverviewPage from './SeriesOverviewPage';
import ArchivePage from './ArchivePage';
import TrashPage from './TrashPage';
import DashboardPage from './DashboardPage';
import AllDecksPage from './AllDecksPage';
import AllSeriesPage from './AllSeriesPage';
import ProgressPage from './ProgressPage';
import { useStore } from '../store/store';

export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : (deck as FlashcardDeck).cards;
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

interface AppRouterProps {
    sessionsToResume: Set<string>;
    sortPreference: SortPreference;
    setSortPreference: (pref: SortPreference) => void;
    draggedDeckId: string | null;
    setDraggedDeckId: (id: string | null) => void;
    openFolderIds: Set<string>;
    onToggleFolder: (folderId: string) => void;
    seriesProgress: SeriesProgress;
    generalStudyDeck: QuizDeck | null;
    activeDeck: Deck | null;
    activeSeries: DeckSeries | null;
    setImportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setRestoreModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setResetProgressModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    openFolderModal: (folder: Folder | 'new' | null) => void;
    openConfirmModal: (props: { title: string; message: string; onConfirm: () => void; confirmText?: string; }) => void;
    openCreateSeriesModal: () => void;
    // Data Handlers
    updateLastOpened: (deckId: string) => Promise<void>;
    handleSessionEnd: (deckId: string, seriesId?: string) => Promise<void>;
    handleCreateSampleDeck: () => Promise<void>;
    handleCreateSampleSeries: () => Promise<void>;
    handleDeleteDeck: (deckId: string) => Promise<void>;
    handleUpdateDeck: (deck: Deck, options?: { silent?: boolean; toastMessage?: string; }) => Promise<void>;
    handleMoveDeck: (deckId: string, folderId: string | null) => Promise<void>;
    handleItemReviewed: (deckId: string, reviewedItem: Reviewable, rating: ReviewRating | null, seriesId?: string) => Promise<void>;
    handleExportData: () => Promise<void>;
    handleRestoreData: (data: RestoreData) => Promise<void>;
    handleResetDeckProgress: (deckId: string) => Promise<void>;
    handleFactoryReset: () => void;
    handleStartGeneralStudy: () => void;
    handleStartSeriesStudy: (seriesId: string) => Promise<void>;
    handleDeleteFolder: (folderId: string) => Promise<void>;
    handleUpdateSeries: (series: DeckSeries, options?: { silent?: boolean; toastMessage?: string; }) => Promise<void>;
    handleSaveSeries: (data: { id: string | null; name: string; description: string; }) => Promise<void>;
    handleDeleteSeries: (seriesId: string) => Promise<void>;
    handleAddDeckToSeries: (seriesId: string, newDeck: QuizDeck) => Promise<void>;
    handleRestoreDeck: (deckId: string) => Promise<void>;
    handleRestoreSeries: (seriesId: string) => Promise<void>;
    handleDeleteDeckPermanently: (deckId: string) => Promise<void>;
    handleDeleteSeriesPermanently: (seriesId: string) => Promise<void>;
}

const AppRouter: React.FC<AppRouterProps> = (props) => {
    const { path } = useRouter();
    const { decks, folders, deckSeries } = useStore();
    const { activeDeck, activeSeries, generalStudyDeck } = props;
    const [pathname] = path.split('?');

    const {
        standaloneDecks,
        totalDueQuestions,
    } = useMemo(() => {
        const seriesDeckIds = new Set<string>();
        deckSeries.forEach(series => {
          (series.levels || []).forEach(level => (level.deckIds || []).forEach(deckId => seriesDeckIds.add(deckId)));
        });

        const standaloneDecks = decks.filter(d => !d.archived && !d.deletedAt && !seriesDeckIds.has(d.id));

        const unlockedSeriesDeckIds = new Set<string>();
        deckSeries.forEach(series => {
            if (!series.archived && !series.deletedAt) {
                const completedCount = props.seriesProgress.get(series.id)?.size || 0;
                const flatDeckIds = (series.levels || []).flatMap(l => l.deckIds || []);
                flatDeckIds.forEach((deckId, index) => {
                    if (index <= completedCount) {
                        unlockedSeriesDeckIds.add(deckId);
                    }
                });
            }
        });

        const totalDueQuestions = decks
          .filter(deck => {
            if (deck.archived || deck.deletedAt) return false;
            // It's a series deck that is locked
            if (seriesDeckIds.has(deck.id) && !unlockedSeriesDeckIds.has(deck.id)) return false;
            return true;
          })
          .reduce((total, deck) => total + getDueItemsCount(deck), 0);
        
        return { standaloneDecks, totalDueQuestions };
    }, [decks, deckSeries, props.seriesProgress]);

    // --- Route Rendering ---
    
    if (pathname === '/trash') {
        return <TrashPage
                onRestoreDeck={props.handleRestoreDeck}
                onRestoreSeries={props.handleRestoreSeries}
                onDeleteDeckPermanently={props.handleDeleteDeckPermanently}
                onDeleteSeriesPermanently={props.handleDeleteSeriesPermanently}
                openConfirmModal={props.openConfirmModal}
            />
    }

    if (pathname === '/archive') {
      return <ArchivePage
                onUpdateDeck={props.handleUpdateDeck}
                onUpdateSeries={props.handleUpdateSeries}
                onDeleteDeck={props.handleDeleteDeck}
                onDeleteSeries={props.handleDeleteSeries}
                openConfirmModal={props.openConfirmModal}
            />
    }

    if (pathname === '/progress') {
        return <ProgressPage />;
    }

    if (pathname.startsWith('/series/') && activeSeries) {
        return <SeriesOverviewPage
            key={activeSeries.id}
            series={activeSeries}
            completedDeckIds={props.seriesProgress.get(activeSeries.id) || new Set()}
            sessionsToResume={props.sessionsToResume}
            onUpdateSeries={props.handleUpdateSeries}
            onDeleteSeries={props.handleDeleteSeries}
            onAddDeckToSeries={props.handleAddDeckToSeries}
            onUpdateDeck={props.handleUpdateDeck as any}
            onStartSeriesStudy={props.handleStartSeriesStudy}
            openConfirmModal={props.openConfirmModal}
        />;
    }

    if (pathname === '/study/general') {
        const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
        return generalStudyDeck && <StudySession key="general-study" deck={generalStudyDeck} seriesId={seriesId} onSessionEnd={(deckId) => props.handleSessionEnd(deckId, seriesId)} onItemReviewed={props.handleItemReviewed} onUpdateLastOpened={() => {}}/>;
    }
    
    if (pathname.startsWith('/decks/') && pathname.endsWith('/cram')) {
        if (activeDeck) {
            const items = (activeDeck.type === DeckType.Flashcard ? (activeDeck as FlashcardDeck).cards : (activeDeck as QuizDeck).questions)
                .filter(item => !item.suspended); // Cramming reviews all non-ignored items
            
            const shuffledItems = [...items].sort(() => Math.random() - 0.5);

            let cramDeck: Deck;
            if (activeDeck.type === DeckType.Flashcard) {
                cramDeck = { ...activeDeck, name: `${activeDeck.name} (Cram)`, cards: shuffledItems as Card[] };
            } else {
                cramDeck = { ...activeDeck, name: `${activeDeck.name} (Cram)`, questions: shuffledItems as Question[] };
            }

            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return <StudySession 
                key={`${activeDeck.id}-cram`} 
                deck={cramDeck} 
                seriesId={seriesId}
                onSessionEnd={(deckId) => props.handleSessionEnd(deckId, seriesId)} 
                onItemReviewed={props.handleItemReviewed}
                onUpdateLastOpened={props.updateLastOpened}
                sessionKeySuffix="_cram"
            />;
        }
    }

    if (pathname.startsWith('/decks/') && pathname.endsWith('/study-flip')) {
        if (activeDeck && activeDeck.type === DeckType.Quiz) {
            const quizDeck = activeDeck as QuizDeck;
            const cards: Card[] = (quizDeck.questions || [])
                .filter(q => !q.suspended)
                .map(q => {
                    const correctAnswer = q.options.find(o => o.id === q.correctAnswerId);
                    const backContent = `
                        <div class="text-left w-full">
                            <p class="text-xl"><b>Answer:</b> ${correctAnswer?.text || 'N/A'}</p>
                            <hr class="my-4 border-gray-300 dark:border-gray-600"/>
                            <p class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Explanation</p>
                            <div class="prose prose-sm dark:prose-invert max-w-none mt-2">${q.detailedExplanation || 'No detailed explanation provided.'}</div>
                        </div>
                    `;
                    return {
                        ...q,
                        front: q.questionText,
                        back: backContent,
                    };
                });

            const virtualFlashcardDeck: FlashcardDeck = {
                ...quizDeck,
                name: `${quizDeck.name} (Review)`,
                type: DeckType.Flashcard,
                cards: cards.sort(() => Math.random() - 0.5) // Shuffle for review
            };
            
            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return <StudySession 
                key={`${activeDeck.id}-flip`} 
                deck={virtualFlashcardDeck} 
                seriesId={seriesId}
                onSessionEnd={(deckId) => props.handleSessionEnd(deckId, seriesId)} 
                onItemReviewed={props.handleItemReviewed} 
                onUpdateLastOpened={props.updateLastOpened}
                sessionKeySuffix="_flip"
            />;
        }
    }

    if (pathname.startsWith('/decks/') && pathname.endsWith('/study-reversed')) {
        if (activeDeck && activeDeck.type === DeckType.Flashcard) {
            const reversedDeck: FlashcardDeck = {
                ...activeDeck,
                name: `${activeDeck.name} (Reversed)`,
                cards: activeDeck.cards.map(card => ({
                    ...card,
                    front: card.back,
                    back: card.front,
                }))
            };
    
            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return <StudySession 
                key={`${activeDeck.id}-reversed`} 
                deck={reversedDeck} 
                seriesId={seriesId}
                onSessionEnd={(deckId) => props.handleSessionEnd(deckId, seriesId)} 
                onItemReviewed={props.handleItemReviewed}
                onUpdateLastOpened={props.updateLastOpened}
                sessionKeySuffix="_reversed"
            />;
        }
    }

    if (pathname.startsWith('/decks/') && pathname.endsWith('/study')) {
        const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
        return activeDeck && <StudySession key={activeDeck.id} deck={activeDeck} seriesId={seriesId} onSessionEnd={(deckId) => props.handleSessionEnd(deckId, seriesId)} onItemReviewed={props.handleItemReviewed} onUpdateLastOpened={props.updateLastOpened}/>;
    }

    if (pathname.startsWith('/decks/')) {
        return activeDeck && <DeckDetailsPage 
          key={activeDeck.id}
          deck={activeDeck}
          sessionsToResume={props.sessionsToResume}
          onUpdateDeck={props.handleUpdateDeck}
          onDeleteDeck={props.handleDeleteDeck}
          onUpdateLastOpened={props.updateLastOpened}
          openConfirmModal={props.openConfirmModal}
        />
    }

    if (pathname === '/settings') {
        return <SettingsPage onExport={props.handleExportData} onRestore={() => props.setRestoreModalOpen(true)} onRestoreData={props.handleRestoreData} onResetProgress={() => props.setResetProgressModalOpen(true)} onFactoryReset={props.handleFactoryReset} />;
    }

    if (pathname === '/instructions/json') {
      return <JsonInstructionsPage />;
    }
    
    if (pathname === '/decks') {
        return <AllDecksPage
            decks={standaloneDecks}
            sessionsToResume={props.sessionsToResume}
            sortPreference={props.sortPreference}
            onSortChange={props.setSortPreference}
            onUpdateLastOpened={props.updateLastOpened}
            onEditFolder={(folder) => props.openFolderModal(folder)}
            onDeleteFolder={props.handleDeleteFolder}
            draggedDeckId={props.draggedDeckId}
            onDragStart={props.setDraggedDeckId}
            onDragEnd={() => props.setDraggedDeckId(null)}
            onMoveDeck={props.handleMoveDeck}
            openFolderIds={props.openFolderIds}
            onToggleFolder={props.onToggleFolder}
            onUpdateDeck={props.handleUpdateDeck}
            onDeleteDeck={props.handleDeleteDeck}
            openConfirmModal={props.openConfirmModal}
            onNewFolder={() => props.openFolderModal('new')}
            onImportDecks={() => props.setImportModalOpen(true)}
            onCreateSampleDeck={props.handleCreateSampleDeck}
        />;
    }

    if (pathname === '/series') {
        return <AllSeriesPage
            seriesProgress={props.seriesProgress}
            onStartSeriesStudy={props.handleStartSeriesStudy}
            onCreateNewSeries={props.openCreateSeriesModal}
            onCreateSampleSeries={props.handleCreateSampleSeries}
        />
    }

    const activeSeriesList = deckSeries.filter(s => !s.archived && !s.deletedAt);
    if (standaloneDecks.length > 0 || activeSeriesList.length > 0) {
        return <DashboardPage
            totalDueQuestions={totalDueQuestions}
            onStartGeneralStudy={props.handleStartGeneralStudy}
            sessionsToResume={props.sessionsToResume}
            onUpdateLastOpened={props.updateLastOpened}
            onUpdateDeck={props.handleUpdateDeck}
            onDeleteDeck={props.handleDeleteDeck}
            openConfirmModal={props.openConfirmModal}
            seriesProgress={props.seriesProgress}
            onStartSeriesStudy={props.handleStartSeriesStudy}
        />
    }
    
    // Fallback to empty state
    return (
        <div className="text-center py-20">
          <h2 className="text-3xl font-bold text-gray-600 dark:text-gray-400">Welcome to CogniFlow</h2>
          <p className="mt-4 text-gray-500 dark:text-gray-500">Create decks, import content, restore from a backup, or try a sample to get started.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 flex-wrap">
            <Button onClick={() => props.setImportModalOpen(true)}><Icon name="plus" className="w-5 h-5 mr-2" />Create or Import Deck</Button>
            <Button onClick={() => props.setRestoreModalOpen(true)} variant="secondary"><Icon name="upload-cloud" className="w-5 h-5 mr-2" />Restore from Backup</Button>
            <Button onClick={props.openCreateSeriesModal} variant="secondary"><Icon name="layers" className="w-5 h-5 mr-2" />Create New Series</Button>
            <Button onClick={props.handleCreateSampleDeck} variant="ghost"><Icon name="laptop" className="w-5 h-5 mr-2" />Create Sample Deck</Button>
            <Button onClick={props.handleCreateSampleSeries} variant="ghost"><Icon name="zap" className="w-5 h-5 mr-2" />Create Sample Series</Button>
          </div>
        </div>
    );
};

export default AppRouter;
