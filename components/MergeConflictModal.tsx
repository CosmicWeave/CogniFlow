import React, { useRef, useState, useMemo } from 'react';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import { BackupComparison, DeckType, FlashcardDeck, FullBackupData, LearningDeck, QuizDeck } from '../types.ts';
import { useStore } from '../store/store.ts';
import { MergeResolutionStrategy } from '../services/mergeService.ts';

interface MergeConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (strategy: MergeResolutionStrategy, remoteData: FullBackupData) => void;
  comparison: BackupComparison;
  remoteData: FullBackupData;
}

const getDeckItemCount = (deck: any) => {
    if (deck.type === DeckType.Flashcard) return (deck as FlashcardDeck).cards?.length || 0;
    return (deck as QuizDeck | LearningDeck).questions?.length || 0;
}

const DiffView: React.FC<{ label: string; localValue: React.ReactNode; remoteValue: React.ReactNode }> = ({ label, localValue, remoteValue }) => (
    <div className="text-sm">
        <span className="font-semibold">{label}: </span>
        <span className="text-text-muted">{localValue}</span>
        <Icon name="arrow-down" className="inline w-3 h-3 mx-1 rotate-[-90deg]" />
        <span className="text-primary font-semibold">{remoteValue}</span>
    </div>
);

const MergeConflictModal: React.FC<MergeConflictModalProps> = ({ isOpen, onClose, onResolve, comparison, remoteData }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  const { seriesProgress } = useStore();

  const [resolutions, setResolutions] = useState<MergeResolutionStrategy>({
      decks: {},
      series: {}
  });

  const [globalChoice, setGlobalChoice] = useState<'local' | 'remote' | 'mixed' | null>(null);

  // Initialize resolutions
  useMemo(() => {
      const initialResolutions: MergeResolutionStrategy = { decks: {}, series: {} };
      comparison.changedDecks.forEach(d => initialResolutions.decks[d.local.id] = 'remote'); // Default to remote (newer)
      comparison.changedSeries.forEach(s => initialResolutions.series[s.local.id] = 'remote'); // Default to remote
      setResolutions(initialResolutions);
  }, [comparison]);

  const toggleResolution = (type: 'decks' | 'series', id: string) => {
      setResolutions(prev => ({
          ...prev,
          [type]: {
              ...prev[type],
              [id]: prev[type][id] === 'local' ? 'remote' : 'local'
          }
      }));
      setGlobalChoice('mixed');
  };

  const handleGlobalChoose = (choice: 'local' | 'remote') => {
      const newResolutions: MergeResolutionStrategy = { decks: {}, series: {} };
      comparison.changedDecks.forEach(d => newResolutions.decks[d.local.id] = choice);
      comparison.changedSeries.forEach(s => newResolutions.series[s.local.id] = choice);
      setResolutions(newResolutions);
      setGlobalChoice(choice);
  };

  const handleResolve = () => {
    onResolve(resolutions, remoteData);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 id="conflict-title" className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
            Sync Conflict
          </h2>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-text-muted">
            Both your local data and the server data have changed since the last sync. Please choose which version to keep for each item.
          </p>
          
          <div className="flex gap-2 mb-4">
              <Button variant={globalChoice === 'local' ? 'primary' : 'secondary'} size="sm" onClick={() => handleGlobalChoose('local')}>Keep All Local</Button>
              <Button variant={globalChoice === 'remote' ? 'primary' : 'secondary'} size="sm" onClick={() => handleGlobalChoose('remote')}>Take All Remote</Button>
          </div>

          <div className="space-y-6">
              {(comparison.newSeries.length > 0 || comparison.newDecks.length > 0) && (
                  <div>
                    <h3 className="font-semibold text-text mb-2 flex items-center gap-2">
                        <Icon name="plus" className="w-4 h-4 text-green-500" /> 
                        New Items on Server (Will be added)
                    </h3>
                    <ul className="text-sm list-disc list-inside text-text-muted bg-background p-3 rounded-md border border-border">
                        {comparison.newSeries.map(s => <li key={s.id}>Series: "{s.name}"</li>)}
                        {comparison.newDecks.map(d => <li key={d.id}>Deck: "{d.name}"</li>)}
                    </ul>
                  </div>
              )}
              
              {comparison.changedSeries.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-text mb-2">Changed Series</h3>
                    <div className="space-y-3">
                        {comparison.changedSeries.map(({ local, backup }) => {
                            const localTotal = (local.levels || []).reduce((acc, l) => acc + (l.deckIds?.length || 0), 0);
                            const backupTotal = (backup.levels || []).reduce((acc, l) => acc + (l.deckIds?.length || 0), 0);
                            const localCompleted = seriesProgress.get(local.id)?.size || 0;
                            const backupCompleted = (remoteData.seriesProgress?.[backup.id] || []).length;
                            const isKeepingLocal = resolutions.series[local.id] === 'local';

                            return (
                                <div key={local.id} className={`p-3 rounded-md border transition-colors cursor-pointer ${isKeepingLocal ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`} onClick={() => toggleResolution('series', local.id)}>
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-bold">{local.name}</p>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${isKeepingLocal ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                            {isKeepingLocal ? 'Keeping Local' : 'Taking Server'}
                                        </span>
                                    </div>
                                    <DiffView label="Progress" localValue={`${localCompleted}/${localTotal}`} remoteValue={`${backupCompleted}/${backupTotal}`} />
                                    <p className="text-xs text-text-muted mt-2 text-right">Tap to toggle</p>
                                </div>
                            )
                        })}
                    </div>
                  </div>
              )}

              {comparison.changedDecks.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-text mb-2">Changed Decks</h3>
                     <div className="space-y-3">
                        {comparison.changedDecks.map(({ local, backup }) => {
                            const localDue = comparison.dueCounts.get(`local-${local.id}`) || 0;
                            const backupDue = comparison.dueCounts.get(backup.id) || 0;
                            const isKeepingLocal = resolutions.decks[local.id] === 'local';

                            return (
                                <div key={local.id} className={`p-3 rounded-md border transition-colors cursor-pointer ${isKeepingLocal ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`} onClick={() => toggleResolution('decks', local.id)}>
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-bold">{local.name}</p>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${isKeepingLocal ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                            {isKeepingLocal ? 'Keeping Local' : 'Taking Server'}
                                        </span>
                                    </div>
                                    <DiffView label="Items" localValue={getDeckItemCount(local)} remoteValue={getDeckItemCount(backup)} />
                                    <DiffView label="Due" localValue={localDue} remoteValue={backupDue} />
                                    <p className="text-xs text-text-muted mt-2 text-right">Tap to toggle</p>
                                </div>
                            )
                        })}
                    </div>
                  </div>
              )}
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-between items-center p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="danger" onClick={onClose}>
                Cancel Sync
            </Button>
            <Button variant="primary" onClick={handleResolve}>
                <Icon name="check-circle" className="mr-2" />
                Resolve & Merge
            </Button>
        </div>
      </div>
    </div>
  );
};

export default MergeConflictModal;