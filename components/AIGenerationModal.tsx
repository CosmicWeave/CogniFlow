
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
import { useData } from '../contexts/DataManagementContext';

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
      mode?: 'generate' | 'expand' | 'rework';
  };
}

type GenerationScope = 'deck' | 'series';
type ContentStyle = 'quiz' | 'flashcard' | 'vocab' | 'atomic' | 'blooms' | 'course' | 'learning' | 'scaffold';

export const AIGenerationModal: React.FC<AIGenerationModalProps> = ({ isOpen, onClose, onStartAIGeneration, initialTopic, initialGenerationType, context }) => {
  const [view, setView] = useState<'main' | 'options'>('main');
  const [topic, setTopic] = useState(initialTopic || context?.deckName || '');
  const [reworkInstructions, setReworkInstructions] = useState('');
  
  // Selection State
  const [scope, setScope] = useState<GenerationScope>(context?.seriesId ? 'series' : 'deck');
  const [contentStyle, setContentStyle] = useState<ContentStyle>('quiz');
  const [count, setCount] = useState<number>(10);
  
  const [imageStyle, setImageStyle] = useState<'none' | 'realistic' | 'creative'>('none');
  const [persona, setPersona] = useState('default');
  const [understanding, setUnderstanding] = useState('Auto');
  const [comprehensiveness, setComprehensiveness] = useState('Standard');
  const { options } = useAIOptions();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  const { addToast } = useToast();
  const dataHandlers = useData();
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const mode = context?.mode || 'generate';

  // Sync content style with deck type if provided
  useEffect(() => {
    if (context?.deckType) {
        if (context.deckType === DeckType.Flashcard) setContentStyle('flashcard');
        else if (context.deckType === DeckType.Learning) setContentStyle('learning');
        else setContentStyle('quiz');
    }
  }, [context]);

  useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
    else if (context?.deckName) setTopic(context.deckName);
  }, [initialTopic, context]);

  const isContextLocked = !!context?.deckId; 

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
          ];
      }
  }, [scope]);

  useEffect(() => {
      if (!isContextLocked && !availableStyles.some(s => s.value === contentStyle)) {
          setContentStyle(availableStyles[0].value as ContentStyle);
      }
  }, [scope, availableStyles, contentStyle, isContextLocked]);

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
      if (mode === 'rework') return 'rework-deck';
      
      if (scope === 'series') {
          if (contentStyle === 'flashcard') return 'series-flashcard';
          if (contentStyle === 'vocab') return 'series-vocab';
          if (contentStyle === 'course') return 'series-course';
          return 'series-quiz';
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

  const getParams = (): AIGenerationParams => ({
      generationType: getGenerationTypeString(),
      topic: topic,
      persona,
      understanding,
      comprehensiveness,
      count,
      imageStyle: (contentStyle === 'flashcard' || contentStyle === 'vocab' || contentStyle === 'atomic') ? imageStyle : undefined,
      seriesId: context?.seriesId,
      levelIndex: context?.levelIndex,
      deckId: context?.deckId,
      reworkInstructions: reworkInstructions.trim()
  });

  const handleChatAndRefine = () => {
    if (!topic.trim()) return;
    onStartAIGeneration(getParams());
  };

  const handleImmediateGenerate = () => {
    if (!topic.trim()) return;
    if (dataHandlers?.handleImmediateAIGeneration) {
        dataHandlers.handleImmediateAIGeneration(getParams());
        onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[60] p-4">
      <div 
        ref={modalRef} 
        className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative h-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {view === 'main' ? (
          <div className="flex flex-col h-full overflow-hidden">
            <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name={mode === 'rework' ? 'refresh-ccw' : 'bot'} className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">
                    {mode === 'rework' ? `Rework "${context?.deckName}"` : (context?.deckId ? `Expand "${context.deckName}"` : 'Generate with AI')}
                </h2>
              </div>
              <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
            </header>
            <main className="flex-grow p-6 space-y-6 overflow-y-auto no-scrollbar">
              
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
                    <label htmlFor="topic" className="block text-sm font-medium text-text-muted">
                        {mode === 'rework' ? 'Base Topic (Derived from Deck)' : (context?.deckId ? 'Additional Topic / Context' : 'Topic')}
                    </label>
                    {(context?.deckName || context?.seriesName) && mode !== 'rework' && (
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
                <input id="topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., The History of Ancient Rome" autoFocus={mode !== 'rework'} />
                
                {suggestions.length > 0 && mode !== 'rework' && (
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

              {/* Rework Focus (Only in rework mode) */}
              {mode === 'rework' && (
                  <div className="animate-fade-in">
                      <label htmlFor="rework-instructions" className="block text-sm font-medium text-text-muted mb-1">Focus for Rework</label>
                      <textarea
                        id="rework-instructions"
                        value={reworkInstructions}
                        onChange={(e) => setReworkInstructions(e.target.value)}
                        rows={3}
                        className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                        placeholder="e.g., Make the questions much harder, add more practical examples, or simplify the language for a child."
                        autoFocus
                      />
                  </div>
              )}

              {/* Content Style Selection - Locked if context provided */}
              {!context?.deckId && (
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
              )}

              {/* Quantity or Comprehensiveness Selector */}
              {scope === 'deck' && (
                <div className="space-y-4">
                    {contentStyle === 'learning' || contentStyle === 'course' ? (
                        <div>
                            <label htmlFor="comprehensiveness" className="block text-sm font-medium text-text-muted mb-1">Depth of Content</label>
                            <select id="comprehensiveness" value={comprehensiveness} onChange={(e) => setComprehensiveness(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                                {options.comprehensivenessLevels.map(level => (
                                    <option key={level} value={level}>
                                        {level} {level === 'Exhaustive' ? '(Min 20 Chapters)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-3 flex justify-between">
                                <span>Number of items {mode === 'rework' ? 'to maintain' : 'to generate'}</span>
                                <span className="font-bold text-primary">{count}</span>
                            </label>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="5" 
                                    max="50" 
                                    step="5" 
                                    value={count} 
                                    onChange={(e) => setCount(Number(e.target.value))}
                                    className="flex-grow accent-primary"
                                />
                                <div className="flex gap-1">
                                    {[5, 10, 20, 50].map(v => (
                                        <button 
                                            key={v}
                                            type="button"
                                            onClick={() => setCount(v)}
                                            className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${count === v ? 'bg-primary text-on-primary border-primary' : 'border-border text-text-muted hover:border-primary'}`}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {count >= 30 && (
                                <p className="text-[10px] text-orange-500 mt-2 flex items-center gap-1">
                                    <Icon name="info" className="w-3 h-3" /> Note: Large generations use more powerful models and take longer.
                                </p>
                            )}
                        </div>
                    )}
                </div>
              )}

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
                  {!(contentStyle === 'learning' || contentStyle === 'course') && (
                    <div>
                        <label htmlFor="comprehensiveness-shared" className="block text-sm font-medium text-text-muted mb-1">Desired Comprehensiveness</label>
                        <select id="comprehensiveness-shared" value={comprehensiveness} onChange={(e) => setComprehensiveness(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                        {options.comprehensivenessLevels.map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                    </div>
                  )}
              </div>

            </main>
            <footer className="flex-shrink-0 flex flex-wrap justify-between items-center p-4 bg-background/50 border-t border-border gap-2">
              <Button type="button" variant="ghost" onClick={() => setView('options')}>Options</Button>
              <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={handleChatAndRefine} disabled={!topic.trim() || (mode === 'rework' && !reworkInstructions.trim())}>
                    <Icon name="bot" className="w-4 h-4 mr-2" />
                    Chat & Refine
                  </Button>
                  <Button type="button" variant="primary" onClick={handleImmediateGenerate} disabled={!topic.trim() || (mode === 'rework' && !reworkInstructions.trim())}>
                    <Icon name="zap" className="w-5 h-5 mr-2" />
                    Generate Now
                  </Button>
              </div>
            </footer>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <AIOptionsManager onBack={() => setView('main')} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AIGenerationModal;
