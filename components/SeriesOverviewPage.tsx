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
  const [draggedDeckId, setDraggedDeckId] = useState<string | null>(null);
  const { navigate } = useRouter();
  const [menuOpenForDeck, setMenuOpenForDeck] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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


  const isDeckUnlocked = (deckIndex: number) => deckIndex <= completedDeckIds.size;
  const isDeckCompleted = (deckId: string) => completedDeckIds.has(deckId);
  
  const totalDueInSeries = useMemo(() => {
    return decks.reduce((total, deck, index) => {
        if (isDeckUnlocked(index)) {
            return total + getDueItemsCount(deck);
        }
        return total;
    }, 0);
  }, [decks, completedDeckIds]);

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
            const updatedSeries = {
                ...series,
                deckIds: series.deckIds.filter(id => id !== deckId)
            };
            onUpdateSeries(updatedSeries);
        }
    });
  };
  
  const handleDeleteSeries = () => {
    openConfirmModal({
        title: "Move Series to Trash",
        message: `Are you sure you want to move the series "${series.name}" to the trash? It will be permanently deleted after 10 days. The decks inside it will NOT be deleted.`,
        onConfirm: () => onDeleteSeries(series.id)
    });
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, deckId: string) => {
    e.dataTransfer.setData('text/plain', deckId);
    setDraggedDeckId(deckId);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetDeckId: string) => {
    e.preventDefault();
    if (!draggedDeckId || draggedDeckId === targetDeckId) return;

    const newDeckIds = [...series.deckIds];
    const draggedIndex = newDeckIds.indexOf(draggedDeckId);
    const targetIndex = newDeckIds.indexOf(targetDeckId);
    
    const [removed] = newDeckIds.splice(draggedIndex, 1);
    newDeckIds.splice(targetIndex, 0, removed);
    
    onUpdateSeries({ ...series, deckIds: newDeckIds });
    setDraggedDeckId(null);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

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
      <div className="space-y-4">
        {decks.map((deck, index) => {
          const unlocked = isDeckUnlocked(index);
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
            <div
                key={deck.id}
                draggable={isEditing}
                onDragStart={(e) => handleDragStart(e, deck.id)}
                onDragEnd={() => setDraggedDeckId(null)}
                onDrop={(e) => handleDrop(e, deck.id)}
                onDragOver={handleDragOver}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-md transition-all duration-200
                    ${isEditing ? 'cursor-move' : ''}
                    ${draggedDeckId === deck.id ? 'opacity-30' : ''}
                `}
            >
                <div className={`p-4 flex items-start justify-between ${!unlocked && !isEditing ? 'opacity-60' : ''}`}>
                    <div className="flex-1 mr-4 min-w-0">
                        <div className="flex items-start">
                           <div className="flex-shrink-0 flex flex-col items-center mr-4 w-10 text-center">
                                {!unlocked && !isEditing && <Icon name="lock" className="w-6 h-6 text-gray-400 dark:text-gray-500" />}
                                {unlocked && !completed && <Icon name="unlock" className="w-6 h-6 text-blue-500" />}
                                {completed && <Icon name="check-circle" className="w-6 h-6 text-green-500" />}
                                <span className="text-xs font-bold mt-1 text-gray-500 dark:text-gray-400">#{index + 1}</span>
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
          );
        })}
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