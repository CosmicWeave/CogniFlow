
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Deck, DeckType, Question, ImportedCard, ImportedQuestion, Reviewable, Folder, FlashcardDeck, QuizDeck, ReviewLog, ReviewRating, LearningDeck, InfoCard } from '../types.ts';
import Button from './ui/Button.tsx';
import Link from './ui/Link.tsx';
import Icon, { IconName, ALL_ICONS } from './ui/Icon.tsx';
import { INITIAL_EASE_FACTOR } from '../constants.ts';
import CardListEditor from './CardListEditor.tsx';
import QuestionListEditor from './QuestionListEditor.tsx';
import BulkAddModal from './BulkAddModal.tsx';
import { createCardsFromImport, createQuestionsFromImport } from '../services/importService.ts';
import StackedProgressBar from './ui/StackedProgressBar.tsx';
import { useRouter } from '../contexts/RouterContext.tsx';
import MasteryBar from './ui/MasteryBar.tsx';
import { getEffectiveMasteryLevel, getDueItemsCount } from '../services/srs.ts';
import DueDateGraph from './ui/DueDateGraph.tsx';
import { useStore, useSeriesList } from '../store/store.ts';
import * as db from '../services/db.ts';
import Spinner from './ui/Spinner.tsx';
import MasteryOverTimeGraph from './ui/MasteryOverTimeGraph.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import { useToast } from '../hooks/useToast.ts';
import LearningItemListEditor from './LearningItemListEditor.tsx';
import LearningBlockDetailModal from './LearningBlockDetailModal.tsx';
import { LearningBlockData } from './EditLearningBlockModal.tsx';
import TruncatedText from './ui/TruncatedText.tsx';
import StatsSkeleton from './StatsSkeleton.tsx';
import { useData } from '../contexts/DataManagementContext.tsx';
import CramOptionsModal, { CramOptions } from './CramOptionsModal.tsx';
import { generateMetadata } from '../services/aiService.ts';

interface DeckDetailsPageProps {
  deck: Deck;
  sessionsToResume: Set<string>;
  onUpdateDeck: (updatedDeck: Deck, options?: { silent?: boolean; toastMessage?: string }) => void;
  onDeleteDeck: (deckId: string) => void;
  onUpdateLastOpened: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
  handleGenerateQuestionsForDeck: (deck: QuizDeck) => void;
  handleGenerateContentForLearningDeck: (deck: LearningDeck) => void;
  onCancelAIGeneration: () => void;
  onSaveLearningBlock: (deckId: string, blockData: { infoCard: InfoCard; questions: Question[] }) => Promise<void>;
  onDeleteLearningBlock: (deckId: string, infoCardId: string) => Promise<void>;
  onExportDeck: (deck: Deck) => void;
  onRegenerateQuestion: (deck: QuizDeck | LearningDeck, question: Question) => Promise<void>;
  onExpandText: (topic: string, originalContent: string, selectedText: string) => Promise<string | null>;
  onGenerateAI: (deck: Deck) => void;
}

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
        return <StatsSkeleton />;
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
        <div className="space-y-8 animate-fade-in">
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

const QuickStatCard = ({ icon, label, value, subtext, color = "primary" }: { icon: IconName, label: string, value: string | number, subtext?: string, color?: string }) => (
    <div className="bg-surface p-4 rounded-lg shadow-sm border border-border flex items-center gap-4">
        <div className={`p-3 rounded-full bg-${color}/10 text-${color}`}>
            <Icon name={icon} className="w-6 h-6" />
        </div>
        <div>
            <p className="text-sm font-medium text-text-muted">{label}</p>
            <p className="text-2xl font-bold text-text">{value}</p>
            {subtext && <p className="text-xs text-text-muted mt-0.5">{subtext}</p>}
        </div>
    </div>
);

