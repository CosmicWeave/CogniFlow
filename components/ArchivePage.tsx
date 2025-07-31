


import React from 'react';
import { Deck, DeckSeries } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface ArchivePageProps {
  archivedDecks: Deck[];
  archivedSeries: DeckSeries[];
  onUpdateDeck: (deck: Deck) => void;
  onUpdateSeries: (series: DeckSeries) => void;
  onDeleteDeck: (deckId: string) => void;
  onDeleteSeries: (seriesId: string) => void;
  openConfirmModal: (props: any) => void;
}

const ArchivePage: React.FC<ArchivePageProps> = ({ archivedDecks, archivedSeries, onUpdateDeck, onUpdateSeries, onDeleteDeck, onDeleteSeries, openConfirmModal }) => {

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
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-4">Archive</h1>
      
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Archived Series</h2>
        {archivedSeries.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-200 dark:divide-gray-700">
            {archivedSeries.map(series => (
              <div key={series.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center min-w-0">
                  <Icon name="list" className="w-6 h-6 mr-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-gray-900 dark:text-gray-100">{series.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{series.description}</p>
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
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">No archived series.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Archived Decks</h2>
        {archivedDecks.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-200 dark:divide-gray-700">
            {archivedDecks.map(deck => (
              <div key={deck.id} className="p-4 flex justify-between items-center">
                 <div className="flex items-center min-w-0">
                    <Icon name={deck.type === 'quiz' ? 'help-circle' : 'laptop'} className="w-6 h-6 mr-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="font-semibold truncate text-gray-900 dark:text-gray-100">{deck.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{deck.description}</p>
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
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
             <p className="text-gray-500 dark:text-gray-400">No archived decks.</p>
          </div>
        )}
      </section>

    </div>
  );
};

export default ArchivePage;