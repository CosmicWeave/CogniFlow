
import React, { useState, useEffect, useRef } from 'react';
import { Deck, DeckSeries, DeckType, FlashcardDeck, QuizDeck, LearningDeck, Reviewable, SeriesLevel } from '../types.ts';
import { useStore, useDecksList } from '../store/store.ts';
import { getEffectiveMasteryLevel, getDueItemsCount } from '../services/srs.ts';
import { DeckListItem } from './DeckListItem.tsx';
import Button from './ui/Button.tsx';
import Icon, { IconName } from './ui/Icon.tsx';
import { stripHtml } from '../services/utils.ts';
import TruncatedText from './ui/TruncatedText.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import Spinner from './ui/Spinner.tsx';
import Link from './ui/Link.tsx';
import { generateMetadata } from '../services/aiService.ts';
// FIX: Imported useToast hook.
import { useToast } from '../hooks/useToast.ts';

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
  onDeleteDeck: (deckId: string) => void;
  handleGenerateContentForLearningDeck: (deck: LearningDeck) => void;
  onGenerateDeckForLevel: (seriesId: string, levelIndex: number) => void;
  onAutoExpandSeries: (seriesId: string) => void;
}

const QuickStatCard = ({ icon, label, value, subtext, color = "primary" }: { icon: IconName, label: string, value: string | number, subtext?: string, color?: string }) => (
    <div className="bg-surface p-4 rounded-lg shadow-sm border border-border flex items-center gap-4">
        <div className={`p-3 rounded-full bg-${color}/10 text-${color}`}>
            <Icon name={icon} className="w-6 h-6" />
        </div>
        <div>
            <p className="text-sm font-medium text-text-muted">{label}</p>
            <p className="text-xl sm:text-2xl font-bold text-text">{value}</p>
            {subtext && <p className="text-xs text-text-muted mt-0.5">{subtext}</p>}
        </div>
    </div>
);

