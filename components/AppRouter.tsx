

import React, { useMemo } from 'react';
import { useRouter } from '../contexts/RouterContext';
import { Deck, Folder, DeckSeries, QuizDeck, DeckType, FlashcardDeck, Card, Question, LearningDeck, AppRouterProps } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import StudySession from './StudySession';
import { SettingsPage } from './SettingsPage';
// FIX: Corrected import path to point to the correct file location.
import DeckDetailsPage from './DeckDetailsPage';
import JsonInstructionsPage from './JsonInstructionsPage';
import SeriesOverviewPage from './SeriesOverviewPage';
import ArchivePage from './ArchivePage';
import TrashPage from './TrashPage';
import DashboardPage from './DashboardPage';
import AllDecksPage from './AllDecksPage';
import AllSeriesPage from './AllSeriesPage';
import ProgressPage from './ProgressPage';
// FIX: Corrected invalid hook calls by using exported selectors from the store.
import { useStore, useActiveSeriesList, useStandaloneDecks, useTotalDueCount } from '../store/store';
import { useSettings } from '../hooks/useSettings';
import { useData } from '../contexts/DataManagementContext';
import Breadcrumbs, { BreadcrumbItem } from './ui/Breadcrumbs';

const AppRouter: React.FC<AppRouterProps> = (props) => {
    const { path } = useRouter();
    const { activeDeck, activeSeries, generalStudyDeck } = props;
    const { aiFeaturesEnabled } = useSettings();
    const dataHandlers = useData();
    const [pathname] = path.split('?');
    const { deckSeries } = useStore();
    
    const standaloneDecks = useStandaloneDecks();
    const activeSeriesList = useActiveSeriesList();
    const totalDueQuestions = useTotalDueCount();

    const isStudySession = useMemo(() => {
        return pathname.startsWith('/study/') || pathname.endsWith('/study') || pathname.endsWith('/cram') || pathname.endsWith('/study-reversed') || pathname.endsWith('/study-flip');
    }, [pathname]);

    const breadcrumbItems = useMemo(() => {
        const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
        const params = new URLSearchParams(window.location.hash.split('?')[1]);

        if (pathname === '/series') {
            items.push({ label: 'Series' });
        } else if (pathname.startsWith('/series/') && activeSeries) {
            items.push({ label: 'Series', href: '/series' });
            items.push({ label: activeSeries.name });
        } else if (pathname === '/decks') {
            items.push({ label: 'Decks' });
        } else if (pathname.startsWith('/decks/') && activeDeck) {
            const seriesId = params.get('seriesId');
            if (seriesId) {
                const series = deckSeries.find(s => s.id === seriesId);
                if (series) {
                    items.push({ label: 'Series', href: '/series' });
                    items.push({ label: series.name, href: `/series/${series.id}` });
                }
            } else {
                 items.push({ label: 'Decks', href: '/decks' });
            }
            items.push({ label: activeDeck.name });
        } else if (pathname === '/settings') {
            items.push({ label: 'Settings' });
        } else if (pathname === '/trash') {
            items.push({ label: 'Trash' });
        } else if (pathname === '/archive') {
            items.push({ label: 'Archive' });
        } else if (pathname === '/progress') {
            items.push({ label: 'Progress' });
        } else if (pathname === '/instructions/json') {
            items.push({ label: 'JSON Guide' });
        }

        return items;
    }, [pathname, activeDeck, activeSeries, deckSeries]);

    const renderPage = () => {
        if (pathname === '/settings') {
            return <SettingsPage 
                onExport={dataHandlers.handleExportData}
                onRestore={() => dataHandlers.openModal('restore')}
                onResetProgress={() => dataHandlers.openModal('resetProgress')}
                onFactoryReset={dataHandlers.handleFactoryReset} 
                onSync={props.onSync}
                onForceFetch={dataHandlers.handleForceFetchFromServer}
                onForceUpload={dataHandlers.handleForceUploadToServer}
                isSyncing={props.isSyncing}
                lastSyncStatus={props.lastSyncStatus}
                onManageServerBackups={() => dataHandlers.openModal('serverBackup')}
                onCreateServerBackup={dataHandlers.handleCreateServerBackup}
                isGapiReady={props.isGapiReady}
                isGapiSignedIn={props.isGapiSignedIn}
                gapiUser={props.gapiUser}
                onGoogleSignIn={dataHandlers.handleGoogleSignIn}
                onGoogleSignOut={dataHandlers.handleGoogleSignOut}
                onBackupToDrive={dataHandlers.handleBackupToDrive}
                onRestoreFromDrive={dataHandlers.openRestoreFromDriveModal}
                onClearAppCache={dataHandlers.handleClearAppCache}
                onClearCdnCache={dataHandlers.handleClearCdnCache}
                onRevertLastFetch={dataHandlers.handleRevertLastFetch}
            />;
        }
        
        if (pathname === '/trash') {
            return <TrashPage 
                onRestoreDeck={dataHandlers.handleRestoreDeck}
                onRestoreSeries={dataHandlers.handleRestoreSeries}
                onDeleteDeckPermanently={dataHandlers.handleDeleteDeckPermanently}
                onDeleteSeriesPermanently={dataHandlers.handleDeleteSeriesPermanently}
                openConfirmModal={dataHandlers.openConfirmModal}
            />
        }

        if (pathname === '/archive') {
          return <ArchivePage 
            onUpdateDeck={dataHandlers.handleUpdateDeck}
            onUpdateSeries={dataHandlers.handleUpdateSeries}
            onDeleteDeck={dataHandlers.handleDeleteDeck}
            onDeleteSeries={dataHandlers.handleDeleteSeries}
            openConfirmModal={dataHandlers.openConfirmModal}
          />
        }

        if (pathname === '/progress') {
            return <ProgressPage />;
        }

        if (pathname.startsWith('/series/') && activeSeries) {
            return <SeriesOverviewPage
                key={activeSeries.id}
                series={activeSeries}
                sessionsToResume={props.sessionsToResume}
                onUpdateSeries={dataHandlers.handleUpdateSeries}
                onDeleteSeries={dataHandlers.handleDeleteSeries}
                onAddDeckToSeries={dataHandlers.handleAddDeckToSeries}
                onUpdateDeck={dataHandlers.handleUpdateDeck}
                onStartSeriesStudy={dataHandlers.handleStartSeriesStudy}
                onUpdateLastOpened={dataHandlers.updateLastOpenedSeries}
                openConfirmModal={dataHandlers.openConfirmModal}
                onAiAddLevelsToSeries={dataHandlers.handleAiAddLevelsToSeries}
                onAiAddDecksToLevel={dataHandlers.handleAiAddDecksToLevel}
                handleGenerateQuestionsForEmptyDecksInSeries={dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries}
                handleGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck}
                onCancelAIGeneration={dataHandlers.handleCancelAIGeneration}
            />;
        }

        if (pathname === '/study/general') {
            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return generalStudyDeck && <StudySession key="general-study" deck={generalStudyDeck} seriesId={seriesId} onSessionEnd={dataHandlers.handleSessionEnd} onItemReviewed={dataHandlers.handleItemReviewed} onUpdateLastOpened={() => {}} onStudyNextDeck={dataHandlers.handleStudyNextDeckInSeries} />;
        }
        
        if (pathname.startsWith('/decks/') && pathname.endsWith('/cram')) {
            if (!activeDeck) return null;
            const items = ((activeDeck.type === DeckType.Flashcard ? (activeDeck as FlashcardDeck).cards : (activeDeck as QuizDeck | LearningDeck).questions) || [])
                .filter(item => !item.suspended);
            
            const shuffledItems = [...items].sort(() => Math.random() - 0.5);

            const cramDeck: Deck = activeDeck.type === DeckType.Flashcard 
                ? { ...activeDeck, name: `${activeDeck.name} (Cram)`, cards: shuffledItems as Card[] } 
                : { ...activeDeck, name: `${activeDeck.name} (Cram)`, questions: shuffledItems as Question[] };

            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return <StudySession key={`${activeDeck.id}-cram`} deck={cramDeck} seriesId={seriesId} onSessionEnd={dataHandlers.handleSessionEnd} onItemReviewed={dataHandlers.handleItemReviewed} onUpdateLastOpened={dataHandlers.updateLastOpened} sessionKeySuffix="_cram" onStudyNextDeck={dataHandlers.handleStudyNextDeckInSeries} />;
        }

        if (pathname.startsWith('/decks/') && pathname.endsWith('/study-reversed')) {
            if (!activeDeck || activeDeck.type !== 'flashcard') return null;
            const reversedDeck: FlashcardDeck = {
                ...activeDeck,
                name: `${activeDeck.name} (Reversed)`,
                cards: (activeDeck.cards || []).map(card => ({ ...card, front: card.back, back: card.front }))
            };
            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return <StudySession key={`${activeDeck.id}-reversed`} deck={reversedDeck} seriesId={seriesId} onSessionEnd={dataHandlers.handleSessionEnd} onItemReviewed={dataHandlers.handleItemReviewed} onUpdateLastOpened={dataHandlers.updateLastOpened} sessionKeySuffix="_reversed" onStudyNextDeck={dataHandlers.handleStudyNextDeckInSeries} />;
        }

        if (pathname.startsWith('/decks/') && pathname.endsWith('/study-flip')) {
            if (!activeDeck || (activeDeck.type !== 'quiz' && activeDeck.type !== 'learning')) return null;
            const quizDeck = activeDeck as QuizDeck | LearningDeck;
            const cards = (quizDeck.questions || []).filter(q => !q.suspended).map(q => {
                const correctAnswer = (q.options || []).find(o => o.id === q.correctAnswerId);
                const backContent = `<div class="text-left w-full"><p class="text-xl"><b>Answer:</b> ${correctAnswer?.text || 'N/A'}</p><hr class="my-4"/><div class="prose prose-sm dark:prose-invert max-w-none">${q.detailedExplanation}</div></div>`;
                return { ...q, front: q.questionText, back: backContent };
            });
            const virtualFlashcardDeck: FlashcardDeck = { ...quizDeck, name: `${quizDeck.name} (Review)`, type: DeckType.Flashcard, cards: cards.sort(() => Math.random() - 0.5) };
            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return <StudySession key={`${activeDeck.id}-flip`} deck={virtualFlashcardDeck} seriesId={seriesId} onSessionEnd={dataHandlers.handleSessionEnd} onItemReviewed={dataHandlers.handleItemReviewed} onUpdateLastOpened={dataHandlers.updateLastOpened} sessionKeySuffix="_flip" onStudyNextDeck={dataHandlers.handleStudyNextDeckInSeries} />;
        }

        if (pathname.startsWith('/decks/') && pathname.endsWith('/study')) {
            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return activeDeck && <StudySession key={activeDeck.id} deck={activeDeck} seriesId={seriesId} onSessionEnd={dataHandlers.handleSessionEnd} onItemReviewed={dataHandlers.handleItemReviewed} onUpdateLastOpened={dataHandlers.updateLastOpened} onStudyNextDeck={dataHandlers.handleStudyNextDeckInSeries} />;
        }

        if (pathname.startsWith('/decks/')) {
            return activeDeck && <DeckDetailsPage key={activeDeck.id} deck={activeDeck} sessionsToResume={props.sessionsToResume} onUpdateDeck={dataHandlers.handleUpdateDeck} onDeleteDeck={dataHandlers.handleDeleteDeck} onUpdateLastOpened={dataHandlers.updateLastOpened} openConfirmModal={dataHandlers.openConfirmModal} handleGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck} handleGenerateContentForLearningDeck={dataHandlers.handleGenerateContentForLearningDeck} onCancelAIGeneration={dataHandlers.handleCancelAIGeneration} onSaveLearningBlock={dataHandlers.handleSaveLearningBlock} onDeleteLearningBlock={dataHandlers.handleDeleteLearningBlock} />
        }

        if (pathname === '/instructions/json') {
          return <JsonInstructionsPage />;
        }
        
        if (pathname === '/decks') {
            return <AllDecksPage sessionsToResume={props.sessionsToResume} sortPreference={props.sortPreference} onSortChange={props.setSortPreference} onUpdateLastOpened={dataHandlers.updateLastOpened} onDeleteFolder={dataHandlers.handleDeleteFolder} draggedDeckId={props.draggedDeckId} onDragStart={props.setDraggedDeckId} onDragEnd={() => props.setDraggedDeckId(null)} onMoveDeck={dataHandlers.handleMoveDeck} openFolderIds={props.openFolderIds} onToggleFolder={props.onToggleFolder} onUpdateDeck={dataHandlers.handleUpdateDeck} onDeleteDeck={dataHandlers.handleDeleteDeck} openConfirmModal={dataHandlers.openConfirmModal} onNewFolder={() => dataHandlers.openModal('folder', { folder: 'new' })} onImportDecks={() => dataHandlers.openModal('import')} onCreateSampleDeck={dataHandlers.handleCreateSampleDeck} handleSaveFolder={dataHandlers.handleSaveFolder} handleGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck} handleGenerateContentForLearningDeck={dataHandlers.handleGenerateContentForLearningDeck} onCancelAIGeneration={dataHandlers.handleCancelAIGeneration} />;
        }

        if (pathname === '/series') {
            return <AllSeriesPage onStartSeriesStudy={dataHandlers.handleStartSeriesStudy} onCreateNewSeries={() => dataHandlers.openModal('series', { series: 'new' })} onCreateSampleSeries={dataHandlers.handleCreateSampleSeries} onGenerateAI={() => dataHandlers.openModal('aiGeneration')} handleGenerateQuestionsForEmptyDecksInSeries={dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries} onCancelAIGeneration={dataHandlers.handleCancelAIGeneration} />;
        }

        if (standaloneDecks.length > 0 || activeSeriesList.length > 0) {
            return <DashboardPage totalDueQuestions={totalDueQuestions} onStartGeneralStudy={dataHandlers.handleStartGeneralStudy} sessionsToResume={props.sessionsToResume} onUpdateLastOpened={dataHandlers.updateLastOpened} onUpdateDeck={dataHandlers.handleUpdateDeck} onDeleteDeck={dataHandlers.handleDeleteDeck} openConfirmModal={dataHandlers.openConfirmModal} seriesProgress={useStore.getState().seriesProgress} onStartSeriesStudy={dataHandlers.handleStartSeriesStudy} handleGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck} handleGenerateContentForLearningDeck={dataHandlers.handleGenerateContentForLearningDeck} handleGenerateQuestionsForEmptyDecksInSeries={dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries} onCancelAIGeneration={dataHandlers.handleCancelAIGeneration} />;
        }
        
        return (
            <div className="text-center py-20">
              <h2 className="text-3xl font-bold text-gray-600 dark:text-gray-400">Welcome to CogniFlow</h2>
              <p className="mt-4 text-gray-500 dark:text-gray-500">Get started by creating or importing content.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 flex-wrap">
                {aiFeaturesEnabled && <Button onClick={() => dataHandlers.openModal('aiGeneration')} variant="primary"><Icon name="zap" className="w-5 h-5 mr-2" />Generate with AI</Button>}
                <Button onClick={() => dataHandlers.openModal('import')}><Icon name="plus" className="w-5 h-5 mr-2" />Create or Import Deck</Button>
                <Button onClick={() => dataHandlers.openModal('restore')} variant="secondary"><Icon name="upload-cloud" className="w-5 h-5 mr-2" />Restore from Backup</Button>
                <Button onClick={() => dataHandlers.openModal('series', { series: 'new' })} variant="secondary"><Icon name="layers" className="w-5 h-5 mr-2" />Create New Series</Button>
                <Button onClick={dataHandlers.handleCreateSampleDeck} variant="ghost"><Icon name="laptop" className="w-5 h-5 mr-2" />Create Sample Deck</Button>
                <Button onClick={dataHandlers.handleCreateSampleSeries} variant="ghost"><Icon name="zap" className="w-5 h-5 mr-2" />Create Sample Series</Button>
              </div>
            </div>
        );
    };

    return (
        <>
            {!isStudySession && <Breadcrumbs items={breadcrumbItems} />}
            {renderPage()}
        </>
    );
};

export default AppRouter;