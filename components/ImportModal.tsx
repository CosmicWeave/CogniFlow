import React, { useState, useCallback, useRef } from 'react';
import { Deck, DeckType, FlashcardDeck, QuizDeck, DeckSeries, SeriesLevel } from '../types';
import { parseAndValidateImportData, createCardsFromImport, createQuestionsFromImport } from '../services/importService';
import { parseAnkiPkg, parseAnkiPkgMainThread } from '../services/ankiImportService';
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
  onAddSeriesWithDecks: (series: DeckSeries, decks: Deck[]) => void;
}

type Tab = 'create' | 'paste' | 'upload';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onAddDecks, onAddSeriesWithDecks }) => {
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

  const handleJsonContentChange = useCallback((content: string) => {
    setJsonContent(content);
    try {
      const parsed = parseAndValidateImportData(content);
      if (parsed?.type === DeckType.Quiz) {
        setDeckName(parsed.data.name);
      } else if (parsed?.type === 'quiz_series') {
        setDeckName(parsed.data.seriesName); // Prefill deck name with series name
      }
    } catch (error) {
        // Ignore parsing errors while typing
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    try {
      if (file.name.toLowerCase().endsWith('.apkg')) {
          setDeckName(''); // Not needed for Anki import
          const buffer = await file.arrayBuffer();
          const bufferCopy = buffer.slice(0); // Copy buffer as it's transferred to worker
          
          let decks: Deck[] = [];

          try {
            // Use the workerized parser
            decks = await parseAnkiPkg(buffer);
          } catch (workerError) {
              console.warn("Anki worker failed, trying main thread fallback:", workerError);
              addToast("Import via worker failed. Trying a slower fallback method... this may freeze the app.", "info");
              try {
                  // Use main thread parser as a fallback
                  decks = await parseAnkiPkgMainThread(bufferCopy);
              } catch (mainThreadError) {
                  console.error("Anki main thread fallback also failed:", mainThreadError);
                  throw mainThreadError; // Re-throw the error from the main thread parser
              }
          }

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
          addToast('File loaded. Confirm name and import, or paste content directly.', 'info');
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
  }, [addToast, handleClose, handleJsonContentChange, onAddDecks, resetState]);


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

    try {
      const parsed = parseAndValidateImportData(jsonContent);
      if (!parsed) return;

      if (parsed.type === 'quiz_series') {
        const { seriesName, seriesDescription, levels: levelsData } = parsed.data;
        const allNewDecks: QuizDeck[] = [];
        const newLevels: SeriesLevel[] = levelsData.map(levelData => {
            const decksForLevel: QuizDeck[] = levelData.decks.map(d => ({
                id: crypto.randomUUID(),
                name: d.name,
                description: d.description,
                type: DeckType.Quiz,
                questions: createQuestionsFromImport(d.questions)
            }));
            allNewDecks.push(...decksForLevel);
            return {
                title: levelData.title,
                deckIds: decksForLevel.map(deck => deck.id)
            };
        });
        
        const newSeries: DeckSeries = {
            id: crypto.randomUUID(),
            type: 'series',
            name: seriesName,
            description: seriesDescription,
            levels: newLevels,
            archived: false,
            createdAt: new Date().toISOString(),
        };

        onAddSeriesWithDecks(newSeries, allNewDecks);
        handleClose();
        return; // Exit after handling series
      }

      // Existing logic for single deck import
      if (!deckName.trim()) {
        addToast('Please enter a deck name.', 'error');
        return;
      }
      
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
  }, [deckName, activeTab, jsonContent, onAddDecks, handleClose, addToast, onAddSeriesWithDecks]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if(file) processFile(file);
    // Reset file input to allow uploading the same file again
    if (event.target) {
        event.target.value = '';
    }
  };


  if (!isOpen) return null;

  const renderContent = () => {
    const isAnkiFile = fileName.toLowerCase().endsWith('.apkg');
    if (activeTab === 'upload' && isAnkiFile) {
        return <div className="text-text-muted text-center py-12">Anki file selected. Decks will be imported automatically.</div>;
    }
    
    switch (activeTab) {
      case 'paste':
        return (
          <div>
            <textarea className="w-full h-48 p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-text" placeholder='Paste JSON here... e.g., [{"front": "Q1", "back": "A1"}] or a Quiz/Series object.' value={jsonContent} onChange={(e) => handleJsonContentChange(e.target.value)} />
            <Link href="/instructions/json" onClick={onClose} className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1">
              <Icon name="help-circle" className="w-4 h-4"/>
              View JSON format guide
            </Link>
          </div>
        );
      case 'upload':
        return (
          <>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json,application/json,.apkg,application/zip,application/x-zip-compressed,application/octet-stream" onChange={handleFileChange} />
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-background transition-colors">
                <Icon name="upload-cloud" className="w-10 h-10 text-text-muted mb-2"/>
                <p className="text-sm text-text-muted"><span className="font-semibold text-primary" onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}>Click to upload</span> or drag and drop anywhere</p>
                <p className="text-xs text-text-muted/70">JSON or Anki Package (.apkg)</p>
                {fileName && <p className="text-sm text-green-500 dark:text-green-400 mt-2 truncate" title={fileName}>{fileName}</p>}
            </label>
          </>
        );
      case 'create':
      default:
        return <p className="text-text-muted text-center py-12">Create an empty flashcard deck.</p>;
    }
  };
  
  const showDeckNameInput = !(activeTab === 'upload' && fileName.toLowerCase().endsWith('.apkg'));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg overflow-hidden transform transition-all relative">
        {isProcessing && (
            <div className="absolute inset-0 bg-surface/80 flex flex-col items-center justify-center z-20">
                <Spinner />
                <p className="text-lg text-text mt-4">Processing file...</p>
            </div>
        )}
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text">Create / Import</h2>
          <Button variant="ghost" onClick={handleClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </div>

        <div className="p-6 space-y-4">
          {showDeckNameInput && (
              <div>
                <label htmlFor="deck-name" className="block text-sm font-medium text-text-muted mb-1">Deck / Series Name</label>
                <input type="text" id="deck-name" value={deckName} onChange={(e) => setDeckName(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g. Japanese Vocabulary" />
                 <p className="text-xs text-text-muted mt-1">For single deck or new deck creation. This is auto-filled when pasting a Series object.</p>
              </div>
          )}
          <div className="flex border-b border-border">
            { (['create', 'paste', 'upload'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`capitalize px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'}`}>{tab === 'create' ? 'Create Empty' : tab}</button>
            ))}
          </div>
          <div className="mt-4">{renderContent()}</div>
        </div>

        <div className="flex justify-end p-4 bg-background/50 border-t border-border">
          <Button variant="secondary" onClick={handleClose} className="mr-2">Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isProcessing || (activeTab === 'create' && !deckName.trim()) || (activeTab !== 'create' && !jsonContent && !fileName) }>
            {activeTab === 'create' ? 'Create Deck' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
