
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAIOptions } from '../hooks/useAIOptions';
import AIOptionsManager from './AIOptionsManager';
import { AIGenerationParams, DeckType } from '../types';
import { getTopicSuggestions } from '../services/aiService';
import { useToast } from '../hooks/useToast';
import Spinner from './ui/Spinner';

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAIGeneration: (params: AIGenerationParams) => void;
  initialTopic?: string;
  initialGenerationType?: string;
  context?: {
      seriesId?: string;
      levelIndex?: number;
      deckId?: string;
      deckName?: string;
      seriesName?: string;
      seriesDescription?: string;
      deckType?: DeckType;
  };
}

type GenerationScope = 'deck' | 'series';
type ContentStyle = 'quiz' | 'flashcard' | 'vocab' | 'atomic' | 'blooms' | 'course' | 'learning' | 'scaffold';

export const AIGenerationModal: React.FC<AIGenerationModalProps> = ({ isOpen, onClose, onStartAIGeneration, initialTopic, initialGenerationType, context }) => {
  const [view, setView] = useState<'main' | 'options'>('main');
  const [topic, setTopic] = useState(initialTopic || context?.deckName || '');
  
  // Selection State
  const [scope, setScope] = useState<GenerationScope>(context?.seriesId ? 'series' : 'deck');
  const [contentStyle, setContentStyle] = useState<ContentStyle>('quiz');
  
  const [imageStyle, setImageStyle] = useState<'none' | 'realistic' | 'creative'>('none');
  const [persona, setPersona] = useState('default');
  const [understanding, setUnderstanding] = useState('Auto');
  const [comprehensiveness, setComprehensiveness] = useState('Standard');
  const { options } = useAIOptions();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  const { addToast } = useToast();
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
    else if (context?.deckName) setTopic(context.deckName);
  }, [initialTopic, context]);

  // Handle special context cases where we might lock the scope
  const isContextLocked = !!context?.deckId; // If generating for a specific deck, scope is locked to 'deck'

  const availableStyles = useMemo(() => {
      if (scope === 'deck') {
          return [
              { value: 'quiz', label: 'Interactive Quiz', icon: 'help-circle' },
              { value: 'flashcard', label: 'Flashcards', icon: 'laptop' },
              { value: 'vocab', label: 'Vocabulary Builder', icon: 'book-open' },
              { value: 'atomic', label: 'Atomic Concepts', icon: 'zap' },
              { value: 'blooms', label: "Bloom's Taxonomy Quiz", icon: 'trending-up' },
              { value: 'learning', label: 'Learning Deck', icon: 'layers' },
              { value: 'course', label: 'Course / Guide (Reader)', icon: 'file-text' },
          ];
      } else {
          return [
              { value: 'quiz', label: 'Interactive Quizzes', icon: 'help-circle' },
              { value: 'flashcard', label: 'Flashcards', icon: 'laptop' },
              { value: 'vocab', label: 'Vocabulary Builder', icon: 'book-open' },
              { value: 'course', label: 'Course / Guide (Reader)', icon: 'file-text' },
              // { value: 'scaffold', label: 'Empty Scaffold (Structure Only)', icon: 'layers' } // 'quiz' does scaffolding too, maybe hide this or make it explicit
          ];
      }
  }, [scope]);

  // Ensure content style is valid when scope changes
  useEffect(() => {
      if (!availableStyles.some(s => s.value === contentStyle)) {
          setContentStyle(availableStyles[0].value as ContentStyle);
      }
  }, [scope, availableStyles, contentStyle]);

  const handleGetSuggestions = async () => {
      if (!context?.deckName && !context?.seriesName) return;
      setIsLoadingSuggestions(true);
      try {
          const suggestions = await getTopicSuggestions({
              name: context.deckName || context.seriesName || '',
              description: context.seriesDescription,
              type: context.seriesId ? 'series' : 'deck'
          });
          setSuggestions(suggestions);
      } catch (e) {
          addToast("Failed to get suggestions.", "error");
      } finally {
          setIsLoadingSuggestions(false);
      }
  };

  const getGenerationTypeString = (): AIGenerationParams['generationType'] => {
      if (scope === 'series') {
          if (contentStyle === 'flashcard') return 'series-flashcard';
          if (contentStyle === 'vocab') return 'series-vocab';
          if (contentStyle === 'course') return 'series-course';
          // if (contentStyle === 'scaffold') return 'series-scaffold'; 
          return 'series-quiz'; // Default mapping for 'quiz' style in series
      } else {
          if (contentStyle === 'quiz') return 'single-deck-quiz';
          if (contentStyle === 'flashcard') return 'deck-flashcard';
          if (contentStyle === 'vocab') return 'deck-vocab';
          if (contentStyle === 'atomic') return 'deck-atomic';
          if (contentStyle === 'blooms') return 'quiz-blooms';
          if (contentStyle === 'learning') return 'single-deck-learning';
          if (contentStyle === 'course') return 'deck-course';
          return 'single-deck-quiz';
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    const finalGenerationType = getGenerationTypeString();

    onStartAIGeneration({
      generationType: finalGenerationType,
      topic: topic,
      persona,
      understanding,
      comprehensiveness,
      imageStyle: (contentStyle === 'flashcard' || contentStyle === 'vocab' || contentStyle === 'atomic') ? imageStyle : undefined,
      seriesId: context?.seriesId,
      levelIndex: context?.levelIndex,
      deckId: context?.deckId
    });
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
            <main className="flex-grow p-6 space-y-6 overflow-y-auto">
              
              {/* Scope Selection */}
              {!isContextLocked && !context?.seriesId && (
                  <div className="flex bg-background rounded-lg p-1 border border-border">
                      <button 
                          type="button"
                          onClick={() => setScope('deck')}
                          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${scope === 'deck' ? 'bg-primary text-on-primary shadow-sm' : 'text-text-muted hover:text-text'}`}
                      >
                          Single Deck
                      </button>
                      <button 
                          type="button"
                          onClick={() => setScope('series')}
                          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${scope === 'series' ? 'bg-primary text-on-primary shadow-sm' : 'text-text-muted hover:text-text'}`}
                      >
                          Full Series
                      </button>
                  </div>
              )}

              {/* Topic Input */}
              <div>
                <div className="flex justify-between items-end mb-1">
                    <label htmlFor="topic" className="block text-sm font-medium text-text-muted">Topic</label>
                    {(context?.deckName || context?.seriesName) && (
                        <button 
                            type="button" 
                            onClick={handleGetSuggestions} 
                            disabled={isLoadingSuggestions}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                            {isLoadingSuggestions ? <Spinner size="sm" /> : <Icon name="zap" className="w-3 h-3" />}
                            {suggestions.length > 0 ? 'Refresh Suggestions' : 'Get Suggestions'}
                        </button>
                    )}
                </div>
                <input id="topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., The History of Ancient Rome" autoFocus />
                
                {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 animate-fade-in">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setTopic(s)}
                                className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors border border-primary/20"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
              </div>

              {/* Content Style Selection */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Content Style</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableStyles.map(style => (
                        <button
                            key={style.value}
                            type="button"
                            onClick={() => setContentStyle(style.value as ContentStyle)}
                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${contentStyle === style.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-background hover:border-primary/50'}`}
                        >
                            <div className={`p-2 rounded-full ${contentStyle === style.value ? 'bg-primary text-on-primary' : 'bg-surface text-text-muted'}`}>
                                <Icon name={style.icon as any} className="w-4 h-4" />
                            </div>
                            <span className={`text-sm font-medium ${contentStyle === style.value ? 'text-primary' : 'text-text'}`}>
                                {style.label}
                            </span>
                        </button>
                    ))}
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-4 pt-4 border-t border-border">
                  {(contentStyle === 'flashcard' || contentStyle === 'vocab' || contentStyle === 'atomic') && (
                    <div className="animate-fade-in">
                      <label htmlFor="image-style" className="block text-sm font-medium text-text-muted mb-1">Image Generation</label>
                      <select id="image-style" value={imageStyle} onChange={(e) => setImageStyle(e.target.value as any)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                        <option value="none">No Images</option>
                        <option value="realistic">Find Realistic Images</option>
                        <option value="creative">Generate Creative Images</option>
                      </select>
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
              </div>

            </main>
            <footer className="flex-shrink-0 flex justify-between items-center p-4 bg-background/50 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setView('options')}>Manage Options</Button>
              <Button type="submit" variant="primary" disabled={!topic.trim()}>
                <Icon name="zap" className="w-5 h-5 mr-2" />
                Start Generation
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
