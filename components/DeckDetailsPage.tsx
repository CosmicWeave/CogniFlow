


import React, { useState, useEffect, useMemo } from 'react';
import { Card, Deck, DeckType, Question, ImportedCard, ImportedQuestion, Reviewable, Folder } from '../types';
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

interface DeckDetailsPageProps {
  deck: Deck;
  folders: Folder[];
  sessionsToResume: Set<string>;
  onUpdateDeck: (updatedDeck: Deck, options?: { silent: boolean }) => void;
  onDeleteDeck: (deckId: string) => void;
  onUpdateLastOpened: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
}

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === DeckType.Flashcard ? deck.cards : deck.questions;
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


const DeckDetailsPage: React.FC<DeckDetailsPageProps> = ({ deck, folders, sessionsToResume, onUpdateDeck, onDeleteDeck, onUpdateLastOpened, openConfirmModal }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(deck.name);
  const [editedDescription, setEditedDescription] = useState(deck.description || '');
  const [editedFolderId, setEditedFolderId] = useState(deck.folderId || '');
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const { navigate } = useRouter();

  useEffect(() => {
      onUpdateLastOpened(deck.id);
  }, [deck.id, onUpdateLastOpened]);

  useEffect(() => {
    // If the deck is archived or moved to trash while we're viewing it, navigate away.
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

  const handleCardsChange = (newCards: Card[]) => {
    if (deck.type === DeckType.Flashcard) {
        onUpdateDeck({ ...deck, cards: newCards }, { silent: true });
    }
  };
  
  const addCard = (newCardData: Pick<Card, 'front' | 'back'>) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newCard: Card = {
        id: crypto.randomUUID(),
        front: newCardData.front,
        back: newCardData.back,
        dueDate: today.toISOString(),
        interval: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        suspended: false,
    };

    if (deck.type === DeckType.Flashcard) {
        handleCardsChange([...deck.cards, newCard]);
    }
  };

  const handleQuestionsChange = (newQuestions: Question[]) => {
    if (deck.type === DeckType.Quiz) {
        onUpdateDeck({ ...deck, questions: newQuestions }, { silent: true });
    }
  };

  const addQuestion = (newQuestionData: Omit<Question, 'id' | 'dueDate' | 'interval' | 'easeFactor' | 'suspended'>) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newQuestion: Question = {
        ...newQuestionData,
        id: crypto.randomUUID(),
        dueDate: today.toISOString(),
        interval: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        suspended: false,
    };

    if (deck.type === DeckType.Quiz) {
        const updatedQuestions = [...deck.questions, newQuestion];
        handleQuestionsChange(updatedQuestions);
    }
  };
  
  const handleBulkAddItems = (items: ImportedCard[] | ImportedQuestion[]) => {
    if (deck.type === DeckType.Flashcard && items.every(item => 'front' in item)) {
        const newCards = createCardsFromImport(items as ImportedCard[]);
        const updatedCards = [...deck.cards, ...newCards];
        onUpdateDeck({ ...deck, cards: updatedCards });
    } else if (deck.type === DeckType.Quiz && items.every(item => 'questionText' in item)) {
        const newQuestions = createQuestionsFromImport(items as ImportedQuestion[]);
        const updatedQuestions = [...deck.questions, ...newQuestions];
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

  const allItems = deck.type === DeckType.Flashcard ? deck.cards : deck.questions;
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
    if (deck.locked) {
      return "Deck is Locked";
    }
    if (deck.type === DeckType.Quiz) {
      return canResume ? 'Resume Quiz' : `Start Quiz (${dueCount} due)`;
    }
    return canResume ? 'Resume Study' : `Study Cards (${dueCount} due)`;
  }, [deck.type, canResume, dueCount, deck.locked]);

  const progressBarData = [
    { value: progressStats.new, color: 'bg-blue-500', label: 'New' },
    { value: progressStats.learning, color: 'bg-orange-500', label: 'Learning' },
    { value: progressStats.young, color: 'bg-teal-500', label: 'Young' },
    { value: progressStats.mature, color: 'bg-green-500', label: 'Mature' },
  ];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      {/* Deck Info & Edit Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="deck-name" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Deck Name</label>
              <input
                type="text"
                id="deck-name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-2xl font-bold"
              />
            </div>
             <div>
              <label htmlFor="deck-folder" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Folder</label>
              <select
                id="deck-folder"
                value={editedFolderId}
                onChange={(e) => setEditedFolderId(e.target.value)}
                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">No folder</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="deck-desc" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Description</label>
              <textarea
                id="deck-desc"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={3}
                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
              <Button onClick={handleSaveChanges}>
                <Icon name="save" className="mr-2" /> Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="min-w-0">
                <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100 break-words">{deck.name}</h2>
                  {deck.folderId && (
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                          <Icon name="folder" className="w-4 h-4 mr-2" />
                          <span>{folders.find(f => f.id === deck.folderId)?.name || '...'}</span>
                      </div>
                  )}
            </div>
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" onClick={() => setIsEditing(true)}>
                  <Icon name="edit" className="mr-2"/> Edit
                </Button>
                <Button variant="ghost" onClick={() => onUpdateDeck({ ...deck, archived: true })}>
                    <Icon name="archive" className="mr-2"/> Archive
                </Button>
            </div>
            {deck.description && <p className="text-gray-500 dark:text-gray-400 mt-1 mb-4 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: deck.description }} />}
            
             <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Deck Statistics</h4>
                            <div className="space-y-1">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Active Items: <strong className="text-gray-800 dark:text-gray-200">{activeItems.length}</strong>
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Items Due Today: <strong className={dueCount > 0 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}>{dueCount}</strong>
                                </p>
                                {suspendedCount > 0 && (
                                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                        Ignored Items: <strong>{suspendedCount}</strong>
                                    </p>
                                )}
                            </div>
                        </div>
                        <div>
                           <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Overall Mastery</h4>
                           <MasteryBar level={effectiveMastery} />
                        </div>
                        <div>
                           <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Progress by Stage</h4>
                           <StackedProgressBar data={progressBarData} total={activeItems.length} />
                           <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
                               <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2"></span><span className="text-gray-600 dark:text-gray-400">New: <strong>{progressStats.new}</strong></span></div>
                               <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2"></span><span className="text-gray-600 dark:text-gray-400">Learning: <strong>{progressStats.learning}</strong></span></div>
                               <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-teal-500 mr-2"></span><span className="text-gray-600 dark:text-gray-400">Young: <strong>{progressStats.young}</strong></span></div>
                               <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2"></span><span className="text-gray-600 dark:text-gray-400">Mature: <strong>{progressStats.mature}</strong></span></div>
                           </div>
                        </div>
                    </div>
                    <div>
                         <DueDateGraph data={dueDateGraphData} />
                    </div>
                </div>
            </div>

            <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-wrap items-center justify-center gap-4">
              <Link
                  href={`/decks/${deck.id}/study`}
                  passAs={Button}
                  variant="primary"
                  size="lg"
                  onClick={() => onUpdateLastOpened(deck.id)}
                  disabled={(dueCount === 0 && !canResume) || !!deck.locked}
                  className="font-semibold w-full sm:w-auto"
              >
                  <Icon name={deck.locked ? 'lock' : (canResume ? 'zap' : 'laptop')} className="w-5 h-5 mr-2" />
                  {studyButtonText}
              </Link>
              {deck.type === DeckType.Quiz && activeItems.length > 0 && (
                 <Link
                    href={`/decks/${deck.id}/study-flip`}
                    passAs={Button}
                    variant="secondary"
                    size="lg"
                    onClick={() => onUpdateLastOpened(deck.id)}
                    disabled={!!deck.locked}
                    className="font-semibold w-full sm:w-auto"
                >
                    <Icon name="refresh-ccw" className="w-5 h-5 mr-2" />
                    Review as Flashcards
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card/Question Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
         {deck.type === DeckType.Flashcard ? (
            <CardListEditor cards={deck.cards} onCardsChange={handleCardsChange} onAddCard={addCard} onBulkAdd={() => setIsBulkAddModalOpen(true)} />
         ) : deck.type === DeckType.Quiz ? (
            <QuestionListEditor 
                questions={deck.questions} 
                onQuestionsChange={handleQuestionsChange} 
                onAddQuestion={addQuestion}
                onBulkAdd={() => setIsBulkAddModalOpen(true)}
            />
         ) : (
            <div className="p-6 text-center text-gray-400 dark:text-gray-500">
                <p>Unsupported deck type.</p>
            </div>
         )}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-red-400 dark:text-red-300 mb-2">Danger Zone</h3>
        <p className="text-red-500/80 dark:text-red-300/80 mb-4">
          Moving a deck to the trash will make it unavailable for study. It will be permanently deleted after 10 days.
        </p>
        <Button variant="danger" onClick={handleDelete}>
          <Icon name="trash-2" className="mr-2" /> Move to Trash
        </Button>
      </div>
      
      {isBulkAddModalOpen && (
        <BulkAddModal
          isOpen={isBulkAddModalOpen}
          onClose={() => setIsBulkAddModalOpen(false)}
          onAddItems={handleBulkAddItems}
          deckType={deck.type}
        />
      )}
    </div>
  );
};

export default DeckDetailsPage;