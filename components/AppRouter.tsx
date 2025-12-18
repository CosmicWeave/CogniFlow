
import React, { useMemo, Suspense, lazy } from 'react';
import { useRouter } from '../contexts/RouterContext.tsx';
import { Deck, Folder, DeckSeries, QuizDeck, DeckType, FlashcardDeck, Card, Question, LearningDeck, AppRouterProps } from '../types.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useStore, useActiveSeriesList, useStandaloneDecks, useTotalDueCount, useDecksList, useSeriesList } from '../store/store.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { useData } from '../contexts/DataManagementContext.tsx';
import Breadcrumbs, { BreadcrumbItem } from './ui/Breadcrumbs.tsx';
import { useModal } from '../contexts/ModalContext.tsx';
import PageTransition from './ui/PageTransition.tsx';
import AppSkeleton from './AppSkeleton.tsx';

// Lazy load page components
const StudySession = lazy(() => import('./StudySession.tsx'));
const ReaderSession = lazy(() => import('./ReaderSession.tsx'));
const SettingsPage = lazy(() => import('./SettingsPage.tsx').then(module => ({ default: module.SettingsPage })));
const DeckDetailsPage = lazy(() => import('./DeckDetailsPage.tsx'));
const JsonInstructionsPage = lazy(() => import('./JsonInstructionsPage.tsx'));
const SeriesOverviewPage = lazy(() => import('./SeriesOverviewPage.tsx'));
const ArchivePage = lazy(() => import('./ArchivePage.tsx').then(module => ({ default: module.ArchivePage })));
const TrashPage = lazy(() => import('./TrashPage.tsx'));
const DashboardPage = lazy(() => import('./DashboardPage.tsx'));
const AllDecksPage = lazy(() => import('./AllDecksPage.tsx'));
const AllSeriesPage = lazy(() => import('./AllSeriesPage.tsx'));
const ProgressPage = lazy(() => import('./ProgressPage.tsx'));
const DeckPrintView = lazy(() => import('./DeckPrintView.tsx'));

