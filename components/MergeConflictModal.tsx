import React, { useRef } from 'react';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import { BackupComparison, DeckType, FlashcardDeck, FullBackupData, LearningDeck, QuizDeck } from '../types.ts';
import { useStore } from '../store/store.ts';

interface MergeConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (resolution: 'local' | 'remote') => void;
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

  const handleResolve = (resolution: 'local' | 'remote') => {
    onResolve(resolution);
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
            Both your local data and the server data have changed since the last sync. Please review the differences and choose which version to keep.
          </p>
          
          <div className="space-y-3">
              {(comparison.newSeries.length > 0 || comparison.newDecks.length > 0) && (
                  <div>
                    <h3 className="font-semibold text-text mb-2">New Items on Server</h3>
                    <ul className="text-sm list-disc list-inside text-text-muted">
                        {comparison.newSeries.map(s => <li key={s.id}>New Series: "{s.name}"</li>)}
                        {comparison.newDecks.map(d => <li key={d.id}>New Deck: "{d.name}"</li>)}
                    </ul>
                  </div>
              )}
              
              {comparison.changedSeries.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-text mb-2">Changed Series</h3>
                    <div className="space-y-2">
                        {comparison.changedSeries.map(({ local, backup }) => {
                            const localTotal = (local.levels || []).reduce((acc, l) => acc + (l.deckIds?.length || 0), 0);
                            const backupTotal = (backup.levels || []).reduce((acc, l) => acc + (l.deckIds?.length || 0), 0);
                            const localCompleted = seriesProgress.get(local.id)?.size || 0;
                            const backupCompleted = (remoteData.seriesProgress?.[backup.id] || []).length;
                            return (
                                <div key={local.id} className="p-3 bg-background rounded-md border border-border">
                                    <p className="font-bold">{local.name}</p>
                                    <DiffView label="Progress" localValue={`${localCompleted}/${localTotal}`} remoteValue={`${backupCompleted}/${backupTotal}`} />
                                </div>
                            )
                        })}
                    </div>
                  </div>
              )}

              {comparison.changedDecks.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-text mb-2">Changed Decks</h3>
                     <div className="space-y-2">
                        {comparison.changedDecks.map(({ local, backup }) => {
                            const localDue = comparison.dueCounts.get(`local-${local.id}`) || 0;
                            const backupDue = comparison.dueCounts.get(backup.id) || 0;
                            return (
                                <div key={local.id} className="p-3 bg-background rounded-md border border-border">
                                    <p className="font-bold">{local.name}</p>
                                    <DiffView label="Items" localValue={getDeckItemCount(local)} remoteValue={getDeckItemCount(backup)} />
                                    <DiffView label="Due" localValue={localDue} remoteValue={backupDue} />
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
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleResolve('local')}>
                <Icon name="laptop" className="mr-2" />
                Keep My Changes
              </Button>
              <Button variant="primary" onClick={() => handleResolve('remote')}>
                <Icon name="upload-cloud" className="mr-2" />
                Take Server Version
              </Button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MergeConflictModal;