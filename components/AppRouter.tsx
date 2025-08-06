
import React, { useMemo } from 'react';
import { useRouter } from '../contexts/RouterContext';
import { Deck, DeckType, Folder, DeckSeries, QuizDeck, SeriesProgress, Reviewable, Card, FlashcardDeck } from '../types';
import { AppState } from '../hooks/useAppReducer';
import { RestoreData } from '../services/googleDriveService';
import { getEffectiveMasteryLevel } from '../services/srs';

import DeckList from './DeckList';
import Button from './ui/Button';
import Icon from './ui/Icon';
import StudySession from './StudySession';
import SettingsPage from './SettingsPage';
import DeckDetailsPage from './DeckDetailsPage';
import JsonInstructionsPage from './JsonInstructionsPage';
import SeriesOverviewPage from './SeriesOverviewPage';
import SeriesListItem from './SeriesListItem';
import ArchivePage from './ArchivePage';
import TrashPage from './TrashPage';
import DeckSortControl from './ui/DeckSortControl';

export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === DeckType.Quiz ? deck.questions : deck.cards;
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

interface AppRouterProps {
    state: AppState;
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
    openModal: (setter: React.Dispatch<React.SetStateAction<boolean>>) => void;
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
    handleItemReviewed: (deckId: string, reviewedItem: Reviewable, seriesId?: string) => Promise<void>;
    handleExportData: () => Promise<void>;
    handleRestoreData: (data: RestoreData) => Promise<void>;
    handleResetDeckProgress: (deckId: string) => Promise<void>;
    handleFactoryReset: () => void;
    handleStartGeneralStudy: () => void;
    handleStartSeriesStudy: (seriesId: string) => void;
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
    const { state, activeDeck, activeSeries, generalStudyDeck } = props;
    const [pathname] = path.split('?');

    const seriesDeckIds = useMemo(() => {
        const ids = new Set<string>();
        state.deckSeries.forEach(series => {
          series.levels.forEach(level => level.deckIds.forEach(deckId => ids.add(deckId)));
        });
        return ids;
    }, [state.deckSeries]);

    const unlockedSeriesDeckIds = useMemo(() => {
        const unlockedIds = new Set<string>();
        state.deckSeries.forEach(series => {
            if (!series.archived && !series.deletedAt) {
                const completedCount = props.seriesProgress.get(series.id)?.size || 0;
                const flatDeckIds = series.levels.flatMap(l => l.deckIds);
                flatDeckIds.forEach((deckId, index) => {
                    if (index <= completedCount) {
                        unlockedIds.add(deckId);
                    }
                });
            }
        });
        return unlockedIds;
    }, [state.deckSeries, props.seriesProgress]);

    const sortedDecks = useMemo(() => {
        const decksToSort = state.decks.filter(d => !d.archived && !d.deletedAt && !seriesDeckIds.has(d.id));
        switch (props.sortPreference) {
            case 'name': return decksToSort.sort((a, b) => a.name.localeCompare(b.name));
            case 'dueCount': return decksToSort.sort((a, b) => getDueItemsCount(b) - getDueItemsCount(a));
            case 'lastOpened': default: return decksToSort.sort((a,b) => (b.lastOpened || '').localeCompare(a.lastOpened || ''));
        }
    }, [state.decks, props.sortPreference, seriesDeckIds]);
      
    const sortedFolders = useMemo(() => [...state.folders].sort((a, b) => a.name.localeCompare(b.name)), [state.folders]);
    const sortedSeries = useMemo(() => state.deckSeries.filter(s => !s.archived && !s.deletedAt).sort((a, b) => a.name.localeCompare(b.name)), [state.deckSeries]);
    
    const totalDueQuestions = useMemo(() => {
        return state.decks
          .filter(deck => {
            if (deck.type !== DeckType.Quiz || deck.archived || deck.deletedAt) return false;
            if (seriesDeckIds.has(deck.id) && !unlockedSeriesDeckIds.has(deck.id)) return false;
            return true;
          })
          .reduce((total, deck) => total + getDueItemsCount(deck), 0);
    }, [state.decks, seriesDeckIds, unlockedSeriesDeckIds]);
      
    const seriesDueCounts = useMemo(() => {
        const counts = new Map<string, number>();
        state.deckSeries.forEach(series => {
            if (series.archived || series.deletedAt) {
                counts.set(series.id, 0);
                return;
            }
            const seriesDecks = series.levels.flatMap(l => l.deckIds).map(id => state.decks.find(d => d.id === id)).filter(d => d);
            const dueCount = seriesDecks.reduce((total, deck) => {
                if (deck && unlockedSeriesDeckIds.has(deck.id)) {
                    return total + getDueItemsCount(deck);
                }
                return total;
            }, 0);
            counts.set(series.id, dueCount);
        });
        return counts;
    }, [state.decks, state.deckSeries, unlockedSeriesDeckIds]);
    
