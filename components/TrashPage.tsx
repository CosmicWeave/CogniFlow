import React from 'react';
import { Deck, DeckSeries } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface TrashPageProps {
  trashedDecks: Deck[];
  trashedSeries: DeckSeries[];
  onRestoreDeck: (deckId: string) => void;
  onRestoreSeries: (seriesId: string) => void;
  onDeleteDeckPermanently: (deckId: string) => void;
  onDeleteSeriesPermanently: (seriesId: string) => void;
  openConfirmModal: (props: any) => void;
}

const TRASH_RETENTION_DAYS = 10;

const calculateDaysLeft = (deletedAt: string): number => {
    const deleteDate = new Date(deletedAt);
    const now = new Date();
    const millisElapsed = now.getTime() - deleteDate.getTime();
    const daysElapsed = millisElapsed / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - daysElapsed));
};

const TrashPage: React.FC<TrashPageProps> = ({
  trashedDecks,
  trashedSeries,
  onRestoreDeck,
  onRestoreSeries,
  onDeleteDeckPermanently,
  onDeleteSeriesPermanently,
  openConfirmModal,
}) => {

  const handleDeleteDeck = (deck: Deck) => {
    openConfirmModal({
        title: 'Permanently Delete Deck',
        message: `Are you sure you want to permanently delete the deck "${deck.name}"? This action cannot be undone.`,
        onConfirm: () => onDeleteDeckPermanently(deck.id)
    });
  };

  const handleDeleteSeries = (series: DeckSeries) => {
    openConfirmModal({
        title: 'Permanently Delete Series',
        message: `Are you sure you want to permanently delete the series "${series.name}"? This action cannot be undone.`,
        onConfirm: () => onDeleteSeriesPermanently(series.id)
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Trash</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Items in the trash will be permanently deleted after {TRASH_RETENTION_DAYS} days.</p>
      </div>
      
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Trashed Series</h2>
        {trashedSeries.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-200 dark:divide-gray-700">
            {trashedSeries.map(series => {
              const daysLeft = calculateDaysLeft(series.deletedAt!);
              return (
              <div key={series.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center min-w-0">
                  <Icon name="list" className="w-6 h-6 mr-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-gray-900 dark:text-gray-100">{series.name}</p>
                    <p className={`text-sm ${daysLeft <= 2 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      {daysLeft > 0 ? `${daysLeft} days left` : 'Deleting soon...'}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onRestoreSeries(series.id)}>
                      <Icon name="unarchive" className="w-4 h-4 mr-2" />
                      Restore
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteSeries(series)}>
                        <Icon name="trash-2" className="w-4 h-4 mr-2" />
                        Delete Now
                    </Button>
                </div>
              </div>
            )})}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Trash is empty.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Trashed Decks</h2>
        {trashedDecks.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-200 dark:divide-gray-700">
            {trashedDecks.map(deck => {
              const daysLeft = calculateDaysLeft(deck.deletedAt!);
              return (
              <div key={deck.id} className="p-4 flex justify-between items-center">
                 <div className="flex items-center min-w-0">
                    <Icon name={deck.type === 'quiz' ? 'help-circle' : 'laptop'} className="w-6 h-6 mr-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="font-semibold truncate text-gray-900 dark:text-gray-100">{deck.name}</p>
                        <p className={`text-sm ${daysLeft <= 2 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Deleting soon...'}
                        </p>
                    </div>
                 </div>
                 <div className="flex-shrink-0 flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onRestoreDeck(deck.id)}>
                      <Icon name="unarchive" className="w-4 h-4 mr-2" />
                      Restore
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteDeck(deck)}>
                        <Icon name="trash-2" className="w-4 h-4 mr-2" />
                        Delete Now
                    </Button>
                 </div>
              </div>
            )})}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
             <p className="text-gray-500 dark:text-gray-400">Trash is empty.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default TrashPage;