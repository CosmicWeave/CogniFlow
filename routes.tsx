
// routes.tsx
import React from 'react';
import { useStore } from './store/store';
import { useData } from './contexts/DataManagementContext';
import { AppRouterProps, Deck, DeckType, FlashcardDeck, QuizDeck, Card, Question, LearningDeck } from './types';
import { BreadcrumbItem } from './components/ui/Breadcrumbs';

// Page Component Imports
import { SettingsPage } from './components/SettingsPage';
import TrashPage from './components/TrashPage';
import ArchivePage from './components/ArchivePage';
import ProgressPage from './components/ProgressPage';
import JsonInstructionsPage from './components/JsonInstructionsPage';
import SeriesOverviewPage from './components/SeriesOverviewPage';
// FIX: Use named import for DeckDetailsPage
import { DeckDetailsPage } from './components/DeckDetailsPage';
import StudySession from './components/StudySession';
import AllDecksPage from './components/AllDecksPage';
import AllSeriesPage from './components/AllSeriesPage';

export interface PathParams {
  [key: string]: string;
}

export interface RouteConfig {
  path: string;
  component: React.ComponentType<any>;
  getProps: (params: PathParams, props: AppRouterProps, dataHandlers: ReturnType<typeof useData>) => object;
  getBreadcrumbs: (params: PathParams, props: AppRouterProps) => BreadcrumbItem[];
}

