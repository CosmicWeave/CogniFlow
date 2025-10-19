import React from 'react';
import { Deck, DeckSeries, DeckType, FlashcardDeck, QuizDeck, LearningDeck, Reviewable } from '../types.ts';
import { useStore } from '../store/store.ts';
import { getEffectiveMasteryLevel } from '../services/srs.ts';
// FIX: Changed to named import to match the updated export in DeckListItem.tsx.
import { DeckListItem } from './DeckListItem.tsx';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { stripHtml } from '../services/utils.ts';
import TruncatedText from './ui/TruncatedText.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import Spinner from './ui/Spinner.tsx';

interface SeriesOverviewPageProps {
  series: DeckSeries;
  sessionsToResume: Set<string>;
  onUpdateSeries: (series: DeckSeries, options?: { toastMessage?: string }) => void;
  onDeleteSeries: (seriesId: string) => void;
  onAddDeckToSeries: (seriesId: string, newDeck: QuizDeck) => void;
  onUpdateDeck: (deck: Deck, options?: { toastMessage?: string }) => void;
  onStartSeriesStudy: (seriesId: string) => Promise<void>;
  onUpdateLastOpened: (seriesId: string) => void;
  openConfirmModal: (props: any) => void;
  onAiAddLevelsToSeries: (seriesId: string) => void;
  onAiAddDecksToLevel: (seriesId: string, levelIndex: number) => void;
  handleGenerateQuestionsForEmptyDecksInSeries: (seriesId: string) => void;
  handleGenerateQuestionsForDeck: (deck: QuizDeck) => void;
  onCancelAIGeneration: () => void;
  onExportSeries: (series: DeckSeries) => void;
  // FIX: Added missing properties to pass down to DeckListItem.
  onDeleteDeck: (deckId: string) => void;
  handleGenerateContentForLearningDeck: (deck: LearningDeck) => void;
}

const SeriesOverviewPage: React.FC<SeriesOverviewPageProps> = (props) => {
  const { series, sessionsToResume, onUpdateLastOpened, onUpdateDeck, onDeleteDeck, openConfirmModal, handleGenerateQuestionsForDeck, handleGenerateContentForLearningDeck } = props;
  const { decks, aiGenerationStatus } = useStore();
  const { aiFeaturesEnabled } = useSettings();

  React.useEffect(() => {
    onUpdateLastOpened(series.id);
  }, [series.id, onUpdateLastOpened]);
  
  const hasEmptyDecks = React.useMemo(() => {
    const seriesDeckIds = new Set((series.levels || []).flatMap(l => l?.deckIds || []));
    const seriesDecks = decks.filter(d => seriesDeckIds.has(d.id));
    return seriesDecks.some(d => (d.type === DeckType.Quiz || d.type === DeckType.Learning) && (d.questions?.length || 0) === 0);
  }, [series.levels, decks]);
  
  const isGeneratingThisSeries = aiGenerationStatus.currentTask?.seriesId === series.id;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <div className="bg-surface rounded-lg shadow-md p-6 border border-border">
        <h2 className="text-3xl font-bold mb-2 text-text break-words">{series.name}</h2>
        {series.description && <TruncatedText html={series.description} className="text-text-muted prose dark:prose-invert max-w-none" />}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Button variant="ghost" onClick={() => props.onExportSeries(series)}><Icon name="download" className="mr-2"/> Export</Button>
            <Button variant="ghost" onClick={() => props.onDeleteSeries(series.id)}><Icon name="trash-2" className="mr-2"/> Move to Trash</Button>
            {aiFeaturesEnabled && hasEmptyDecks && (
              <Button
                variant="secondary"
                onClick={() => props.handleGenerateQuestionsForEmptyDecksInSeries(series.id)}
                disabled={isGeneratingThisSeries}
              >
                {isGeneratingThisSeries ? <span className="mr-2"><Spinner size="sm" /></span> : <Icon name="zap" className="w-4 h-4 mr-2" />}
                {isGeneratingThisSeries ? 'Generating...' : 'Generate All Questions'}
              </Button>
            )}
        </div>
      </div>

      <div className="space-y-8">
        {(series.levels || []).map((level, index) => (
          <div key={index}>
            <h3 className="text-2xl font-semibold text-text mb-4 border-b border-border pb-2">{level.title}</h3>
            <div className="space-y-4">
              {level.deckIds.map(deckId => {
                const deck = decks.find(d => d.id === deckId);
                if (!deck) return <div key={deckId} className="p-4 bg-red-100 text-red-800 rounded-md">Deck with ID "{deckId}" not found.</div>;
                
                return (
                  <DeckListItem
                    key={deck.id}
                    deck={deck}
                    sessionsToResume={sessionsToResume}
                    onUpdateLastOpened={() => onUpdateLastOpened(series.id)}
                    draggedDeckId={null}
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                    onUpdateDeck={onUpdateDeck}
                    onDeleteDeck={onDeleteDeck}
                    openConfirmModal={openConfirmModal}
                    handleGenerateQuestionsForDeck={handleGenerateQuestionsForDeck as any}
                    handleGenerateContentForLearningDeck={handleGenerateContentForLearningDeck as any}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SeriesOverviewPage;