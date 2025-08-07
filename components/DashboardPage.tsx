import React from 'react';
import { Deck, DeckSeries, SeriesProgress } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Link from './ui/Link';
import SeriesListItem from './SeriesListItem';
import DeckListItem from './DeckListItem';

interface DashboardPageProps {
  recentSeries: DeckSeries[];
  recentDecks: Deck[];
  totalDueQuestions: number;
  onStartGeneralStudy: () => void;
  sessionsToResume: Set<string>;
  onUpdateLastOpened: (deckId: string) => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onDeleteDeck: (deckId: string) => void;
  openConfirmModal: (props: any) => void;
  seriesData: Map<string, { dueCount: number, mastery: number }>;
  seriesProgress: SeriesProgress;
  onStartSeriesStudy: (seriesId: string) => Promise<void>;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  recentSeries,
  recentDecks,
  totalDueQuestions,
  onStartGeneralStudy,
  sessionsToResume,
  onUpdateLastOpened,
  onUpdateDeck,
  onDeleteDeck,
  openConfirmModal,
  seriesData,
  seriesProgress,
  onStartSeriesStudy
}) => {
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
              return (
                <SeriesListItem
                  key={series.id}
                  series={series}
                  completedCount={seriesProgress.get(series.id)?.size || 0}
                  dueCount={data.dueCount}
                  masteryLevel={data.mastery}
                  onStartSeriesStudy={onStartSeriesStudy}
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
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;