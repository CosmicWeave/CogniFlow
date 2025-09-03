
import React, { useState, useRef } from 'react';
import { GoogleDriveFile } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface RestoreFromDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (fileId: string) => void;
  files: GoogleDriveFile[];
}

const RestoreFromDriveModal: React.FC<RestoreFromDriveModalProps> = ({
  isOpen,
  onClose,
  onRestore,
  files,
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const handleRestore = () => {
    if (selectedFileId) {
      onRestore(selectedFileId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform transition-all relative max-h-[90vh] flex flex-col"
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold">Restore from Google Drive</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </div>

        <div className="p-6 overflow-y-auto">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Select a backup file to restore. Restoring will overwrite decks with the same ID.</p>
          {files.length > 0 ? (
            <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-md">
              {files.map(file => (
                <label key={file.id} className="flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                  <input
                    type="radio"
                    name="backup-file"
                    value={file.id}
                    checked={selectedFileId === file.id}
                    onChange={() => setSelectedFileId(file.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <div className="ml-3 text-sm">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Last modified: {new Date(file.modifiedTime).toLocaleString()}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No backup files found in your Google Drive application folder.</p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 bg-gray-100/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
          <Button type="button" variant="danger" onClick={handleRestore} disabled={!selectedFileId}>
            Restore Selected
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RestoreFromDriveModal;