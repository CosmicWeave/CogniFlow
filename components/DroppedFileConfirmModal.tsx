import React, { useState, useMemo, useRef, useEffect } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { AnalysisResult } from '../services/importService';

interface DroppedFileConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (analysis: AnalysisResult, options?: { deckName?: string; imageHint?: string }) => void;
  analysis: AnalysisResult;
}

const DroppedFileConfirmModal: React.FC<DroppedFileConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  analysis,
}) => {
  const [deckName, setDeckName] = useState('');
  const [imageHint, setImageHint] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
      // Pre-fill deck name if available
      if ((analysis.type === 'quiz' || analysis.type === 'learning') && analysis.data.name) {
          setDeckName(analysis.data.name);
      } else {
          setDeckName('');
      }
      
      // Load image preview if applicable
      if (analysis.type === 'image' && analysis.file) {
          const reader = new FileReader();
          reader.readAsDataURL(analysis.file);
          reader.onload = (e) => {
              setImagePreview(e.target?.result as string);
          };
      } else {
          setImagePreview(null);
      }
      setImageHint('');
  }, [analysis]);

  const { title, message, confirmText } = useMemo(() => {
    switch (analysis.type) {
      case 'backup':
        return {
          title: 'Restore from Backup',
          message: `You dropped the backup file "${analysis.fileName}". Restoring will merge its content with your current data. Do you want to continue?`,
          confirmText: 'Restore',
        };
      case 'series':
        return {
          title: 'Import Series',
          message: `You dropped a file containing the series "${analysis.data.seriesName}". Would you like to import it?`,
          confirmText: 'Import Series',
        };
      case 'quiz':
        return {
          title: 'Import Quiz Deck',
          message: `You dropped a file for the quiz deck "${analysis.data.name}". Would you like to import it?`,
          confirmText: 'Import Deck',
        };
      case 'learning':
        return {
          title: 'Import Learning Deck',
          message: `You dropped a file for the course "${analysis.data.name}". It includes instructional cards and associated questions.`,
          confirmText: 'Import Course',
        };
      case 'flashcard':
        return {
          title: 'Import Flashcard Deck',
          message: `You dropped a file with ${analysis.data.length} flashcard(s). Please provide a name for the new deck.`,
          confirmText: 'Import Deck',
        };
      case 'anki':
        return {
          title: 'Import Anki Package',
          message: `You dropped the Anki package "${analysis.fileName}". This may contain multiple decks and media.`,
          confirmText: 'Import Anki Package',
        };
      case 'image':
        return {
          title: 'Generate Deck from Image',
          message: `Analyze this image with AI to create a flashcard deck.`,
          confirmText: 'Generate Deck',
        };
      default:
        return { title: 'Confirm Import', message: 'Unknown file type.', confirmText: 'Confirm' };
    }
  }, [analysis]);

  const isConfirmDisabled = (analysis.type === 'flashcard' && !deckName.trim());

  const handleConfirm = () => {
    onConfirm(analysis, { deckName: deckName.trim(), imageHint: imageHint.trim() });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg transform transition-all relative flex flex-col max-h-[90vh]">
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text">{title}</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close">
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <p className="text-text-muted">{message}</p>
          
          {(analysis.type === 'flashcard' || analysis.type === 'quiz' || analysis.type === 'learning') && (
            <div>
              <label htmlFor="deck-name-input" className="block text-sm font-medium text-text-muted mb-1">
                Deck Name
              </label>
              <input
                id="deck-name-input"
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="Enter a name for the new deck"
                autoFocus
              />
            </div>
          )}

          {analysis.type === 'image' && (
              <div className="space-y-4">
                  {imagePreview && (
                      <div className="rounded-lg overflow-hidden border border-border max-h-48 flex justify-center bg-black/5">
                          <img src={imagePreview} alt="Preview" className="h-full object-contain" />
                      </div>
                  )}
                  <div>
                      <label htmlFor="image-hint" className="block text-sm font-medium text-text-muted mb-1">Topic / Hint (Optional)</label>
                      <input 
                        type="text" 
                        id="image-hint" 
                        value={imageHint} 
                        onChange={(e) => setImageHint(e.target.value)} 
                        className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" 
                        placeholder="e.g., Focus on dates or biological terms" 
                      />
                      <p className="text-xs text-text-muted mt-1">Guide the AI to extract specific information.</p>
                  </div>
              </div>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose} className="mr-2">
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} disabled={isConfirmDisabled}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DroppedFileConfirmModal;