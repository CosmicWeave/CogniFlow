import React, { useState, useMemo } from 'react';
import { Deck, DeckSeries, SeriesProgress, Reviewable, DeckType, FlashcardDeck, QuizDeck } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import SeriesListItem from './SeriesListItem';
import DeckSortControl from './ui/DeckSortControl';
import { useStore } from '../store/store';
import { getEffectiveMasteryLevel } from '../services/srs';

type SortPreference = 'name' | 'progress' | 'mastery';
type FilterPreference = 'all' | 'inProgress' | 'completed';

interface AllSeriesPageProps {
  seriesProgress: SeriesProgress;
  onStartSeriesStudy: (seriesId: string) => Promise<void>;
  onCreateNewSeries: () => void;
  onCreateSampleSeries: () => void;
}

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === 'quiz' ? (deck as QuizDeck).questions : (deck as FlashcardDeck).cards;
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

const AllSeriesPage: React.FC<AllSeriesPageProps> = ({
  seriesProgress,
  onStartSeriesStudy,
  onCreateNewSeries,
  onCreateSampleSeries
}) => {
    const { deckSeries: allSeries, decks } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [sort, setSort] = useState<SortPreference>('name');
    const [filter, setFilter] = useState<FilterPreference>('all');
    
    const series = useMemo(() => allSeries.filter(s => !s.archived && !s.deletedAt), [allSeries]);

    const seriesData = useMemo(() => {
        const data = new Map<string, { dueCount: number, mastery: number }>();
        series.forEach(s => {
            const seriesDecks = (s.levels || []).flatMap(l => l.deckIds || []).map(id => decks.find(d => d.id === id)).filter(Boolean) as Deck[];
            
            const completedCount = seriesProgress.get(s.id)?.size || 0;
            const unlockedDeckIds = new Set<string>();
            const flatDeckIds = (s.levels || []).flatMap(l => l.deckIds || []);
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

            const allItems = seriesDecks.flatMap<Reviewable>(d => d.type === DeckType.Flashcard ? (d as FlashcardDeck).cards : (d as QuizDeck).questions).filter(i => !i.suspended);
            const mastery = allItems.length > 0 ? allItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0) / allItems.length : 0;
            
            data.set(s.id, { dueCount, mastery });
        });
        return data;
    }, [series, decks, seriesProgress]);


    const filteredAndSortedSeries = useMemo(() => {
        let filteredSeries = series.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.description.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filter !== 'all') {
            filteredSeries = filteredSeries.filter(s => {
                const totalDecks = (s.levels || []).reduce((acc, level) => acc + (level.deckIds || []).length, 0);
                if (totalDecks === 0) return filter === 'inProgress';
                const completedDecks = seriesProgress.get(s.id)?.size || 0;
                const isCompleted = completedDecks >= totalDecks;
                return filter === 'completed' ? isCompleted : !isCompleted;
            });
        }
        
        switch(sort) {
            case 'progress':
                return filteredSeries.sort((a, b) => {
                    const progressA = (seriesProgress.get(a.id)?.size || 0) / ((a.levels || []).reduce((acc, l) => acc + (l.deckIds || []).length, 0) || 1);
                    const progressB = (seriesProgress.get(b.id)?.size || 0) / ((b.levels || []).reduce((acc, l) => acc + (l.deckIds || []).length, 0) || 1);
                    return progressB - progressA;
                });
            case 'mastery':
                return filteredSeries.sort((a,b) => {
                    const masteryA = seriesData.get(a.id)?.mastery || 0;
                    const masteryB = seriesData.get(b.id)?.mastery || 0;
                    return masteryB - masteryA;
                });
            case 'name':
            default:
                return filteredSeries.sort((a,b) => a.name.localeCompare(b.name));
        }

    }, [series, searchTerm, sort, filter, seriesProgress, seriesData]);

    const sortOptions: readonly { key: SortPreference; label: string }[] = [
      { key: 'name', label: 'Name' },
      { key: 'progress', label: 'Progress' },
      { key: 'mastery', label: 'Mastery' },
    ];
    
    const filterOptions: readonly { key: FilterPreference; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: 'inProgress', label: 'In Progress' },
      { key: 'completed', label: 'Completed' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-text">All Series</h1>
                 <Button variant="primary" onClick={onCreateNewSeries}>
                    <Icon name="layers" className="w-5 h-5 mr-2" />
                    Create New Series
                </Button>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-surface rounded-lg border border-border">
                <div className="relative w-full md:max-w-xs">
                    <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"/>
                    <input
                        type="text"
                        placeholder="Search series..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                        <Icon name="filter" className="w-5 h-5 text-text-muted"/>
                        <DeckSortControl currentSort={filter} onSortChange={(value) => setFilter(value)} sortOptions={filterOptions}/>
                    </div>
                    <DeckSortControl currentSort={sort} onSortChange={(value) => setSort(value)} sortOptions={sortOptions}/>
                </div>
            </div>

            {filteredAndSortedSeries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAndSortedSeries.map(s => {
                    const data = seriesData.get(s.id) || { dueCount: 0, mastery: 0 };
                    return (
                      <SeriesListItem
                        key={s.id}
                        series={s}
                        completedCount={seriesProgress.get(s.id)?.size || 0}
                        dueCount={data.dueCount}
                        masteryLevel={data.mastery}
                        onStartSeriesStudy={onStartSeriesStudy}
                      />
                  )})}
                </div>
            ) : (
                <div className="text-center py-10">
                    <Icon name="layers" className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600"/>
                    <h3 className="mt-2 text-xl font-medium text-text">
                        {searchTerm ? 'No series found' : 'Your series collection is empty'}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {searchTerm ? 'Try adjusting your search or filter.' : 'Create a new series or try a sample to get started.'}
                    </p>
                    {(!searchTerm && series.length === 0) && (
                        <div className="mt-6">
                            <Button onClick={onCreateSampleSeries} variant="secondary">
                                <Icon name="zap" className="w-4 h-4 mr-2"/> Create Sample Series
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AllSeriesPage;