const SeriesOverviewPage: React.FC<SeriesOverviewPageProps> = (props) => {
  const { series, sessionsToResume, onUpdateLastOpened, onUpdateDeck, onDeleteDeck, openConfirmModal, handleGenerateQuestionsForDeck, handleGenerateContentForLearningDeck, onUpdateSeries } = props;
  const decks = useDecksList();
  const { seriesProgress, aiGenerationStatus } = useStore();
  const { aiFeaturesEnabled } = useSettings();
  // FIX: Obtained addToast from the useToast hook.
  const { addToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(series.name);
  const [editedDescription, setEditedDescription] = useState(series.description);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Level editing state
  const [editingLevelIndex, setEditingLevelIndex] = useState<number | null>(null);
  const [tempLevelTitle, setTempLevelTitle] = useState('');
  const levelTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onUpdateLastOpened(series.id);
  }, [series.id, onUpdateLastOpened]);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsMenuOpen(false);
        }
    };
    if (isMenuOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

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

  const handleAutoMetadata = async () => {
    const seriesDecks = (series.levels || []).flatMap(l => l?.deckIds || []).map(id => decks.find(d => d.id === id)).filter(Boolean);
    if (seriesDecks.length === 0) {
        // FIX: addToast is now correctly accessible.
        addToast("Add some decks to this series first so the AI has context.", "info");
        return;
    }
    setIsGeneratingMetadata(true);
    try {
        const textContext = seriesDecks.map(d => `${d?.name}: ${stripHtml(d?.description)}`).join('\n');
        const { name, description } = await generateMetadata(textContext, 'series');
        setEditedName(name);
        setEditedDescription(description);
        // FIX: addToast is now correctly accessible.
        addToast("Details generated!", "success");
    } catch (e) {
        // FIX: addToast is now correctly accessible.
        addToast("Failed to generate details.", "error");
    } finally {
        setIsGeneratingMetadata(false);
    }
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
      setTimeout(() => {
          handleStartRenameLevel(updatedLevels.length - 1, newLevel.title);
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

  const { dueCount, nextUpDeckId, isCompleted, completedCount, totalCount } = React.useMemo(() => {
    const seriesDecks = (series.levels || []).flatMap(l => l?.deckIds || []).map(id => decks.find(d => d.id === id)).filter((d): d is Deck => !!d);
    
    const completedDeckIds = seriesProgress.get(series.id) || new Set<string>();
    const completedCount = completedDeckIds.size;
    
    const flatDeckIds = (series.levels || []).flatMap(l => l?.deckIds || []);
    const totalCount = flatDeckIds.length;

    const unlockedDeckIds = new Set<string>();
    flatDeckIds.forEach((deckId, index) => {
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
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6 pb-20">
      
      {/* Hero Header Section */}
      <div className={`bg-surface rounded-xl shadow-sm border border-border ${isEditing ? 'overflow-hidden' : ''}`}>
        {isEditing ? (
            <div className="p-6 space-y-4 animate-fade-in bg-background/50">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-text">Edit Series Details</h2>
                    {aiFeaturesEnabled && (
                        <Button variant="ghost" size="sm" onClick={handleAutoMetadata} disabled={isGeneratingMetadata} className="text-primary hover:text-primary-hover">
                            {isGeneratingMetadata ? <Spinner size="sm" /> : <Icon name="bot" className="w-4 h-4 mr-2" />}
                            Auto-generate with AI
                        </Button>
                    )}
                </div>
                <div>
                    <label htmlFor="series-name-edit" className="block text-sm font-medium text-text-muted mb-1">Series Name</label>
                    <input 
                        id="series-name-edit"
                        type="text" 
                        value={editedName} 
                        onChange={(e) => setEditedName(e.target.value)} 
                        className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-xl font-bold"
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
                <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
                    <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                    <Button onClick={handleSave}><Icon name="save" className="mr-2" /> Save Changes</Button>
                </div>
            </div>
        ) : (
            <div className="p-6 md:p-8 flex items-start justify-between gap-4 relative">
                <div className="flex-1 min-w-0 pr-10 md:pr-0">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl flex-shrink-0 hidden sm:block">
                            <Icon name="layers" className="w-8 h-8 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">
                                <span>Learning Series</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-text break-words leading-tight">{series.name}</h1>
                            {series.description && (
                                <div className="mt-2 text-text-muted">
                                    <TruncatedText html={series.description} className="prose prose-sm dark:prose-invert max-w-none text-text-muted leading-relaxed" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="absolute top-6 right-6 md:static md:flex-shrink-0 md:self-start" ref={menuRef}>
                    <Button variant="ghost" onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full hover:bg-border/50">
                        <Icon name="more-vertical" className="w-6 h-6 text-text-muted" />
                    </Button>
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-surface rounded-lg shadow-xl border border-border z-30 py-1 animate-fade-in origin-top-right">
                            <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                                <Icon name="edit" className="w-4 h-4 mr-3" /> Edit Details
                            </button>
                            {aiFeaturesEnabled && (
                                <>
                                    <button onClick={() => { props.onAutoExpandSeries(series.id); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                                        <Icon name="layers" className="w-4 h-4 mr-3" /> Auto-Expand Series
                                    </button>
                                    <button onClick={() => { props.onAiAddLevelsToSeries(series.id); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                                        <Icon name="plus" className="w-4 h-4 mr-3" /> Generate Next Level
                                    </button>
                                </>
                            )}
                            {aiFeaturesEnabled && hasEmptyDecks && (
                                <button onClick={() => { props.handleGenerateQuestionsForEmptyDecksInSeries(series.id); setIsMenuOpen(false); }} disabled={isGeneratingThisSeries} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors disabled:opacity-50">
                                    <Icon name="zap" className="w-4 h-4 mr-3" /> {isGeneratingThisSeries ? 'Generating...' : 'Generate All Questions'}
                                </button>
                            )}
                            <button onClick={() => { props.onExportSeries(series); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                                <Icon name="download" className="w-4 h-4 mr-3" /> Export JSON
                            </button>
                            <div className="my-1 border-t border-border"></div>
                            <button onClick={() => { props.onDeleteSeries(series.id); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Icon name="trash-2" className="w-4 h-4 mr-3" /> Move to Trash
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* Primary Action Area */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-6 bg-primary/5 rounded-xl border border-primary/10">
          <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold text-text mb-1">
                  {isCompleted ? "Series Completed!" : (nextUpDeckId ? "Ready to continue learning?" : "Start this series.")}
              </h3>
              <p className="text-sm text-text-muted">
                  {isCompleted ? "Great job! Review due items to maintain mastery." : (nextUpDeckId ? "Pick up where you left off." : "Begin the first level.")}
              </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center md:justify-end w-full md:w-auto">
              {!isCompleted && nextUpDeckId && (
                <Link
                  href={`/decks/${nextUpDeckId}/study?seriesId=${series.id}`}
                  passAs={Button}
                  variant="primary"
                  size="lg"
                  className="font-bold px-8 shadow-md flex-1 md:flex-none"
                >
                  <Icon name="zap" className="w-5 h-5 mr-2" />
                  {completedCount > 0 ? 'Continue' : 'Start Series'}
                </Link>
              )}
              {dueCount > 0 && (
                <Button
                  variant={!isCompleted && nextUpDeckId ? 'secondary' : 'primary'}
                  size="lg"
                  onClick={() => props.onStartSeriesStudy(series.id)}
                  className="font-bold flex-1 md:flex-none"
                >
                  <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
                  Study Due ({dueCount})
                </Button>
              )}
          </div>
      </div>

      {/* Dashboard Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
           <QuickStatCard icon="layers" label="Total Decks" value={totalCount} color="blue" />
           <QuickStatCard icon="check-circle" label="Progress" value={`${completedCount}/${totalCount}`} subtext={`${Math.round((completedCount / (totalCount || 1)) * 100)}% Complete`} color="green" />
           <QuickStatCard icon="zap" label="Due Today" value={dueCount} color="orange" />
      </div>

      {/* Levels List */}
      <div className="space-y-6 sm:space-y-8 mt-4 sm:mt-8">
        {(series.levels || []).map((level, index) => (
          <div key={index} className="bg-surface rounded-xl p-4 border border-border shadow-sm">
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
                    <h3 className="text-xl font-bold text-text flex-grow cursor-pointer hover:text-primary transition-colors" onClick={() => handleStartRenameLevel(index, level.title)}>
                        {level.title}
                    </h3>
                )}
                
                <div className="flex items-center gap-1 self-end sm:self-auto">
                    <Button variant="ghost" size="sm" className="p-1 h-auto text-text-muted hover:text-text" onClick={() => handleMoveLevel(index, 'up')} disabled={index === 0} title="Move Up">
                        <Icon name="chevron-down" className="w-4 h-4 rotate-180" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1 h-auto text-text-muted hover:text-text" onClick={() => handleMoveLevel(index, 'down')} disabled={index === (series.levels || []).length - 1} title="Move Down">
                        <Icon name="chevron-down" className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1 h-auto text-text-muted hover:text-text" onClick={() => handleStartRenameLevel(index, level.title)} title="Rename Level">
                        <Icon name="edit" className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1 h-auto text-text-muted hover:text-red-500" onClick={() => handleDeleteLevel(index)} title="Delete Level">
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
                  <div className="text-center p-8 border-2 border-dashed border-border rounded-lg text-text-muted text-sm">
                      <Icon name="folder" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No decks in this level yet.
                  </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-8 border-t border-border">
        <Button onClick={handleAddLevel} variant="secondary" className="w-full sm:w-auto">
            <Icon name="plus" className="w-5 h-5 mr-2" />
            Add New Level
        </Button>
      </div>
    </div>
  );
};

export default SeriesOverviewPage;
