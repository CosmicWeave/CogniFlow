

import React, { useState, useRef } from 'react';
import { Deck, Folder, DeckSeries } from '../types';
import { parseAndValidateBackupFile } from '../services/importService';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Spinner from './ui/Spinner';
import ConfirmModal from './ConfirmModal';

interface RestoreData {
    decks: Deck[];
    folders: Folder[];
    deckSeries: DeckSeries[];
}

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (data: RestoreData) => Promise<void>;
}

const RestoreModal: React.FC<RestoreModalProps> = ({ isOpen, onClose, onRestore }) => {
  const [fileName, setFileName] = useState('');
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<RestoreData | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);


  const handleClose = () => {
    setFileName('');
    setLoadingText(null);
    setParsedData(null);
    onClose();
  };

  const processFile = async (file: File) => {
    if (!file) return;

    setFileName(file.name);
    setParsedData(null);
    setLoadingText('Processing file...');

    try {
        if (file.name.toLowerCase().endsWith('.json')) {
            const text = await file.text();
            const data = parseAndValidateBackupFile(text);
            setParsedData(data);
            addToast(`Backup file "${file.name}" is valid and ready to restore.`, 'success');
        } else {
            addToast("Unsupported file type. Please upload a '.json' backup file.", 'error');
            setFileName('');
        }
    } catch (error) {
        console.error("Failed to process file:", error);
        addToast(`Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`, 'error');
        setFileName('');
    } finally {
        setLoadingText(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (loadingText) return;
    const file = event.target.files?.[0];
    if (file) processFile(file);
    if (event.target) {
        event.target.value = '';
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (loadingText) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();

  const handleRestore = async () => {
    if (parsedData) {
        setIsConfirmOpen(false);
        setLoadingText('Restoring data...');
        try {
            await onRestore(parsedData);
            // On success, App.tsx shows a toast and we just close the modal.
            handleClose();
        } catch (error) {
            // On failure, App.tsx shows a toast, and we just stop the loading indicator.
            setLoadingText(null);
        }
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden transform transition-all relative">
        {loadingText && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col items-center justify-center z-20">
                <Spinner />
                <p className="text-lg text-gray-700 dark:text-gray-300 mt-4">{loadingText}</p>
            </div>
        )}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold">Restore from Backup</h2>
          <Button variant="ghost" onClick={handleClose} className="p-1 h-auto" disabled={!!loadingText}><Icon name="x" /></Button>
        </div>

        <div className="p-6 space-y-4">
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-red-700 dark:text-red-200">
                <p><strong className="font-bold">Warning:</strong> Restoring from a backup will merge and overwrite data. Decks and folders with the same ID will be replaced. This action cannot be undone.</p>
            </div>
            
            <input type="file" ref={fileInputRef} className="hidden" accept=".json,application/json" onChange={handleFileChange} disabled={!!loadingText} />
            <label onDragOver={handleDragOver} onDrop={handleDrop} className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg transition-colors ${loadingText ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                <Icon name="upload-cloud" className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2"/>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400" onClick={(e) => { if (!loadingText) { e.preventDefault(); fileInputRef.current?.click(); }}}>
                        Click to upload
                    </span> or drag and drop</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">CogniFlow Backup JSON file</p>
                {fileName && <p className={`text-sm mt-2 truncate ${parsedData ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} title={fileName}>{fileName}</p>}
            </label>
        </div>

        <div className="flex justify-end p-4 bg-gray-100/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={handleClose} className="mr-2" disabled={!!loadingText}>Cancel</Button>
          <Button variant="danger" onClick={() => setIsConfirmOpen(true)} disabled={!parsedData || !!loadingText}>
            {loadingText ? 'Please wait...' : 'Restore'}
          </Button>
        </div>
      </div>
    </div>
    {isConfirmOpen && (
        <ConfirmModal
            isOpen={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            onConfirm={handleRestore}
            title="Confirm Restore"
            message="Restoring from a backup will overwrite existing decks and folders with the same ID. This action cannot be undone. Are you sure you want to continue?"
        />
    )}
    </>
  );
};

export default RestoreModal;