export const routes: RouteConfig[] = [
    {
        path: '/settings',
        component: SettingsPage,
        getProps: (params, props, dataHandlers) => ({
            ...props,
            onExport: dataHandlers.handleExportData,
            onRestore: dataHandlers.openRestoreModal,
            onResetProgress: dataHandlers.openResetProgressModal,
            onFactoryReset: dataHandlers.handleFactoryReset,
            onSync: dataHandlers.handleSync,
            onManageServerBackups: dataHandlers.openServerBackupModal,
            onCreateServerBackup: dataHandlers.handleCreateServerBackup,
            onGoogleSignIn: dataHandlers.handleGoogleSignIn,
            onGoogleSignOut: dataHandlers.handleGoogleSignOut,
            onBackupToDrive: dataHandlers.handleBackupToDrive,
            onRestoreFromDrive: dataHandlers.openRestoreFromDriveModal,
            onClearAppCache: dataHandlers.handleClearAppCache,
            onClearCdnCache: dataHandlers.handleClearCdnCache,
            onRevertLastFetch: dataHandlers.handleRevertLastFetch,
        }),
        getBreadcrumbs: () => ([{ label: 'Home', href: '/' }, { label: 'Settings' }]),
    },
    {
        path: '/trash',
        component: TrashPage,
        getProps: (params, props, dataHandlers) => ({
            ...props,
            onRestoreDeck: dataHandlers.handleRestoreDeck,
            onRestoreSeries: dataHandlers.handleRestoreSeries,
            onDeleteDeckPermanently: dataHandlers.handleDeleteDeckPermanently,
            onDeleteSeriesPermanently: dataHandlers.handleDeleteSeriesPermanently,
            openConfirmModal: dataHandlers.openConfirmModal,
        }),
        getBreadcrumbs: () => ([{ label: 'Home', href: '/' }, { label: 'Trash' }]),
    },
    {
        path: '/archive',
        component: ArchivePage,
        getProps: (params, props, dataHandlers) => ({
            ...props,
            onUpdateDeck: dataHandlers.handleUpdateDeck,
            onUpdateSeries: dataHandlers.handleUpdateSeries,
            onDeleteDeck: dataHandlers.handleDeleteDeck,
            onDeleteSeries: dataHandlers.handleDeleteSeries,
            openConfirmModal: dataHandlers.openConfirmModal,
        }),
        getBreadcrumbs: () => ([{ label: 'Home', href: '/' }, { label: 'Archive' }]),
    },
    {
        path: '/progress',
        component: ProgressPage,
        getProps: () => ({}),
        getBreadcrumbs: () => ([{ label: 'Home', href: '/' }, { label: 'Progress' }]),
    },
    {
        path: '/instructions/json',
        component: JsonInstructionsPage,
        getProps: () => ({}),
        getBreadcrumbs: () => ([{ label: 'Home', href: '/' }, { label: 'JSON Guide' }]),
    },
    {
        path: '/decks',
        component: AllDecksPage,
        getProps: (params, props, dataHandlers) => ({
            ...props,
            onUpdateLastOpened: dataHandlers.updateLastOpened,
            onDeleteFolder: dataHandlers.handleDeleteFolder,
            onDragStart: props.setDraggedDeckId,
            onDragEnd: () => props.setDraggedDeckId(null),
            onMoveDeck: dataHandlers.handleMoveDeck,
            onUpdateDeck: dataHandlers.handleUpdateDeck,
            onDeleteDeck: dataHandlers.handleDeleteDeck,
            openConfirmModal: dataHandlers.openConfirmModal,
            onNewFolder: () => dataHandlers.openFolderEditor('new'),
            onImportDecks: dataHandlers.openImportModal,
            onCreateSampleDeck: dataHandlers.handleCreateSampleDeck,
            handleSaveFolder: dataHandlers.handleSaveFolder,
            onGenerateQuestionsForDeck: dataHandlers.handleGenerateQuestionsForDeck,
            onGenerateContentForLearningDeck: dataHandlers.handleGenerateContentForLearningDeck,
            onCancelAIGeneration: dataHandlers.handleCancelAIGeneration,
        }),
        getBreadcrumbs: () => ([{ label: 'Home', href: '/' }, { label: 'Decks' }]),
    },
    {
        path: '/series',
        component: AllSeriesPage,
        getProps: (params, props, dataHandlers) => ({
            ...props,
            onStartSeriesStudy: dataHandlers.handleStartSeriesStudy,
            onCreateNewSeries: () => dataHandlers.openSeriesEditor('new'),
            onCreateSampleSeries: dataHandlers.handleCreateSampleSeries,
            onGenerateAI: dataHandlers.openAIGenerationModal,
            onGenerateQuestionsForEmptyDecksInSeries: dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries,
            onCancelAIGeneration: dataHandlers.handleCancelAIGeneration,
        }),
        getBreadcrumbs: () => ([{ label: 'Home', href: '/' }, { label: 'Series' }]),
    },
    {
        path: '/series/:id',
        component: SeriesOverviewPage,
        getProps: (params, props, dataHandlers) => ({
            ...props,
            series: props.activeSeries!,
            onUpdateSeries: dataHandlers.handleUpdateSeries,
            onDeleteSeries: dataHandlers.handleDeleteSeries,
            onAddDeckToSeries: dataHandlers.handleAddDeckToSeries,
            onUpdateDeck: dataHandlers.handleUpdateDeck,
            onStartSeriesStudy: dataHandlers.handleStartSeriesStudy,
            onUpdateLastOpened: dataHandlers.updateLastOpenedSeries,
            openConfirmModal: dataHandlers.openConfirmModal,
            onAiAddLevelsToSeries: dataHandlers.handleAiAddLevelsToSeries,
            onAiAddDecksToLevel: dataHandlers.handleAiAddDecksToLevel,
            onGenerateQuestionsForEmptyDecksInSeries: dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries,
            onGenerateQuestionsForDeck: dataHandlers.handleGenerateQuestionsForDeck,
            onCancelAIGeneration: dataHandlers.handleCancelAIGeneration,
        }),
        getBreadcrumbs: (params, props) => ([
            { label: 'Home', href: '/' },
            { label: 'Series', href: '/series' },
            { label: props.activeSeries?.name || '...' },
        ]),
    },
    {
        path: '/decks/:id',
        component: DeckDetailsPage,
        getProps: (params, props, dataHandlers) => ({
            ...props,
            deck: props.activeDeck!,
            onUpdateDeck: dataHandlers.handleUpdateDeck,
            onDeleteDeck: dataHandlers.handleDeleteDeck,
            onUpdateLastOpened: dataHandlers.updateLastOpened,
            openConfirmModal: dataHandlers.openConfirmModal,
            onGenerateQuestionsForDeck: dataHandlers.handleGenerateQuestionsForDeck,
            onGenerateContentForLearningDeck: dataHandlers.handleGenerateContentForLearningDeck,
            onCancelAIGeneration: dataHandlers.handleCancelAIGeneration,
            onSaveLearningBlock: dataHandlers.handleSaveLearningBlock,
            onDeleteLearningBlock: dataHandlers.handleDeleteLearningBlock,
        }),
        getBreadcrumbs: (params, props) => {
            const { deckSeries } = useStore.getState();
            const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
            const seriesId = urlParams.get('seriesId');
            const crumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
            if (seriesId) {
                const series = deckSeries.find(s => s.id === seriesId);
                if (series) {
                    crumbs.push({ label: 'Series', href: '/series' });
                    crumbs.push({ label: series.name, href: `/series/${series.id}` });
                }
            } else {
                 crumbs.push({ label: 'Decks', href: '/decks' });
            }
            crumbs.push({ label: props.activeDeck?.name || '...' });
            return crumbs;
        },
    },
    {
        path: '/study/general',
        component: StudySession,
        getProps: (params, props, dataHandlers) => ({
            deck: props.generalStudyDeck,
            seriesId: new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined,
            onSessionEnd: dataHandlers.handleSessionEnd,
            onItemReviewed: dataHandlers.handleItemReviewed,
            onUpdateLastOpened: () => {},
            onStudyNextDeck: dataHandlers.handleStudyNextDeckInSeries,
        }),
        getBreadcrumbs: () => ([{ label: 'Home', href: '/' }, { label: 'General Study' }]),
    },
    {
        path: '/decks/:id/study',
        component: StudySession,
        getProps: (params, props, dataHandlers) => ({
            deck: props.activeDeck!,
            seriesId: new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined,
            onSessionEnd: dataHandlers.handleSessionEnd,
            onItemReviewed: dataHandlers.handleItemReviewed,
            onUpdateLastOpened: dataHandlers.updateLastOpened,
            onStudyNextDeck: dataHandlers.handleStudyNextDeckInSeries,
        }),
        getBreadcrumbs: (params, props) => getBreadcrumbsForStudy(params, props, 'Study'),
    },
    {
        path: '/decks/:id/cram',
        component: StudySession,
        getProps: (params, props, dataHandlers) => {
            const activeDeck = props.activeDeck!;
            const items = (activeDeck.type === DeckType.Flashcard ? (activeDeck as FlashcardDeck).cards : (activeDeck as QuizDeck | LearningDeck).questions).filter(item => !item.suspended);
            const shuffledItems = [...items].sort(() => Math.random() - 0.5);
            const cramDeck: Deck = activeDeck.type === DeckType.Flashcard 
                ? { ...activeDeck, name: `${activeDeck.name} (Cram)`, cards: shuffledItems as Card[] } 
                : { ...activeDeck, name: `${activeDeck.name} (Cram)`, questions: shuffledItems as Question[] };
            return {
                deck: cramDeck,
                seriesId: new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined,
                onSessionEnd: dataHandlers.handleSessionEnd,
                onItemReviewed: dataHandlers.handleItemReviewed,
                onUpdateLastOpened: dataHandlers.updateLastOpened,
                sessionKeySuffix: "_cram",
                onStudyNextDeck: dataHandlers.handleStudyNextDeckInSeries,
            };
        },
        getBreadcrumbs: (params, props) => getBreadcrumbsForStudy(params, props, 'Cram'),
    },
    {
        path: '/decks/:id/study-reversed',
        component: StudySession,
        getProps: (params, props, dataHandlers) => {
            const activeDeck = props.activeDeck as FlashcardDeck;
            const reversedDeck: FlashcardDeck = {
                ...activeDeck,
                name: `${activeDeck.name} (Reversed)`,
                cards: activeDeck.cards.map(card => ({
                    ...card,
                    front: card.back,
                    back: card.front,
                }))
            };
            return {
                deck: reversedDeck, 
                seriesId: new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined,
                onSessionEnd: dataHandlers.handleSessionEnd, 
                onItemReviewed: dataHandlers.handleItemReviewed,
                onUpdateLastOpened: dataHandlers.updateLastOpened,
                sessionKeySuffix: "_reversed",
                onStudyNextDeck: dataHandlers.handleStudyNextDeckInSeries,
            }
        },
        getBreadcrumbs: (params, props) => getBreadcrumbsForStudy(params, props, 'Reversed Study'),
    },
    {
        path: '/decks/:id/study-flip',
        component: StudySession,
        getProps: (params, props, dataHandlers) => {
            const activeDeck = props.activeDeck as (QuizDeck | LearningDeck);
            const cards = (activeDeck.questions || [])
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
                    return { ...q, front: q.questionText, back: backContent };
                });

            const virtualFlashcardDeck: FlashcardDeck = {
                ...activeDeck,
                name: `${activeDeck.name} (Review)`,
                type: DeckType.Flashcard,
                cards: cards.sort(() => Math.random() - 0.5)
            };
            return {
                deck: virtualFlashcardDeck, 
                seriesId: new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined,
                onSessionEnd: dataHandlers.handleSessionEnd, 
                onItemReviewed: dataHandlers.handleItemReviewed, 
                onUpdateLastOpened: dataHandlers.updateLastOpened,
                sessionKeySuffix: "_flip",
                onStudyNextDeck: dataHandlers.handleStudyNextDeckInSeries,
            }
        },
        getBreadcrumbs: (params, props) => getBreadcrumbsForStudy(params, props, 'Flashcard Review'),
    },
];

const getBreadcrumbsForStudy = (params: PathParams, props: AppRouterProps, studyType: string): BreadcrumbItem[] => {
    const { deckSeries } = useStore.getState();
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const seriesId = urlParams.get('seriesId');
    const crumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
    if (seriesId) {
        const series = deckSeries.find(s => s.id === seriesId);
        if (series) {
            crumbs.push({ label: 'Series', href: '/series' });
            crumbs.push({ label: series.name, href: `/series/${series.id}` });
        }
    } else {
        crumbs.push({ label: 'Decks', href: '/decks' });
    }
    crumbs.push({ label: props.activeDeck?.name || '...', href: `/decks/${props.activeDeck?.id}` });
    crumbs.push({ label: studyType });
    return crumbs;
};
