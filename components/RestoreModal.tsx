import React, { useState, useRef } from 'react';
// FIX: Corrected import path for types
import { FullBackupData } from '../types';
import { parseAndValidateBackupFile } from '../services/importService';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Spinner from './ui/Spinner';
import ConfirmModal from './ConfirmModal';

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (data: FullBackupData) => Promise<void>;
}

const RestoreModal: React.FC<RestoreModalProps> = ({ isOpen, onClose, onRestore }) => {
  const [fileName, setFileName] = useState('');
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<FullBackupData | null>(null);
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
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer, 0, 4);
        const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;

        if (isZip) {
            throw new Error("This appears to be a ZIP file (like an Anki package). This modal only accepts '.json' backup files. Please use the main 'Import' modal for Anki packages.");
        }

        const text = new TextDecoder().decode(buffer);
        const data = parseAndValidateBackupFile(text);
        setParsedData(data);
        addToast(`Backup file "${file.name}" is valid and ready to restore.`, 'success');
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg overflow-hidden transform transition-all relative">
        {loadingText && (
            <div className="absolute inset-0 bg-surface/80 flex flex-col items-center justify-center z-20">
                <Spinner />
                <p className="text-lg text-text mt-4">{loadingText}</p>
            </div>
        )}
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold">Restore from Backup</h2>
          <Button variant="ghost" onClick={handleClose} className="p-1 h-auto" disabled={!!loadingText}><Icon name="x" /></Button>
        </div>

        <div className="p-6 space-y-4">
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-red-700 dark:text-red-200">
                <p><strong className="font-bold">Warning:</strong> Restoring from a backup will merge and overwrite data. Decks and folders with the same ID will be replaced. This action cannot be undone.</p>
            </div>
            
            <input type="file" ref={fileInputRef} className="hidden" accept=".json,application/json" onChange={handleFileChange} disabled={!!loadingText} />
            <label onDragOver={handleDragOver} onDrop={handleDrop} className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg transition-colors ${loadingText ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-background'}`}>
                <Icon name="upload-cloud" className="w-10 h-10 text-text-muted mb-2"/>
                <p className="text-sm text-text-muted">
                    <span className="font-semibold text-primary" onClick={(e) => { if (!loadingText) { e.preventDefault(); fileInputRef.current?.click(); }}}>
                        Click to upload
                    </span> or drag and drop</p>
                <p className="text-xs text-text-muted/70">CogniFlow Backup JSON file</p>
                {fileName && <p className={`text-sm mt-2 truncate ${parsedData ? 'text-green-600' : 'text-red-600'}`} title={fileName}>{fileName}</p>}
            </label>
        </div>

        <div className="flex justify-end p-4 bg-background/50 border-t border-border">
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