const AppRouter: React.FC<AppRouterProps> = (props) => {
    const { path, navigate } = useRouter();
    const { activeDeck, activeSeries, generalStudyDeck } = props;
    const { aiFeaturesEnabled } = useSettings();
    const dataHandlers = useData();
    const [pathname] = path.split('?');
    const { openModal } = useModal();
    const openConfirmModal = (p: any) => openModal('confirm', p);
    
    // Selectors
    const deckSeries = useSeriesList(); // Get array of series for finding by ID in breadcrumbs
    const standaloneDecks = useStandaloneDecks();
    const activeSeriesList = useActiveSeriesList();
    const totalDueQuestions = useTotalDueCount();

    const isStudySession = useMemo(() => {
        return pathname.startsWith('/study/') || pathname.endsWith('/study') || pathname.endsWith('/cram') || pathname.endsWith('/study-reversed') || pathname.endsWith('/study-flip') || pathname.endsWith('/read');
    }, [pathname]);
    
    // Check if it is a print view to hide standard layout elements if needed in parent
    const isPrintView = pathname.endsWith('/print');

    const breadcrumbItems = useMemo(() => {
        if (isPrintView) return []; // Hide breadcrumbs in print view logic (handled by CSS mostly, but cleaner here)

        const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
        const params = new URLSearchParams(window.location.hash.split('?')[1]);

        if (pathname === '/series') {
            items.push({ label: 'Series' });
        } else if (pathname.startsWith('/series/') && activeSeries) {
            items.push({ label: 'Series', href: '/series' });
            items.push({ label: activeSeries.name || 'Series' });
        } else if (pathname === '/decks') {
            items.push({ label: 'Decks' });
        } else if (pathname.startsWith('/decks/') && activeDeck) {
            let parentSeries = null;
            const seriesIdParam = params.get('seriesId');
            
            if (seriesIdParam) {
                parentSeries = deckSeries.find(s => s.id === seriesIdParam);
            }
            
            // If not found by param, try to find if it belongs to any active series
            if (!parentSeries) {
                 parentSeries = deckSeries.find(s => !s.deletedAt && (s.levels || []).some(l => l.deckIds?.includes(activeDeck.id)));
            }

            if (parentSeries) {
                items.push({ label: 'Series', href: '/series' });
                items.push({ label: parentSeries.name || 'Series', href: `/series/${parentSeries.id}` });
            } else {
                 items.push({ label: 'Decks', href: '/decks' });
            }
            items.push({ label: activeDeck.name || 'Deck' });
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
    }, [pathname, activeDeck, activeSeries, deckSeries, isPrintView]);

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
                openConfirmModal={openConfirmModal}
            />
        }

        if (pathname === '/archive') {
          return <ArchivePage 
            onUpdateDeck={dataHandlers.handleUpdateDeck}
            onUpdateSeries={dataHandlers.handleUpdateSeries}
            onDeleteDeck={dataHandlers.handleDeleteDeck}
            onDeleteSeries={dataHandlers.handleDeleteSeries}
            openConfirmModal={openConfirmModal}
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
                openConfirmModal={openConfirmModal}
                onAiAddLevelsToSeries={dataHandlers.handleAiAddLevelsToSeries}
                onAiAddDecksToLevel={dataHandlers.handleAiAddDecksToLevel}
                handleGenerateQuestionsForEmptyDecksInSeries={dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries}
                handleGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck}
                onCancelAIGeneration={dataHandlers.handleCancelAIGeneration}
                onExportSeries={dataHandlers.handleExportSeries}
                onDeleteDeck={dataHandlers.handleDeleteDeck}
                handleGenerateContentForLearningDeck={dataHandlers.handleGenerateContentForLearningDeck}
                onGenerateDeckForLevel={dataHandlers.handleOpenAIGenerationForSeriesLevel}
                onAutoExpandSeries={dataHandlers.handleOpenAIAutoExpandSeries}
            />;
        }

        if (pathname === '/study/general') {
            const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId') || undefined;
            return generalStudyDeck && <StudySession key="general-study" deck={generalStudyDeck} seriesId={seriesId} onSessionEnd={dataHandlers.handleSessionEnd} onItemReviewed={dataHandlers.handleItemReviewed} onUpdateLastOpened={() => {}} onStudyNextDeck={dataHandlers.handleStudyNextDeckInSeries} />;
        }
        
        if (pathname.startsWith('/decks/') && pathname.endsWith('/cram')) {
            if (!activeDeck) return null;
            const params = new URLSearchParams(window.location.hash.split('?')[1]);
            const sortMode = params.get('sort') || 'random';
            const limit = params.get('limit') || 'all';
            
            let items = ((activeDeck.type === DeckType.Flashcard ? (activeDeck as FlashcardDeck).cards : (activeDeck as QuizDeck | LearningDeck).questions) || [])
                .filter(item => !item.suspended);
            
            // Sorting Logic
            if (sortMode === 'hardest') {
                items.sort((a, b) => {
                    const lapseDiff = (b.lapses || 0) - (a.lapses || 0);
                    if (lapseDiff !== 0) return lapseDiff;
                    return (a.easeFactor || 2.5) - (b.easeFactor || 2.5);
                });
            } else if (sortMode === 'newest') {
                // Reverse array order as approximation for "newest"
                items.reverse();
            } else if (sortMode === 'oldest') {
                // Default array order is usually oldest first
            } else {
                // Random
                items.sort(() => Math.random() - 0.5);
            }

            // Limiting Logic
            if (limit !== 'all') {
                const limitNum = parseInt(limit, 10);
                if (!isNaN(limitNum)) {
                    items = items.slice(0, limitNum);
                }
            }

            const cramDeck: Deck = activeDeck.type === DeckType.Flashcard 
                ? { ...activeDeck, name: `${activeDeck.name} (Cram)`, cards: items as Card[] } 
                : { ...activeDeck, name: `${activeDeck.name} (Cram)`, questions: items as Question[] };

            const seriesId = params.get('seriesId') || undefined;
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

        if (pathname.startsWith('/decks/') && pathname.endsWith('/read')) {
            if (!activeDeck || activeDeck.type !== DeckType.Learning) return null;
            return <ReaderSession deck={activeDeck as LearningDeck} onExit={() => navigate(`/decks/${activeDeck.id}`)} onPractice={() => navigate(`/decks/${activeDeck.id}/study`)} />
        }
        
        if (pathname.startsWith('/decks/') && pathname.endsWith('/print')) {
            return activeDeck && <DeckPrintView deck={activeDeck} />;
        }

        if (pathname.startsWith('/decks/')) {
            return activeDeck && <DeckDetailsPage 
                key={activeDeck.id} 
                deck={activeDeck} 
                sessionsToResume={props.sessionsToResume} 
                onUpdateDeck={dataHandlers.handleUpdateDeck} 
                onDeleteDeck={dataHandlers.handleDeleteDeck} 
                onUpdateLastOpened={dataHandlers.updateLastOpened} 
                openConfirmModal={openConfirmModal} 
                handleGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck} 
                handleGenerateContentForLearningDeck={dataHandlers.handleGenerateContentForLearningDeck} 
                onCancelAIGeneration={dataHandlers.handleCancelAIGeneration} 
                onSaveLearningBlock={dataHandlers.handleSaveLearningBlock} 
                onDeleteLearningBlock={dataHandlers.handleDeleteLearningBlock} 
                onExportDeck={dataHandlers.handleExportDeck} 
                onRegenerateQuestion={dataHandlers.handleRegenerateQuestion}
                onExpandText={dataHandlers.handleExpandText}
                onGenerateAI={() => dataHandlers.handleOpenAIGenerationForDeck(activeDeck)}
            />
        }

        if (pathname === '/instructions/json') {
          return <JsonInstructionsPage />;
        }
        
        if (pathname === '/decks') {
            return <AllDecksPage sessionsToResume={props.sessionsToResume} sortPreference={props.sortPreference} onSortChange={props.setSortPreference} onUpdateLastOpened={dataHandlers.updateLastOpened} onDeleteFolder={dataHandlers.handleDeleteFolder} draggedDeckId={props.draggedDeckId} onDragStart={props.setDraggedDeckId} onDragEnd={() => props.setDraggedDeckId(null)} onMoveDeck={dataHandlers.handleMoveDeck} openFolderIds={props.openFolderIds} onToggleFolder={props.onToggleFolder} onUpdateDeck={dataHandlers.handleUpdateDeck} onDeleteDeck={dataHandlers.handleDeleteDeck} openConfirmModal={openConfirmModal} onNewFolder={() => dataHandlers.openModal('folder', { folder: 'new' })} onImportDecks={() => dataHandlers.openModal('import')} onCreateSampleDeck={dataHandlers.handleCreateSampleDeck} handleSaveFolder={dataHandlers.handleSaveFolder} handleGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck} handleGenerateContentForLearningDeck={dataHandlers.handleGenerateContentForLearningDeck} onCancelAIGeneration={dataHandlers.handleCancelAIGeneration} />;
        }

        if (pathname === '/series') {
            return <AllSeriesPage onStartSeriesStudy={dataHandlers.handleStartSeriesStudy} onCreateNewSeries={() => dataHandlers.openModal('series', { series: 'new' })} onCreateSampleSeries={dataHandlers.handleCreateSampleSeries} onGenerateAI={() => dataHandlers.openModal('aiGeneration')} handleGenerateQuestionsForEmptyDecksInSeries={dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries} onCancelAIGeneration={dataHandlers.handleCancelAIGeneration} />;
        }

        if (standaloneDecks.length > 0 || activeSeriesList.length > 0) {
            return <DashboardPage 
                onGenerateAI={() => dataHandlers.openModal('aiGeneration')} 
                totalDueQuestions={totalDueQuestions} 
                onStartGeneralStudy={dataHandlers.handleStartGeneralStudy} 
                sessionsToResume={props.sessionsToResume} 
                onUpdateLastOpened={dataHandlers.updateLastOpened} 
                onUpdateDeck={dataHandlers.handleUpdateDeck} 
                onDeleteDeck={dataHandlers.handleDeleteDeck} 
                openConfirmModal={openConfirmModal} 
                seriesProgress={useStore.getState().seriesProgress} 
                onStartSeriesStudy={dataHandlers.handleStartSeriesStudy} 
                handleGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck} 
                handleGenerateContentForLearningDeck={dataHandlers.handleGenerateContentForLearningDeck} 
                handleGenerateQuestionsForEmptyDecksInSeries={dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries} 
                onCancelAIGeneration={dataHandlers.handleCancelAIGeneration} 
                onCreateSampleQuizDeck={dataHandlers.handleCreateSampleQuizDeck}
                onCreateSampleFlashcardDeck={dataHandlers.handleCreateSampleFlashcardDeck}
                onCreateSampleLearningDeck={dataHandlers.handleCreateSampleLearningDeck}
                onCreateSampleSeries={dataHandlers.handleCreateSampleSeries}
                onCreateSampleCourse={dataHandlers.handleCreateSampleCourse}
            />;
        }
        
        return (
            <div className="text-center py-20 max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-600 dark:text-gray-400">Welcome to CogniFlow</h2>
              <p className="mt-4 text-gray-500 dark:text-gray-500">Get started by creating or importing content.</p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 flex-wrap">
                {aiFeaturesEnabled && <Button onClick={() => dataHandlers.openModal('aiGeneration')} variant="primary"><Icon name="zap" className="w-5 h-5 mr-2" />Generate with AI</Button>}
                <Button onClick={() => dataHandlers.openModal('import')}><Icon name="plus" className="w-5 h-5 mr-2" />Create / Import</Button>
                <Button onClick={() => dataHandlers.openModal('series', { series: 'new' })} variant="secondary"><Icon name="layers" className="w-5 h-5 mr-2" />New Series</Button>
                <Button onClick={() => dataHandlers.openModal('restore')} variant="secondary"><Icon name="upload-cloud" className="w-5 h-5 mr-2" />Restore Backup</Button>
              </div>

              <div className="mt-12 border-t border-border pt-8">
                  <h3 className="text-lg font-semibold text-text-muted mb-4">Or try a sample:</h3>
                  <div className="flex flex-wrap justify-center gap-3">
                      <Button onClick={dataHandlers.handleCreateSampleQuizDeck} variant="ghost" size="sm">
                          <Icon name="help-circle" className="w-4 h-4 mr-2" /> Quiz Deck
                      </Button>
                      <Button onClick={dataHandlers.handleCreateSampleFlashcardDeck} variant="ghost" size="sm">
                          <Icon name="laptop" className="w-4 h-4 mr-2" /> Flashcard Deck
                      </Button>
                      <Button onClick={dataHandlers.handleCreateSampleLearningDeck} variant="ghost" size="sm">
                          <Icon name="book-open" className="w-4 h-4 mr-2" /> Learning Deck
                      </Button>
                      <Button onClick={dataHandlers.handleCreateSampleSeries} variant="ghost" size="sm">
                          <Icon name="layers" className="w-4 h-4 mr-2" /> Series
                      </Button>
                  </div>
              </div>
            </div>
        );
    };

    if (isStudySession || isPrintView) {
        return (
            <Suspense fallback={<AppSkeleton />}>
                {renderPage()}
            </Suspense>
        );
    }

    return (
        <>
            <Breadcrumbs items={breadcrumbItems} />
            <PageTransition key={pathname}>
                <Suspense fallback={<AppSkeleton />}>
                    {renderPage()}
                </Suspense>
            </PageTransition>
        </>
    );
};

export default AppRouter;
