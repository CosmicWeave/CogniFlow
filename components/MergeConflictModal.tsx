import React from 'react';
import { FullBackupData } from '../types';
import Button from './ui/Button';

interface MergeConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (mergedData: FullBackupData) => void;
  localData: FullBackupData;
  remoteData: FullBackupData;
}

const MergeConflictModal: React.FC<MergeConflictModalProps> = ({
  isOpen,
  onClose,
  onResolve,
  localData,
  remoteData,
}) => {
  if (!isOpen) return null;

  const handleKeepLocal = () => {
    onResolve(localData);
    onClose();
  };
  
  const handleKeepRemote = () => {
    onResolve(remoteData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-4">Merge Conflict</h2>
        <p className="text-text-muted mb-6">
          Your local data and server data have both changed. Choose which version to keep.
        </p>
        <div className="flex justify-end gap-4">
          <Button onClick={handleKeepLocal} variant="secondary">Keep My Local Data</Button>
          <Button onClick={handleKeepRemote} variant="primary">Use Server Data</Button>
        </div>
      </div>
    </div>
  );
};

export default MergeConflictModal;
