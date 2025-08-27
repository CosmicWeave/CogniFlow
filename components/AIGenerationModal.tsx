import React, { useState, useRef } from 'react';
import { Deck, DeckSeries, DeckType, QuizDeck, SeriesLevel } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Spinner from './ui/Spinner';
import { generateSeriesScaffoldWithAI } from '../services/aiService';
import { createQuestionsFromImport } from '../services/importService';

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSeriesWithDecks: (series: DeckSeries, decks: Deck[]) => void;
}

const AIGenerationModal: React.FC<AIGenerationModalProps> = ({ isOpen, onClose, onAddSeriesWithDecks }) => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  
  const understandingLevels = ['Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      addToast("Please enter a topic.", "error");
      return;
    }
    
    setIsGenerating(true);
    try {
      const generatedData = await generateSeriesScaffoldWithAI(topic, level);
      
      const { seriesName, seriesDescription, levels: levelsData } = generatedData;
      const allNewDecks: QuizDeck[] = [];
      const newLevels: SeriesLevel[] = levelsData.map(levelData => {
          const decksForLevel: QuizDeck[] = levelData.decks.map(d => ({
              id: crypto.randomUUID(),
              name: d.name,
              description: d.description,
              type: DeckType.Quiz,
              questions: [], // Questions are initially empty
              suggestedQuestionCount: d.suggestedQuestionCount,
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
      addToast(`Successfully generated series scaffold: "${newSeries.name}"`, 'success');
      onClose();

    } catch (error) {
      addToast(error instanceof Error ? error.message : 'An unknown error occurred.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg overflow-hidden transform transition-all relative">
        {isGenerating && (
            <div className="absolute inset-0 bg-surface/80 flex flex-col items-center justify-center z-20">
                <Spinner />
                <p className="text-lg text-text mt-4">Generating series scaffold...</p>
                <p className="text-sm text-text-muted">This may take a moment.</p>
            </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">Generate with AI</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" disabled={isGenerating}><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="ai-topic" className="block text-sm font-medium text-text-muted mb-1">Topic</label>
              <input
                type="text"
                id="ai-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="e.g. The History of Ancient Rome"
              />
            </div>
            <div>
                <label htmlFor="ai-level" className="block text-sm font-medium text-text-muted mb-1">
                    Target Level
                </label>
                <select
                    id="ai-level"
                    value={level}
                    onChange={e => setLevel(e.target.value)}
                    className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                >
                    {understandingLevels.map(l => (
                        <option key={l} value={l}>{l}</option>
                    ))}
                </select>
            </div>
            <p className="text-xs text-text-muted p-2 bg-background/50 rounded-md border border-border">This will generate a series outline with empty decks. You can then generate questions for each deck individually.</p>
          </div>

          <div className="flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2" disabled={isGenerating}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isGenerating || !topic.trim()}>
              <Icon name="zap" className="w-5 h-5 mr-2"/>
              Generate Scaffold
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIGenerationModal;