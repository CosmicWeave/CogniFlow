
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAIOptions } from '../hooks/useAIOptions.ts';
import AIOptionsManager from './AIOptionsManager';
import { AIGenerationParams, DeckType } from '../types.ts';
import { getTopicSuggestions } from '../services/aiService.ts';
import { useToast } from '../hooks/useToast.ts';
import Spinner from './ui/Spinner';
import { useData } from '../contexts/DataManagementContext.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import { extractTextFromFile } from '../services/importService.ts';

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
      sourceMaterial?: string;
  };
}

type GenerationScope = 'deck' | 'series' | 'deep-course';
type ContentStyle = 'quiz' | 'flashcard' | 'vocab' | 'atomic' | 'blooms' | 'course' | 'learning' | 'scaffold';

export const AIGenerationModal: React.FC<AIGenerationModalProps> = ({ isOpen, onClose, onStartAIGeneration, initialTopic, initialGenerationType, context }) => {
  const [view, setView] = useState<'main' | 'options'>('main');
  const [topic, setTopic] = useState(initialTopic || context?.deckName || '');
  const [reworkInstructions, setReworkInstructions] = useState('');
  
  const [scope, setScope] = useState<GenerationScope>(context?.sourceMaterial ? 'deep-course' : (context?.seriesId ? 'series' : 'deck'));
  const [contentStyle, setContentStyle] = useState<ContentStyle>(context?.sourceMaterial ? 'learning' : 'quiz');
  const [count, setCount] = useState<number>(10);
  const [chapterCount, setChapterCount] = useState<number>(12);
  const [targetWordCount, setTargetWordCount] = useState<number>(10000);

  const [imageStyle, setImageStyle] = useState<'none' | 'realistic' | 'creative'>('none');
  const [persona, setPersona] = useState('default');
  const [understanding, setUnderstanding] = useState('Auto');
  const [comprehensiveness, setComprehensiveness] = useState('Standard');
  
  // Source Material state
  const [sourceMaterial, setSourceMaterial] = useState(context?.sourceMaterial || '');
  const [showSourceMaterial, setShowSourceMaterial] = useState(!!context?.sourceMaterial);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { options } = useAIOptions();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  const { addToast } = useToast();
  const dataHandlers = useData();

  const mode = context?.mode || 'generate';

  useEffect(() => {
    if (context?.deckType) {
        if (context.deckType === DeckType.Flashcard) setContentStyle('flashcard');
        else if (context.deckType === DeckType.Learning) setContentStyle('learning');
    }
  }, [context]);

  const getParams = (): AIGenerationParams => ({
      generationType: mode === 'rework' ? 'rework-deck' : (scope === 'deep-course' ? 'deep-course' : (scope === 'series' ? 'series-quiz' : 'single-deck-quiz')),
      topic, persona, understanding, comprehensiveness, count,
      imageStyle: (contentStyle === 'flashcard') ? imageStyle : undefined,
      seriesId: context?.seriesId,
      levelIndex: context?.levelIndex,
      deckId: context?.deckId,
      reworkInstructions: reworkInstructions.trim(),
      chapterCount: scope === 'deep-course' ? chapterCount : undefined,
      targetWordCount: scope === 'deep-course' ? targetWordCount : undefined,
      sourceMaterial: sourceMaterial.trim() || undefined
  });

  const handleImmediateGenerate = () => {
    if (!topic.trim()) return;
    dataHandlers.handleImmediateAIGeneration(getParams());
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const text = await extractTextFromFile(file);
              setSourceMaterial(text);
              if (!topic) setTopic(file.name.replace(/\.[^/.]+$/, ""));
              addToast("Material ingested successfully.", "success");
          } catch (err) {
              addToast((err as Error).message, "error");
          }
      }
      if (e.target) e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative h-full max-h-[95vh] overflow-hidden flex flex-col">
        {view === 'main' ? (
          <div className="flex flex-col h-full overflow-hidden">
            <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="bot" className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">
                    {mode === 'rework' ? 'Rework Content' : 'AI Content Studio'}
                </h2>
              </div>
              <Button variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
            </header>
            <main className="flex-grow p-6 space-y-6 overflow-y-auto no-scrollbar">
              
              {/* Project Context Summary */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-start gap-4">
                <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <Icon name={scope === 'deep-course' ? 'layers' : (scope === 'series' ? 'layers' : 'laptop')} className="w-6 h-6" />
                </div>
                <div className="flex-grow">
                    <h3 className="font-bold text-sm text-text">Target Goal</h3>
                    <p className="text-xs text-text-muted">
                        Generating {scope === 'deep-course' ? 'a comprehensive master course' : (scope === 'series' ? 'a multi-level series' : 'a standalone deck')} on your chosen topic.
                    </p>
                </div>
              </div>

              {/* Scope Selection */}
              <div className="space-y-2">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest">Generation Scope</label>
                  <div className="flex bg-background rounded-lg p-1 border border-border">
                      <button onClick={() => setScope('deck')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${scope === 'deck' ? 'bg-primary text-on-primary shadow-sm' : 'text-text-muted hover:text-text'}`}>Standalone Deck</button>
                      <button onClick={() => setScope('series')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${scope === 'series' ? 'bg-primary text-on-primary shadow-sm' : 'text-text-muted hover:text-text'}`}>Full Series</button>
                      <button onClick={() => setScope('deep-course')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${scope === 'deep-course' ? 'bg-indigo-600 text-on-primary shadow-sm' : 'text-text-muted hover:text-text'}`}>Hyper-Course ✨</button>
                  </div>
              </div>

              {/* Topic Input */}
              <div>
                <label htmlFor="topic" className="block text-sm font-medium text-text-muted mb-1">Concept Topic / Title</label>
                <input 
                    id="topic" 
                    type="text" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)} 
                    placeholder="e.g., Quantum Mechanics, Conversational Spanish, AWS Solutions Architect..."
                    className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-lg font-bold" 
                />
              </div>

              {/* Source Material Section (NEW) */}
              <div className="space-y-3">
                  <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-semibold text-text">
                          <Icon name="file-text" className="w-4 h-4 text-indigo-500" />
                          Knowledge Source
                      </label>
                      <button 
                        onClick={() => setShowSourceMaterial(!showSourceMaterial)} 
                        className={`text-xs font-bold px-2 py-1 rounded-md transition-all ${showSourceMaterial ? 'bg-indigo-100 text-indigo-600' : 'bg-background border border-border text-text-muted hover:border-indigo-300'}`}
                      >
                          {showSourceMaterial ? 'Using Custom Source' : 'Use Generic AI Knowledge'}
                      </button>
                  </div>

                  {showSourceMaterial && (
                      <div className="animate-fade-in space-y-3 p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">Ingested Material</p>
                          <textarea
                            value={sourceMaterial}
                            onChange={(e) => setSourceMaterial(e.target.value)}
                            placeholder="Paste your text, notes, or article content here. The AI will strictly follow this material for all chapters and questions."
                            className="w-full h-32 p-3 bg-background border border-indigo-100 dark:border-indigo-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
                          />
                          <div className="flex items-center justify-between">
                              <p className="text-[10px] text-text-muted font-mono">
                                  {sourceMaterial ? `${sourceMaterial.split(/\s+/).length} words loaded` : 'No text entered'}
                              </p>
                              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-indigo-600 hover:bg-indigo-100 h-auto py-1">
                                  <Icon name="upload-cloud" className="w-3.5 h-3.5 mr-1.5" /> Upload Document
                              </Button>
                              <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.md,.markdown,.rtf" onChange={handleFileUpload} />
                          </div>
                      </div>
                  )}
              </div>

              {/* Hyper-Course Specific Config */}
              {scope === 'deep-course' && (
                  <div className="space-y-4 p-5 bg-indigo-600 text-white rounded-xl shadow-lg animate-fade-in relative overflow-hidden">
                      <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
                          <Icon name="zap" className="w-32 h-32" />
                      </div>
                      <div className="relative flex flex-col gap-4">
                          <div>
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-black uppercase tracking-tighter opacity-80">Depth of Curriculum</span>
                                  <span className="text-sm font-bold bg-white/20 px-2 py-0.5 rounded">{chapterCount} Chapters</span>
                              </div>
                              <input type="range" min="5" max="30" value={chapterCount} onChange={(e) => setChapterCount(Number(e.target.value))} className="w-full accent-white" />
                          </div>
                          <div>
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-black uppercase tracking-tighter opacity-80">Word Density</span>
                                  <span className="text-sm font-bold bg-white/20 px-2 py-0.5 rounded">~{(targetWordCount / 1000).toFixed(0)}k total words</span>
                              </div>
                              <input type="range" min="3000" max="30000" step="1000" value={targetWordCount} onChange={(e) => setTargetWordCount(Number(e.target.value))} className="w-full accent-white" />
                          </div>
                      </div>
                  </div>
              )}

              {/* Persona and Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                <div className="space-y-1">
                  <label htmlFor="persona" className="block text-xs font-bold text-text-muted uppercase tracking-widest">Instructional Persona</label>
                  <select id="persona" value={persona} onChange={(e) => setPersona(e.target.value)} className="w-full p-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary">
                    {options.personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="understanding" className="block text-xs font-bold text-text-muted uppercase tracking-widest">Target Proficiency</label>
                  <select id="understanding" value={understanding} onChange={(e) => setUnderstanding(e.target.value)} className="w-full p-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary">
                    {options.understandingLevels.map(level => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
              </div>

            </main>
            <footer className="flex-shrink-0 flex justify-end items-center p-4 bg-background/50 border-t border-border gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleImmediateGenerate} disabled={!topic.trim()} className="px-8 font-bold">
                <Icon name="zap" className="w-5 h-5 mr-2" /> Start Synthesis
              </Button>
            </footer>
          </div>
        ) : <AIOptionsManager onBack={() => setView('main')} />}
      </div>
    </div>
  );
};

export default AIGenerationModal;
