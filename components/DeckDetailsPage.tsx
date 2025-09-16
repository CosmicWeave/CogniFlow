

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Deck, DeckType, Question, ImportedCard, ImportedQuestion, Reviewable, Folder, FlashcardDeck, QuizDeck, ReviewLog, ReviewRating, LearningDeck, InfoCard } from '../types';
import Button from './ui/Button';
import Link from './ui/Link';
import Icon from './ui/Icon';
import { INITIAL_EASE_FACTOR } from '../constants';
import CardListEditor from './CardListEditor';
import QuestionListEditor from './QuestionListEditor';
import BulkAddModal from './BulkAddModal';
import { createCardsFromImport, createQuestionsFromImport } from '../services/importService';
import StackedProgressBar from './ui/StackedProgressBar';
import { useRouter } from '../contexts/RouterContext';
import MasteryBar from './ui/MasteryBar';
import { getEffectiveMasteryLevel } from '../services/srs';
import DueDateGraph from './ui/DueDateGraph';
import { useStore } from '../store/store';
import * as db from '../services/db';
import Spinner from './ui/Spinner';
import MasteryOverTimeGraph from './ui/MasteryOverTimeGraph';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import LearningItemListEditor from './LearningItemListEditor';
import LearningBlockDetailModal from './LearningBlockDetailModal';
import { LearningBlockData } from './EditLearningBlockModal';
import TruncatedText from './ui/TruncatedText';

interface DeckDetailsPageProps {
  deck: Deck;
  sessionsToResume: Set<string>;
  onUpdateDeck: (updatedDeck: Deck, options?: { silent: boolean }) => void;
  onDeleteDeck: (deckId: string) => void;
  onUpdateLastOpened: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
  handleGenerateQuestionsForDeck: (deck: QuizDeck) => void;
  handleGenerateContentForLearningDeck: (deck: LearningDeck) => void;
  onCancelAIGeneration: () => void;
  onSaveLearningBlock: (deckId: string, blockData: { infoCard: InfoCard; questions: Question[] }) => Promise<void>;
  onDeleteLearningBlock: (deckId: string, infoCardId: string) => Promise<void>;
}

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = (deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : 
                  deck.type === DeckType.Learning ? (deck as LearningDeck).questions : 
                  (deck as QuizDeck).questions) || [];
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(card => !card.suspended && new Date(card.dueDate) <= today).length;
};

const calculateProgressStats = (items: Reviewable[]) => {
  const stats = {
    new: 0,
    learning: 0,
    young: 0,
    mature: 0,
  };

  items.forEach(item => {
    if (item.interval === 0) {
      stats.new++;
    } else if (item.interval < 7) {
      stats.learning++;
    } else if (item.interval < 21) {
      stats.young++;
    } else {
      stats.mature++;
    }
  });

  return stats;
};

type Tab = 'overview' | 'items' | 'stats';

