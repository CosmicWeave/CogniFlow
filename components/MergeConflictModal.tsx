import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FullBackupData } from '../types';
import { diffData, mergeData, MergeReport, UserResolution, Change, Conflict } from '../services/mergeService';
import Button from './ui/Button';
import Icon, { IconName } from './ui/Icon';
import Spinner from './ui/Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface MergeConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  localData: FullBackupData;
  remoteData: FullBackupData;
  onResolve: (mergedData: FullBackupData) => void;
}

const itemTypeToIcon: Record<string, IconName> = {
    deck: 'laptop',
    series: 'layers',
    folder: 'folder',
};

const ChangeItem: React.FC<{ change: Change<any> }> = ({ change }) => {
    const { type, item, itemType, source } = change;
    const colorClass = source === 'local' ? 'border-blue-500' : 'border-green-500';
    const typeClass = type === 'added' ? 'text-green-600' : 'text-red-600';
    const typeIcon = type === 'added' ? 'plus' : 'trash-2';

    return (
        <div className={`p-3 rounded-lg bg-background border-l-4 ${colorClass}`}>
            <div className="flex justify-between items-center">
                <div className="flex items-center min-w-0">
                    <Icon name={itemTypeToIcon[itemType]} className="w-5 h-5 mr-3 text-text-muted flex-shrink-0" />
                    <span className="font-semibold text-text truncate" title={item.name}>{item.name}</span>
                </div>
                <div className={`flex items-center text-sm font-medium ${typeClass}`}>
                    <Icon name={typeIcon} className="w-4 h-4 mr-1" />
                    <span>{type}</span>
                </div>
            </div>
        </div>
    );
};

const ConflictItem: React.FC<{ conflict: Conflict<any>, resolution?: UserResolution, onResolve: (resolution: UserResolution) => void }> = ({ conflict, resolution, onResolve }) => {
    return (
        <div className={`p-3 rounded-lg border-2 ${resolution ? 'border-primary' : 'border-yellow-500'} bg-background`}>
            <div className="flex items-center min-w-0 mb-3">
                <Icon name={itemTypeToIcon[conflict.itemType]} className="w-5 h-5 mr-3 text-text-muted flex-shrink-0" />
                <span className="font-semibold text-text truncate" title={conflict.local.name}>{conflict.local.name}</span>
            </div>
            <p className="text-sm text-text-muted mb-3">This {conflict.itemType} was modified on both your device and the server. Please choose which version to keep.</p>
            <div className="flex justify-center gap-2">
                <Button variant={resolution === 'keep_local' ? 'primary' : 'secondary'} size="sm" onClick={() => onResolve('keep_local')}>Keep My Version</Button>
                <Button variant={resolution === 'keep_remote' ? 'primary' : 'secondary'} size="sm" onClick={() => onResolve('keep_remote')}>Take Server Version</Button>
            </div>
        </div>
    );
};

const MergeConflictModal: React.FC<MergeConflictModalProps> = ({ isOpen, onClose, localData, remoteData, onResolve }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<MergeReport | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, UserResolution>>(new Map());

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen && localData && remoteData) {
      const diffReport = diffData(localData, remoteData);
      setReport(diffReport);
      setResolutions(new Map()); // Reset resolutions when modal opens
    }
  }, [isOpen, localData, remoteData]);

  const handleResolveConflict = (itemId: string, resolution: UserResolution) => {
    setResolutions(prev => new Map(prev).set(itemId, resolution));
  };

  const isFullyResolved = useMemo(() => {
    if (!report) return false;
    return report.conflicts.every(c => resolutions.has(c.id));
  }, [report, resolutions]);

  const handleConfirmMerge = () => {
    if (!isFullyResolved || !localData || !remoteData) return;
    const mergedData = mergeData(localData, remoteData, resolutions);
    onResolve(mergedData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-3xl transform transition-all relative max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text">Resolve Sync Conflicts</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {!report ? <div className="text-center p-8"><Spinner /></div> : (
            <>
              {report.hasConflicts && (
                <div>
                  <h3 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-2">Resolve Conflicts ({report.conflicts.length})</h3>
                  <p className="text-sm text-text-muted mb-4">The following items were modified on both devices. You must choose which version to keep for each.</p>
                  <div className="space-y-4">
                    {report.conflicts.map(conflict => (
                        <ConflictItem key={conflict.id} conflict={conflict} resolution={resolutions.get(conflict.id)} onResolve={(res) => handleResolveConflict(conflict.id, res)} />
                    ))}
                  </div>
                </div>
              )}
              {report.unconflictedChanges.length > 0 && (
                 <div>
                    <h3 className="text-lg font-semibold text-text mb-2">Unconflicted Changes ({report.unconflictedChanges.length})</h3>
                    <p className="text-sm text-text-muted mb-4">These changes were made on only one device and will be merged automatically.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <h4 className="text-center font-medium text-blue-600">Your Device's Changes</h4>
                            {report.unconflictedChanges.filter(c => c.source === 'local').map((change, i) => <ChangeItem key={i} change={change} />)}
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-center font-medium text-green-600">Server's Changes</h4>
                             {report.unconflictedChanges.filter(c => c.source === 'remote').map((change, i) => <ChangeItem key={i} change={change} />)}
                        </div>
                    </div>
                 </div>
              )}
              {report.unconflictedChanges.length === 0 && !report.hasConflicts && (
                <p className="text-text-muted text-center py-8">It seems the only changes were to review progress, which will be merged automatically.</p>
              )}
            </>
          )}
        </div>
        
        <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel Sync</Button>
          <Button type="button" variant="primary" onClick={handleConfirmMerge} disabled={!isFullyResolved}>
            Resolve & Sync
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MergeConflictModal;