const DeckDetailsPage: React.FC<DeckDetailsPageProps> = ({ deck, sessionsToResume, onUpdateDeck, onDeleteDeck, onUpdateLastOpened, openConfirmModal, handleGenerateQuestionsForDeck, handleGenerateContentForLearningDeck, onCancelAIGeneration, onSaveLearningBlock, onDeleteLearningBlock, onExportDeck, onRegenerateQuestion, onExpandText, onGenerateAI }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(deck.name);
  const [editedDescription, setEditedDescription] = useState(deck.description || '');
  const [editedFolderId, setEditedFolderId] = useState(deck.folderId || '');
  const [editedIcon, setEditedIcon] = useState(deck.icon);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [isCramModalOpen, setIsCramModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isBlockDetailModalOpen, setIsBlockDetailModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<LearningBlockData | null>(null);
  
  const { navigate } = useRouter();
  const { addToast } = useToast();
  const { aiFeaturesEnabled } = useSettings();
  const { folders, aiGenerationStatus, learningProgress } = useStore();
  const seriesList = useSeriesList();
  const dataHandlers = useData();
  const menuRef = useRef<HTMLDivElement>(null);
  
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

  const parentSeries = useMemo(() => {
      return seriesList.find(s => !s.deletedAt && (s.levels || []).some(l => l.deckIds?.includes(deck.id)));
  }, [seriesList, deck.id]);

  useEffect(() => {
      onUpdateLastOpened(deck.id);
  }, [deck.id, onUpdateLastOpened]);

  useEffect(() => {
    if (deck.archived || deck.deletedAt) {
      navigate('/');
    }
  }, [deck.archived, deck.deletedAt, navigate]);

  useEffect(() => {
      if (!isEditing) {
          setEditedName(deck.name);
          setEditedDescription(deck.description || '');
          setEditedFolderId(deck.folderId || '');
          setEditedIcon(deck.icon);
      }
  }, [deck, isEditing]);

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

  const handleSaveChanges = () => {
    onUpdateDeck({ ...deck, name: editedName, description: editedDescription, folderId: editedFolderId || null, icon: editedIcon });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleAutoMetadata = async () => {
    if (allItems.length === 0) {
        addToast("Add some cards or questions first so the AI has context.", "info");
        return;
    }
    setIsGeneratingMetadata(true);
    try {
        const textContext = allItems.slice(0, 20).map(i => 'front' in i ? i.front : i.questionText).join('\n');
        const { name, description } = await generateMetadata(textContext, 'deck');
        setEditedName(name);
        setEditedDescription(description);
        addToast("Details generated!", "success");
    } catch (e) {
        addToast("Failed to generate details.", "error");
    } finally {
        setIsGeneratingMetadata(false);
    }
  };
  
  const handleBulkAddItems = (items: ImportedCard[] | ImportedQuestion[]) => {
    if (deck.type === DeckType.Flashcard && items.every(item => 'front' in item)) {
        const newCards = createCardsFromImport(items as ImportedCard[]);
        const updatedCards = [...(deck.cards || []), ...newCards];
        onUpdateDeck({ ...(deck as FlashcardDeck), cards: updatedCards });
    } else if ((deck.type === DeckType.Quiz || deck.type === DeckType.Learning) && items.every(item => 'questionText' in item)) {
        const newQuestions = createQuestionsFromImport(items as ImportedQuestion[]);
        const currentQuestions = (deck as QuizDeck | LearningDeck).questions || [];
        const updatedQuestions = [...currentQuestions, ...newQuestions];
        onUpdateDeck({ ...(deck as QuizDeck | LearningDeck), questions: updatedQuestions });
    }
  };
  
  const handleDelete = () => {
    openConfirmModal({
        title: 'Move Deck to Trash',
        message: `Are you sure you want to move the deck "${deck.name}" to the trash? It will be permanently deleted after 10 days. This will also remove it from any series it belongs to.`,
        onConfirm: () => onDeleteDeck(deck.id),
    });
  };

  const handleUpgradeToLearning = () => {
      if (deck.type === DeckType.Learning) return;
      openConfirmModal({
          title: 'Upgrade to Learning Deck?',
          message: `This will use AI to analyze your existing ${allItems.length} items and generate a structured curriculum (InfoCards) for them. You'll be able to read instructional chapters before taking the quiz.`,
          confirmText: 'Upgrade with AI ✨',
          onConfirm: () => dataHandlers?.handleUpgradeDeckToLearning(deck)
      });
  };

  const handleBlockClick = (block: LearningBlockData) => {
    setSelectedBlock(block);
    setIsBlockDetailModalOpen(true);
  };

  const handleReorderLearningBlocks = (newInfoCards: InfoCard[]) => {
    const updatedDeck = { ...(deck as LearningDeck), infoCards: newInfoCards };
    onUpdateDeck(updatedDeck, { silent: true });
  };

  const handleStartCram = (options: CramOptions) => {
      onUpdateLastOpened(deck.id);
      navigate(`/decks/${deck.id}/cram?sort=${options.sort}&limit=${options.limit}`);
  };

  const activeItems = allItems.filter(item => !item.suspended);
  const suspendedCount = allItems.length - activeItems.length;
  const progressStats = calculateProgressStats(activeItems);
  
  // Calculate unlocked due count for learning decks
  const progress = learningProgress[deck.id];
  const unlockedSet = new Set(progress?.unlockedQuestionIds || []);
  const dueCount = deck.type === DeckType.Learning 
      ? (deck as LearningDeck).questions.filter(q => unlockedSet.has(q.id) && !q.suspended && new Date(q.dueDate) <= new Date()).length
      : getDueItemsCount(deck);

  const canResume = sessionsToResume.has(deck.id);

  // Learning Deck Progress
  const readCardCount = progress?.readInfoCardIds?.length || 0;
  const totalInfoCards = (deck as LearningDeck).infoCards?.length || 0;
  const hasUnreadContent = deck.type === DeckType.Learning && readCardCount < totalInfoCards;
  
  // Unlock stats
  const unlockedQuestionsCount = (deck.type === DeckType.Learning) 
      ? (deck as LearningDeck).questions.filter(q => unlockedSet.has(q.id)).length
      : 0;
  const totalQuestionsCount = (deck.type === DeckType.Learning) ? (deck as LearningDeck).questions.length : 0;

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
            // Only count if unlocked for learning decks
            if (deck.type === DeckType.Learning && !unlockedSet.has(item.id)) return;

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
  }, [allItems, deck.type, unlockedSet]);
  
  const studyButtonText = useMemo(() => {
    if (allItems.length === 0) return "No Items to Study";
    if (deck.locked) return "Deck is Locked";
    
    if (deck.type === DeckType.Quiz) return canResume ? 'Resume Quiz' : `Start Quiz`;
    
    // Learning Mode Logic
    if (deck.type === DeckType.Learning) {
        if ((deck as LearningDeck).learningMode === 'mixed') return `Start Course`;
        return `Practice`;
    }

    return canResume ? 'Resume Study' : `Study Cards`;
  }, [deck.type, canResume, deck.locked, allItems.length, (deck as LearningDeck).learningMode]);

  const progressBarData = [
    { value: progressStats.new, color: 'bg-blue-500', label: 'New' },
    { value: progressStats.learning, color: 'bg-orange-500', label: 'Learning' },
    { value: progressStats.young, color: 'bg-teal-500', label: 'Young' },
    { value: progressStats.mature, color: 'bg-green-500', label: 'Mature' },
  ];
  
  const tabClasses = (tabName: Tab) => `px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === tabName ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`;
  
  const isDeckEmpty = allItems.length === 0 && (deck.type !== DeckType.Learning || (deck as LearningDeck).infoCards.length === 0);
  const showReadButton = deck.type === DeckType.Learning && (deck as LearningDeck).learningMode !== 'mixed';

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6 pb-20">
      
      {/* Hero Header Section */}
      <div className={`bg-surface rounded-xl shadow-sm border border-border ${isEditing ? 'overflow-hidden' : ''}`}>
        {isEditing ? (
          <div className="p-6 space-y-4 animate-fade-in bg-background/50">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-text">Edit Deck Details</h2>
                {aiFeaturesEnabled && (
                    <Button variant="ghost" size="sm" onClick={handleAutoMetadata} disabled={isGeneratingMetadata} className="text-primary hover:text-primary-hover">
                        {isGeneratingMetadata ? <Spinner size="sm" /> : <Icon name="bot" className="w-4 h-4 mr-2" />}
                        Auto-generate with AI
                    </Button>
                )}
            </div>
            <div>
              <label htmlFor="deck-name-edit" className="block text-sm font-medium text-text-muted mb-1">Deck Name</label>
              <input
                id="deck-name-edit"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-xl font-bold"
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Deck Icon</label>
                    <div className="flex gap-2">
                        <select 
                            value={editedIcon || ''} 
                            onChange={(e) => setEditedIcon(e.target.value as IconName)} 
                            className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                            <option value="">Default</option>
                            {ALL_ICONS.map(icon => (
                                <option key={icon} value={icon}>{icon}</option>
                            ))}
                        </select>
                        {aiFeaturesEnabled && (
                            <Button variant="secondary" onClick={() => dataHandlers?.handleSuggestDeckIcon(deck)} title="Suggest Icon with AI">
                                <Icon name="zap" className="w-4 h-4 mr-1"/> Auto
                            </Button>
                        )}
                    </div>
                </div>

                <div>
                    <label htmlFor="deck-folder" className="block text-sm font-medium text-text-muted mb-1">Folder</label>
                    <select id="deck-folder" value={editedFolderId} onChange={(e) => setEditedFolderId(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                        <option value="">No folder</option>
                        {(Object.values(folders) as Folder[]).map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                </div>
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
            
            <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
              <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
              <Button onClick={handleSaveChanges}><Icon name="save" className="mr-2" /> Save Changes</Button>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-8 flex items-start justify-between gap-4 relative">
            <div className="flex-1 min-w-0 pr-10 sm:pr-0">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl flex-shrink-0 hidden sm:block">
                        <Icon name={(deck.icon as IconName) || (deck.type === 'flashcard' ? 'laptop' : (deck.type === 'learning' ? 'book-open' : 'help-circle'))} className="w-8 h-8 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                        {parentSeries ? (
                             <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                                <Link href={`/series/${parentSeries.id}`} className="flex items-center text-xs font-bold text-primary uppercase tracking-wider hover:underline whitespace-nowrap">
                                    <Icon name="layers" className="w-3 h-3 mr-1" />
                                    <span>{parentSeries.name}</span>
                                </Link>
                                {deck.folderId && folders[deck.folderId] && (
                                    <>
                                        <span className="text-text-muted/30 text-xs hidden sm:inline">•</span>
                                        <div className="flex items-center text-xs font-medium text-text-muted uppercase tracking-wider whitespace-nowrap">
                                            <Icon name="folder" className="w-3 h-3 mr-1" />
                                            <span>{folders[deck.folderId].name}</span>
                                        </div>
                                    </>
                                )}
                             </div>
                        ) : (
                            deck.folderId && (
                                <div className="flex items-center text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
                                    <Icon name="folder" className="w-3 h-3 mr-1" />
                                    <span>{folders[deck.folderId]?.name || 'Uncategorized'}</span>
                                </div>
                            )
                        )}
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-text break-words leading-tight">{deck.name}</h1>
                        {deck.description && (
                            <div className="mt-2 text-text-muted">
                                <TruncatedText html={deck.description} className="prose prose-sm dark:prose-invert max-w-none text-text-muted leading-relaxed" />
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
                        {aiFeaturesEnabled && !isDeckEmpty && (
                            <>
                                <button onClick={() => { dataHandlers?.handleOpenDeckAnalysis(deck); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                                    <Icon name="zap" className="w-4 h-4 mr-3" /> Analyze & Improve
                                </button>
                                {deck.type !== DeckType.Learning && (
                                    <button onClick={() => { handleUpgradeToLearning(); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                                        <Icon name="layers" className="w-4 h-4 mr-3 text-purple-500" /> Upgrade to Course ✨
                                    </button>
                                )}
                            </>
                        )}
                        <Link href={`/decks/${deck.id}/print`} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                            <Icon name="printer" className="w-4 h-4 mr-3" /> Print / PDF
                        </Link>
                        <button onClick={() => { onExportDeck(deck); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                            <Icon name="download" className="w-4 h-4 mr-3" /> Export JSON
                        </button>
                        {deck.type === 'flashcard' && (
                            <button onClick={() => { dataHandlers?.handleExportDeckCSV(deck); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                                <Icon name="file-text" className="w-4 h-4 mr-3" /> Export CSV
                            </button>
                        )}
                        <div className="my-1 border-t border-border"></div>
                        <button onClick={() => { onUpdateDeck({ ...deck, archived: true }, { toastMessage: "Deck archived." }); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/5 hover:text-primary transition-colors">
                            <Icon name="archive" className="w-4 h-4 mr-3" /> Archive
                        </button>
                        <button onClick={() => { handleDelete(); setIsMenuOpen(false); }} className="flex items-center w-full px-4 py-2.5 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Icon name="trash-2" className="w-4 h-4 mr-3" /> Move to Trash
                        </button>
                    </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
       <div className="flex space-x-1 border-b border-border overflow-x-auto no-scrollbar">
          <button className={tabClasses('overview')} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={tabClasses('items')} onClick={() => setActiveTab('items')}>Items ({allItems.length})</button>
          <button className={tabClasses('stats')} onClick={() => setActiveTab('stats')}>Statistics</button>
       </div>
       
       <div className="min-h-[300px]">
        {activeTab === 'overview' && (
            <div className="space-y-6 sm:space-y-8 animate-fade-in">
                {/* Primary Actions Area */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-6 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-lg font-bold text-text mb-1">
                            {dueCount > 0 ? `You have ${dueCount} item${dueCount !== 1 ? 's' : ''} due today.` : "All caught up for now!"}
                        </h3>
                        <p className="text-sm text-text-muted">
                            {dueCount > 0 ? "Keep up your streak and review now." : "Review ahead or add new cards."}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center md:justify-end w-full md:w-auto">
                        {isDeckEmpty && aiFeaturesEnabled ? (
                            isGeneratingThisDeck ? (
                                <div className="flex items-center justify-center py-3 px-6 bg-surface rounded-md border border-border w-full md:w-auto">
                                    <Spinner size="sm" />
                                    <span className="ml-3 text-text-muted text-sm font-semibold">{relevantTask.statusText || 'Generating...'}</span>
                                </div>
                            ) : (
                                <Button 
                                    variant="primary" 
                                    size="lg" 
                                    onClick={() => {
                                        if (deck.type === DeckType.Quiz) {
                                            handleGenerateQuestionsForDeck(deck as QuizDeck);
                                        } else if (deck.type === DeckType.Learning) {
                                            handleGenerateContentForLearningDeck(deck as LearningDeck);
                                        } else {
                                            onGenerateAI(deck);
                                        }
                                    }}
                                    className="w-full md:w-auto"
                                >
                                    <Icon name="zap" className="w-5 h-5 mr-2" />
                                    Generate Content
                                </Button>
                            )
                        ) : isDeckEmpty && !aiFeaturesEnabled ? (
                            <Button variant="primary" size="lg" onClick={() => setActiveTab('items')} className="w-full md:w-auto">
                                <Icon name="plus" className="w-5 h-5 mr-2" />
                                Create First Item
                            </Button>
                        ) : (
                            <>
                                {showReadButton && (
                                    <Link 
                                        href={`/decks/${deck.id}/read`}
                                        passAs={Button}
                                        variant="secondary"
                                        size="lg"
                                        className="font-semibold flex-1 md:flex-none"
                                    >
                                        <Icon name="book-open" className="w-5 h-5 mr-2" />
                                        {readCardCount === 0 ? 'Read' : (hasUnreadContent ? 'Continue Reading' : 'Review')}
                                    </Link>
                                )}
                                <Link 
                                    href={`/decks/${deck.id}/study`} 
                                    passAs={Button} 
                                    variant={(deck.type !== DeckType.Learning || !hasUnreadContent || (deck as LearningDeck).learningMode === 'mixed') ? 'primary' : 'secondary'} 
                                    size="lg" 
                                    onClick={() => onUpdateLastOpened(deck.id)} 
                                    disabled={(dueCount === 0 && !canResume) || !!deck.locked || allItems.length === 0} 
                                    className="font-bold px-8 shadow-md flex-1 md:flex-none"
                                >
                                    <Icon name="refresh-ccw" className="w-5 h-5 mr-2" /> {studyButtonText}
                                </Link>
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => setIsCramModalOpen(true)}
                                    disabled={allItems.length === 0}
                                    title="Review without affecting stats"
                                    className="w-full md:w-auto"
                                >
                                    Cram
                                </Button>
                            </>
                        )}
                        {/* More study options dropdown could go here, or simple buttons */}
                        <div className="flex gap-2 w-full sm:w-auto justify-center">
                            {deck.type === DeckType.Flashcard && activeItems.length > 0 && (
                                <Link href={`/decks/${deck.id}/study-reversed`} passAs={Button} variant="ghost" size="lg" onClick={() => onUpdateLastOpened(deck.id)} title="Study Back-to-Front" className="flex-1 sm:flex-none">
                                    <Icon name="repeat" className="w-5 h-5" />
                                </Link>
                            )}
                            {deck.type === DeckType.Quiz && activeItems.length > 0 && (
                                <Link href={`/decks/${deck.id}/study-flip`} passAs={Button} variant="ghost" size="lg" onClick={() => onUpdateLastOpened(deck.id)} title="Review as Flashcards" className="flex-1 sm:flex-none">
                                    <Icon name="columns" className="w-5 h-5" />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dashboard Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <QuickStatCard icon="layers" label="Total Items" value={activeItems.length} color="blue" />
                    <QuickStatCard icon="zap" label="Due Today" value={dueCount} subtext={suspendedCount > 0 ? `${suspendedCount} suspended` : undefined} color="orange" />
                    <div className="sm:col-span-2 bg-surface p-4 rounded-lg shadow-sm border border-border flex flex-col justify-center">
                        <MasteryBar level={effectiveMastery} />
                    </div>
                </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    <div className="bg-surface p-6 rounded-lg shadow-md border border-border flex flex-col justify-center">
                       <h4 className="text-sm font-semibold text-text mb-4 flex items-center gap-2"><Icon name="trending-up" className="w-4 h-4"/> Retention Breakdown</h4>
                       <StackedProgressBar data={progressBarData} total={activeItems.length} />
                       <div className="grid grid-cols-2 gap-4 mt-6">
                           <div className="flex items-center gap-2 text-sm text-text-muted"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span>New: <strong>{progressStats.new}</strong></span></div>
                           <div className="flex items-center gap-2 text-sm text-text-muted"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span>Learning: <strong>{progressStats.learning}</strong></span></div>
                           <div className="flex items-center gap-2 text-sm text-text-muted"><div className="w-3 h-3 rounded-full bg-teal-500"></div><span>Young: <strong>{progressStats.young}</strong></span></div>
                           <div className="flex items-center gap-2 text-sm text-text-muted"><div className="w-3 h-3 rounded-full bg-green-500"></div><span>Mature: <strong>{progressStats.mature}</strong></span></div>
                       </div>
                    </div>
                    <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
                         <DueDateGraph data={dueDateGraphData} />
                    </div>
                </div>
            </div>
        )}
        {activeTab === 'items' && (
            <div className="bg-surface rounded-lg shadow-md border border-border animate-fade-in">
             {deck.type === DeckType.Flashcard ? (
                <CardListEditor cards={(deck as FlashcardDeck).cards || []} onCardsChange={(newCards) => onUpdateDeck({ ...(deck as FlashcardDeck), cards: newCards }, { silent: true })} onAddCard={(d) => onUpdateDeck({ ...(deck as FlashcardDeck), cards: [...((deck as FlashcardDeck).cards || []), {...d, id: crypto.randomUUID(), dueDate: new Date().toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR }] }, { silent: true })} onBulkAdd={() => setIsBulkAddModalOpen(true)} deckName={deck.name} />
             ) : deck.type === DeckType.Quiz ? (
                <QuestionListEditor
                    deck={deck as QuizDeck}
                    questions={(deck as QuizDeck).questions || []}
                    onQuestionsChange={(newQuestions) => onUpdateDeck({ ...(deck as QuizDeck), questions: newQuestions }, { silent: true })}
                    onAddQuestion={(d) => {
                        const newQuestion: Question = {
                            questionType: d.questionType,
                            questionText: d.questionText,
                            options: d.options,
                            correctAnswerId: d.correctAnswerId,
                            detailedExplanation: d.detailedExplanation,
                            tags: d.tags,
                            infoCardIds: d.infoCardIds,
                            suspended: d.suspended,
                            id: crypto.randomUUID(),
                            dueDate: new Date().toISOString(),
                            interval: 0,
                            easeFactor: INITIAL_EASE_FACTOR,
                            lapses: 0,
                            masteryLevel: 0,
                        };
                        onUpdateDeck({ ...(deck as QuizDeck), questions: [...((deck as QuizDeck).questions || []), newQuestion] }, { silent: true });
                    }}
                    onBulkAdd={() => setIsBulkAddModalOpen(true)}
                    onGenerateAI={() => handleGenerateQuestionsForDeck(deck as QuizDeck)}
                    isGeneratingAI={isGeneratingThisDeck}
                    onRegenerateQuestion={onRegenerateQuestion}
                    onAutoTag={() => dataHandlers?.handleAutoTagQuestions(deck as QuizDeck)}
                    deckName={deck.name}
                />
             ) : deck.type === DeckType.Learning ? (
                <LearningItemListEditor
                    deck={deck as LearningDeck}
                    onSaveBlock={(data) => onSaveLearningBlock(deck.id, data)}
                    onDeleteBlock={(infoCardId) => onDeleteLearningBlock(deck.id, infoCardId)}
                    onBlockClick={handleBlockClick}
                    onReorderBlocks={handleReorderLearningBlocks}
                />
             ) : (
                <div className="p-6 text-center text-text-muted"><p>Unsupported deck type.</p></div>
             )}
            </div>
        )}
        {activeTab === 'stats' && <div className="animate-fade-in"><StatisticsTabContent deck={deck} /></div>}
       </div>
      
      {isBulkAddModalOpen && <BulkAddModal isOpen={isBulkAddModalOpen} onClose={() => setIsBulkAddModalOpen(false)} onAddItems={handleBulkAddItems} deckType={deck.type} />}
      {isBlockDetailModalOpen && (
        <LearningBlockDetailModal
            isOpen={isBlockDetailModalOpen}
            onClose={() => setIsBlockDetailModalOpen(false)}
            block={selectedBlock}
            deckName={deck.name}
            onExpandText={onExpandText}
        />
      )}
      {isCramModalOpen && (
          <CramOptionsModal 
            isOpen={isCramModalOpen} 
            onClose={() => setIsCramModalOpen(false)} 
            onStart={handleStartCram}
            totalItems={allItems.length}
          />
      )}
    </div>
  );
};

export default DeckDetailsPage;
