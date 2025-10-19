import React, { useState, useRef, useEffect } from 'react';
import { FullBackupData, BackupComparison, Deck, DeckSeries, DeckType, FlashcardDeck, QuizDeck, LearningDeck, DeckComparison, SeriesComparison } from '../types';
import { parseAndValidateBackupFile } from '../services/importService';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Spinner from './ui/Spinner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/Accordion';
import { useStore } from '../store/store';

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompare: (data: FullBackupData) => BackupComparison;
  onRestoreSelected: (data: { selectedIds: Set<string>; backupData: FullBackupData }) => Promise<void>;
  onFullRestore: (data: FullBackupData) => Promise<void>;
  openConfirmModal: (props: any) => void;
  file?: File;
}

type View = 'upload' | 'loading' | 'compare';

const DiffView: React.FC<{ label: string; localValue: React.ReactNode; backupValue: React.ReactNode; hasChanged: boolean }> = ({ label, localValue, backupValue, hasChanged }) => {
    if (!hasChanged) return null;
    return (
        <div className="text-xs">
            <span className="font-semibold">{label}: </span>
            <span className="text-text-muted">{localValue}</span>
            <Icon name="arrow-down" className="inline w-3 h-3 mx-1 rotate-[-90deg]" />
            <span className="text-primary font-semibold">{backupValue}</span>
        </div>
    );
};

