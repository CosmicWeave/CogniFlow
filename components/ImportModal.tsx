
import React, { useState, useCallback, useRef } from 'react';
import { Deck, DeckType, FlashcardDeck, QuizDeck, DeckSeries, SeriesLevel, LearningDeck } from '../types';
import { parseAndValidateImportData, createCardsFromImport, createQuestionsFromImport, analyzeFile, extractTextFromFile } from '../services/importService.ts';
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

type Tab = 'create' | 'paste' | 'upload' | 'image' | 'document';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onAddDecks, onAddSeriesWithDecks }) => {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [deckName, setDeckName] = useState('');
  const [jsonContent, setJsonContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Document state
  const [sourceText, setSourceText] = useState('');
  const [documentFileName, setDocumentFileName] = useState('');

  // Image Generation State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageHint, setImageHint] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
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
    setSourceText('');
    setDocumentFileName('');
  }, []);
  
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleJsonContentChange = useCallback((content: string) => {
    setJsonContent(content);
    try {
      const parsed = parseAndValidateImportData(content);
      if (parsed?.type === DeckType.Quiz || parsed?.type === DeckType.Learning) {
        setDeckName(parsed.data.name);
      } else if (parsed?.type === 'series') {
        setDeckName(parsed.data.seriesName); 
      }
    } catch (error) {}
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

        if (analysis.type === 'document') {
             setIsProcessing(false);
             const extracted = await extractTextFromFile(file);
             setSourceText(extracted);
             setDocumentFileName(file.name);
             setActiveTab('document');
             addToast("Document text extracted. Choose a generation mode.", "success");
             return;
        }

        if (analysis.type === 'backup' || analysis.type === 'anki' || analysis.type === 'image') {
             setIsProcessing(false);
             openModal('droppedFile', { analysis });
             return;
        }

        if (analysis.type === 'flashcard' || analysis.type === 'quiz' || analysis.type === 'series' || analysis.type === 'learning') {
             const textContent = JSON.stringify(analysis.data, null, 2);
             handleJsonContentChange(textContent);
             setIsProcessing(false);
             setActiveTab('paste'); 
             if ((analysis.type === 'flashcard') && analysis.fileName) {
                 setDeckName(analysis.fileName.replace(/\.(csv|json)$/i, ''));
             }
             addToast('File processed. Review content and click Import.', 'success');
             return;
        }

    } catch (error) {
        addToast(`An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, 'error');
        resetState();
    }
  }, [addToast, handleJsonContentChange, openModal, resetState]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (event.target) event.target.value = '';
  }, [processFile]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          setImageFile(file);
          const reader = new FileReader();
          reader.onload = (e) => setImagePreview(e.target?.result as string);
          reader.readAsDataURL(file);
      }
      if (event.target) event.target.value = '';
  };

  const handleDocChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          try {
              const text = await extractTextFromFile(file);
              setSourceText(text);
              setDocumentFileName(file.name);
              addToast("Document text extracted.", "success");
          } catch (e) {
              addToast((e as Error).message, "error");
          }
      }
      if (event.target) event.target.value = '';
  };

  const handleStartAIGenFromDoc = (scope: 'deck' | 'series') => {
      if (!sourceText.trim()) return;
      openModal('aiGeneration', { 
          initialTopic: documentFileName || 'My Document',
          context: { 
              mode: 'generate',
              sourceMaterial: sourceText
          }
      });
      onClose();
  };

  const handleSubmit = useCallback(() => {
    if (activeTab === 'image') {
        // Image generation handled via drag/drop handler in useDataManagement
        addToast("Please use the Upload tab or drag an image directly for AI generation.", "info");
        return;
    }

    if (activeTab === 'create') {
        if (!deckName.trim()) { addToast('Please enter a deck name.', 'error'); return; }
        const newDeck: FlashcardDeck = {
            id: crypto.randomUUID(), name: deckName.trim(), type: DeckType.Flashcard, cards: [], description: `Created on ${getStockholmDateString()}`
        };
        onAddDecks([newDeck]);
        addToast(`Deck "${newDeck.name}" created.`, 'success');
        handleClose();
        return;
    }
    
    if (activeTab === 'paste') {
        if (!jsonContent) { addToast('Please paste content.', 'error'); return; }
        try {
          const parsed = parseAndValidateImportData(jsonContent);
          if (!parsed) return;

          if (parsed.type === 'series') {
              const { seriesName, seriesDescription, levels: levelsData } = parsed.data;
              const allNewDecks: Deck[] = [];
              const newLevels: SeriesLevel[] = (levelsData || []).map((levelData: any) => {
                  const decksForLevel: Deck[] = (levelData.decks || []).map((d: any): Deck | null => {
                      const id = crypto.randomUUID();
                      const common = { id, name: d.name, description: d.description || '', icon: d.icon, generationStatus: d.generationStatus };
                      if (d.type === 'learning' || d.infoCards) {
                          return { ...common, type: DeckType.Learning, infoCards: d.infoCards || [], questions: createQuestionsFromImport(d.questions || []), learningMode: d.learningMode || 'separate', curriculum: d.curriculum } as LearningDeck;
                      }
                      if (d.type === 'flashcard' || d.cards) {
                          return { ...common, type: DeckType.Flashcard, cards: createCardsFromImport(d.cards || []) } as FlashcardDeck;
                      }
                      return { ...common, type: DeckType.Quiz, questions: createQuestionsFromImport(d.questions || []) } as QuizDeck;
                  }).filter((d: any): d is Deck => d !== null);
                  allNewDecks.push(...decksForLevel);
                  return { title: levelData.title, deckIds: decksForLevel.map(d => d.id) };
              });
              
              const newSeries: DeckSeries = {
                  id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription,
                  levels: newLevels, archived: false, createdAt: new Date().toISOString()
              };
              onAddSeriesWithDecks(newSeries, allNewDecks);
              addToast(`Series "${newSeries.name}" imported.`, 'success');
          } else if (parsed.type === DeckType.Quiz || parsed.type === DeckType.Learning) {
              const d = parsed.data;
              const id = crypto.randomUUID();
              const common = { id, name: d.name, description: d.description || '', icon: d.icon, generationStatus: d.generationStatus };
              let newDeck: Deck;
              if (parsed.type === DeckType.Learning) {
                  newDeck = { ...common, type: DeckType.Learning, infoCards: d.infoCards || [], questions: createQuestionsFromImport(d.questions || []), learningMode: d.learningMode || 'separate', curriculum: d.curriculum } as LearningDeck;
              } else {
                  newDeck = { ...common, type: DeckType.Quiz, questions: createQuestionsFromImport(d.questions || []) } as QuizDeck;
              }
              onAddDecks([newDeck]);
              addToast(`Deck "${newDeck.name}" imported.`, 'success');
          } else if (parsed.type === DeckType.Flashcard) {
              const cards = createCardsFromImport(parsed.data);
              const newDeck: FlashcardDeck = {
                  id: crypto.randomUUID(), name: deckName || 'Imported Flashcards',
                  type: DeckType.Flashcard, cards,
                  description: `Imported on ${new Date().toLocaleDateString()}`
              };
              onAddDecks([newDeck]);
              addToast(`Deck "${newDeck.name}" imported with ${cards.length} cards.`, 'success');
          }

          handleClose();
        } catch(error) {
           addToast(error instanceof Error ? error.message : 'Invalid JSON content.', 'error');
        }
    }
  }, [deckName, activeTab, jsonContent, onAddDecks, handleClose, addToast, onAddSeriesWithDecks]);


  if (!isOpen) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'document':
          return (
              <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg bg-background/50 relative">
                        {sourceText ? (
                            <div className="p-4 w-full h-full flex flex-col items-center justify-center text-center">
                                <Icon name="file-text" className="w-10 h-10 text-primary mb-2" />
                                <p className="text-sm font-bold text-text truncate max-w-full px-4">{documentFileName || 'Pasted Content'}</p>
                                <p className="text-xs text-text-muted mt-1">{sourceText.split(/\s+/).length} words detected</p>
                                <Button variant="ghost" size="sm" onClick={() => setSourceText('')} className="mt-4 text-red-500">Remove Source</Button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer" onClick={() => docInputRef.current?.click()}>
                                <Icon name="upload-cloud" className="w-10 h-10 text-text-muted mb-2"/>
                                <p className="text-sm text-text-muted"><span className="font-semibold text-primary">Click to upload document</span></p>
                                <p className="text-xs text-text-muted/70">TXT, Markdown, MD, RTF</p>
                            </label>
                        )}
                        <input type="file" ref={docInputRef} className="hidden" accept=".txt,.md,.markdown,.rtf" onChange={handleDocChange} />
                  </div>
                  
                  {!sourceText && (
                      <div>
                        <label htmlFor="paste-doc" className="block text-sm font-medium text-text-muted mb-1">Or paste source text here:</label>
                        <textarea 
                            id="paste-doc"
                            className="w-full h-32 p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-text text-sm"
                            placeholder="Paste text from a PDF, EPUB, or article to create a study guide..."
                            value={sourceText}
                            onChange={(e) => setSourceText(e.target.value)}
                        />
                      </div>
                  )}

                  {sourceText && (
                      <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => handleStartAIGenFromDoc('deck')}
                            className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-left hover:bg-primary/20 transition-all group"
                          >
                              <Icon name="layers" className="w-6 h-6 text-primary mb-2" />
                              <h4 className="font-bold text-text text-sm">Learning Deck</h4>
                              <p className="text-[10px] text-text-muted mt-1">Single guide + Practice quiz</p>
                          </button>
                          <button 
                            onClick={() => handleStartAIGenFromDoc('series')}
                            className="p-4 bg-indigo-600 text-white rounded-xl text-left hover:bg-indigo-700 transition-all shadow-lg group"
                          >
                              <Icon name="bot" className="w-6 h-6 text-white mb-2" />
                              <h4 className="font-bold text-sm">Hyper-Course</h4>
                              <p className="text-[10px] text-white/80 mt-1">Full curriculum synthesis</p>
                          </button>
                      </div>
                  )}
              </div>
          );
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
                      <input type="text" id="image-hint" value={imageHint} onChange={(e) => setImageHint(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., Focus on the dates in the timeline" />
                  </div>
              </div>
          );
      case 'paste':
        return (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label htmlFor="paste-json" className="block text-sm font-medium text-text-muted mb-1">Paste JSON Deck or Series Export:</label>
              <textarea 
                id="paste-json"
                className="w-full h-48 p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-text font-mono text-xs" 
                placeholder='{ "name": "My Deck", "questions": [...] }' 
                value={jsonContent} 
                onChange={(e) => handleJsonContentChange(e.target.value)} 
              />
            </div>
            <Link href="/instructions/json" onClick={onClose} className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1">
              <Icon name="help-circle" className="w-4 h-4"/> View JSON format guide
            </Link>
          </div>
        );
      case 'upload':
        return (
          <div className="p-4 text-center">
            <input type="file" ref={fileInputRef} className="hidden" accept=".json, .csv, .apkg, .zip, .txt, .md, .rtf" onChange={handleFileChange} />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Icon name="upload-cloud" className="w-5 h-5 mr-2" />
              Choose File
            </Button>
            <p className="mt-2 text-xs text-text-muted">JSON, CSV, Anki (.apkg), or Text documents</p>
          </div>
        );
      case 'create':
      default:
        return (
            <div className="space-y-4 animate-fade-in">
                <div>
                  <label htmlFor="new-deck-name" className="block text-sm font-medium text-text-muted mb-1">Deck Name</label>
                  <input
                    id="new-deck-name"
                    type="text"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="e.g., Anatomy 101"
                    autoFocus
                  />
                </div>
                <p className="text-text-muted text-center py-4">Create an empty flashcard deck to manually add cards later.</p>
            </div>
        );
    }
  };
  
  const tabs: Tab[] = ['create', 'document', 'paste', 'upload'];
  if (aiFeaturesEnabled) tabs.splice(2, 0, 'image');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg overflow-hidden transform transition-all relative">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text">Create / Import</h2>
          <Button variant="ghost" onClick={handleClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex border-b border-border overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`capitalize px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'}`}>
                  {tab === 'create' ? 'Create Empty' : (tab === 'document' ? 'From Document ✨' : tab)}
              </button>
            ))}
          </div>
          <div className="mt-4">{renderContent()}</div>
        </div>

        {activeTab !== 'document' && (
            <div className="flex justify-end p-4 bg-background/50 border-t border-border">
                <Button variant="secondary" onClick={handleClose} className="mr-2">Cancel</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={isProcessing}>
                    {activeTab === 'create' ? 'Create Deck' : 'Import'}
                </Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default ImportModal;
