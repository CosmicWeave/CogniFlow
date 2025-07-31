

import React, { useState, useCallback, useRef } from 'react';
import { Deck, DeckType, FlashcardDeck } from '../types';
import { parseAndValidateImportData, createCardsFromImport, createQuestionsFromImport } from '../services/importService';
import { parseAnkiPkg } from '../services/ankiImportService';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Spinner from './ui/Spinner';
import Link from './ui/Link';
import { getStockholmDateString } from '../services/time';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDecks: (decks: Deck[]) => void;
}

type Tab = 'create' | 'paste' | 'upload';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onAddDecks }) => {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [deckName, setDeckName] = useState('');
  const [jsonContent, setJsonContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const resetState = useCallback(() => {
    setActiveTab('create');
    setDeckName('');
    setJsonContent('');
    setFileName('');
    setIsProcessing(false);
  }, []);
  
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleJsonContentChange = (content: string) => {
    setJsonContent(content);
    try {
      const parsed = parseAndValidateImportData(content);
      if (parsed?.type === DeckType.Quiz) {
        setDeckName(parsed.data.name);
      }
    } catch (error) {
        // Ignore parsing errors while typing
    }
  };

  const handleSubmit = useCallback(() => {
    if (activeTab === 'create') {
        if (!deckName.trim()) {
          addToast('Please enter a deck name.', 'error');
          return;
        }
        const newDeck: FlashcardDeck = {
            id: crypto.randomUUID(),
            name: deckName.trim(),
            type: DeckType.Flashcard,
            cards: [],
            description: `An empty deck created on ${getStockholmDateString()}`
        };
        onAddDecks([newDeck]);
        addToast(`Deck "${newDeck.name}" created.`, 'success');
        handleClose();
        return;
    }
    
    // This handles 'paste' and 'upload' tabs
    if (!jsonContent) {
        addToast('Please paste or upload content.', 'error');
        return;
    }

    if (!deckName.trim()) {
        addToast('Please enter a deck name.', 'error');
        return;
    }
    
    try {
      const parsed = parseAndValidateImportData(jsonContent);
      if (!parsed) return;

      let newDeck: Deck;
      if (parsed.type === DeckType.Flashcard) {
        const cards = createCardsFromImport(parsed.data);
        newDeck = {
          id: crypto.randomUUID(),
          name: deckName.trim(),
          type: DeckType.Flashcard,
          cards: cards,
          description: `${cards.length} imported flashcard${cards.length === 1 ? '' : 's'}.`
        };
      } else { // Quiz type
        const questions = createQuestionsFromImport(parsed.data.questions);
        newDeck = {
          id: crypto.randomUUID(),
          name: deckName.trim(),
          description: parsed.data.description,
          type: DeckType.Quiz,
          questions: questions
        };
      }
      onAddDecks([newDeck]);
      addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
      handleClose();

    } catch(error) {
       addToast(error instanceof Error ? error.message : 'Invalid JSON content.', 'error');
    }
  }, [deckName, activeTab, jsonContent, onAddDecks, handleClose, addToast]);

  const processFile = async (file: File) => {
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    try {
      if (file.name.toLowerCase().endsWith('.apkg')) {
          setDeckName(''); // Not needed for Anki import
          const buffer = await file.arrayBuffer();
          // Use the workerized parser
          const decks = await parseAnkiPkg(buffer);
          if (decks.length > 0) {
              onAddDecks(decks);
              addToast(`Successfully imported ${decks.length} deck(s) from ${file.name}.`, 'success');
              handleClose();
          } else {
              addToast('No valid decks found in the Anki package.', 'info');
              resetState();
          }
      } else if (file.name.toLowerCase().endsWith('.json')) {
          const text = await file.text();
          handleJsonContentChange(text);
          setIsProcessing(false); // Done processing text file
          addToast('File loaded. Enter a deck name and import.', 'info');
      } else {
          addToast("Unsupported file type. Please upload a '.json' or '.apkg' file.", 'error');
          setFileName('');
          setIsProcessing(false);
      }
    } catch (error) {
        console.error("Failed to process file:", error);
        addToast(`An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, 'error');
        resetState();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if(file) processFile(file);
    // Reset file input to allow uploading the same file again
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();
  
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  if (!isOpen) return null;

  const renderContent = () => {
    const isAnkiFile = fileName.toLowerCase().endsWith('.apkg');
    if (activeTab === 'upload' && isAnkiFile) {
        return <div className="text-gray-500 dark:text-gray-400 text-center py-12">Anki file selected. Decks will be imported automatically.</div>;
    }
    
    switch (activeTab) {
      case 'paste':
        return (
          <div>
            <textarea className="w-full h-48 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-gray-100" placeholder='Paste JSON here... e.g., [{"front": "Q1", "back": "A1"}] or a Quiz object.' value={jsonContent} onChange={(e) => handleJsonContentChange(e.target.value)} />
            <Link href="/instructions/json" onClick={onClose} className="text-sm text-blue-500 dark:text-blue-400 hover:underline mt-2 inline-flex items-center gap-1">
              <Icon name="help-circle" className="w-4 h-4"/>
              View JSON format guide
            </Link>
          </div>
        );
      case 'upload':
        return (
          <>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json,application/json,.apkg" onChange={handleFileChange} />
            <label onDragOver={handleDragOver} onDrop={handleDrop} className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Icon name="upload-cloud" className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2"/>
                <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold text-blue-500 dark:text-blue-400" onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}>Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">JSON or Anki (.apkg) files</p>
                {fileName && <p className="text-sm text-green-500 dark:text-green-400 mt-2 truncate" title={fileName}>{fileName}</p>}
            </label>
          </>
        );
      case 'create':
      default:
        return <p className="text-gray-500 dark:text-gray-400 text-center py-12">Create an empty flashcard deck.</p>;
    }
  };
  
  const showDeckNameInput = !(activeTab === 'upload' && fileName.toLowerCase().endsWith('.apkg'));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden transform transition-all relative">
        {isProcessing && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col items-center justify-center z-20">
                <Spinner />
                <p className="text-lg text-gray-700 dark:text-gray-300 mt-4">Processing file...</p>
            </div>
        )}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create / Import Deck</h2>
          <Button variant="ghost" onClick={handleClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </div>

        <div className="p-6 space-y-4">
          {showDeckNameInput && (
              <div>
                <label htmlFor="deck-name" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Deck Name</label>
                <input type="text" id="deck-name" value={deckName} onChange={(e) => setDeckName(e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. Japanese Vocabulary" />
              </div>
          )}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            { (['create', 'paste', 'upload'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`capitalize px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'border-b-2 border-blue-500 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>{tab === 'create' ? 'Create Empty' : tab}</button>
            ))}
          </div>
          <div className="mt-4">{renderContent()}</div>
        </div>

        <div className="flex justify-end p-4 bg-gray-100/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={handleClose} className="mr-2">Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isProcessing || (activeTab === 'create' && !deckName.trim()) || (activeTab !== 'create' && !jsonContent && !fileName) }>
            {activeTab === 'create' ? 'Create Deck' : 'Create & Import'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