const RestoreModal: React.FC<RestoreModalProps> = ({ isOpen, onClose, onCompare, onRestoreSelected, onFullRestore, openConfirmModal, file }) => {
  const [view, setView] = useState<View>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState<FullBackupData | null>(null);
  const [comparison, setComparison] = useState<BackupComparison | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  const { seriesProgress } = useStore();

  useEffect(() => {
    if (file && isOpen) {
        processFile(file);
    }
  }, [file, isOpen]);

  const handleClose = () => {
    setView('upload');
    setFileName('');
    setParsedData(null);
    setComparison(null);
    setSelectedIds(new Set());
    onClose();
  };

  const processFile = async (file: File) => {
    if (!file) return;

    setView('loading');
    setFileName(file.name);

    try {
        const text = await file.text();
        const data = parseAndValidateBackupFile(text);
        setParsedData(data);
        
        const comparisonResult = onCompare(data);
        setComparison(comparisonResult);

        const allNewAndChangedIds = [
            ...comparisonResult.newSeries.map(s => s.id),
            ...comparisonResult.newDecks.map(d => d.id),
            ...comparisonResult.changedSeries.map(s => s.backup.id),
            ...comparisonResult.changedDecks.map(d => d.backup.id),
        ];
        setSelectedIds(new Set(allNewAndChangedIds));
        
        setView('compare');
    } catch (error) {
        addToast(`Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`, 'error');
        handleClose();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (view === 'loading') return;
    const file = event.target.files?.[0];
    if (file) processFile(file);
    if (event.target) event.target.value = '';
  };
  
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (view === 'loading') return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();

  const handleRestore = async () => {
    if (parsedData) {
        setView('loading');
        await onRestoreSelected({ selectedIds, backupData: parsedData });
        handleClose();
    }
  };
  
  const handleFullRestoreClick = () => {
    if (!parsedData) return;
    onClose();
    openConfirmModal({
        title: 'Confirm Full Restore',
        message: 'This will completely overwrite all your local data with the contents of the backup file. This action cannot be undone.',
        confirmText: 'overwrite everything',
        onConfirm: () => onFullRestore(parsedData),
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  if (!isOpen) return null;
  
  const getDeckItemCount = (deck: Deck) => {
      if (deck.type === DeckType.Flashcard) return (deck as FlashcardDeck).cards?.length || 0;
      return (deck as QuizDeck | LearningDeck).questions?.length || 0;
  }

  const renderContent = () => {
      if (view === 'loading') {
          return (
             <div className="absolute inset-0 bg-surface/80 flex flex-col items-center justify-center z-20">
                <Spinner />
                <p className="text-lg text-text mt-4">Analyzing backup...</p>
            </div>
          );
      }
      
      if (view === 'compare' && comparison) {
          const { newSeries, newDecks, changedSeries, changedDecks, dueCounts, masteryLevels } = comparison;

          const newSeriesDeckIds = new Set(newSeries.flatMap(s => (s.levels || []).flatMap(l => l.deckIds || [])));
          const standaloneNewDecks = newDecks.filter(d => !newSeriesDeckIds.has(d.id));

          const hasNew = newSeries.length > 0 || standaloneNewDecks.length > 0;
          const hasChanges = changedSeries.length > 0 || changedDecks.length > 0;

          const defaultOpen = [];
          if(newSeries.length > 0) defaultOpen.push('new-series');
          if(standaloneNewDecks.length > 0) defaultOpen.push('new-decks');
          if(changedSeries.length > 0) defaultOpen.push('changed-series');
          if(changedDecks.length > 0) defaultOpen.push('changed-decks');
          
          return (
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {!hasNew && !hasChanges ? (
                     <div className="text-center py-8 text-text-muted">
                        <Icon name="check-circle" className="w-12 h-12 mx-auto text-green-500" />
                        <p className="mt-2 font-medium">Everything is up-to-date!</p>
                        <p className="text-sm">Your local data already matches the contents of this backup file.</p>
                     </div>
                 ) : (
                    <Accordion type="multiple" defaultValue={defaultOpen}>
                        {newSeries.length > 0 && (
                            <AccordionItem value="new-series" className="border-b">
                                <AccordionTrigger>New Series ({newSeries.length})</AccordionTrigger>
                                <AccordionContent className="p-2 space-y-2">
                                    {newSeries.map(series => (
                                    <div key={series.id} className="p-3 bg-background rounded-md border border-border">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input type="checkbox" checked={selectedIds.has(series.id)} onChange={() => toggleSelection(series.id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <div className="flex-grow">
                                                <p className="font-semibold text-text">{series.name}</p>
                                                <p className="text-xs text-text-muted">{(series.levels || []).reduce((acc, l) => acc + (l.deckIds?.length || 0), 0)} deck(s)</p>
                                            </div>
                                        </label>
                                    </div>))}
                                </AccordionContent>
                            </AccordionItem>
                        )}
                        {changedSeries.length > 0 && (
                             <AccordionItem value="changed-series" className="border-b">
                                <AccordionTrigger>Changed Series ({changedSeries.length})</AccordionTrigger>
                                <AccordionContent className="p-2 space-y-2">
                                    {changedSeries.map(({ local, backup, diff }) => {
                                        const localCompletion = `${seriesProgress.get(local.id)?.size || 0}/${(local.levels || []).reduce((acc, l) => acc + (l.deckIds?.length || 0), 0)}`;
                                        const backupCompletion = `${(parsedData?.seriesProgress || {})[backup.id]?.length || 0}/${(backup.levels || []).reduce((acc, l) => acc + (l.deckIds?.length || 0), 0)}`;
                                        const localMastery = Math.round((masteryLevels.get(`local-${local.id}`) || 0) * 100);
                                        const backupMastery = Math.round((masteryLevels.get(backup.id) || 0) * 100);
                                    return (
                                    <div key={backup.id} className="p-3 bg-background rounded-md border border-border">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input type="checkbox" checked={selectedIds.has(backup.id)} onChange={() => toggleSelection(backup.id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <div className="flex-grow space-y-1">
                                                <p className="font-semibold text-text">{backup.name}</p>
                                                <DiffView label="Completion" localValue={localCompletion} backupValue={backupCompletion} hasChanged={diff.completion} />
                                                <DiffView label="Mastery" localValue={`${localMastery}%`} backupValue={`${backupMastery}%`} hasChanged={diff.mastery} />
                                                {diff.structure && <p className="text-xs font-semibold text-primary">Content/Structure updated</p>}
                                            </div>
                                        </label>
                                    </div>
                                    )})}
                                </AccordionContent>
                            </AccordionItem>
                        )}
                        {standaloneNewDecks.length > 0 && (
                            <AccordionItem value="new-decks" className="border-b">
                                <AccordionTrigger>New Standalone Decks ({standaloneNewDecks.length})</AccordionTrigger>
                                <AccordionContent className="p-2 space-y-2">
                                     {standaloneNewDecks.map(deck => (
                                    <div key={deck.id} className="p-3 bg-background rounded-md border border-border">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input type="checkbox" checked={selectedIds.has(deck.id)} onChange={() => toggleSelection(deck.id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <div className="flex-grow">
                                                <p className="font-semibold text-text">{deck.name}</p>
                                                <p className="text-xs text-text-muted">{getDeckItemCount(deck)} item(s) &bull; {dueCounts.get(deck.id) || 0} due</p>
                                            </div>
                                        </label>
                                    </div>))}
                                </AccordionContent>
                            </AccordionItem>
                        )}
                         {changedDecks.length > 0 && (
                             <AccordionItem value="changed-decks" className="border-b">
                                <AccordionTrigger>Changed Decks ({changedDecks.length})</AccordionTrigger>
                                <AccordionContent className="p-2 space-y-2">
                                     {changedDecks.map(({ local, backup, diff }) => {
                                        const localMastery = Math.round((masteryLevels.get(`local-${local.id}`) || 0) * 100);
                                        const backupMastery = Math.round((masteryLevels.get(backup.id) || 0) * 100);
                                        return (
                                        <div key={backup.id} className="p-3 bg-background rounded-md border border-border">
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input type="checkbox" checked={selectedIds.has(backup.id)} onChange={() => toggleSelection(backup.id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                                <div className="flex-grow space-y-1">
                                                    <p className="font-semibold text-text">{backup.name}</p>
                                                    <DiffView label="Items" localValue={getDeckItemCount(local)} backupValue={getDeckItemCount(backup)} hasChanged={diff.content} />
                                                    <DiffView label="Due" localValue={dueCounts.get(`local-${local.id}`)} backupValue={dueCounts.get(backup.id)} hasChanged={diff.dueCount} />
                                                    <DiffView label="Mastery" localValue={`${localMastery}%`} backupValue={`${backupMastery}%`} hasChanged={diff.mastery} />
                                                    {diff.content && <p className="text-xs font-semibold text-primary">Content updated</p>}
                                                </div>
                                            </label>
                                        </div>
                                    )})}
                                </AccordionContent>
                            </AccordionItem>
                        )}
                    </Accordion>
                 )}
              </div>
          )
      }

      return (
        <div className="p-6 space-y-4">
            <input type="file" ref={fileInputRef} className="hidden" accept=".json,application/json" onChange={handleFileChange} />
            <label onDragOver={handleDragOver} onDrop={handleDrop} className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-background`}>
                <Icon name="upload-cloud" className="w-10 h-10 text-text-muted mb-2"/>
                <p className="text-sm text-text-muted">
                    <span className="font-semibold text-primary" onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}>
                        Click to upload
                    </span> or drag and drop</p>
                <p className="text-xs text-text-muted/70">CogniFlow Backup JSON file</p>
            </label>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg overflow-hidden transform transition-all relative">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold">Restore from Backup</h2>
          <Button variant="ghost" onClick={handleClose} className="p-1 h-auto" disabled={view === 'loading'}><Icon name="x" /></Button>
        </div>

        {renderContent()}

        <div className="flex justify-between items-center p-4 bg-background/50 border-t border-border">
            <div>
                {view === 'compare' && (
                     <Button variant="danger" onClick={handleFullRestoreClick}>Full Restore</Button>
                )}
            </div>
            <div className="flex gap-2">
                <Button variant="secondary" onClick={handleClose} disabled={view === 'loading'}>Cancel</Button>
                {view === 'compare' && (
                    <Button variant="primary" onClick={handleRestore} disabled={selectedIds.size === 0}>
                        Add/Update Selected ({selectedIds.size})
                    </Button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default RestoreModal;