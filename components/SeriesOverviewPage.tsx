
import React, { useState, useEffect, useRef } from 'react';
import { Deck, DeckSeries, DeckType, FlashcardDeck, QuizDeck, LearningDeck, Reviewable, SeriesLevel } from '../types.ts';
import { useStore, useDecksList } from '../store/store.ts';
import { getEffectiveMasteryLevel, getDueItemsCount } from '../services/srs.ts';
// FIX: Changed to named import to match the updated export in DeckListItem.tsx.
import { DeckListItem } from './DeckListItem.tsx';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { stripHtml } from '../services/utils.ts';
import TruncatedText from './ui/TruncatedText.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import Spinner from './ui/Spinner.tsx';
import Link from './ui/Link.tsx';

interface SeriesOverviewPageProps {
  series: DeckSeries;
  sessionsToResume: Set<string>;
  onUpdateSeries: (series: DeckSeries, options?: { toastMessage?: string }) => void;
  onDeleteSeries: (seriesId: string) => void;
  onAddDeckToSeries: (seriesId: string, newDeck: QuizDeck) => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onStartSeriesStudy: (seriesId: string) => Promise<void>;
  onUpdateLastOpened: (seriesId: string) => void;
  openConfirmModal: (props: any) => void;
  onAiAddLevelsToSeries: (seriesId: string) => void;
  onAiAddDecksToLevel: (seriesId: string, levelIndex: number) => void;
  handleGenerateQuestionsForEmptyDecksInSeries: (seriesId: string) => void;
  handleGenerateQuestionsForDeck: (deck: QuizDeck) => void;
  onCancelAIGeneration: () => void;
  onExportSeries: (series: DeckSeries) => void;
  // FIX: Added missing properties to pass down to DeckListItem.
  onDeleteDeck: (deckId: string) => void;
  handleGenerateContentForLearningDeck: (deck: LearningDeck) => void;
  onGenerateDeckForLevel: (seriesId: string, levelIndex: number) => void;
  onAutoExpandSeries: (seriesId: string) => void;
}

