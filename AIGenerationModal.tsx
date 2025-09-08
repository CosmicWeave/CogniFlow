import React, { useState, useRef, useEffect } from 'react';
import { AIGenerationParams } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import ToggleSwitch from './ui/ToggleSwitch';
import { useStore } from '../store/store';
import { useAIOptions } from '../hooks/useAIOptions';
import AIOptionsManager from './AIOptionsManager';

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: AIGenerationParams & { generationType: 'series' | 'deck' | 'learning', generateQuestions?: boolean, isLearningMode?: boolean }) => void;
}

const AIGenerationModal: React.FC<AIGenerationModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [view, setView] = useState<'form' | 'manager'>('form');
  const [generationType, setGenerationType] = useState<'series' | 'deck' | null>(null);
  const [isLearningMode, setIsLearningMode] = useState(false);
  const [topic, setTopic] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [comprehensiveness, setComprehensiveness] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [focusTopics, setFocusTopics] = useState('');
  const [excludeTopics, setExcludeTopics] = useState('');
  const [language, setLanguage] = useState('');
  const [level, setLevel] = useState('');
  const [generateQuestions, setGenerateQuestions] = useState(true);
  
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  const { aiGenerationStatus } = useStore();
  const { options: aiOptions } = useAIOptions();

  useEffect(() => {
    if (isOpen) {
      setComprehensiveness(aiOptions.comprehensivenessLevels.includes('Standard') ? 'Standard' : aiOptions.comprehensivenessLevels[0] || '');
      setLanguage(aiOptions.languageOptions.includes('English') ? 'English' : aiOptions.languageOptions[0] || '');
    }
  }, [isOpen, aiOptions]);

  const handleClose = () => {
    // Reset state on close
    setGenerationType(null);
    setIsLearningMode(false);
    setTopic('');
    setLevel('');
    setCustomInstructions('');
    setFocusTopics('');
    setExcludeTopics('');
    setLearningGoal('');
    setLearningStyle('');
    setComprehensiveness(aiOptions.comprehensivenessLevels.includes('Standard') ? 'Standard' : aiOptions.comprehensivenessLevels[0] || '');
    setLanguage(aiOptions.languageOptions.includes('English') ? 'English' : aiOptions.languageOptions[0] || '');
    setView('form');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiGenerationStatus.currentTask || aiGenerationStatus.queue.length > 5) {
      addToast("The AI queue is full. Please wait for some tasks to complete.", "info");
      return;
    }
    if (!generationType) return;
    if (!topic.trim()) {
      addToast("Please enter a topic.", "error");
      return;
    }
    
    const aiParams: AIGenerationParams = {
        topic, level: level || undefined, comprehensiveness,
        customInstructions: customInstructions || undefined,
        learningGoal: learningGoal || undefined,
        learningStyle: learningStyle || undefined,
        focusTopics: focusTopics || undefined,
        excludeTopics: excludeTopics || undefined,
        language: language || undefined,
    };
    
    const generationConfig = {
        ...aiParams,
        // FIX: Explicitly cast the generationType to satisfy the expected union type.
        generationType: (isLearningMode ? 'learning' : generationType) as ('series' | 'deck' | 'learning'),
        generateQuestions: generationType === 'series' ? generateQuestions : undefined,
        isLearningMode,
    };

    onGenerate(generationConfig);
    handleClose();
  };
  
  if (!isOpen) return null;

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6">
        <div>
            <label htmlFor="ai-topic" className="block text-sm font-bold text-text mb-1">
            Main Topic <span className="text-red-500">*</span>
            </label>
            <input id="ai-topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., The History of Ancient Rome" required autoFocus/>
        </div>
        
        <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
            <ToggleSwitch 
                label="Enable Learning Mode" 
                description="Generates info cards followed by related questions." 
                checked={isLearningMode} 
                onChange={setIsLearningMode} 
            />
        </div>

        {generationType === 'series' && !isLearningMode && (
            <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <ToggleSwitch 
                    label="Generate questions for all decks" 
                    description="The AI will create the full series and populate all decks with questions." 
                    checked={generateQuestions} 
                    onChange={setGenerateQuestions} 
                />
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="ai-level" className="block text-sm font-medium text-text-muted mb-1"> My Current Understanding Is... </label>
                <select id="ai-level" value={level} onChange={(e) => setLevel(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="">(Optional)</option>
                    {aiOptions.understandingLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="ai-goal" className="block text-sm font-medium text-text-muted mb-1"> My Primary Goal Is... </label>
                <select id="ai-goal" value={learningGoal} onChange={(e) => setLearningGoal(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="">(Optional)</option>
                    {aiOptions.learningGoalOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        </div>
        
        <details className="space-y-4">
            <summary className="cursor-pointer text-sm font-medium text-primary hover:underline"> Advanced Options </summary>
            <div className="pt-4 space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="ai-style" className="block text-sm font-medium text-text-muted mb-1"> Preferred Learning Style </label>
                        <select id="ai-style" value={learningStyle} onChange={(e) => setLearningStyle(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                            <option value="">(Optional)</option>
                            {aiOptions.learningStyleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="ai-comp" className="block text-sm font-medium text-text-muted mb-1"> Desired Comprehensiveness </label>
                        <select id="ai-comp" value={comprehensiveness} onChange={(e) => setComprehensiveness(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                            {aiOptions.comprehensivenessLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="ai-focus" className="block text-sm font-medium text-text-muted mb-1"> Specific Topics to Focus On </label>
                    <input id="ai-focus" type="text" value={focusTopics} onChange={(e) => setFocusTopics(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., The Roman Republic, not the Empire"/>
                </div>
                <div>
                    <label htmlFor="ai-exclude" className="block text-sm font-medium text-text-muted mb-1"> Topics to Exclude </label>
                    <input id="ai-exclude" type="text" value={excludeTopics} onChange={(e) => setExcludeTopics(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., military history, specific emperors"/>
                </div>
                <div>
                    <label htmlFor="ai-instructions" className="block text-sm font-medium text-text-muted mb-1"> Additional Instructions </label>
                    <textarea id="ai-instructions" value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} rows={3} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., 'Focus on practical examples for a beginner.'"/>
                </div>
                <div>
                    <label htmlFor="ai-lang" className="block text-sm font-medium text-text-muted mb-1"> Output Language </label>
                    <select id="ai-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                        {aiOptions.languageOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>
        </details>
    </form>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {generationType && view === 'form' && (
              <Button variant="ghost" size="sm" className="p-1" onClick={() => setGenerationType(null)}>
                <Icon name="chevron-left" />
              </Button>
            )}
            <h2 className="text-xl font-bold">Generate with AI</h2>
          </div>
          <div className="flex items-center gap-1">
            {view === 'form' && (
                <Button type="button" variant="ghost" onClick={() => setView('manager')} className="p-1 h-auto" aria-label="Manage AI options">
                    <Icon name="settings" />
                </Button>
            )}
            <Button type="button" variant="ghost" onClick={handleClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>
        </div>
        
        {view === 'manager' ? <AIOptionsManager onBack={() => setView('form')} /> : (
            generationType ? renderForm() : (
                <div className="p-6 text-center space-y-4">
                    <p className="text-text-muted">What would you like to create?</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button variant="secondary" size="lg" onClick={() => setGenerationType('series')} className="w-full sm:w-auto">
                            <Icon name="layers" className="w-5 h-5 mr-2"/>
                            A Series of Decks
                        </Button>
                        <Button variant="secondary" size="lg" onClick={() => setGenerationType('deck')} className="w-full sm:w-auto">
                            <Icon name="help-circle" className="w-5 h-5 mr-2"/>
                            A Single Deck
                        </Button>
                    </div>
                </div>
            )
        )}

        {view === 'form' && generationType && (
            <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="primary" onClick={handleSubmit}>
                {`Generate ${isLearningMode ? 'Content' : (generationType === 'series' ? 'Series' : 'Deck')}`}
            </Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AIGenerationModal;