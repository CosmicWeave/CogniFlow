import React, { useState, useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAIOptions } from '../hooks/useAIOptions';
import AIOptionsManager from './AIOptionsManager';
import { AIGenerationParams } from '../types';

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: AIGenerationParams) => void;
}

type GenerationType = 'series-scaffold' | 'single-deck-quiz' | 'single-deck-learning' | 'deck-flashcard';
type ImageStyle = 'none' | 'realistic' | 'creative';

export const AIGenerationModal: React.FC<AIGenerationModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [view, setView] = useState<'main' | 'options'>('main');
  const [topic, setTopic] = useState('');
  const [generationType, setGenerationType] = useState<GenerationType>('series-scaffold');
  const [imageStyle, setImageStyle] = useState<ImageStyle>('none');
  const [persona, setPersona] = useState('default');
  const [understanding, setUnderstanding] = useState('Auto');
  const [comprehensiveness, setComprehensiveness] = useState('Standard');
  const { options } = useAIOptions();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onGenerate({
      generationType,
      topic,
      persona,
      understanding,
      comprehensiveness,
      imageStyle: generationType === 'deck-flashcard' ? imageStyle : undefined
    } as AIGenerationParams);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col">
        {view === 'main' ? (
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="bot" className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Generate with AI</h2>
              </div>
              <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
            </header>
            <main className="flex-grow p-6 space-y-4 overflow-y-auto">
              <div>
                <label htmlFor="topic" className="block text-sm font-medium text-text-muted mb-1">Topic</label>
                <input id="topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., The History of Ancient Rome" autoFocus />
              </div>
              <div>
                <label htmlFor="generation-type" className="block text-sm font-medium text-text-muted mb-1">Content Type</label>
                <select id="generation-type" value={generationType} onChange={(e) => setGenerationType(e.target.value as GenerationType)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="series-scaffold">Series (Structure Only)</option>
                  <option value="single-deck-quiz">Single Deck (Quiz)</option>
                  <option value="single-deck-learning">Single Deck (Learning Module)</option>
                  <option value="deck-flashcard">Single Deck (Flashcards)</option>
                </select>
              </div>
              {generationType === 'deck-flashcard' && (
                <div className="animate-fade-in">
                  <label htmlFor="image-style" className="block text-sm font-medium text-text-muted mb-1">Image Generation</label>
                  <select id="image-style" value={imageStyle} onChange={(e) => setImageStyle(e.target.value as ImageStyle)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="none">No Images</option>
                    <option value="realistic">Find Realistic Images</option>
                    <option value="creative">Generate Creative Images</option>
                  </select>
                   <p className="text-xs text-text-muted mt-1">AI will generate an image for the back of each flashcard.</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="persona" className="block text-sm font-medium text-text-muted mb-1">AI Persona</label>
                  <select id="persona" value={persona} onChange={(e) => setPersona(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                    {options.personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="understanding" className="block text-sm font-medium text-text-muted mb-1">My Current Level Is</label>
                  <select id="understanding" value={understanding} onChange={(e) => setUnderstanding(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                    {options.understandingLevels.map(level => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="comprehensiveness" className="block text-sm font-medium text-text-muted mb-1">Desired Comprehensiveness</label>
                <select id="comprehensiveness" value={comprehensiveness} onChange={(e) => setComprehensiveness(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                  {options.comprehensivenessLevels.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
            </main>
            <footer className="flex-shrink-0 flex justify-between items-center p-4 bg-background/50 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setView('options')}>Manage Options</Button>
              <Button type="submit" variant="primary" disabled={!topic.trim()}>
                <Icon name="zap" className="w-5 h-5 mr-2" />
                Generate
              </Button>
            </footer>
          </form>
        ) : (
          <AIOptionsManager onBack={() => setView('main')} />
        )}
      </div>
    </div>
  );
};
