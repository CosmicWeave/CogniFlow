
import React, { useMemo } from 'react';
import { Deck, DeckSeries, SeriesProgress, DeckType, Reviewable, FlashcardDeck, QuizDeck, LearningDeck } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Link from './ui/Link';
import SeriesListItem from './SeriesListItem';
// FIX: Changed to named import to match the updated export in DeckListItem.tsx.
import { DeckListItem } from './DeckListItem';
import { useStore, useDecksList, useSeriesList } from '../store/store';
import { getEffectiveMasteryLevel, getDueItemsCount } from '../services/srs';
import { useSettings } from '../hooks/useSettings';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import InstallBanner from './ui/InstallBanner';

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
  onGenerateAI?: () => void;
  onCreateSampleQuizDeck: () => void;
  onCreateSampleFlashcardDeck: () => void;
  onCreateSampleLearningDeck: () => void;
  onCreateSampleSeries: () => void;
  onCreateSampleCourse?: () => void;
}

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
  onGenerateAI,
  onCreateSampleQuizDeck,
  onCreateSampleFlashcardDeck,
  onCreateSampleLearningDeck,
  onCreateSampleSeries
}) => {
  const decks = useDecksList();
  const deckSeries = useSeriesList();
  const { aiFeaturesEnabled } = useSettings();
  const [installPrompt, handleInstall, showInstallBanner] = useInstallPrompt();

  const handleDismissInstall = () => {
      localStorage.setItem('cogniflow-install-dismissed', 'true');
      window.location.reload(); 
  };

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

  const showButtons = totalDueQuestions > 0 || (aiFeaturesEnabled && onGenerateAI);

  return (
    <div className="space-y-12">
      {showButtons && (
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {totalDueQuestions > 0 && (
            <Button onClick={onStartGeneralStudy} variant="primary" className="w-full sm:w-auto text-lg py-3">
              <Icon name="zap" className="w-5 h-5 mr-2" />
              Study All Due Items ({totalDueQuestions})
            </Button>
          )}
          {aiFeaturesEnabled && onGenerateAI && (
            <Button onClick={onGenerateAI} variant="secondary" className="w-full sm:w-auto text-lg py-3">
              <Icon name="bot" className="w-5 h-5 mr-2" />
              Generate with AI
            </Button>
          )}
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
      
      <section className="pt-8 border-t border-border">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Quick Start Samples</h2>
          <div className="flex flex-wrap gap-3">
              <Button onClick={onCreateSampleQuizDeck} variant="secondary" size="sm">
                  <Icon name="help-circle" className="w-4 h-4 mr-2" /> Quiz Deck
              </Button>
              <Button onClick={onCreateSampleFlashcardDeck} variant="secondary" size="sm">
                  <Icon name="laptop" className="w-4 h-4 mr-2" /> Flashcard Deck
              </Button>
              <Button onClick={onCreateSampleLearningDeck} variant="secondary" size="sm">
                  <Icon name="book-open" className="w-4 h-4 mr-2" /> Learning Deck
              </Button>
              <Button onClick={onCreateSampleSeries} variant="secondary" size="sm">
                  <Icon name="layers" className="w-4 h-4 mr-2" /> Series
              </Button>
          </div>
      </section>
      
      {showInstallBanner && installPrompt && (
          <InstallBanner onInstall={handleInstall} onDismiss={handleDismissInstall} />
      )}
    </div>
  );
};

export default DashboardPage;
