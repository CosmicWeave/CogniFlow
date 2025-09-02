
import React, { useState, useRef } from 'react';
import { AIGenerationParams } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import ToggleSwitch from './ui/ToggleSwitch';
import { useStore } from '../store/store';

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: AIGenerationParams & { generationType: 'series' | 'deck' | 'learning', generateQuestions?: boolean, isLearningMode?: boolean }) => Promise<void>;
}

const AIGenerationModal: React.FC<AIGenerationModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [generationType, setGenerationType] = useState<'series' | 'deck' | null>(null);
  const [isLearningMode, setIsLearningMode] = useState(false);
  const [topic, setTopic] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [comprehensiveness, setComprehensiveness] = useState('Standard');
  const [learningGoal, setLearningGoal] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [focusTopics, setFocusTopics] = useState('');
  const [excludeTopics, setExcludeTopics] = useState('');
  const [language, setLanguage] = useState('English');
  const [level, setLevel] = useState('');
  const [generateQuestions, setGenerateQuestions] = useState(true);
  
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  const { aiGenerationStatus } = useStore();
  
  const understandingLevels = ['Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
  const comprehensivenessLevels = ['Quick Overview', 'Standard', 'Comprehensive', 'Exhaustive'];
  const learningGoalOptions = [
    "Master a subject",
    "Learn for the sake of curiosity",
    "Explore a new interest",
    "Become more informed",
    "Understand a complex topic",
    "Practically learn the topic"
  ];
  const learningStyleOptions = ["Conceptual Understanding (Why & How)", "Factual Recall (What, Who, When)", "Practical Application & Scenarios"];
  const languageOptions = ["English", "Spanish", "French", "German", "Japanese", "Mandarin", "Russian"];

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
    setComprehensiveness('Standard');
    setLanguage('English');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiGenerationStatus.isGenerating) {
      addToast("An AI generation task is already in progress. Please wait for it to complete.", "info");
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
        generationType,
        isLearningMode,
        generateQuestions: generationType === 'series' ? generateQuestions : undefined,
    };

    // Fire-and-forget. The hook will handle state updates.
    onGenerate(generationConfig);
    
    // Give immediate feedback and close the modal.
    addToast("AI generation has started. A status indicator will appear in the corner.", "info");
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

        {generationType === 'series' && (
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
                    {understandingLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="ai-goal" className="block text-sm font-medium text-text-muted mb-1"> My Primary Goal Is... </label>
                <select id="ai-goal" value={learningGoal} onChange={(e) => setLearningGoal(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="">(Optional)</option>
                    {learningGoalOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                            {learningStyleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="ai-comp" className="block text-sm font-medium text-text-muted mb-1"> Desired Comprehensiveness </label>
                        <select id="ai-comp" value={comprehensiveness} onChange={(e) => setComprehensiveness(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
                            {comprehensivenessLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
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
                        {languageOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>
        </details>
    </form>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {generationType && (
              <Button variant="ghost" size="sm" className="p-1" onClick={() => setGenerationType(null)} disabled={aiGenerationStatus.isGenerating}>
                <Icon name="chevron-left" />
              </Button>
            )}
            <h2 className="text-xl font-bold">Generate with AI</h2>
          </div>
          <Button type="button" variant="ghost" onClick={handleClose} className="p-1 h-auto" disabled={aiGenerationStatus.isGenerating}><Icon name="x" /></Button>
        </div>
        
        {generationType ? renderForm() : (
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
        )}

        {generationType && (
            <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={handleClose} className="mr-2" disabled={aiGenerationStatus.isGenerating}>Cancel</Button>
            <Button type="submit" variant="primary" onClick={handleSubmit} disabled={aiGenerationStatus.isGenerating}>
                {`Generate ${generationType === 'series' ? 'Series' : 'Deck'}`}
            </Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AIGenerationModal;