const StatisticsTabContent = ({ deck }: { deck: Deck }) => {
    const [reviewHistory, setReviewHistory] = useState<ReviewLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const allItems = (deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : 
                     deck.type === DeckType.Learning ? (deck as LearningDeck).questions : 
                     (deck as QuizDeck).questions) || [];

    useEffect(() => {
        const fetchReviews = async () => {
            setIsLoading(true);
            try {
                const reviews = await db.getReviewsForDeck(deck.id);
                setReviewHistory(reviews);
            } catch (error) {
                console.error("Failed to fetch review history for deck:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchReviews();
    }, [deck.id]);
    
    const mostDifficultItems = useMemo(() => {
        if (!reviewHistory.length) return [];

        const againCountMap = new Map<string, number>();
        reviewHistory.forEach(review => {
            if (review.rating === ReviewRating.Again) {
                againCountMap.set(review.itemId, (againCountMap.get(review.itemId) || 0) + 1);
            }
        });

        return Array.from(againCountMap.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by count desc
            .slice(0, 5) // Take top 5
            .map(([itemId, count]) => {
                const item = allItems.find(i => i.id === itemId);
                return item ? { ...item, failureCount: count } : null;
            })
            .filter((item): item is (Card | Question) & { failureCount: number } => Boolean(item));
    }, [reviewHistory, allItems]);


    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Spinner /></div>;
    }

    if (reviewHistory.length === 0) {
        return (
            <div className="text-center py-10 bg-surface rounded-lg border border-border">
                <Icon name="trending-up" className="w-12 h-12 mx-auto text-text-muted/50" />
                <h3 className="mt-2 text-xl font-medium text-text">No Statistics Yet</h3>
                <p className="mt-1 text-sm text-text-muted">Complete a study session for this deck to see your stats.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
                    <h3 className="text-xl font-semibold text-text mb-4">Mastery Over Time</h3>
                    <p className="text-sm text-text-muted mb-4">Average mastery level of reviewed cards per day over the last 90 days of activity.</p>
                    <MasteryOverTimeGraph reviews={reviewHistory} />
                </div>
                <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
                    <h3 className="text-xl font-semibold text-text mb-4">Most Difficult Items</h3>
                    <p className="text-sm text-text-muted mb-4">Items you've marked "Again" most frequently.</p>
                     {mostDifficultItems.length > 0 ? (
                        <ul className="space-y-3">
                            {mostDifficultItems.map(item => {
                                const isQuestion = 'questionText' in item;
                                const promptText = (isQuestion ? item.questionText : item.front).replace(/<[^>]+>/g, '').trim();
                                return (
                                    <li key={item.id} className="p-3 bg-background rounded-md border border-border">
                                        <p className="font-semibold text-sm text-text break-words truncate" title={promptText}>{promptText}</p>
                                        <p className="text-xs text-red-500 font-medium">Marked "Again" {item.failureCount} time{item.failureCount > 1 ? 's' : ''}</p>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm text-text-muted">No items have been repeatedly marked as difficult. Great job!</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const DeckDetailsPage: React.FC<DeckDetailsPageProps> = ({ deck, sessionsToResume, onUpdateDeck, onDeleteDeck, onUpdateLastOpened, openConfirmModal, handleGenerateQuestionsForDeck, handleGenerateContentForLearningDeck, onCancelAIGeneration, onSaveLearningBlock, onDeleteLearningBlock }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(deck.name);
  const [editedDescription, setEditedDescription] = useState(deck.description || '');
  const [editedFolderId, setEditedFolderId] = useState(deck.folderId || '');
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isBlockDetailModalOpen, setIsBlockDetailModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<LearningBlockData | null>(null);
  const { navigate } = useRouter();
  const { addToast } = useToast();
  const { aiFeaturesEnabled } = useSettings();
  const { folders, aiGenerationStatus } = useStore();
  
  const allItems = (deck.type === DeckType.Flashcard ? (deck as FlashcardDeck).cards : 
                   deck.type === DeckType.Learning ? (deck as LearningDeck).questions : 
                   (deck as QuizDeck).questions) || [];

  const relevantTask = useMemo(() => {
    const { currentTask, queue } = aiGenerationStatus;
    if (currentTask?.deckId === deck.id) {
        return currentTask;
    }
    const deckQueue = Array.isArray(queue) ? queue : [];
    return deckQueue.find(task => task.deckId === deck.id);
  }, [aiGenerationStatus, deck.id]);

  const isGeneratingThisDeck = !!relevantTask;

  useEffect(() => {
      onUpdateLastOpened(deck.id);
  }, [deck.id, onUpdateLastOpened]);

  useEffect(() => {
    if (deck.archived || deck.deletedAt) {
      navigate('/');
    }
  }, [deck.archived, deck.deletedAt, navigate]);

  const handleSaveChanges = () => {
    onUpdateDeck({ ...deck, name: editedName, description: editedDescription, folderId: editedFolderId || null });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedName(deck.name);
    setEditedDescription(deck.description || '');
    setEditedFolderId(deck.folderId || '');
    setIsEditing(false);
  };
  
  const handleBulkAddItems = (items: ImportedCard[] | ImportedQuestion[]) => {
    if (deck.type === DeckType.Flashcard && items.every(item => 'front' in item)) {
        const newCards = createCardsFromImport(items as ImportedCard[]);
        const updatedCards = [...(deck.cards || []), ...newCards];
        onUpdateDeck({ ...deck, cards: updatedCards });
    } else if ((deck.type === DeckType.Quiz || deck.type === DeckType.Learning) && items.every(item => 'questionText' in item)) {
        const newQuestions = createQuestionsFromImport(items as ImportedQuestion[]);
        const currentQuestions = (deck as QuizDeck | LearningDeck).questions || [];
        const updatedQuestions = [...currentQuestions, ...newQuestions];
        onUpdateDeck({ ...deck, questions: updatedQuestions });
    }
  };
  
  const handleDelete = () => {
    openConfirmModal({
        title: 'Move Deck to Trash',
        message: `Are you sure you want to move the deck "${deck.name}" to the trash? It will be permanently deleted after 10 days. This will also remove it from any series it belongs to.`,
        onConfirm: () => onDeleteDeck(deck.id),
    });
  };

  const handleBlockClick = (block: LearningBlockData) => {
    setSelectedBlock(block);
    setIsBlockDetailModalOpen(true);
  };

  const activeItems = allItems.filter(item => !item.suspended);
  const suspendedCount = allItems.length - activeItems.length;
  const progressStats = calculateProgressStats(activeItems);
  const dueCount = getDueItemsCount(deck);
  const canResume = sessionsToResume.has(deck.id);

  const effectiveMastery = useMemo(() => {
    if (activeItems.length === 0) return 0;
    const totalMastery = activeItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0);
    return totalMastery / activeItems.length;
  }, [activeItems]);

  const dueDateGraphData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts = Array(7).fill(0);
    const dayLabels = [];
    const dates = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        if (i === 0) dayLabels.push('Today');
        else if (i === 1) dayLabels.push('Tom');
        else dayLabels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        
        dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

        const dateTimestamp = date.getTime();

        allItems.forEach(item => {
            if (item.suspended) return;
            const dueDate = new Date(item.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate.getTime() === dateTimestamp) {
                counts[i]++;
            }
        });
    }

    return dayLabels.map((dayLabel, index) => ({
        dayLabel,
        count: counts[index],
        date: dates[index],
    }));
  }, [allItems]);
  
  const studyButtonText = useMemo(() => {
    if (allItems.length === 0) return "No Items to Study";
    if (deck.locked) return "Deck is Locked";
    if (deck.type === DeckType.Quiz || deck.type === DeckType.Learning) return canResume ? 'Resume Quiz' : `Start Quiz (${dueCount} due)`;
    return canResume ? 'Resume Study' : `Study Cards (${dueCount} due)`;
  }, [deck.type, canResume, dueCount, deck.locked, allItems.length]);

  const progressBarData = [
    { value: progressStats.new, color: 'bg-blue-500', label: 'New' },
    { value: progressStats.learning, color: 'bg-orange-500', label: 'Learning' },
    { value: progressStats.young, color: 'bg-teal-500', label: 'Young' },
    { value: progressStats.mature, color: 'bg-green-500', label: 'Mature' },
  ];
  
  const tabClasses = (tabName: Tab) => `px-4 py-2 text-sm font-medium transition-colors ${activeTab === tabName ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'}`;
  
  const isEmptyActionableDeck = (deck.type === DeckType.Quiz || deck.type === DeckType.Learning) && allItems.length === 0;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Deck Info & Edit Section */}
      <div className="bg-surface rounded-lg shadow-md p-6 border border-border">
        {isEditing ? (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label htmlFor="deck-name-edit" className="block text-sm font-medium text-text-muted mb-1">Deck Name</label>
              <input
                id="deck-name-edit"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-2xl font-bold"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="deck-folder" className="block text-sm font-medium text-text-muted mb-1">Folder</label>
              <select id="deck-folder" value={editedFolderId} onChange={(e) => setEditedFolderId(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="">No folder</option>
                {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </div>
            
            <div>
              <label htmlFor="deck-desc" className="block text-sm font-medium text-text-muted mb-1">Description</label>
              <textarea
                id="deck-desc"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={4}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            
            <div className="flex justify-start gap-2 pt-2">
              <Button onClick={handleSaveChanges}><Icon name="save" className="mr-2" /> Save Changes</Button>
              <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="min-w-0">
                <h2 className="text-3xl font-bold mb-2 text-text break-words">{deck.name}</h2>
                  {deck.folderId && (
                      <div className="flex items-center text-sm text-text-muted mb-2">
                          <Icon name="folder" className="w-4 h-4 mr-2" />
                          <span>{folders.find(f => f.id === deck.folderId)?.name || '...'}</span>
                      </div>
                  )}
            </div>
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" onClick={() => setIsEditing(true)}><Icon name="edit" className="mr-2"/> Edit</Button>
                <Button variant="ghost" onClick={() => onUpdateDeck({ ...deck, archived: true })}><Icon name="archive" className="mr-2"/> Archive</Button>
            </div>
            {deck.description && <TruncatedText html={deck.description} className="text-text-muted prose dark:prose-invert max-w-none" />}
          </div>
        )}
      </div>

      {/* Tabs */}
       <div className="border-b border-border flex space-x-4">
          <button className={tabClasses('overview')} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={tabClasses('items')} onClick={() => setActiveTab('items')}>Items ({allItems.length})</button>
          <button className={tabClasses('stats')} onClick={() => setActiveTab('stats')}>Statistics</button>
       </div>
       
       <div className="mt-6">
        {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4 bg-surface p-6 rounded-lg shadow-md border border-border">
                        <div>
                            <h4 className="text-sm font-semibold text-text mb-2">Deck Statistics</h4>
                            <div className="space-y-1">
                                {deck.type === DeckType.Learning && <p className="text-sm text-text-muted">Info Cards: <strong className="text-text">{(deck as LearningDeck).infoCards?.length || 0}</strong></p>}
                                <p className="text-sm text-text-muted">Active {deck.type === DeckType.Learning ? 'Questions' : 'Items'}: <strong className="text-text">{activeItems.length}</strong></p>
                                <p className="text-sm text-text-muted">Items Due Today: <strong className={dueCount > 0 ? 'text-primary' : 'text-text'}>{dueCount}</strong></p>
                                {suspendedCount > 0 && <p className="text-sm text-yellow-600 dark:text-yellow-400">Suspended Items: <strong>{suspendedCount}</strong></p>}
                            </div>
                        </div>
                        <div>
                           <h4 className="text-sm font-semibold text-text mb-2">Overall Mastery</h4><MasteryBar level={effectiveMastery} />
                        </div>
                        <div>
                           <h4 className="text-sm font-semibold text-text mb-2">Progress by Stage</h4>
                           <StackedProgressBar data={progressBarData} total={activeItems.length} />
                           <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
                               <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2"></span><span className="text-text-muted">New: <strong>{progressStats.new}</strong></span></div>
                               <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2"></span><span className="text-text-muted">Learning: <strong>{progressStats.learning}</strong></span></div>
                               <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-teal-500 mr-2"></span><span className="text-text-muted">Young: <strong>{progressStats.young}</strong></span></div>
                               <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2"></span><span className="text-text-muted">Mature: <strong>{progressStats.mature}</strong></span></div>
                           </div>
                        </div>
                    </div>
                    <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
                         <DueDateGraph data={dueDateGraphData} />
                    </div>
                </div>
                <div className="border-t border-border pt-6 flex flex-wrap items-center justify-center gap-4">
                  {isEmptyActionableDeck && aiFeaturesEnabled ? (
                    isGeneratingThisDeck ? (
                        <div className="flex items-center justify-center w-full sm:w-auto text-lg py-3 px-6 font-semibold bg-background rounded-md">
                            <Spinner size="sm" />
                            <span className="ml-3 text-text-muted">{relevantTask.statusText || 'Generating...'}</span>
                        </div>
                    ) : (
                        <Button 
                            variant="primary" 
                            size="lg" 
                            className="font-semibold w-full sm:w-auto"
                            onClick={() => {
                                if (deck.type === DeckType.Quiz) {
                                    handleGenerateQuestionsForDeck(deck as QuizDeck);
                                } else if (deck.type === DeckType.Learning) {
                                    handleGenerateContentForLearningDeck(deck as LearningDeck);
                                }
                            }}
                        >
                            <Icon name="zap" className="w-5 h-5 mr-2" />
                            {deck.type === DeckType.Quiz ? 'Generate Questions' : 'Generate Content'}
                        </Button>
                    )
                  ) : (
                    <Link href={`/decks/${deck.id}/study`} passAs={Button} variant="primary" size="lg" onClick={() => onUpdateLastOpened(deck.id)} disabled={(dueCount === 0 && !canResume) || !!deck.locked || allItems.length === 0} className="font-semibold w-full sm:w-auto">
                        <Icon name={deck.locked ? 'lock' : (canResume ? 'zap' : 'laptop')} className="w-5 h-5 mr-2" /> {studyButtonText}
                    </Link>
                  )}
                  <Link href={`/decks/${deck.id}/cram`} passAs={Button} variant="secondary" size="lg" onClick={() => onUpdateLastOpened(deck.id)} disabled={allItems.length === 0} className="font-semibold w-full sm:w-auto" title="Review all cards in random order, without affecting your SRS schedule.">
                    <Icon name="refresh-ccw" className="w-5 h-5 mr-2" /> Cram
                  </Link>
                  {deck.type === DeckType.Flashcard && activeItems.length > 0 && (
                     <Link href={`/decks/${deck.id}/study-reversed`} passAs={Button} variant="secondary" size="lg" onClick={() => onUpdateLastOpened(deck.id)} disabled={!!deck.locked} className="font-semibold w-full sm:w-auto" title="Study cards from back to front.">
                        <Icon name="repeat" className="w-5 h-5 mr-2" /> Study Reversed
                    </Link>
                  )}
                  {deck.type === DeckType.Quiz && activeItems.length > 0 && (
                     <Link href={`/decks/${deck.id}/study-flip`} passAs={Button} variant="secondary" size="lg" onClick={() => onUpdateLastOpened(deck.id)} disabled={!!deck.locked} className="font-semibold w-full sm:w-auto">
                        <Icon name="refresh-ccw" className="w-5 h-5 mr-2" /> Review as Flashcards
                    </Link>
                  )}
                </div>
            </div>
        )}
        {activeTab === 'items' && (
            <div className="bg-surface rounded-lg shadow-md border border-border animate-fade-in">
             {deck.type === DeckType.Flashcard ? (
                <CardListEditor cards={(deck as FlashcardDeck).cards || []} onCardsChange={(newCards) => onUpdateDeck({ ...deck, cards: newCards }, { silent: true })} onAddCard={(d) => onUpdateDeck({ ...deck, cards: [...((deck as FlashcardDeck).cards || []), {...d, id: crypto.randomUUID(), dueDate: new Date().toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR }] }, { silent: true })} onBulkAdd={() => setIsBulkAddModalOpen(true)} />
             ) : deck.type === DeckType.Quiz ? (
                <QuestionListEditor
                    questions={(deck as QuizDeck).questions || []}
                    onQuestionsChange={(newQuestions) => onUpdateDeck({ ...deck, questions: newQuestions }, { silent: true })}
                    onAddQuestion={(d) => onUpdateDeck({ ...deck, questions: [...((deck as QuizDeck).questions || []), {...d, id: crypto.randomUUID(), dueDate: new Date().toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR }] }, { silent: true })}
                    onBulkAdd={() => setIsBulkAddModalOpen(true)}
                    onGenerateAI={() => handleGenerateQuestionsForDeck(deck as QuizDeck)}
                    isGeneratingAI={isGeneratingThisDeck}
                />
             ) : deck.type === DeckType.Learning ? (
                <LearningItemListEditor
                    deck={deck as LearningDeck}
                    onSaveBlock={(data) => onSaveLearningBlock(deck.id, data)}
                    onDeleteBlock={(infoCardId) => onDeleteLearningBlock(deck.id, infoCardId)}
                    onBlockClick={handleBlockClick}
                />
             ) : (
                <div className="p-6 text-center text-text-muted"><p>Unsupported deck type.</p></div>
             )}
            </div>
        )}
        {activeTab === 'stats' && <div className="animate-fade-in"><StatisticsTabContent deck={deck} /></div>}
       </div>

      {/* Danger Zone */}
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-red-400 dark:text-red-300 mb-2">Danger Zone</h3>
        <p className="text-red-500/80 dark:text-red-300/80 mb-4">Moving a deck to the trash will make it unavailable for study. It will be permanently deleted after 10 days.</p>
        <Button variant="danger" onClick={handleDelete}><Icon name="trash-2" className="mr-2" /> Move to Trash</Button>
      </div>
      
      {isBulkAddModalOpen && <BulkAddModal isOpen={isBulkAddModalOpen} onClose={() => setIsBulkAddModalOpen(false)} onAddItems={handleBulkAddItems} deckType={deck.type} />}
      {isBlockDetailModalOpen && (
        <LearningBlockDetailModal
            isOpen={isBlockDetailModalOpen}
            onClose={() => setIsBlockDetailModalOpen(false)}
            block={selectedBlock}
        />
      )}
    </div>
  );
};

export default DeckDetailsPage;