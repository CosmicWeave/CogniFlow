
import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from './store/store.ts';
import { useData } from './contexts/DataManagementContext.tsx';
import AppRouter from './components/AppRouter.tsx';
import Header from './components/Header.tsx';
import Sidebar from './components/Sidebar.tsx';
import ModalManager from './components/ModalManager.tsx';
import AIGenerationStatusIndicator from './components/AIGenerationStatusIndicator.tsx';
import AIChatFab from './components/AIChatFab.tsx';
import OfflineIndicator from './components/ui/OfflineIndicator.tsx';
import PullToRefreshIndicator from './components/ui/PullToRefreshIndicator.tsx';
import { useAutoHideHeader } from './hooks/useAutoHideHeader.ts';
import { usePullToRefresh } from './hooks/usePullToRefresh.ts';
import { GoogleDriveFile } from './types.ts';
import { analyzeFile } from './services/importService.ts';
import Icon from './components/ui/Icon.tsx';

const App: React.FC = () => {
    const { dispatch, aiGenerationStatus, isLoading } = useStore();
    const dataHandlers = useData();
    const isHeaderVisible = useAutoHideHeader();
    const { pullToRefreshState, handleTouchStart, handleTouchMove, handleTouchEnd, REFRESH_THRESHOLD } = usePullToRefresh();
    
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    
    // AI Generation Processor
    useEffect(() => {
        const processNextTask = async () => {
            const { currentTask, queue } = aiGenerationStatus;
            
            if (!currentTask && queue && queue.length > 0) {
                const nextTask = queue[0];
                const abortController = new AbortController();
                dispatch({ type: 'START_NEXT_AI_TASK', payload: { task: nextTask, abortController } });

                try {
                    switch (nextTask.type) {
                        case 'generateDeepCourse':
                            await (dataHandlers as any).onGenerateDeepCourse(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'generateDeckFromOutline':
                            await (dataHandlers as any).onGenerateDeckFromOutline(
                                nextTask.payload.outline, 
                                nextTask.payload.metadata, 
                                nextTask.payload.seriesId, 
                                nextTask.payload.levelIndex, 
                                abortController.signal,
                                nextTask.deckId
                            );
                            break;
                        case 'generateFullSeriesFromScaffold':
                            await (dataHandlers as any).onGenerateFullSeriesFromScaffold(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'generateFlashcardDeckWithAI':
                            await (dataHandlers as any).onGenerateFlashcardDeck(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'generateLearningDeckWithAI':
                            await (dataHandlers as any).onGenerateLearningDeckWithAI(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'autoPopulateSeries':
                            await (dataHandlers as any).onAutoPopulateSeries(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'autoPopulateLevel':
                            await (dataHandlers as any).onAutoPopulateLevel(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'generateQuestionsForDeck':
                            await (dataHandlers as any).onGenerateQuestionsForDeck(
                                nextTask.payload.deck,
                                nextTask.payload.count,
                                undefined,
                                abortController.signal
                            );
                            break;
                        case 'generateSeriesLearningContentInBatches':
                            await (dataHandlers as any).onGenerateLearningContentForDeck(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'generateSeriesQuestionsInBatches':
                            await (dataHandlers as any).onGenerateSeriesQuestionsInBatches(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'regenerateQuestion':
                            await (dataHandlers as any).onRegenerateQuestion(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'upgradeDeckToLearning':
                            await (dataHandlers as any).onUpgradeDeckToLearning(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'hardenAllDistractors':
                            await (dataHandlers as any).onHardenAllDistractors(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'generateAudioForAllCards':
                            await (dataHandlers as any).onGenerateAudioForAllCards(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                        case 'rework-deck':
                            await (dataHandlers as any).onReworkDeckContent(
                                nextTask.payload,
                                abortController.signal
                            );
                            break;
                    }
                } catch (e) {
                    if (e instanceof Error && e.message !== 'Cancelled by user') {
                        console.error("AI Task Failed:", e);
                        dataHandlers.addToast(`Generation failed: ${e.message}`, 'error');
                    }
                } finally {
                    dispatch({ type: 'FINISH_CURRENT_AI_TASK' });
                }
            }
        };

        processNextTask();
    }, [aiGenerationStatus, dispatch, dataHandlers]);

    // Global Drag and Drop Handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingFile(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only stop dragging if we are leaving the window, not just moving between elements
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingFile(false);
        }
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        const analysis = await analyzeFile(file);
        if (analysis) {
            dataHandlers.openModal('droppedFile', { analysis });
        } else {
            dataHandlers.addToast("Unrecognized file format. Please drop a JSON, Anki, or Image file.", "error");
        }
    }, [dataHandlers]);

    if (isLoading) return null;

    return (
        <div 
            className="min-h-screen bg-background text-text selection:bg-primary selection:text-on-primary transition-colors duration-300 relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Global Drag Overlay */}
            {isDraggingFile && (
                <div className="fixed inset-0 z-[100] bg-primary/20 backdrop-blur-sm border-4 border-dashed border-primary m-4 rounded-2xl flex flex-col items-center justify-center animate-fade-in pointer-events-none">
                    <div className="bg-surface p-8 rounded-full shadow-2xl scale-110 mb-6">
                        <Icon name="upload-cloud" className="w-16 h-16 text-primary" />
                    </div>
                    <h2 className="text-3xl font-bold text-primary bg-surface/80 px-6 py-2 rounded-lg backdrop-blur-md">Drop to Import</h2>
                    <p className="text-primary font-medium mt-2">JSON, Anki, CSV, or Image</p>
                </div>
            )}

            <PullToRefreshIndicator 
                pullDistance={pullToRefreshState.pullDistance} 
                isRefreshing={pullToRefreshState.isRefreshing} 
                threshold={REFRESH_THRESHOLD} 
            />
            
            <Header 
                onOpenMenu={() => setIsMenuOpen(true)} 
                onOpenCommandPalette={() => dataHandlers.openModal('commandPalette')}
                activeDeck={dataHandlers.activeDeck}
                isVisible={isHeaderVisible}
            />
            
            <Sidebar 
                isOpen={isMenuOpen} 
                onClose={() => setIsMenuOpen(false)}
                onImport={() => dataHandlers.openModal('import')}
                onCreateSeries={() => dataHandlers.openModal('series', { series: 'new' })}
                onGenerateAI={() => dataHandlers.openModal('aiGeneration')}
                onInstall={null}
            />
            
            <main className="container mx-auto px-4 pt-24 pb-20 sm:px-6 lg:px-8 max-w-7xl min-h-[calc(100vh-4rem)]">
                <AppRouter />
            </main>
            
            <ModalManager driveFiles={driveFiles} />
            
            <AIGenerationStatusIndicator 
                onOpen={() => dataHandlers.openModal('aiStatus')} 
                onCancel={dataHandlers.handleCancelAIGeneration} 
            />
            
            <AIChatFab />
            <OfflineIndicator />
        </div>
    );
};

export default App;
