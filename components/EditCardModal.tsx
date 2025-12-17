
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import RichTextToolbar from './ui/RichTextToolbar';
import { useData } from '../contexts/DataManagementContext';
import { useSettings } from '../hooks/useSettings';
import Spinner from './ui/Spinner';

interface EditCardModalProps {
  card: Card | null; // null for creating a new card
  onClose: () => void;
  onSave: (card: Pick<Card, 'front' | 'back' | 'id' | 'css'>) => void;
  deckName?: string;
}

const EditCardModal: React.FC<EditCardModalProps> = ({ card, onClose, onSave, deckName }) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [css, setCss] = useState('');
  const [isGeneratingExamples, setIsGeneratingExamples] = useState(false);
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);
  const dataHandlers = useData();
  const { aiFeaturesEnabled } = useSettings();

  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
      setCss(card.css || '');
    }
  }, [card]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      addToast("Both front and back fields are required.", "error");
      return;
    }
    onSave({
      id: card?.id || '', // id is only used for editing
      front: front.trim(),
      back: back.trim(),
      css: css.trim(),
    });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow tab navigation within textareas
    if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        target.value = target.value.substring(0, start) + "\t" + target.value.substring(end);
        target.selectionStart = target.selectionEnd = start + 1;
        // Need to manually trigger onChange if not using the toolbar wrapper for this event
        const name = target.id;
        if (name === 'card-front') setFront(target.value);
        if (name === 'card-back') setBack(target.value);
        if (name === 'card-css') setCss(target.value);
    }
  };

  const handleGenerateExamples = async () => {
      if (!front.trim() || !back.trim()) {
          addToast("Please fill in both front and back fields first.", "error");
          return;
      }
      setIsGeneratingExamples(true);
      try {
          const examplesHtml = await dataHandlers.handleGenerateCardExamples(front, back, deckName);
          if (examplesHtml) {
              setBack(prev => `${prev}<br><br><strong>Examples:</strong><br>${examplesHtml}`);
              addToast("Examples added to the back of the card.", "success");
          }
      } catch (e) {
          // Toast handled in hook
      } finally {
          setIsGeneratingExamples(false);
      }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">{card ? 'Edit Card' : 'Add New Card'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label htmlFor="card-front" className="block text-sm font-medium text-text-muted mb-1">Front (Supports HTML)</label>
              <div className="border border-border rounded-md focus-within:ring-2 focus-within:ring-primary overflow-hidden">
                <RichTextToolbar targetId="card-front" value={front} onChange={setFront} />
                <textarea 
                    id="card-front" 
                    value={front} 
                    onChange={(e) => setFront(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    rows={5} 
                    className="w-full p-2 bg-background focus:outline-none font-mono text-sm block" 
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-1">
                  <label htmlFor="card-back" className="block text-sm font-medium text-text-muted">Back (Supports HTML)</label>
                  {aiFeaturesEnabled && (
                      <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleGenerateExamples} 
                          disabled={isGeneratingExamples}
                          className="text-primary hover:text-primary-hover"
                          title="Use AI to generate real-world examples"
                      >
                          {isGeneratingExamples ? <Spinner size="sm" /> : <Icon name="zap" className="w-3 h-3 mr-1" />}
                          {isGeneratingExamples ? 'Generating...' : 'Generate Examples'}
                      </Button>
                  )}
              </div>
              <div className="border border-border rounded-md focus-within:ring-2 focus-within:ring-primary overflow-hidden">
                <RichTextToolbar targetId="card-back" value={back} onChange={setBack} />
                <textarea 
                    id="card-back" 
                    value={back} 
                    onChange={(e) => setBack(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    rows={5} 
                    className="w-full p-2 bg-background focus:outline-none font-mono text-sm block" 
                />
              </div>
            </div>
            <div>
              <label htmlFor="card-css" className="block text-sm font-medium text-text-muted mb-1">Custom CSS (Optional)</label>
              <textarea id="card-css" value={css} onChange={(e) => setCss(e.target.value)} onKeyDown={handleKeyDown} rows={5} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none font-mono text-sm" placeholder=".card { font-family: 'Arial'; }" />
            </div>
          </div>

          <div className="flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">
              {card ? 'Save Changes' : 'Add Card'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCardModal;
