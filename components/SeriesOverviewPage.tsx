
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DeckSeries, QuizDeck, Question } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Link from './ui/Link';
import AddDeckToSeriesModal from './AddDeckToSeriesModal';
import EditSeriesModal from './EditSeriesModal';
import BulkAddModal from './BulkAddModal';
import { useRouter } from '../contexts/RouterContext';
import MasteryBar from './ui/MasteryBar';
import ProgressBar from './ui/ProgressBar';
import { getEffectiveMasteryLevel } from '../services/srs';
import { useStore } from '../store/store';

interface SeriesOverviewPageProps {
  series: DeckSeries;
  completedDeckIds: Set<string>;
  sessionsToResume: Set<string>;
  onUpdateSeries: (updatedSeries: DeckSeries) => void;
  onDeleteSeries: (seriesId: string) => void;
  onAddDeckToSeries: (seriesId: string, newDeck: QuizDeck) => void;
  onUpdateDeck: (updatedDeck: QuizDeck) => void;
  onStartSeriesStudy: (seriesId: string) => void;
  openConfirmModal: (props: any) => void;
}

const getDueItemsCount = (deck: QuizDeck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return deck.questions.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

const DropIndicator = () => (
    <div className="h-16 my-2 -ml-4" aria-hidden="true">
        <div className="h-full w-full rounded-md bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center">
            <Icon name="arrow-down" className="w-5 h-5 text-primary animate-bounce" />
            <span className="ml-2 font-medium text-primary">Move Here</span>
        </div>
    </div>
);

const SeriesOverviewPage: React.FC<SeriesOverviewPageProps> = ({
  series,
  completedDeckIds,
  sessionsToResume,
  onUpdateSeries,
  onDeleteSeries,
  onAddDeckToSeries,
  onUpdateDeck,
  onStartSeriesStudy,
  openConfirmModal
}) => {
  const { navigate } = useRouter();
  
  const initialEditMode = useMemo(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    return params.get('edit') === 'true';
  }, []);

  const [isOrganizing, setIsOrganizing] = useState(initialEditMode);
  const [isAddDeckModalOpen, setIsAddDeckModalOpen] = useState(false);
  const [isEditSeriesModalOpen, setIsEditSeriesModalOpen] = useState(false);
  const [deckForBulkAdd, setDeckForBulkAdd] = useState<QuizDeck | null>(null);
  const [editingLevel, setEditingLevel] = useState<{ index: number; name: string } | null>(null);

  const allDecks = useStore(state => state.decks);
  
  const decks = useMemo(() => {
    const deckIdsInSeries = new Set(series.levels.flatMap(l => l.deckIds));
    return allDecks.filter(d => deckIdsInSeries.has(d.id)) as QuizDeck[];
  }, [series, allDecks]);

  const [draggedItem, setDraggedItem] = useState<{ type: 'level' | 'deck', sourceLevelIndex: number, deckId?: string } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ levelIndex: number, deckIndex?: number | null } | null>(null);

  const flatDeckIdsInOrder = useMemo(() => series.levels.flatMap(l => l.deckIds), [series.levels]);
  const totalDecksInSeries = flatDeckIdsInOrder.length;

  const nextUpDeckId = useMemo(() => {
      return flatDeckIdsInOrder.find(id => !completedDeckIds.has(id)) || null;
  }, [flatDeckIdsInOrder, completedDeckIds]);


  useEffect(() => {
    if (initialEditMode) {
        navigate(`/series/${series.id}`);
    }
  }, [initialEditMode, navigate, series.id]);

  useEffect(() => {
    if (series.archived || series.deletedAt) {
      navigate('/');
    }
  }, [series.archived, series.deletedAt, navigate]);

  const totalDueInSeries = useMemo(() => {
    return decks.reduce((total, deck) => {
        if (flatDeckIdsInOrder.indexOf(deck.id) <= completedDeckIds.size) { // is unlocked
            return total + getDueItemsCount(deck);
        }
        return total;
    }, 0);
  }, [decks, completedDeckIds, flatDeckIdsInOrder]);

  const seriesMastery = useMemo(() => {
    const allItems = decks.flatMap(d => d.questions).filter(q => !q.suspended);
    if (allItems.length === 0) return 0;
    const totalMastery = allItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0);
    return totalMastery / allItems.length;
  }, [decks]);
  
  const handleRemoveDeck = (deckId: string, deckName: string) => {
    openConfirmModal({
        title: "Remove Deck from Series",
        message: `Are you sure you want to remove "${deckName}" from this series? The deck itself will not be deleted.`,
        onConfirm: () => {
            const updatedLevels = series.levels.map(level => ({
                ...level,
                deckIds: level.deckIds.filter(id => id !== deckId)
            })).filter(level => level.deckIds.length > 0 || isOrganizing);
            onUpdateSeries({ ...series, levels: updatedLevels });
        }
    });
  };
  
  const handleDeleteSeries = () => {
    openConfirmModal({
        title: "Move Series to Trash",
        message: `Are you sure you want to move the series "${series.name}" to the trash? All ${decks.length} deck(s) inside this series will also be moved to the trash.`,
        onConfirm: () => onDeleteSeries(series.id)
    });
  };

  const handleAddLevel = () => {
    const newLevel = { title: 'New Level', deckIds: [] };
    onUpdateSeries({ ...series, levels: [...series.levels, newLevel] });
  };
  
  const handleUpdateLevelName = (levelIndex: number) => {
    if (!editingLevel || editingLevel.name.trim() === '') return;
    const newLevels = [...series.levels];
    newLevels[levelIndex].title = editingLevel.name.trim();
    onUpdateSeries({ ...series, levels: newLevels });
    setEditingLevel(null);
  };
  
  const handleDragStart = (e: React.DragEvent, type: 'level' | 'deck', sourceLevelIndex: number, deckId?: string) => {
    if (!isOrganizing) return;
    
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', deckId || `level-${sourceLevelIndex}`); } catch(e) {}
    
    // Defer state update to allow browser to capture clean drag image
    setTimeout(() => {
      setDraggedItem({ type, sourceLevelIndex, deckId });
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, levelIndex: number, deckIndex?: number) => {
    if (!isOrganizing || !draggedItem) return;
    e.preventDefault();
    if (draggedItem.type === 'level') {
        setDropIndicator({ levelIndex: levelIndex, deckIndex: null });
    } else if (draggedItem.type === 'deck') {
        setDropIndicator({ levelIndex: levelIndex, deckIndex: deckIndex });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isOrganizing || !draggedItem || !dropIndicator) return;
    e.preventDefault();

    const { type: draggedType, sourceLevelIndex, deckId: draggedDeckId } = draggedItem;
    let { levelIndex: targetLevelIndex, deckIndex: targetDeckIndex } = dropIndicator;
    
    const newLevels = JSON.parse(JSON.stringify(series.levels));

    if (draggedType === 'level') {
        if (targetDeckIndex !== null) return;
        if (sourceLevelIndex === targetLevelIndex) return;
        const [movedLevel] = newLevels.splice(sourceLevelIndex, 1);
        const effectiveTargetIndex = sourceLevelIndex < targetLevelIndex ? targetLevelIndex - 1 : targetLevelIndex;
        newLevels.splice(effectiveTargetIndex, 0, movedLevel);
    } else if (draggedType === 'deck' && draggedDeckId) {
        newLevels[sourceLevelIndex].deckIds = newLevels[sourceLevelIndex].deckIds.filter((id: string) => id !== draggedDeckId);
        newLevels[targetLevelIndex].deckIds.splice(targetDeckIndex!, 0, draggedDeckId);
    }
    
    onUpdateSeries({ ...series, levels: newLevels.filter(l => l.deckIds.length > 0) });
    setDraggedItem(null);
    setDropIndicator(null);
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropIndicator(null);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <div className="bg-surface rounded-lg shadow-md p-6 border border-border">
        <div className="mb-4">
          <h2 className="text-3xl font-bold text-text break-words">{series.name}</h2>
          {series.description && <p className="text-text-muted mt-1">{series.description}</p>}
        </div>
         <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 items-center">
            <div>
              <div className="text-sm font-semibold text-text-muted flex justify-between">
                  <span>Overall Mastery</span>
                  <span>{Math.round(seriesMastery * 100)}%</span>
              </div>
              <MasteryBar level={seriesMastery} />
            </div>
            <div>
              <div className="text-sm font-semibold text-text-muted flex justify-between">
                  <span>Completion</span>
                  <span>{completedDeckIds.size} / {totalDecksInSeries}</span>
              </div>
              <ProgressBar current={completedDeckIds.size} total={totalDecksInSeries} />
            </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center mt-6 border-t border-border pt-6">
            <Button variant="primary" onClick={() => onStartSeriesStudy(series.id)} disabled={totalDueInSeries === 0}>
                <Icon name="zap" className="mr-2"/> Study All Due ({totalDueInSeries})
            </Button>
            <Button variant="ghost" onClick={() => setIsOrganizing(!isOrganizing)}>
              <Icon name={isOrganizing ? 'x-circle' : 'edit'} className="mr-2"/> {isOrganizing ? 'Finish Organizing' : 'Organize Series'}
            </Button>
            <Button variant="ghost" onClick={() => onUpdateSeries({ ...series, archived: true })}>
                <Icon name="archive" className="mr-2" /> Archive
            </Button>
            {isOrganizing && (
                <>
                    <div className="w-full border-t border-border/50 my-2 md:hidden"></div>
                    <Button variant="secondary" onClick={() => setIsEditSeriesModalOpen(true)}>
                        <Icon name="edit" className="mr-2" /> Edit Info
                    </Button>
                    <Button variant="danger" onClick={handleDeleteSeries}>
                        <Icon name="trash-2" className="mr-2" /> Move to Trash
                    </Button>
                </>
            )}
        </div>
      </div>
      
      <div className="relative pl-4" onDrop={handleDrop} onDragOver={e => e.preventDefault()} onDragEnd={handleDragEnd}>
        <div className="absolute top-0 bottom-0 left-8 w-0.5 bg-border -z-10"></div>
        <div className="space-y-2">
            {isOrganizing && dropIndicator?.levelIndex === 0 && dropIndicator.deckIndex === null && <DropIndicator />}
            {series.levels.map((level, levelIndex) => (
                <div key={`${level.title}-${levelIndex}`} onDragOver={e => isOrganizing && handleDragOver(e, levelIndex, 0)}>
                    <div
                        draggable={isOrganizing}
                        onDragStart={e => handleDragStart(e, 'level', levelIndex)}
                        className={`flex items-center group transition-opacity -ml-4 pl-4 ${isOrganizing ? 'cursor-grab' : ''} ${draggedItem?.type === 'level' && draggedItem.sourceLevelIndex === levelIndex ? 'opacity-20' : ''}`}
                    >
                        <div className="w-8 flex-shrink-0"></div>
                        <div className="flex-grow py-4">
                            {editingLevel?.index === levelIndex ? (
                                <input
                                    type="text"
                                    value={editingLevel.name}
                                    onChange={e => setEditingLevel({ ...editingLevel, name: e.target.value })}
                                    onBlur={() => handleUpdateLevelName(levelIndex)}
                                    onKeyDown={e => e.key === 'Enter' && handleUpdateLevelName(levelIndex)}
                                    className="text-2xl font-bold bg-background/50 border-b-2 border-primary focus:outline-none"
                                    autoFocus
                                />
                            ) : (
                                <h3 className="text-2xl font-bold text-text">{level.title}</h3>
                            )}
                        </div>
                         {isOrganizing && (
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" className="p-2 h-auto" onClick={() => setEditingLevel({ index: levelIndex, name: level.title })}>
                                    <Icon name="edit" className="w-4 h-4" />
                                </Button>
                                <div className="p-2 text-text-muted/60">
                                    <Icon name="grip-vertical" />
                                </div>
                            </div>
                        )}
                    </div>
                    {isOrganizing && dropIndicator?.levelIndex === levelIndex && dropIndicator.deckIndex === 0 && <DropIndicator />}

                    <div className="space-y-2">
                        {level.deckIds.map((deckId, deckIndex) => {
                            const deck = decks.find(d => d.id === deckId);
                            if (!deck) return null;

                            const isCompleted = completedDeckIds.has(deckId);
                            const isNextUp = nextUpDeckId === deck.id;
                            const isLocked = !completedDeckIds.has(deckId) && nextUpDeckId !== deckId;
                            const dueCount = getDueItemsCount(deck);

                            const status = isLocked ? 'locked' : (isCompleted ? 'completed' : (isNextUp ? 'next' : 'unlocked'));
                            const lineClass = isCompleted || isNextUp ? 'bg-primary' : 'bg-border';
                            
                            const nodeIcon = {
                                locked: <Icon name="lock" className="w-3 h-3 text-text-muted" />,
                                completed: <Icon name="check-circle" className="w-5 h-5 text-white bg-green-500 rounded-full" />,
                                next: <div className="w-3 h-3 bg-primary rounded-full ring-4 ring-primary/30"></div>,
                                unlocked: <div className="w-3 h-3 bg-border rounded-full"></div>
                            };

                            return (
                                <div key={deck.id}>
                                <div
                                    onDragOver={e => isOrganizing && handleDragOver(e, levelIndex, deckIndex)}
                                    className="relative flex items-center gap-4"
                                >
                                    <div className="absolute top-0 bottom-0 left-8 w-0.5 -z-10">
                                        <div className={`h-1/2 w-full ${deckIndex > 0 ? lineClass : ''}`}></div>
                                        <div className={`h-1/2 w-full ${deckIndex < level.deckIds.length -1 ? lineClass : ''}`}></div>
                                    </div>
                                    <div className="absolute left-8 -translate-x-1/2 h-8 w-8 rounded-full bg-surface flex items-center justify-center">
                                        {nodeIcon[status]}
                                    </div>
                                    <div className="w-8 flex-shrink-0"></div>
                                    
                                    <div
                                        draggable={isOrganizing}
                                        onDragStart={e => handleDragStart(e, 'deck', levelIndex, deck.id)}
                                        className={`flex-grow my-4 bg-surface rounded-lg shadow-md border hover:shadow-lg transition-all ${status === 'next' ? 'border-primary' : 'border-border'} ${status === 'locked' && !isOrganizing ? 'opacity-60' : ''} ${draggedItem?.deckId === deckId ? 'border-2 border-dashed border-border bg-background/50' : ''}`}
                                    >
                                        <div className={`p-4 flex items-center justify-between gap-2 ${draggedItem?.deckId === deckId ? 'opacity-0' : ''}`}>
                                            <div className="flex-grow min-w-0">
                                                <Link href={`/decks/${deck.id}?seriesId=${series.id}`} className="font-bold text-text break-words hover:text-primary transition-colors">{deck.name}</Link>
                                                <div className="text-sm text-text-muted">{deck.questions.length} questions</div>
                                            </div>
                                            <div className="flex-shrink-0 flex items-center gap-1">
                                                {isOrganizing ? (
                                                    <div className="flex items-center">
                                                        <Button variant="ghost" size="sm" className="p-2 h-auto text-red-500" onClick={() => handleRemoveDeck(deck.id, deck.name)}>
                                                            <Icon name="x" />
                                                        </Button>
                                                        <div className="cursor-grab p-2 text-text-muted/60">
                                                            <Icon name="grip-vertical"/>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Link href={`/decks/${deck.id}/study?seriesId=${series.id}`} passAs={Button} variant="secondary" size="sm" disabled={isLocked || dueCount === 0 && !sessionsToResume.has(deck.id)}>
                                                        {sessionsToResume.has(deck.id) ? 'Resume' : 'Study'} {dueCount > 0 && `(${dueCount})`}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {isOrganizing && dropIndicator?.levelIndex === levelIndex && dropIndicator.deckIndex === deckIndex + 1 && <DropIndicator />}
                                </div>
                            );
                        })}
                        {isOrganizing && (
                            <div className="pl-16 py-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsAddDeckModalOpen(true)}>
                                    <Icon name="plus" className="w-4 h-4 mr-2" /> Add Deck to Level
                                </Button>
                            </div>
                        )}
                    </div>
                    {isOrganizing && dropIndicator?.levelIndex === levelIndex + 1 && dropIndicator.deckIndex === null && <DropIndicator />}
                </div>
            ))}
            {isOrganizing && (
                <div className="pl-16 pt-4">
                    <Button variant="secondary" onClick={handleAddLevel}>
                        <Icon name="plus" className="w-4 h-4 mr-2" /> Add New Level
                    </Button>
                </div>
            )}
        </div>
      </div>
      
      {isAddDeckModalOpen && (
        <AddDeckToSeriesModal isOpen={isAddDeckModalOpen} onClose={() => setIsAddDeckModalOpen(false)} onAddDeck={(newDeck) => onAddDeckToSeries(series.id, newDeck)} />
      )}
      {isEditSeriesModalOpen && (
        <EditSeriesModal series={series} onClose={() => setIsEditSeriesModalOpen(false)} onSave={(data) => { onUpdateSeries({ ...series, name: data.name, description: data.description }); setIsEditSeriesModalOpen(false); }} />
      )}
      {deckForBulkAdd && (
        <BulkAddModal isOpen={!!deckForBulkAdd} onClose={() => setDeckForBulkAdd(null)} deckType={deckForBulkAdd.type} onAddItems={(items) => { const updatedDeck = { ...deckForBulkAdd, questions: [...deckForBulkAdd.questions, ...(items as Question[])]}; onUpdateDeck(updatedDeck); setDeckForBulkAdd(null); }} />
      )}
    </div>
  );
};

export default SeriesOverviewPage;
