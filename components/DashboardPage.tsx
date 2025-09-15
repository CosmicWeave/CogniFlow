
import React, { useMemo } from 'react';
import { Deck, DeckSeries, SeriesProgress, DeckType, Reviewable, FlashcardDeck, QuizDeck, LearningDeck } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Link from './ui/Link';
import SeriesListItem from './SeriesListItem';
import DeckListItem from './DeckListItem';
import { useStore } from '../store/store';
import { getEffectiveMasteryLevel } from '../services/srs';

interface DashboardPageProps {
  totalDueQuestions: number;
  onStartGeneralStudy: () => void;
  sessionsToResume: Set<string>;
  onUpdateLastOpened: (deckId: string) => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onDeleteDeck: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
  seriesProgress: SeriesProgress;
  onStartSeriesStudy: (seriesId: string) => Promise<void>;
  handleGenerateQuestionsForDeck?: (deck: QuizDeck) => void;
  handleGenerateContentForLearningDeck?: (deck: LearningDeck) => void;
  handleGenerateQuestionsForEmptyDecksInSeries?: (seriesId: string) => void;
  onCancelAIGeneration: () => void;
}

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = (deck.type === DeckType.Quiz ? (deck as QuizDeck).questions : 
                  deck.type === DeckType.Learning ? (deck as LearningDeck).questions : 
                  (deck as FlashcardDeck).cards) || [];
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

const DashboardPage: React.FC<DashboardPageProps> = ({
  totalDueQuestions,
  onStartGeneralStudy,
  sessionsToResume,
  onUpdateLastOpened,
  onUpdateDeck,
  onDeleteDeck,
  openConfirmModal,
  seriesProgress,
  onStartSeriesStudy,
  handleGenerateQuestionsForDeck,
  handleGenerateContentForLearningDeck,
  handleGenerateQuestionsForEmptyDecksInSeries,
}) => {
  const { decks, deckSeries } = useStore();

  const { recentDecks, recentSeries, seriesData } = useMemo(() => {
    const seriesDeckIds = new Set<string>();
    deckSeries.forEach(series => {
        ((series.levels || []).filter(Boolean)).forEach(level => (level.deckIds || []).forEach(deckId => seriesDeckIds.add(deckId)));
    });

    const standaloneDecks = decks.filter(d => !d.archived && !d.deletedAt && !seriesDeckIds.has(d.id));
    const activeSeriesList = deckSeries.filter(s => !s.archived && !s.deletedAt);

    const recentSeries = [...activeSeriesList].sort((a, b) => {
        const decksA = (a.levels || []).filter(Boolean).flatMap(l => l.deckIds || []).map(id => decks.find(d => d.id === id)).filter(Boolean) as Deck[];
        const decksB = (b.levels || []).filter(Boolean).flatMap(l => l.deckIds || []).map(id => decks.find(d => d.id === id)).filter(Boolean) as Deck[];
        const lastOpenedA = Math.max(new Date(a.lastOpened || a.createdAt || 0).getTime(), ...decksA.map(d => new Date(d.lastOpened || 0).getTime()));
        const lastOpenedB = Math.max(new Date(b.lastOpened || b.createdAt || 0).getTime(), ...decksB.map(d => new Date(d.lastOpened || 0).getTime()));
        return lastOpenedB - lastOpenedA;
    }).slice(0, 2);

    const recentDecks = [...standaloneDecks].sort((a,b) => (b.lastOpened || '').localeCompare(a.lastOpened || '')).slice(0, 2);

    const seriesData = new Map<string, { dueCount: number, mastery: number }>();
    deckSeries.forEach(s => {
        const seriesDecks = (s.levels || []).filter(Boolean).flatMap(l => l.deckIds || []).map(id => decks.find(d => d.id === id)).filter(Boolean) as Deck[];
        
        const completedCount = seriesProgress.get(s.id)?.size || 0;
        const unlockedDeckIds = new Set<string>();
        const flatDeckIds = (s.levels || []).filter(Boolean).flatMap(l => l.deckIds || []);
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

        const allItems = seriesDecks.flatMap<Reviewable>(d => 
            d.type === DeckType.Flashcard ? ((d as FlashcardDeck).cards || []) : 
            ((d as QuizDeck | LearningDeck).questions || [])
        ).filter(i => !i.suspended);
        const mastery = allItems.length > 0 ? allItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0) / allItems.length : 0;
        
        seriesData.set(s.id, { dueCount, mastery });
    });

    return { recentDecks, recentSeries, seriesData };
  }, [decks, deckSeries, seriesProgress]);

  return (
    <div className="space-y-12">
      {totalDueQuestions > 0 && (
        <div className="mb-6">
          <Button onClick={onStartGeneralStudy} variant="primary" className="w-full sm:w-auto text-lg py-3">
            <Icon name="zap" className="w-5 h-5 mr-2" />
            Study All Due Items ({totalDueQuestions})
          </Button>
        </div>
      )}

      {recentSeries.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Recent Series</h2>
            <Link href="/series" passAs={Button} variant="ghost">
              View all <Icon name="chevron-left" className="w-4 h-4 ml-2 rotate-180" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentSeries.map(series => {
              const data = seriesData.get(series.id) || { dueCount: 0, mastery: 0 };
              const completedDeckIds = seriesProgress.get(series.id) || new Set();
              const flatDeckIds = (series.levels || []).filter(Boolean).flatMap(l => l.deckIds || []);
              const nextUpDeckId = flatDeckIds.find(id => !completedDeckIds.has(id)) || null;
              return (
                <SeriesListItem
                  key={series.id}
                  series={series}
                  completedCount={seriesProgress.get(series.id)?.size || 0}
                  dueCount={data.dueCount}
                  masteryLevel={data.mastery}
                  onStartSeriesStudy={onStartSeriesStudy}
                  nextUpDeckId={nextUpDeckId}
                  onGenerateAllQuestions={handleGenerateQuestionsForEmptyDecksInSeries}
                />
              );
            })}
          </div>
        </section>
      )}

      {recentDecks.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Recent Decks</h2>
            <Link href="/decks" passAs={Button} variant="ghost">
              View all <Icon name="chevron-left" className="w-4 h-4 ml-2 rotate-180" />
            </Link>
          </div>
          <div className="space-y-4">
            {recentDecks.map(deck => (
              <DeckListItem
                key={deck.id}
                deck={deck}
                sessionsToResume={sessionsToResume}
                onUpdateLastOpened={onUpdateLastOpened}
                draggedDeckId={null}
                onDragStart={() => {}}
                onDragEnd={() => {}}
                onUpdateDeck={onUpdateDeck}
                onDeleteDeck={onDeleteDeck}
                openConfirmModal={openConfirmModal}
                handleGenerateQuestionsForDeck={handleGenerateQuestionsForDeck}
                handleGenerateContentForLearningDeck={handleGenerateContentForLearningDeck}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;