const SeriesOverviewPage: React.FC<SeriesOverviewPageProps> = (props) => {
  const { series, sessionsToResume, onUpdateLastOpened, onUpdateDeck, onDeleteDeck, openConfirmModal, handleGenerateQuestionsForDeck, handleGenerateContentForLearningDeck, onUpdateSeries } = props;
  const decks = useDecksList();
  const { seriesProgress, aiGenerationStatus } = useStore();
  const { aiFeaturesEnabled } = useSettings();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(series.name);
  const [editedDescription, setEditedDescription] = useState(series.description);

  // Level editing state
  const [editingLevelIndex, setEditingLevelIndex] = useState<number | null>(null);
  const [tempLevelTitle, setTempLevelTitle] = useState('');
  const levelTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onUpdateLastOpened(series.id);
  }, [series.id, onUpdateLastOpened]);

  // Sync local state when series prop changes (e.g. from external update)
  useEffect(() => {
    if (!isEditing) {
        setEditedName(series.name);
        setEditedDescription(series.description);
    }
  }, [series, isEditing]);

  useEffect(() => {
      if (editingLevelIndex !== null && levelTitleInputRef.current) {
          levelTitleInputRef.current.focus();
          levelTitleInputRef.current.select();
      }
  }, [editingLevelIndex]);

  const handleSave = () => {
    if (!editedName.trim()) return;
    onUpdateSeries({ ...series, name: editedName, description: editedDescription }, { toastMessage: 'Series updated.' });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(series.name);
    setEditedDescription(series.description);
    setIsEditing(false);
  };

  // --- Level Management Handlers ---

  const handleStartRenameLevel = (index: number, title: string) => {
      setEditingLevelIndex(index);
      setTempLevelTitle(title);
  };

  const handleSaveLevelTitle = (index: number) => {
      if (tempLevelTitle.trim()) {
          const updatedLevels = [...(series.levels || [])];
          updatedLevels[index] = { ...updatedLevels[index], title: tempLevelTitle.trim() };
          onUpdateSeries({ ...series, levels: updatedLevels }, { toastMessage: 'Level renamed.' });
      }
      setEditingLevelIndex(null);
  };

  const handleAddLevel = () => {
      const newLevel: SeriesLevel = { title: `Level ${(series.levels || []).length + 1}: New Level`, deckIds: [] };
      const updatedLevels = [...(series.levels || []), newLevel];
      onUpdateSeries({ ...series, levels: updatedLevels }, { toastMessage: 'New level added.' });
      // Automatically start editing the new level
      setTimeout(() => {
          handleStartRenameLevel(updatedLevels.length - 1, newLevel.title);
          // Scroll to bottom to see new level (rough approximation)
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
  };

  const handleDeleteLevel = (index: number) => {
      const level = series.levels[index];
      const hasDecks = level.deckIds && level.deckIds.length > 0;
      
      const doDelete = () => {
          const updatedLevels = [...series.levels];
          updatedLevels.splice(index, 1);
          onUpdateSeries({ ...series, levels: updatedLevels }, { toastMessage: 'Level deleted.' });
      };

      if (hasDecks) {
          openConfirmModal({
              title: 'Delete Level',
              message: `Are you sure you want to delete "${level.title}"? The ${level.deckIds.length} deck(s) inside will remain in your library but will be removed from this series.`,
              onConfirm: doDelete
          });
      } else {
          doDelete();
      }
  };

  const handleMoveLevel = (index: number, direction: 'up' | 'down') => {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === series.levels.length - 1)) return;
      
      const updatedLevels = [...series.levels];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      [updatedLevels[index], updatedLevels[targetIndex]] = [updatedLevels[targetIndex], updatedLevels[index]];
      onUpdateSeries({ ...series, levels: updatedLevels });
  };

  const handleRemoveDeckFromLevel = (levelIndex: number, deckId: string) => {
      const updatedLevels = [...series.levels];
      const level = updatedLevels[levelIndex];
      updatedLevels[levelIndex] = {
          ...level,
          deckIds: level.deckIds.filter(id => id !== deckId)
      };
      onUpdateSeries({ ...series, levels: updatedLevels }, { toastMessage: 'Deck removed from series.' });
  };

  // --- End Level Management ---

  const { dueCount, nextUpDeckId, isCompleted, completedCount, totalCount } = React.useMemo(() => {
    const seriesDecks = (series.levels || []).flatMap(l => l?.deckIds || []).map(id => decks.find(d => d.id === id)).filter((d): d is Deck => !!d);
    
    const completedDeckIds = seriesProgress.get(series.id) || new Set<string>();
    const completedCount = completedDeckIds.size;
    
    const flatDeckIds = (series.levels || []).flatMap(l => l?.deckIds || []);
    const totalCount = flatDeckIds.length;

    const unlockedDeckIds = new Set<string>();
    flatDeckIds.forEach((deckId, index) => {
        // A deck is unlocked if it's the next one up, or has been completed.
        if (index <= completedCount) {
            unlockedDeckIds.add(deckId);
        }
    });

    const dueCount = seriesDecks.reduce((total, deck) => {
        if (unlockedDeckIds.has(deck.id)) {
            return total + getDueItemsCount(deck);
        }
        return total;
    }, 0);

    const nextUpDeckId = flatDeckIds.find(id => !completedDeckIds.has(id)) || null;

    const isCompleted = totalCount > 0 && completedCount >= totalCount;

    return { dueCount, nextUpDeckId, isCompleted, completedCount, totalCount };
  }, [series, decks, seriesProgress]);
  
  const hasEmptyDecks = React.useMemo(() => {
    const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
    const seriesDecks = decks.filter(d => seriesDeckIds.has(d.id));
    return seriesDecks.some(d => (d.type === DeckType.Quiz || d.type === DeckType.Learning) && (d.questions?.length || 0) === 0);
  }, [series.levels, decks]);
  
  const isGeneratingThisSeries = aiGenerationStatus.currentTask?.seriesId === series.id;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8 pb-10">
      <div className="bg-surface rounded-lg shadow-md p-6 border border-border">
        {isEditing ? (
            <div className="space-y-4 animate-fade-in">
                <div>
                    <label htmlFor="series-name-edit" className="block text-sm font-medium text-text-muted mb-1">Series Name</label>
                    <input 
                        id="series-name-edit"
                        type="text" 
                        value={editedName} 
                        onChange={(e) => setEditedName(e.target.value)} 
                        className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-2xl font-bold"
                        autoFocus
                    />
                </div>
                <div>
                    <label htmlFor="series-desc-edit" className="block text-sm font-medium text-text-muted mb-1">Description</label>
                    <textarea 
                        id="series-desc-edit"
                        value={editedDescription} 
                        onChange={(e) => setEditedDescription(e.target.value)} 
                        rows={3}
                        className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                </div>
                <div className="flex justify-start gap-2 pt-2">
                    <Button onClick={handleSave}><Icon name="save" className="mr-2" /> Save Changes</Button>
                    <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                </div>
            </div>
        ) : (
            <div>
                <h2 className="text-3xl font-bold mb-2 text-text break-words">{series.name}</h2>
                {series.description && <TruncatedText html={series.description} className="text-text-muted prose dark:prose-invert max-w-none" />}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Button variant="ghost" onClick={() => setIsEditing(true)}><Icon name="edit" className="mr-2"/> Edit</Button>
                    {aiFeaturesEnabled && (
                        <Button variant="ghost" onClick={() => props.onAutoExpandSeries(series.id)}>
                            <Icon name="layers" className="w-4 h-4 mr-2" /> Auto-Expand Series
                        </Button>
                    )}
                    <Button variant="ghost" onClick={() => props.onExportSeries(series)}><Icon name="download" className="mr-2"/> Export</Button>
                    <Button variant="ghost" onClick={() => props.onDeleteSeries(series.id)}><Icon name="trash-2" className="mr-2"/> Move to Trash</Button>
                    {aiFeaturesEnabled && hasEmptyDecks && (
                    <Button
                        variant="secondary"
                        onClick={() => props.handleGenerateQuestionsForEmptyDecksInSeries(series.id)}
                        disabled={isGeneratingThisSeries}
                    >
                        {isGeneratingThisSeries ? <span className="mr-2"><Spinner size="sm" /></span> : <Icon name="zap" className="w-4 h-4 mr-2" />}
                        {isGeneratingThisSeries ? 'Generating...' : 'Generate All Questions'}
                    </Button>
                    )}
                </div>
            </div>
        )}
      </div>
      
      {(dueCount > 0 || nextUpDeckId || isCompleted) && (
        <div className="border-t border-border pt-6 flex flex-wrap items-center justify-center gap-4">
          {!isCompleted && nextUpDeckId && (
            <Link
              href={`/decks/${nextUpDeckId}/study?seriesId=${series.id}`}
              passAs={Button}
              variant="primary"
              size="lg"
              className="font-semibold w-full sm:w-auto"
            >
              <Icon name="zap" className="w-5 h-5 mr-2" />
              {completedCount > 0 ? 'Continue Series' : 'Start Series'}
            </Link>
          )}
          {dueCount > 0 && (
            <Button
              variant={!isCompleted && nextUpDeckId ? 'secondary' : 'primary'}
              size="lg"
              onClick={() => props.onStartSeriesStudy(series.id)}
              className="font-semibold w-full sm:w-auto"
            >
              <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
              Study Due ({dueCount})
            </Button>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2 text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-4 py-2 rounded-full">
              <Icon name="check-circle" className="w-6 h-6" />
              <span className="text-lg font-semibold">Series Completed!</span>
            </div>
          )}
        </div>
      )}


      <div className="space-y-8">
        {(series.levels || []).map((level, index) => (
          <div key={index} className="bg-surface/30 rounded-xl p-4 border border-border/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-border pb-2 gap-2">
                {editingLevelIndex === index ? (
                    <div className="flex-grow flex items-center gap-2 w-full sm:w-auto">
                        <input
                            ref={levelTitleInputRef}
                            type="text"
                            value={tempLevelTitle}
                            onChange={(e) => setTempLevelTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveLevelTitle(index);
                                if (e.key === 'Escape') setEditingLevelIndex(null);
                            }}
                            className="flex-grow p-1 bg-background border border-border rounded focus:ring-2 focus:ring-primary focus:outline-none font-semibold text-lg"
                        />
                        <Button size="sm" variant="primary" onClick={() => handleSaveLevelTitle(index)}><Icon name="check-circle" className="w-4 h-4"/></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingLevelIndex(null)}><Icon name="x" className="w-4 h-4"/></Button>
                    </div>
                ) : (
                    <h3 className="text-xl font-semibold text-text flex-grow cursor-pointer hover:text-primary transition-colors" onClick={() => handleStartRenameLevel(index, level.title)}>
                        {level.title}
                    </h3>
                )}
                
                <div className="flex items-center gap-1 self-end sm:self-auto">
                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => handleMoveLevel(index, 'up')} disabled={index === 0} title="Move Up">
                        <Icon name="chevron-down" className="w-4 h-4 rotate-180" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => handleMoveLevel(index, 'down')} disabled={index === (series.levels || []).length - 1} title="Move Down">
                        <Icon name="chevron-down" className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => handleStartRenameLevel(index, level.title)} title="Rename Level">
                        <Icon name="edit" className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1 h-auto hover:text-red-500" onClick={() => handleDeleteLevel(index)} title="Delete Level">
                        <Icon name="trash-2" className="w-4 h-4" />
                    </Button>
                    
                    {aiFeaturesEnabled && (
                        <div className="flex gap-1 ml-2 border-l border-border pl-2">
                            <Button variant="ghost" size="sm" onClick={() => props.onAiAddDecksToLevel(series.id, index)} title="AI: Add Empty Decks">
                                <Icon name="plus" className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => props.onGenerateDeckForLevel(series.id, index)} title="AI: Generate Deck">
                                <Icon name="zap" className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <div className="space-y-4">
              {level.deckIds.map(deckId => {
                const deck = decks.find(d => d.id === deckId);
                if (!deck) return <div key={deckId} className="p-4 bg-red-100 text-red-800 rounded-md flex justify-between items-center">
                    <span>Deck with ID "{deckId}" not found.</span>
                    <Button size="sm" variant="ghost" className="text-red-800 hover:bg-red-200" onClick={() => handleRemoveDeckFromLevel(index, deckId)}>Remove</Button>
                </div>;
                
                return (
                  <DeckListItem
                    key={deck.id}
                    deck={deck}
                    sessionsToResume={sessionsToResume}
                    onUpdateLastOpened={() => onUpdateLastOpened(series.id)}
                    draggedDeckId={null}
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                    onUpdateDeck={onUpdateDeck}
                    onDeleteDeck={onDeleteDeck}
                    openConfirmModal={openConfirmModal}
                    handleGenerateQuestionsForDeck={handleGenerateQuestionsForDeck as any}
                    handleGenerateContentForLearningDeck={handleGenerateContentForLearningDeck as any}
                    onRemoveFromSeries={() => handleRemoveDeckFromLevel(index, deck.id)}
                  />
                );
              })}
              {(level.deckIds || []).length === 0 && (
                  <div className="text-center p-4 border-2 border-dashed border-border rounded-lg text-text-muted text-sm">
                      No decks in this level.
                  </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center pt-8 pb-8 gap-4 border-t border-border mt-8">
        <Button onClick={handleAddLevel} variant="secondary" className="w-full sm:w-auto">
            <Icon name="plus" className="w-5 h-5 mr-2" />
            Add New Level
        </Button>
        
        {aiFeaturesEnabled && (
            <Button variant="ghost" onClick={() => props.onAiAddLevelsToSeries(series.id)} className="text-sm">
                <Icon name="layers" className="w-4 h-4 mr-2" />
                AI: Generate Next Level
            </Button>
        )}
      </div>
    </div>
  );
};

export default SeriesOverviewPage;
