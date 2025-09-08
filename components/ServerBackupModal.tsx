import React, { useState, useRef, useEffect } from 'react';
import { BackupFileMetadata } from '../services/backupService';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import * as backupService from '../services/backupService';
import { useToast } from '../hooks/useToast';
import Spinner from './ui/Spinner';

interface ServerBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (filename: string) => void;
  onDelete: (filename: string) => void;
}

const ServerBackupModal: React.FC<ServerBackupModalProps> = ({ isOpen, onClose, onRestore, onDelete }) => {
  const [files, setFiles] = useState<BackupFileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveSyncInfo, setLiveSyncInfo] = useState<string | null>(null);
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen) {
        const fetchBackups = async () => {
            setIsLoading(true);
            setError(null);
            setLiveSyncInfo('Loading sync file info...');
            try {
                const [fetchedFiles, { metadata }] = await Promise.all([
                    backupService.listServerBackups(),
                    backupService.getSyncDataMetadata()
                ]);
                const sortedFiles = fetchedFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
                setFiles(sortedFiles);
                if (metadata) {
                    const syncDate = new Date(metadata.modified);
                    const sizeKB = (metadata.size / 1024).toFixed(1);
                    setLiveSyncInfo(`Live sync file: ${syncDate.toLocaleString()} (${sizeKB} KB)`);
                } else {
                    setLiveSyncInfo('No live sync file found on server.');
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to load backups.";
                setError(message);
                setLiveSyncInfo('Could not retrieve live sync file info.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchBackups();
    }
  }, [isOpen]);
  
  const handleRestore = (filename: string) => {
      onRestore(filename);
      onClose();
  };
  
  const handleDelete = async (filename: string) => {
      try {
        await onDelete(filename);
        setFiles(prev => prev.filter(f => f.filename !== filename));
        addToast(`Deleted backup: ${filename}`, 'success');
      } catch (e) {
        // Error toast is handled by the calling function
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col"
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold">Manage Server Backups</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </div>

        <div className="p-6 overflow-y-auto">
          <p className="text-text-muted mb-2">Select a backup to restore your live sync data from, or delete old backups. Restoring will overwrite the current sync file on the server.</p>
          {liveSyncInfo && <p className="text-sm text-text-muted mb-4 p-2 bg-background rounded-md">{liveSyncInfo}</p>}
          {isLoading ? (
             <div className="text-center py-8"><Spinner /></div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : files.length > 0 ? (
            <div className="space-y-2 border border-border rounded-md">
              {files.map(file => (
                <div key={file.filename} className="flex items-center justify-between p-3 hover:bg-background border-b border-border last:border-b-0">
                  <div className="text-sm min-w-0">
                    <p className="font-medium text-text truncate">{file.filename}</p>
                    <p className="text-text-muted">
                      {new Date(file.modified).toLocaleString()} - {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <Button variant="secondary" size="sm" onClick={() => handleRestore(file.filename)}>Restore</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(file.filename)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted">
                <p>No server backups found.</p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ServerBackupModal;