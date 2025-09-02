import React, { useState, useMemo, useEffect } from 'react';
import { DeckSeries, QuizDeck, Question, DeckType, ImportedQuestion, LearningDeck } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Link from './ui/Link';
import { useRouter } from '../contexts/RouterContext';
import MasteryBar from './ui/MasteryBar';
import ProgressBar from './ui/ProgressBar';
import { getEffectiveMasteryLevel } from '../services/srs';
import { useStore } from '../store/store';
import { useToast } from '../hooks/useToast';
import { generateSeriesQuestionsInBatches } from '../services/aiService';
import { createQuestionsFromImport } from '../services/importService';
import Spinner from './ui/Spinner';
import { useSettings } from '../hooks/useSettings';

interface SeriesOverviewPageProps {
  series: DeckSeries;
  sessionsToResume: Set<string>;
  onUpdateSeries: (updatedSeries: DeckSeries, options?: { silent?: boolean; toastMessage?: string }) => void;
  onDeleteSeries: (seriesId: string) => void;
  onAddDeckToSeries: (seriesId: string, newDeck: QuizDeck) => void;
  onUpdateDeck: (updatedDeck: QuizDeck | LearningDeck) => void;
  onStartSeriesStudy: (seriesId: string) => void;
  onUpdateLastOpened: (seriesId: string) => void;
  openConfirmModal: (props: any) => void;
  onAiAddLevelsToSeries: (seriesId: string) => Promise<void>;
  onAiAddDecksToLevel: (seriesId: string, levelIndex: number) => Promise<void>;
  onGenerateQuestionsForEmptyDecksInSeries: (seriesId: string) => void;
  onCancelAIGeneration: () => void;
}

const getDueItemsCount = (deck?: QuizDeck | LearningDeck): number => {
    if (!deck) return 0;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return deck.questions.filter(q => !q.suspended && new Date(q.dueDate) <= today).length;
};

