
import React, { useState, useCallback, useRef } from 'react';
import { Deck, DeckType, FlashcardDeck, QuizDeck, DeckSeries, SeriesLevel } from '../types';
import { parseAndValidateImportData, createCardsFromImport, createQuestionsFromImport, analyzeFile } from '../services/importService.ts';
import { generateDeckFromImage } from '../services/aiService.ts';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import Spinner from './ui/Spinner';
import Link from './ui/Link';
import { getStockholmDateString } from '../services/time.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { useModal } from '../contexts/ModalContext.tsx';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDecks: (decks: Deck[]) => void;
  onAddSeriesWithDecks: (series: DeckSeries, decks: Deck[]) => void;
}

type Tab = 'create' | 'paste' | 'upload' | 'image';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onAddDecks, onAddSeriesWithDecks }) => {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [deckName, setDeckName] = useState('');
  const [jsonContent, setJsonContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Image Generation State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageHint, setImageHint] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const { aiFeaturesEnabled } = useSettings();
  const { openModal } = useModal();

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const resetState = useCallback(() => {
    setActiveTab('create');
    setDeckName('');
    setJsonContent('');
    setFileName('');
    setIsProcessing(false);
    setImageFile(null);
    setImagePreview(null);
    setImageHint('');
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
      } else if (parsed?.type === 'series') {
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
        const analysis = await analyzeFile(file);

        if (!analysis) {
             addToast("Unsupported file type. Please upload a JSON, CSV, Anki package, or Image.", 'error');
             setFileName('');
             setIsProcessing(false);
             return;
        }

        // Delegate complex types to the unified confirmation modal
        if (analysis.type === 'backup' || analysis.type === 'anki' || analysis.type === 'image') {
             setIsProcessing(false);
             // This will close the current modal and open the confirmation modal
             openModal('droppedFile', { analysis });
             return;
        }

        // Handle JSON/CSV content by populating the editor
        if (analysis.type === 'flashcard' || analysis.type === 'quiz' || analysis.type === 'series') {
             // For CSV, analysis.data is already an array of cards
             // For JSON, analysis.data is the parsed object
             // We stringify it to put it into the "Paste" tab for review
             const textContent = JSON.stringify(analysis.data, null, 2);
             
             handleJsonContentChange(textContent);
             setIsProcessing(false);
             setActiveTab('paste'); // Switch to paste tab so user can see/edit content
             
             if (analysis.type === 'flashcard' && analysis.fileName) {
                 // Try to set a default deck name from filename for CSVs/simple JSON
                 const nameFromFiles = analysis.fileName.replace(/\.(csv|json)$/i, '');
                 setDeckName(nameFromFiles);
             }
             
             addToast('File processed. Review content and click Import.', 'success');
             return;
        }

    } catch (error) {
        console.error("Failed to process file:", error);
        addToast(`An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, 'error');
        resetState();
    }
  }, [addToast, handleJsonContentChange, openModal, resetState]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          setImageFile(file);
          const reader = new FileReader();
          reader.onload = (e) => {
              setImagePreview(e.target?.result as string);
          };
          reader.readAsDataURL(file);
      }
      if (event.target) event.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleGenerateFromImage = async () => {
      if (!imageFile) return;
      setIsProcessing(true);
      try {
          const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                  const result = reader.result as string;
                  resolve(result.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(imageFile);
          });

          const { name, description, cards } = await generateDeckFromImage(base64Data, imageFile.type, imageHint);
          
          const newDeck: FlashcardDeck = {
              id: crypto.randomUUID(),
              name: name || `Image Deck - ${imageFile.name}`,
              description: description || `Generated from ${imageFile.name}`,
              type: DeckType.Flashcard,
              cards: createCardsFromImport(cards)
          };

          onAddDecks([newDeck]);
          addToast(`Deck "${newDeck.name}" generated successfully.`, 'success');
          handleClose();
      } catch (e) {
          console.error(e);
          addToast(`Image generation failed: ${(e as Error).message}`, 'error');
          setIsProcessing(false);
      }
  };

  const handleSubmit = useCallback(() => {
    if (activeTab === 'image') {
        handleGenerateFromImage();
        return;
    }

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
    
    // This handles 'paste' (and indirectly 'upload' via paste tab switch)
    if (!jsonContent) {
        addToast('Please paste content or upload a file.', 'error');
        return;
    }

    try {
      const parsed = parseAndValidateImportData(jsonContent);
      if (!parsed) return;

      if (parsed.type === 'series') {
        const { seriesName, seriesDescription, levels: levelsData } = parsed.data;
        const allNewDecks: Deck[] = [];
        const newLevels: SeriesLevel[] = levelsData.map(levelData => {
            const decksForLevel: (FlashcardDeck | QuizDeck)[] = levelData.decks.map((d: any) => {
                if (d.type === DeckType.Quiz) {
                    const newQuizDeck: QuizDeck = {
                        id: crypto.randomUUID(),
                        name: d.name,
                        description: d.description,
                        type: DeckType.Quiz,
                        questions: createQuestionsFromImport(d.questions || [])
                    };
                    return newQuizDeck;
                } else if (d.type === DeckType.Flashcard) {
                    const newFlashcardDeck: FlashcardDeck = {
                        id: crypto.randomUUID(),
                        name: d.name,
                        description: d.description,
                        type: DeckType.Flashcard,
                        cards: createCardsFromImport(d.cards || [])
                    };
                    return newFlashcardDeck;
                }
                return null;
            }).filter((d): d is FlashcardDeck | QuizDeck => d !== null);
            
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
      
      let newDeck: FlashcardDeck | QuizDeck;
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
  }, [deckName, activeTab, jsonContent, onAddDecks, handleClose, addToast, onAddSeriesWithDecks, handleGenerateFromImage]);

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
    switch (activeTab) {
      case 'image':
          return (
              <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-background transition-colors relative overflow-hidden">
                      {imagePreview ? (
                          <div className="relative w-full h-full group">
                              <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}>Remove Image</Button>
                              </div>
                          </div>
                      ) : (
                          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer" onClick={(e) => { e.preventDefault(); imageInputRef.current?.click(); }}>
                              <Icon name="upload-cloud" className="w-10 h-10 text-text-muted mb-2"/>
                              <p className="text-sm text-text-muted"><span className="font-semibold text-primary">Click to upload image</span></p>
                              <p className="text-xs text-text-muted/70">PNG, JPG, WEBP</p>
                          </label>
                      )}
                      <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                  </div>
                  
                  <div>
                      <label htmlFor="image-hint" className="block text-sm font-medium text-text-muted mb-1">Topic / Hint (Optional)</label>
                      <input 
                        type="text" 
                        id="image-hint" 
                        value={imageHint} 
                        onChange={(e) => setImageHint(e.target.value)} 
                        className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" 
                        placeholder="e.g., Focus on the dates in the timeline" 
                      />
                      <p className="text-xs text-text-muted mt-1">Guide the AI to extract specific information.</p>
                  </div>
              </div>
          );
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
            <input type="file" ref={fileInputRef} className="hidden" accept=".json, .csv, .apkg, .zip, image/*" onChange={handleFileChange} />
            <label 
                onDrop={handleDrop} 
                onDragOver={handleDragOver}
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-background transition-colors"
            >
                <Icon name="upload-cloud" className="w-10 h-10 text-text-muted mb-2"/>
                <p className="text-sm text-text-muted"><span className="font-semibold text-primary" onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}>Click to upload</span> or drag and drop anywhere</p>
                <p className="text-xs text-text-muted/70">JSON, CSV, Anki (.apkg), Backup, or Image</p>
                {fileName && <p className="text-sm text-green-500 dark:text-green-400 mt-2 truncate" title={fileName}>{fileName}</p>}
            </label>
          </>
        );
      case 'create':
      default:
        return <p className="text-text-muted text-center py-12">Create an empty flashcard deck.</p>;
    }
  };
  
  const showDeckNameInput = activeTab !== 'image' && activeTab !== 'upload';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg overflow-hidden transform transition-all relative">
        {isProcessing && (
            <div className="absolute inset-0 bg-surface/80 flex flex-col items-center justify-center z-20">
                <Spinner />
                <p className="text-lg text-text mt-4">{activeTab === 'image' ? 'Analyzing image...' : 'Processing file...'}</p>
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
          <div className="flex border-b border-border overflow-x-auto">
            { (['create', 'paste', 'upload', ...(aiFeaturesEnabled ? ['image'] : [])] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`capitalize px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'}`}>
                  {tab === 'create' ? 'Create Empty' : tab}
              </button>
            ))}
          </div>
          <div className="mt-4">{renderContent()}</div>
        </div>

        <div className="flex justify-end p-4 bg-background/50 border-t border-border">
          <Button variant="secondary" onClick={handleClose} className="mr-2">Cancel</Button>
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={isProcessing || (activeTab === 'create' && !deckName.trim()) || (activeTab === 'paste' && !jsonContent) || (activeTab === 'upload' && !fileName) || (activeTab === 'image' && !imageFile) }
          >
            {activeTab === 'create' ? 'Create Deck' : (activeTab === 'image' ? 'Generate Deck' : 'Import')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
