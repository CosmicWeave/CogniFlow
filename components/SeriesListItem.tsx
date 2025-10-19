

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Deck, DeckSeries, DeckType, FlashcardDeck, QuizDeck, LearningDeck } from '../types.ts';
import Button from './ui/Button.tsx';
import Link from './ui/Link.tsx';
import { getEffectiveMasteryLevel } from '../services/srs.ts';
import MasteryBar from './ui/MasteryBar.tsx';
import Icon, { IconName } from './ui/Icon.tsx';
import { useRouter } from '../contexts/RouterContext.tsx';
import { stripHtml } from '../services/utils.ts';
import { useStore } from '../store/store.ts';
import Spinner from './ui/Spinner.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import ProgressBar from './ui/ProgressBar.tsx';

interface SeriesListItemProps {
  series: DeckSeries;
  completedCount: number;
  dueCount: number;
  onStartSeriesStudy: (seriesId: string) => Promise<void>;
  masteryLevel: number;
  nextUpDeckId: string | null;
  onGenerateAllQuestions?: (seriesId: string) => void;
}

const SeriesListItem: React.FC<SeriesListItemProps> = ({ series, completedCount, dueCount, onStartSeriesStudy, masteryLevel, nextUpDeckId, onGenerateAllQuestions }) => {
    const { aiGenerationStatus, decks } = useStore();
    const totalCount = (series.levels || []).reduce((sum, level) => sum + (level?.deckIds?.length || 0), 0);
    const isCompleted = completedCount >= totalCount && totalCount > 0;

    const isGeneratingThisSeries = aiGenerationStatus.currentTask?.seriesId === series.id;

    const hasEmptyDecks = useMemo(() => {
        const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
        const seriesDecks = decks.filter(d => seriesDeckIds.has(d.id));
        return seriesDecks.some(d => (d.type === DeckType.Quiz || d.type === DeckType.Learning) && (d.questions?.length || 0) === 0);
    }, [series.levels, decks]);

    return (
        <Link 
            href={`/series/${series.id}`}
            className="block bg-surface rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-transparent hover:border-primary"
        >
             <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center mb-1">
                            <Icon name="layers" className="w-5 h-5 mr-2 text-purple-500 dark:text-purple-400" />
                            <h3 className="text-xl font-bold text-text break-words">{series.name}</h3>
                        </div>
                        {series.description && (
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none text-text-muted mt-1 truncate"
                                title={stripHtml(series.description)}
                                dangerouslySetInnerHTML={{ __html: series.description }}
                            />
                        )}
                    </div>
                    {isCompleted && (
                        <div className="flex-shrink-0 flex items-center gap-2 text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-3 py-1 rounded-full">
                            <Icon name="check-circle" className="w-4 h-4" />
                            <span className="text-sm font-semibold">Completed</span>
                        </div>
                    )}
                </div>
                {totalCount > 0 && (
                    <div className="mt-3 space-y-3">
                        <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="font-medium text-text-muted">Completion</span>
                                <span className="font-semibold text-text-muted">{completedCount} / {totalCount}</span>
                            </div>
                            <ProgressBar current={completedCount} total={totalCount} />
                        </div>
                         <div>
                            <MasteryBar level={masteryLevel} />
                        </div>
                    </div>
                )}
                <div className="mt-4 pt-4 border-t border-border/50 flex justify-end gap-2">
                    {isGeneratingThisSeries ? (
                        <div className="flex items-center text-text-muted">
                            <Spinner size="sm" />
                            <span className="ml-2 text-sm font-semibold">Generating...</span>
                        </div>
                    ) : (
                        <>
                            {nextUpDeckId && (
                                 <Link
                                    href={`/decks/${nextUpDeckId}/study?seriesId=${series.id}`}
                                    passAs={Button}
                                    variant="primary"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}
                                >
                                    <Icon name="laptop" className="w-4 h-4 mr-2"/>
                                    Continue
                                </Link>
                            )}
                            {hasEmptyDecks && dueCount === 0 && !nextUpDeckId && onGenerateAllQuestions && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onGenerateAllQuestions(series.id);
                                    }}
                                >
                                    <Icon name="zap" className="w-4 h-4 mr-2"/>
                                    Generate Questions
                                </Button>
                            )}
                             <Button 
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onStartSeriesStudy(series.id);
                                }}
                                disabled={dueCount === 0}
                            >
                                <Icon name="zap" className="w-4 h-4 mr-2"/>
                                Study Due ({dueCount})
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default SeriesListItem;