const SeriesOverviewPage: React.FC<SeriesOverviewPageProps> = ({ series, sessionsToResume, onUpdateSeries, onDeleteSeries, onAddDeckToSeries, onUpdateDeck, onStartSeriesStudy, onUpdateLastOpened, openConfirmModal, onAiAddLevelsToSeries, onAiAddDecksToLevel, onGenerateQuestionsForEmptyDecksInSeries }) => {
  const { decks: allDecks, seriesProgress, aiGenerationStatus, dispatch } = useStore();
  const { navigate, path } = useRouter();
  const { addToast } = useToast();
  const { aiFeaturesEnabled } = useSettings();
  
  const [isOrganizeMode, setIsOrganizeMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(series.name);
  const [editedDescription, setEditedDescription] = useState(series.description);
  
  const [isAddingLevels, setIsAddingLevels] = useState(false);
  const [isAddingDecksToLevel, setIsAddingDecksToLevel] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(path.split('?')[1]);
    if(params.get('edit') === 'true') {
        setIsOrganizeMode(true);
        // Clean up URL after activating edit mode
        navigate(`/series/${series.id}`, { replace: true });
    }
  }, [path, series.id, navigate]);

  useEffect(() => {
      onUpdateLastOpened(series.id);
  }, [series.id, onUpdateLastOpened]);

  useEffect(() => {
    if (series.archived || series.deletedAt) {
      navigate('/series');
    }
  }, [series.archived, series.deletedAt, navigate]);
  
  const seriesDecks = useMemo(() => {
    const deckMap = new Map<string, QuizDeck | LearningDeck>();
    const allSeriesDeckIds = new Set(series.levels.flatMap(level => level.deckIds));
    allDecks.forEach(deck => {
        if (allSeriesDeckIds.has(deck.id) && (deck.type === DeckType.Quiz || deck.type === DeckType.Learning)) {
            deckMap.set(deck.id, deck as QuizDeck | LearningDeck);
        }
    });
    return deckMap;
  }, [series.levels, allDecks]);

  const completedDeckIds = useMemo(() => seriesProgress.get(series.id) || new Set(), [seriesProgress, series.id]);
  const totalDecks = series.levels.reduce((sum, level) => sum + level.deckIds.length, 0);

  const { totalDueCount, averageMastery } = useMemo(() => {
    let dueCount = 0;
    const allItems = [];
    let deckIndex = 0;

    for (const level of series.levels) {
        for (const deckId of level.deckIds) {
            const deck = seriesDecks.get(deckId);
            if (deck) {
                if (deckIndex <= completedDeckIds.size) { // Unlocked
                    dueCount += getDueItemsCount(deck);
                }
                allItems.push(...deck.questions.filter(q => !q.suspended));
            }
            deckIndex++;
        }
    }
    
    const mastery = allItems.length > 0
        ? allItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0) / allItems.length
        : 0;
        
    return { totalDueCount: dueCount, averageMastery: mastery };
  }, [series.levels, seriesDecks, completedDeckIds]);
  
  const handleSaveChanges = () => {
    onUpdateSeries({ ...series, name: editedName, description: editedDescription });
    setIsEditing(false);
  };
  
  const handleDelete = () => {
    const deckCount = series.levels.reduce((sum, level) => sum + level.deckIds.length, 0);
    openConfirmModal({
        title: 'Move Series to Trash',
        message: `Are you sure you want to move the series "${series.name}" and all of its ${deckCount} deck(s) to the trash?`,
        onConfirm: () => onDeleteSeries(series.id),
    });
  };
  
  const handleGenerateQuestionsForDeck = (deck: QuizDeck) => {
    if (aiGenerationStatus.isGenerating) {
        addToast("An AI generation task is already in progress.", "info");
        return;
    }
    
    dispatch({
      type: 'SET_AI_GENERATION_STATUS',
      payload: { isGenerating: true, generatingDeckId: deck.id, generatingSeriesId: series.id, statusText: `Generating questions for "${deck.name}"...` }
    });
    addToast(`AI is now generating questions for "${deck.name}". This will continue in the background.`, 'info');
    
    (async () => {
        try {
            const history = await generateSeriesQuestionsInBatches(series, [deck], (deckId, questions) => {
                const newQuestions = createQuestionsFromImport(questions);
                const deckToUpdate = seriesDecks.get(deckId);
                if(deckToUpdate) {
                    const updatedDeck = { ...deckToUpdate, questions: newQuestions };
                    onUpdateDeck(updatedDeck);
                }
            });
            
            // Save history after successful generation
            onUpdateSeries({ ...series, aiChatHistory: history }, { silent: true });
            addToast(`Successfully generated questions for "${deck.name}"!`, 'success');

        } catch(e) {
            const message = e instanceof Error ? e.message : "An unknown error occurred during AI generation.";
            addToast(message, 'error');
        } finally {
             if (useStore.getState().aiGenerationStatus.generatingDeckId === deck.id) {
                dispatch({
                  type: 'SET_AI_GENERATION_STATUS',
                  payload: { isGenerating: false, generatingDeckId: null, generatingSeriesId: null, statusText: null }
                });
            }
        }
    })();
  };
  
  const handleAddLevels = async () => {
      setIsAddingLevels(true);
      try {
          await onAiAddLevelsToSeries(series.id);
      } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to add levels.";
          addToast(message, 'error');
      } finally {
          setIsAddingLevels(false);
      }
  };

  const handleAddDecksToLevel = async (levelIndex: number) => {
      setIsAddingDecksToLevel(levelIndex);
      try {
          await onAiAddDecksToLevel(series.id, levelIndex);
      } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to add decks.";
          addToast(message, 'error');
      } finally {
          setIsAddingDecksToLevel(null);
      }
  };
  
  const hasEmptyDecks = useMemo(() => Array.from(seriesDecks.values()).some(d => (d.questions?.length || 0) === 0), [seriesDecks]);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="bg-surface rounded-lg shadow-md p-6 border border-border">
        {isEditing ? (
          <div className="space-y-4">
            <div>
                <label htmlFor="series-name-edit" className="block text-sm font-medium text-text-muted mb-1">Series Name</label>
                <input id="series-name-edit" type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-2xl font-bold" autoFocus />
            </div>
            <div>
                <label htmlFor="series-desc-edit" className="block text-sm font-medium text-text-muted mb-1">Description</label>
                <textarea id="series-desc-edit" value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} rows={3} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div className="flex justify-start gap-2 pt-2">
              <Button onClick={handleSaveChanges}><Icon name="save" className="mr-2" /> Save Changes</Button>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-3xl font-bold mb-2 text-text break-words">{series.name}</h2>
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" onClick={() => setIsEditing(true)}><Icon name="edit" className="mr-2"/> Edit</Button>
                <Button variant="ghost" onClick={() => onUpdateSeries({ ...series, archived: true })}><Icon name="archive" className="mr-2"/> Archive</Button>
                <Button variant="ghost" onClick={() => setIsOrganizeMode(p => !p)}>
                    <Icon name="list" className="mr-2"/> {isOrganizeMode ? 'Done Organizing' : 'Organize'}
                </Button>
            </div>
            <p className="text-text-muted mt-1 prose dark:prose-invert max-w-none">{series.description}</p>
          </div>
        )}
      </div>

       <div className="bg-surface rounded-lg shadow-md p-6 border border-border space-y-4">
            <div>
                <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-medium text-text-muted">Completion</span>
                    <span className="font-semibold text-text-muted">{completedDeckIds.size} / {totalDecks} Decks</span>
                </div>
                <ProgressBar current={completedDeckIds.size} total={totalDecks} />
            </div>
            <div>
               <h4 className="text-sm font-medium text-text-muted mb-1">Overall Mastery</h4>
               <MasteryBar level={averageMastery} />
            </div>
            <div className="border-t border-border pt-4 flex flex-wrap items-center justify-center gap-4">
                <Button variant="primary" size="lg" onClick={() => onStartSeriesStudy(series.id)} disabled={totalDueCount === 0} className="font-semibold w-full sm:w-auto">
                  <Icon name="zap" className="w-5 h-5 mr-2" />
                  Study Due Items ({totalDueCount})
                </Button>
                {aiFeaturesEnabled && hasEmptyDecks && (
                    <Button variant="secondary" size="lg" onClick={() => onGenerateQuestionsForEmptyDecksInSeries(series.id)} disabled={aiGenerationStatus.isGenerating} className="font-semibold w-full sm:w-auto">
                        {aiGenerationStatus.isGenerating && aiGenerationStatus.generatingSeriesId === series.id ? <Spinner size="sm"/> : <Icon name="zap" className="w-5 h-5 mr-2" />}
                        Generate All Questions
                    </Button>
                )}
            </div>
       </div>

      <div className="space-y-6">
        {series.levels.map((level, levelIndex) => {
            let deckCounter = 0;
            for(let i=0; i<levelIndex; i++) {
                deckCounter += series.levels[i].deckIds.length;
            }

            return (
              <div key={levelIndex} className="bg-surface rounded-lg shadow-md border border-border p-6">
                <h3 className="text-xl font-bold text-text mb-4">{level.title}</h3>
                <div className="space-y-4">
                    {level.deckIds.map((deckId, indexInLevel) => {
                        const deck = seriesDecks.get(deckId);
                        const absoluteIndex = deckCounter + indexInLevel;
                        const isCompleted = completedDeckIds.has(deckId);
                        const isLocked = absoluteIndex > completedDeckIds.size;
                        const dueCount = getDueItemsCount(deck);

                        if (!deck) return <div key={deckId} className="text-red-500">Deck with ID {deckId} not found.</div>;
                        
                        const isGeneratingThisDeck = aiGenerationStatus.isGenerating && aiGenerationStatus.generatingDeckId === deck.id;
                        const canGenerateAI = aiFeaturesEnabled && isOrganizeMode && (deck.questions?.length || 0) === 0 && deck.type === DeckType.Quiz;

                        return (
                            <div key={deckId} className={`p-4 rounded-lg flex items-center justify-between transition-opacity ${isLocked ? 'opacity-50 bg-background' : 'bg-background'}`}>
                                <div className="flex items-center min-w-0">
                                    <div className={`mr-4 flex-shrink-0 ${isLocked ? 'text-text-muted' : isCompleted ? 'text-green-500' : 'text-primary'}`}>
                                        {isLocked ? <Icon name="lock" /> : isCompleted ? <Icon name="check-circle" /> : <Icon name="unlock" />}
                                    </div>
                                    <div className="min-w-0">
                                        <Link
                                            href={`/decks/${deck.id}?seriesId=${series.id}`}
                                            className={`font-bold truncate ${isLocked ? 'text-text-muted cursor-not-allowed' : 'text-text hover:underline hover:text-primary'}`}
                                            onClick={(e: React.MouseEvent) => {
                                                if (isLocked) {
                                                    e.preventDefault();
                                                    addToast('This deck is locked. Complete the previous deck to unlock it.', 'info');
                                                }
                                            }}
                                            aria-disabled={isLocked}
                                        >
                                            {deck.name}
                                        </Link>
                                        <p className="text-sm text-text-muted truncate">{deck.description}</p>
                                        <p className="text-xs text-text-muted mt-1 flex items-center">
                                            <Icon name={deck.type === DeckType.Learning ? "book-open" : "help-circle"} className="inline-block w-3.5 h-3.5 mr-1.5" />
                                            {deck.questions.length} questions
                                            {!isLocked && <span className="mx-1.5">&bull;</span>}
                                            {!isLocked && `${dueCount} due`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 ml-4 flex items-center gap-2">
                                    {isGeneratingThisDeck ? (
                                        <div className="flex items-center justify-center p-2 h-auto min-w-[6rem]">
                                            <Spinner size="sm"/>
                                        </div>
                                    ) : (
                                        <>
                                            {canGenerateAI && (
                                                <Button variant="ghost" size="sm" onClick={() => handleGenerateQuestionsForDeck(deck as QuizDeck)} disabled={aiGenerationStatus.isGenerating}>
                                                    <Icon name="zap" className="w-4 h-4 mr-1" /> Generate
                                                </Button>
                                            )}
                                            <Link href={`/decks/${deck.id}/study?seriesId=${series.id}`} passAs={Button} variant="secondary" size="sm" disabled={isLocked}>
                                                Study
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                {aiFeaturesEnabled && isOrganizeMode && (
                    <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddDecksToLevel(levelIndex)}
                            disabled={isAddingDecksToLevel === levelIndex || isAddingLevels || aiGenerationStatus.isGenerating}
                        >
                            {isAddingDecksToLevel === levelIndex ? <Spinner size="sm" /> : <Icon name="zap" className="w-4 h-4 mr-2" />}
                            Add Decks with AI
                        </Button>
                    </div>
                )}
              </div>
            )
        })}
        {aiFeaturesEnabled && isOrganizeMode && (
            <div className="mt-4 pt-4 flex justify-center">
              <Button
                variant="secondary"
                onClick={handleAddLevels}
                disabled={isAddingLevels || isAddingDecksToLevel !== null || aiGenerationStatus.isGenerating}
              >
                {isAddingLevels ? <Spinner size="sm" /> : <Icon name="zap" className="w-5 h-5 mr-2" />}
                Add Levels with AI
              </Button>
            </div>
        )}
      </div>

      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-red-400 dark:text-red-300 mb-2">Danger Zone</h3>
        <p className="text-red-500/80 dark:text-red-300/80 mb-4">Moving a series to the trash will also move all of its decks to the trash.</p>
        <Button variant="danger" onClick={handleDelete}><Icon name="trash-2" className="mr-2" /> Move to Trash</Button>
      </div>
    </div>
  );
};

export default SeriesOverviewPage;
