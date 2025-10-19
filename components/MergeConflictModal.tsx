import React, { useRef } from 'react';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';

interface MergeConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (resolution: 'local' | 'remote') => void;
  localData: { lastModified: number | null };
  remoteData: { modified: string };
}

const MergeConflictModal: React.FC<MergeConflictModalProps> = ({
  isOpen,
  onClose,
  onResolve,
  localData,
  remoteData,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const handleResolve = (resolution: 'local' | 'remote') => {
    onResolve(resolution);
    onClose();
  };

  const localDate = localData.lastModified ? new Date(localData.lastModified).toLocaleString() : 'N/A';
  const remoteDate = new Date(remoteData.modified).toLocaleString();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-lg transform transition-all relative"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
      >
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 id="conflict-title" className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
            Sync Conflict
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-text-muted">
            Both your local data and the server data have changed since the last sync. Please choose which version to keep.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-border rounded-lg text-center">
              <h3 className="font-semibold text-text">Keep Local Changes</h3>
              <p className="text-xs text-text-muted mt-1">Last modified: {localDate}</p>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => handleResolve('local')}>
                <Icon name="laptop" className="mr-2" />
                Choose Local
              </Button>
            </div>
             <div className="p-4 border-2 border-primary rounded-lg text-center bg-primary/5">
              <h3 className="font-semibold text-text">Keep Server Changes</h3>
              <p className="text-xs text-text-muted mt-1">Last modified: {remoteDate}</p>
              <Button variant="primary" className="mt-4 w-full" onClick={() => handleResolve('remote')}>
                <Icon name="upload-cloud" className="mr-2" />
                Choose Server
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="danger" onClick={onClose}>
            Cancel Sync
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MergeConflictModal;