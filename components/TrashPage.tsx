import React, { useMemo } from 'react';
import { Deck, DeckSeries } from '../types.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useStore } from '../store/store.ts';

interface TrashPageProps {
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
  onRestoreDeck,
  onRestoreSeries,
  onDeleteDeckPermanently,
  onDeleteSeriesPermanently,
  openConfirmModal,
}) => {
  const { decks, deckSeries } = useStore();

  const trashedDecks = useMemo(() => decks.filter(d => d.deletedAt), [decks]);
  const trashedSeries = useMemo(() => deckSeries.filter(s => s.deletedAt), [deckSeries]);


  const handleDeleteDeck = (deck: Deck) => {
    openConfirmModal({
        title: 'Permanently Delete Deck',
        message: `Are you sure you want to permanently delete the deck "${deck.name}"? This action cannot be undone.`,
        onConfirm: () => onDeleteDeckPermanently(deck.id)
    });
  };

  const handleDeleteSeries = (series: DeckSeries) => {
    const deckCount = (series.levels || []).reduce((sum, level) => sum + (level?.deckIds?.length || 0), 0);
    openConfirmModal({
        title: 'Permanently Delete Series',
        message: `Are you sure you want to permanently delete the series "${series.name}"? All ${deckCount} deck(s) inside it will also be permanently deleted. This action cannot be undone.`,
        onConfirm: () => onDeleteSeriesPermanently(series.id)
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <div className="border-b border-border pb-4">
        <h1 className="text-3xl font-bold text-text">Trash</h1>
        <p className="mt-2 text-text-muted">Items in the trash will be permanently deleted after {TRASH_RETENTION_DAYS} days.</p>
      </div>
      
      <section>
        <h2 className="text-2xl font-semibold text-text mb-4">Trashed Series</h2>
        {trashedSeries.length > 0 ? (
          <div className="bg-surface rounded-lg shadow-md divide-y divide-border">
            {trashedSeries.map(series => {
              const daysLeft = calculateDaysLeft(series.deletedAt!);
              return (
              <div key={series.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center min-w-0">
                  <Icon name="list" className="w-6 h-6 mr-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-text">{series.name}</p>
                    <p className={`text-sm ${daysLeft <= 2 ? 'text-red-500' : 'text-text-muted'}`}>
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
          <div className="text-center py-10 bg-surface rounded-lg border border-border">
            <Icon name="trash-2" className="w-12 h-12 mx-auto text-text-muted/50" />
            <h3 className="mt-2 text-xl font-medium text-text">Trash is Empty</h3>
            <p className="mt-1 text-sm text-text-muted">
              Deleted series will appear here for {TRASH_RETENTION_DAYS} days.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-text mb-4">Trashed Decks</h2>
        {trashedDecks.length > 0 ? (
          <div className="bg-surface rounded-lg shadow-md divide-y divide-border">
            {trashedDecks.map(deck => {
              const daysLeft = calculateDaysLeft(deck.deletedAt!);
              return (
              <div key={deck.id} className="p-4 flex justify-between items-center">
                 <div className="flex items-center min-w-0">
                    <Icon name={deck.type === 'quiz' ? 'help-circle' : 'laptop'} className="w-6 h-6 mr-4 text-text-muted flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="font-semibold truncate text-text">{deck.name}</p>
                        <p className={`text-sm ${daysLeft <= 2 ? 'text-red-500' : 'text-text-muted'}`}>
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
          <div className="text-center py-10 bg-surface rounded-lg border border-border">
             <Icon name="trash-2" className="w-12 h-12 mx-auto text-text-muted/50" />
             <h3 className="mt-2 text-xl font-medium text-text">Trash is Empty</h3>
             <p className="mt-1 text-sm text-text-muted">
               Deleted decks will appear here for {TRASH_RETENTION_DAYS} days.
             </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default TrashPage;