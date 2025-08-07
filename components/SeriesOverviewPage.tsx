


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
import { getEffectiveMasteryLevel } from '../services/srs';

interface SeriesOverviewPageProps {
  series: DeckSeries;
  decks: QuizDeck[];
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
    <div className="h-1.5 my-2 w-full rounded-full bg-blue-400 dark:bg-blue-600" aria-hidden="true" />
);

const SeriesOverviewPage: React.FC<SeriesOverviewPageProps> = ({
  series,
  decks,
  completedDeckIds,
  sessionsToResume,
  onUpdateSeries,
  onDeleteSeries,
  onAddDeckToSeries,
  onUpdateDeck,
  onStartSeriesStudy,
  openConfirmModal
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isAddDeckModalOpen, setIsAddDeckModalOpen] = useState(false);
  const [isEditSeriesModalOpen, setIsEditSeriesModalOpen] = useState(false);
  const [deckForBulkAdd, setDeckForBulkAdd] = useState<QuizDeck | null>(null);
  const { navigate } = useRouter();
  const [menuOpenForDeck, setMenuOpenForDeck] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{ type: 'level' | 'deck', sourceLevelIndex: number, deckId?: string } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ levelIndex: number, deckIndex?: number | null } | null>(null);

  const flatDeckIdsInOrder = useMemo(() => series.levels.flatMap(l => l.deckIds), [series.levels]);

  useEffect(() => {
    if (series.archived || series.deletedAt) {
      navigate('/');
    }
  }, [series.archived, series.deletedAt, navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setMenuOpenForDeck(null);
        }
    };
    if (menuOpenForDeck) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenForDeck]);

  const isDeckUnlocked = (deckId: string) => {
    const deckIndex = flatDeckIdsInOrder.indexOf(deckId);
    if (deckIndex === -1) return false;
    return deckIndex <= completedDeckIds.size;
  }
  const isDeckCompleted = (deckId: string) => completedDeckIds.has(deckId);
  
  const totalDueInSeries = useMemo(() => {
    return decks.reduce((total, deck) => {
        if (isDeckUnlocked(deck.id)) {
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
            })).filter(level => level.deckIds.length > 0);
            
            const updatedSeries = { ...series, levels: updatedLevels };
            onUpdateSeries(updatedSeries);
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

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, type: 'level' | 'deck', sourceLevelIndex: number, deckId?: string) => {
    if (!isEditing) return;
    setDraggedItem({ type, sourceLevelIndex, deckId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Necessary for Firefox
  };

  const handleDragOver = (e: React.DragEvent, levelIndex: number, deckId?: string) => {
    if (!isEditing || !draggedItem) return;
    e.preventDefault();

    if (draggedItem.type === 'level' && deckId) {
      setDropIndicator(null);
      return; // Cannot drop a level onto a deck
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (deckId) { // Dragging over a deck
        const deckIndex = series.levels[levelIndex].deckIds.indexOf(deckId);
        setDropIndicator({ levelIndex, deckIndex: e.clientY < midpoint ? deckIndex : deckIndex + 1 });
    } else { // Dragging over a level header
        setDropIndicator({ levelIndex: e.clientY < midpoint ? levelIndex : levelIndex + 1, deckIndex: null });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isEditing || !draggedItem || !dropIndicator) return;
    e.preventDefault();

    const { type: draggedType, sourceLevelIndex, deckId: draggedDeckId } = draggedItem;
    const { levelIndex: targetLevelIndex, deckIndex: rawTargetDeckIndex } = dropIndicator;
    
    const newLevels = JSON.parse(JSON.stringify(series.levels));

    if (draggedType === 'level') {
        if (rawTargetDeckIndex !== null) return; // Should be prevented by onDragOver, but check again
        
        const [movedLevel] = newLevels.splice(sourceLevelIndex, 1);
        const effectiveTargetIndex = sourceLevelIndex < targetLevelIndex ? targetLevelIndex - 1 : targetLevelIndex;
        newLevels.splice(effectiveTargetIndex, 0, movedLevel);

    } else if (draggedType === 'deck' && draggedDeckId) {
        // Remove from source level
        const sourceDeckIds = newLevels[sourceLevelIndex].deckIds as string[];
        const originalDeckIndexInSource = sourceDeckIds.indexOf(draggedDeckId);
        if (originalDeckIndexInSource > -1) {
            sourceDeckIds.splice(originalDeckIndexInSource, 1);
        }

        // Add to target level
        let targetDeckIndex = rawTargetDeckIndex === null ? 0 : rawTargetDeckIndex;
        const targetDeckIds = newLevels[targetLevelIndex].deckIds as string[];
        
        if (sourceLevelIndex === targetLevelIndex && originalDeckIndexInSource < targetDeckIndex) {
             targetDeckIndex--;
        }
        targetDeckIds.splice(targetDeckIndex, 0, draggedDeckId);
    }
    
    onUpdateSeries({ ...series, levels: newLevels.filter(l => l.deckIds.length > 0 || l.title.trim() !== '') });

    setDraggedItem(null);
    setDropIndicator(null);
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropIndicator(null);
  };
  // --- End Drag and Drop ---

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      {/* Series Info & Edit Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="mb-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 break-words">{series.name}</h2>
          {series.description && <p className="text-gray-500 dark:text-gray-400 mt-1">{series.description}</p>}
          <div className="mt-4">
            <MasteryBar level={seriesMastery} />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
            <Button 
                variant="primary"
                onClick={() => onStartSeriesStudy(series.id)}
                disabled={totalDueInSeries === 0}
            >
                <Icon name="zap" className="mr-2"/> Study All Due ({totalDueInSeries})
            </Button>
            <Button variant="ghost" onClick={() => setIsEditing(!isEditing)}>
              <Icon name={isEditing ? 'x-circle' : 'edit'} className="mr-2"/> {isEditing ? 'Finish Editing' : 'Edit Series'}
            </Button>
            <Button variant="ghost" onClick={() => onUpdateSeries({ ...series, archived: true })}>
                <Icon name="archive" className="mr-2" /> Archive Series
            </Button>
            {isEditing && (
                <>
                    <div className="w-full border-t border-gray-200 dark:border-gray-700/50 my-2"></div>
                    <Button variant="secondary" onClick={() => setIsAddDeckModalOpen(true)}>
                        <Icon name="plus" className="mr-2" /> Add New Deck
                    </Button>
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

      {/* Deck List */}
      <div className="space-y-6" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {isEditing && dropIndicator?.levelIndex === 0 && dropIndicator.deckIndex === null && <DropIndicator />}
        {series.levels.map((level, levelIndex) => (
          <div key={level.title + levelIndex}>
            <div
                draggable={isEditing}
                onDragStart={(e) => handleDragStart(e, 'level', levelIndex)}
                onDragOver={(e) => handleDragOver(e, levelIndex)}
                onDragEnd={handleDragEnd}
                className={`transition-opacity ${isEditing ? 'cursor-grab' : ''} ${draggedItem?.type === 'level' && draggedItem.sourceLevelIndex === levelIndex ? 'opacity-40' : ''}`}
            >
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2">{level.title}</h3>
            </div>
            <div className="space-y-4">
            {level.deckIds.map((deckId, deckIndex) => {
              const deck = decks.find(d => d.id === deckId);
              if (!deck) return null;

              const unlocked = isDeckUnlocked(deck.id);
              const completed = isDeckCompleted(deck.id);
              const dueCount = getDueItemsCount(deck);
              const canResume = sessionsToResume.has(deck.id);
              const deckMastery = (() => {
                  const activeItems = deck.questions.filter(q => !q.suspended);
                  if (activeItems.length === 0) return 0;
                  const totalMastery = activeItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0);
                  return totalMastery / activeItems.length;
              })();

              return (
                <div key={deck.id}>
                    {isEditing && dropIndicator?.levelIndex === levelIndex && dropIndicator.deckIndex === deckIndex && <DropIndicator />}
                    <div
                        draggable={isEditing}
                        onDragStart={(e) => handleDragStart(e, 'deck', levelIndex, deckId)}
                        onDragOver={(e) => handleDragOver(e, levelIndex, deckId)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md transition-all duration-200 ${isEditing ? 'cursor-grab' : ''} ${draggedItem?.type === 'deck' && draggedItem.deckId === deckId ? 'opacity-40' : ''}`}
                    >
                        <div className={`p-4 flex items-start justify-between ${!unlocked && !isEditing ? 'opacity-60' : ''}`}>
                            <div className="flex-1 mr-4 min-w-0">
                                <div className="flex items-start">
                                <div className="flex-shrink-0 flex flex-col items-center mr-4 w-10 text-center">
                                        {!unlocked && !isEditing && <Icon name="lock" className="w-6 h-6 text-gray-400 dark:text-gray-500" />}
                                        {unlocked && !completed && <Icon name="unlock" className="w-6 h-6 text-blue-500" />}
                                        {completed && <Icon name="check-circle" className="w-6 h-6 text-green-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Link
                                        href={`/decks/${deck.id}?seriesId=${series.id}`}
                                        className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                                    >
                                        {deck.name}
                                    </Link>
                                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                                        <span>{deck.questions.length} question{deck.questions.length !== 1 ? 's' : ''}</span>
                                        {unlocked && dueCount > 0 && (
                                            <span className="font-semibold text-blue-500 dark:text-blue-400">
                                                {dueCount} due
                                            </span>
                                        )}
                                    </div>
                                </div>
                                </div>
                                <div className="mt-3 pl-14">
                                    <MasteryBar level={deckMastery} />
                                </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center space-x-1">
                                {isEditing ? (
                                    <>
                                        <Button variant="secondary" size="sm" onClick={() => setDeckForBulkAdd(deck)}>
                                            <Icon name="plus" className="w-4 h-4 mr-1"/> Questions
                                        </Button>
                                        <Button variant="danger" size="sm" onClick={() => handleRemoveDeck(deck.id, deck.name)}>
                                            <Icon name="trash-2" className="w-4 h-4"/>
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Link href={`/decks/${deck.id}/study?seriesId=${series.id}`} passAs={Button} variant="primary" disabled={!unlocked || (dueCount === 0 && !canResume)}>
                                            {completed ? 'Completed' : (canResume ? 'Resume' : 'Study')}
                                        </Link>
                                        <div className="relative">
                                            <Button
                                                variant="ghost"
                                                className="p-2 h-auto"
                                                onClick={(e) => {
                                                    e.preventDefault(); e.stopPropagation();
                                                    setMenuOpenForDeck(menuOpenForDeck === deck.id ? null : deck.id);
                                                }}
                                                aria-haspopup="true"
                                                aria-expanded={menuOpenForDeck === deck.id}
                                                aria-label={`More options for ${deck.name}`}
                                            >
                                                <Icon name="more-vertical" className="w-5 h-5" />
                                            </Button>
                                            {menuOpenForDeck === deck.id && (
                                                <div
                                                    ref={menuRef}
                                                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 ring-1 ring-black ring-opacity-5 animate-fade-in"
                                                    style={{ animationDuration: '150ms' }}
                                                >
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault(); e.stopPropagation();
                                                            setDeckForBulkAdd(deck);
                                                            setMenuOpenForDeck(null);
                                                        }}
                                                        className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    >
                                                        <Icon name="plus" className="w-4 h-4 mr-3" />
                                                        Bulk Add Questions
                                                    </button>
                                                    <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault(); e.stopPropagation();
                                                            handleRemoveDeck(deck.id, deck.name);
                                                            setMenuOpenForDeck(null);
                                                        }}
                                                        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <Icon name="trash-2" className="w-4 h-4 mr-3" />
                                                        Remove from Series
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    {isEditing && dropIndicator?.levelIndex === levelIndex && dropIndicator.deckIndex === deckIndex + 1 && <DropIndicator />}
                </div>
              );
            })}
            </div>
            {isEditing && dropIndicator?.levelIndex === levelIndex + 1 && dropIndicator.deckIndex === null && <DropIndicator />}
          </div>
        ))}
      </div>

      {/* Modals */}
      {isAddDeckModalOpen && (
        <AddDeckToSeriesModal
            isOpen={isAddDeckModalOpen}
            onClose={() => setIsAddDeckModalOpen(false)}
            onAddDeck={(newDeck) => onAddDeckToSeries(series.id, newDeck)}
        />
      )}
      {isEditSeriesModalOpen && (
        <EditSeriesModal
            series={series}
            onClose={() => setIsEditSeriesModalOpen(false)}
            onSave={(data) => {
                onUpdateSeries({ ...series, name: data.name, description: data.description });
                setIsEditSeriesModalOpen(false);
            }}
        />
      )}
      {deckForBulkAdd && (
        <BulkAddModal
            isOpen={!!deckForBulkAdd}
            onClose={() => setDeckForBulkAdd(null)}
            deckType={deckForBulkAdd.type}
            onAddItems={(items) => {
                const updatedDeck = {
                    ...deckForBulkAdd,
                    questions: [...deckForBulkAdd.questions, ...(items as Question[])]
                };
                onUpdateDeck(updatedDeck);
                setDeckForBulkAdd(null);
            }}
        />
      )}
    </div>
  );
};

export default SeriesOverviewPage;