    const seriesMasteryLevels = useMemo(() => {
        const masteryMap = new Map<string, number>();
        state.deckSeries.forEach(series => {
            const seriesDecks = series.levels.flatMap(l => l.deckIds).map(id => state.decks.find(d => d.id === id)).filter(Boolean) as Deck[];
            if (seriesDecks.length === 0) {
                masteryMap.set(series.id, 0);
                return;
            }
            const allItems = seriesDecks.flatMap<Reviewable>(d => d.type === DeckType.Flashcard ? d.cards : d.questions).filter(i => !i.suspended);
            if (allItems.length === 0) {
                masteryMap.set(series.id, 0);
                return;
            }
            const totalMastery = allItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0);
            masteryMap.set(series.id, totalMastery / allItems.length);
        });
        return masteryMap;
    }, [state.decks, state.deckSeries]);

    // --- Route Rendering ---
    
    if (pathname === '/trash') {
        const trashedDecks = state.decks.filter(d => d.deletedAt);
        const trashedSeries = state.deckSeries.filter(s => s.deletedAt);
        return <TrashPage
                trashedDecks={trashedDecks}
                trashedSeries={trashedSeries}
                onRestoreDeck={props.handleRestoreDeck}
                onRestoreSeries={props.handleRestoreSeries}
                onDeleteDeckPermanently={props.handleDeleteDeckPermanently}
                onDeleteSeriesPermanently={props.handleDeleteSeriesPermanently}
                openConfirmModal={props.openConfirmModal}
            />
    }

    if (pathname === '/archive') {
      const archivedDecks = state.decks.filter(d => d.archived && !d.deletedAt);
      const archivedSeries = state.deckSeries.filter(s => s.archived && !s.deletedAt);
      return <ArchivePage
                archivedDecks={archivedDecks}
                archivedSeries={archivedSeries}
                onUpdateDeck={props.handleUpdateDeck}
                onUpdateSeries={props.handleUpdateSeries}
                onDeleteDeck={props.handleDeleteDeck}
                onDeleteSeries={props.handleDeleteSeries}
                openConfirmModal={props.openConfirmModal}
            />
    }

    if (pathname.startsWith('/series/') && activeSeries) {
        const seriesDecks = activeSeries.levels.flatMap(l => l.deckIds).map(id => state.decks.find(d => d.id === id)).filter(d => d) as QuizDeck[];
        return <SeriesOverviewPage
            key={activeSeries.id}
            series={activeSeries}
            decks={seriesDecks}
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

    if (pathname.startsWith('/decks/') && pathname.endsWith('/study-flip')) {
        if (activeDeck && activeDeck.type === DeckType.Quiz) {
            const quizDeck = activeDeck as QuizDeck;
            const cards: Card[] = quizDeck.questions
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

    if (pathname.startsWith('/decks/') && pathname.endsWith('/study')) {
        const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
        return activeDeck && <StudySession key={activeDeck.id} deck={activeDeck} seriesId={seriesId} onSessionEnd={(deckId) => props.handleSessionEnd(deckId, seriesId)} onItemReviewed={props.handleItemReviewed} onUpdateLastOpened={props.updateLastOpened}/>;
    }

    if (pathname.startsWith('/decks/')) {
        return activeDeck && <DeckDetailsPage 
          key={activeDeck.id}
          deck={activeDeck}
          sessionsToResume={props.sessionsToResume}
          folders={state.folders}
          onUpdateDeck={props.handleUpdateDeck}
          onDeleteDeck={props.handleDeleteDeck}
          onUpdateLastOpened={props.updateLastOpened}
          openConfirmModal={props.openConfirmModal}
        />
    }

    if (pathname === '/settings') {
        return <SettingsPage onExport={props.handleExportData} onRestore={() => props.openModal(props.setRestoreModalOpen)} onRestoreData={props.handleRestoreData} onResetProgress={() => props.openModal(props.setResetProgressModalOpen)} onFactoryReset={props.handleFactoryReset} />;
    }

    if (pathname === '/instructions/json') {
      return <JsonInstructionsPage />;
    }
    
    // Default to home page
    if (sortedDecks.length > 0 || sortedFolders.length > 0 || sortedSeries.length > 0) {
      return (
        <>
          {totalDueQuestions > 0 && (
            <div className="mb-6"><Button onClick={props.handleStartGeneralStudy} variant="primary" className="w-full sm:w-auto text-lg py-3"><Icon name="zap" className="w-5 h-5 mr-2" />Study All Due Questions ({totalDueQuestions})</Button></div>
          )}
          
          {sortedSeries.length > 0 && (
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Your Series</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedSeries.map(series => (
                      <SeriesListItem
                        key={series.id}
                        series={series}
                        completedCount={props.seriesProgress.get(series.id)?.size || 0}
                        dueCount={seriesDueCounts.get(series.id) || 0}
                        masteryLevel={seriesMasteryLevels.get(series.id) || 0}
                        onStartSeriesStudy={props.handleStartSeriesStudy}
                      />
                  ))}
                </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Your Decks</h2>
            <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => props.openFolderModal('new')}><Icon name="folder-plus" className="w-5 h-5 mr-2" /><span className="hidden sm:inline">New Folder</span></Button>
                <DeckSortControl currentSort={props.sortPreference} onSortChange={props.setSortPreference} />
            </div>
          </div>
          <DeckList 
            decks={sortedDecks} 
            folders={sortedFolders}
            sessionsToResume={props.sessionsToResume} 
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
          />
        </>
      )
    }
    
    return (
        <div className="text-center py-20">
          <h2 className="text-3xl font-bold text-gray-600 dark:text-gray-400">Welcome to CogniFlow</h2>
          <p className="mt-4 text-gray-500 dark:text-gray-500">Create decks, import content, or try a sample to get started.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Button onClick={() => props.openModal(props.setImportModalOpen)}><Icon name="plus" className="w-5 h-5 mr-2" />Create or Import Deck</Button>
            <Button onClick={props.openCreateSeriesModal} variant="secondary"><Icon name="list" className="w-5 h-5 mr-2" />Create New Series</Button>
            <Button onClick={props.handleCreateSampleDeck} variant="ghost"><Icon name="laptop" className="w-5 h-5 mr-2" />Create Sample Deck</Button>
            <Button onClick={props.handleCreateSampleSeries} variant="ghost"><Icon name="zap" className="w-5 h-5 mr-2" />Create Sample Series</Button>
          </div>
        </div>
    );
};

export default AppRouter;