




import React, { useMemo } from 'react';
import { Deck, DeckSeries } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useStore } from '../store/store';

interface ArchivePageProps {
  onUpdateDeck: (deck: Deck) => void;
  onUpdateSeries: (series: DeckSeries) => void;
  onDeleteDeck: (deckId: string) => void;
  onDeleteSeries: (seriesId: string) => void;
  openConfirmModal: (props: any) => void;
}

const ArchivePage: React.FC<ArchivePageProps> = ({ onUpdateDeck, onUpdateSeries, onDeleteDeck, onDeleteSeries, openConfirmModal }) => {
  const { decks, deckSeries } = useStore();
  
  const archivedDecks = useMemo(() => decks.filter(d => d.archived && !d.deletedAt), [decks]);
  const archivedSeries = useMemo(() => deckSeries.filter(s => s.archived && !s.deletedAt), [deckSeries]);

  const handleUnarchiveDeck = (deck: Deck) => {
    onUpdateDeck({ ...deck, archived: false });
  };
  
  const handleUnarchiveSeries = (series: DeckSeries) => {
    onUpdateSeries({ ...series, archived: false });
  };

  const handleDeleteDeck = (deck: Deck) => {
    openConfirmModal({
        title: 'Move Deck to Trash',
        message: `Are you sure you want to move the archived deck "${deck.name}" to the trash? This will un-archive it and place it in the trash for 10 days, after which it will be permanently deleted.`,
        onConfirm: () => onDeleteDeck(deck.id)
    });
  };

  const handleDeleteSeries = (series: DeckSeries) => {
    openConfirmModal({
        title: 'Move Series to Trash',
        message: `Are you sure you want to move the archived series "${series.name}" to the trash? It will be un-archived and placed in the trash for 10 days. Decks within the series will NOT be deleted.`,
        onConfirm: () => onDeleteSeries(series.id)
    });
  };


  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <h1 className="text-3xl font-bold mb-6 text-text border-b border-border pb-4">Archive</h1>
      
      <section>
        <h2 className="text-2xl font-semibold text-text mb-4">Archived Series</h2>
        {archivedSeries.length > 0 ? (
          <div className="bg-surface rounded-lg shadow-md divide-y divide-border">
            {archivedSeries.map(series => (
              <div key={series.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center min-w-0">
                  <Icon name="list" className="w-6 h-6 mr-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-text">{series.name}</p>
                    <p className="text-sm text-text-muted truncate">{series.description}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleUnarchiveSeries(series)}>
                      <Icon name="unarchive" className="w-4 h-4 mr-2" />
                      Unarchive
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteSeries(series)}>
                        <Icon name="trash-2" className="w-4 h-4 mr-2" />
                        Move to Trash
                    </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-background/50 rounded-lg">
            <p className="text-text-muted">No archived series.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-text mb-4">Archived Decks</h2>
        {archivedDecks.length > 0 ? (
          <div className="bg-surface rounded-lg shadow-md divide-y divide-border">
            {archivedDecks.map(deck => (
              <div key={deck.id} className="p-4 flex justify-between items-center">
                 <div className="flex items-center min-w-0">
                    <Icon name={deck.type === 'quiz' ? 'help-circle' : 'laptop'} className="w-6 h-6 mr-4 text-text-muted flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="font-semibold truncate text-text">{deck.name}</p>
                        <p className="text-sm text-text-muted truncate">{deck.description}</p>
                    </div>
                 </div>
                 <div className="flex-shrink-0 flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleUnarchiveDeck(deck)}>
                      <Icon name="unarchive" className="w-4 h-4 mr-2" />
                      Unarchive
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteDeck(deck)}>
                        <Icon name="trash-2" className="w-4 h-4 mr-2" />
                        Move to Trash
                    </Button>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-background/50 rounded-lg">
             <p className="text-text-muted">No archived decks.</p>
          </div>
        )}
      </section>

    </div>
  );
};

export default ArchivePage;