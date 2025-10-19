import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Spinner from './ui/Spinner';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAIOptions } from '../hooks/useAIOptions';
import AIOptionsManager from './AIOptionsManager';
import { AIGenerationParams, AIGenerationAnalysis, AIMessage } from '../types';
import * as aiService from '../services/aiService';
import ToggleSwitch from './ui/ToggleSwitch';
import TopicSuggestionModal from './TopicSuggestionModal';

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (payload: AIGenerationParams) => void;
}

export const AIGenerationModal: React.FC<AIGenerationModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuggestingTopics, setIsSuggestingTopics] = useState(false);
  
  // Step 1 State
  const [generationTarget, setGenerationTarget] = useState<'series' | 'deck'>('series');
  const [isLearningMode, setIsLearningMode] = useState<boolean>(false);
  const [params, setParams] = useState<Partial<Omit<AIGenerationParams, 'generationType' | 'isLearningMode'>>>({
    topic: '',
    understandingLevel: 'Auto',
    learningGoal: 'Auto',
    learningStyle: 'Auto',
    language: 'English',
    tone: 'Auto',
    comprehensiveness: 'Standard',
    customInstructions: '',
    topicsToInclude: '',
    topicsToExclude: '',
  });
  const [sourceFiles, setSourceFiles] = useState<{ name: string, content: string }[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [pastedSource, setPastedSource] = useState('');
  
  // Step 2 State
  const [analysis, setAnalysis] = useState<AIGenerationAnalysis | null>(null);
  const [finalTitle, setFinalTitle] = useState('');
  const [questionCount, setQuestionCount] = useState<number | undefined>(undefined);
  const [brainstormHistory, setBrainstormHistory] = useState<AIMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [managingOptions, setManagingOptions] = useState(false);
  
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [topicSuggestions, setTopicSuggestions] = useState<{ include: string[]; exclude: string[] } | null>(null);
  
  const [personaId, setPersonaId] = useState('default');
  const [temperature, setTemperature] = useState(0.7);

  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  useFocusTrap(modalRef, isOpen);
  const { options } = useAIOptions();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [brainstormHistory]);

  useEffect(() => {
    const textarea = chatInputRef.current;
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [chatInput]);

  const derivedGenerationType = useMemo((): AIGenerationParams['generationType'] => {
    if (generationTarget === 'series') {
        return 'series-scaffold'; 
    }
    return isLearningMode ? 'deck-learning' : 'deck-quiz';
  }, [generationTarget, isLearningMode]);
  
  const handleClose = useCallback(() => {
    setStep(1);
    setIsProcessing(false);
    setGenerationTarget('series');
    setIsLearningMode(false);
    setParams({
      topic: '',
      understandingLevel: 'Auto',
      learningGoal: 'Auto',
      learningStyle: 'Auto',
      language: 'English',
      tone: 'Auto',
      comprehensiveness: 'Standard',
      customInstructions: '',
      topicsToInclude: '',
      topicsToExclude: '',
    });
    setSourceFiles([]);
    setSourceUrl('');
    setPastedSource('');
    setAnalysis(null);
    setFinalTitle('');
    setQuestionCount(undefined);
    setBrainstormHistory([]);
    setChatInput('');
    onClose();
  }, [onClose]);
  
  const handleParamChange = (field: keyof typeof params, value: string) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles: { name: string, content: string }[] = [];
      for (const file of Array.from(files)) {
        try {
          const f = file as File;
          const text = await f.text();
          newFiles.push({ name: f.name, content: text });
        } catch (error) {
          addToast(`Could not read file "${(file as File).name}".`, 'error');
        }
      }
      setSourceFiles(prev => [...prev, ...newFiles]);
      addToast(`${newFiles.length} file(s) loaded successfully.`, 'success');
    }
  };

  const handleRemoveFile = (fileNameToRemove: string) => {
    setSourceFiles(prev => prev.filter(file => file.name !== fileNameToRemove));
  };

  const handleSuggestTopics = async () => {
    if (!params.topic?.trim()) {
      addToast('Please enter a primary topic first to get suggestions.', 'error');
      return;
    }
    setIsSuggestingTopics(true);
    try {
      const suggestions = await aiService.getTopicSuggestions(params.topic);
      setTopicSuggestions({
        include: suggestions.topicsToInclude,
        exclude: suggestions.topicsToExclude,
      });
      setIsTopicModalOpen(true);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to get topic suggestions.", 'error');
    } finally {
      setIsSuggestingTopics(false);
    }
  };
  
  const handleApplyTopicSelections = (selections: { included: string[], excluded: string[] }) => {
    const currentInclude = params.topicsToInclude?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const combinedInclude = [...new Set([...currentInclude, ...selections.included])].join(', ');

    const currentExclude = params.topicsToExclude?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const combinedExclude = [...new Set([...currentExclude, ...selections.excluded])].join(', ');
    
    setParams(prev => ({
      ...prev,
      topicsToInclude: combinedInclude,
      topicsToExclude: combinedExclude,
    }));
    setIsTopicModalOpen(false);
    setTopicSuggestions(null);
  };

  const getFullPayload = (): AIGenerationParams => {
    const sourceFileContents = sourceFiles.map(f => `--- Start of ${f.name} ---\n${f.content}\n--- End of ${f.name} ---`).join('\n\n');
    const combinedSourceContent = [sourceFileContents, pastedSource.trim()].filter(Boolean).join('\n\n');
    
    const selectedPersona = options.personas.find(p => p.id === personaId);
    const systemInstruction = personaId === 'custom' ? params.customInstructions : selectedPersona?.instruction;
    
    const formattedHistory = brainstormHistory.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');

    return {
        ...params,
        topic: params.topic?.trim() || 'Content from provided sources',
        generationType: derivedGenerationType,
        isLearningMode,
        finalTitle,
        questionCount,
        brainstormHistory: formattedHistory,
        sourceContent: combinedSourceContent || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        topicsToInclude: params.topicsToInclude?.trim() || undefined,
        topicsToExclude: params.topicsToExclude?.trim() || undefined,
        systemInstruction: systemInstruction || undefined,
        temperature,
        customFields: options.customFields,
    } as AIGenerationParams;
  }

  const handleAnalyze = async () => {
    if (!params.topic?.trim() && !sourceFiles.length && !pastedSource.trim() && !sourceUrl.trim()) {
        addToast('Please provide a topic or source material.', 'error');
        return;
    }
    
    setIsProcessing(true);
    try {
      const analysisPayload = getFullPayload();
      const analysisResult = await aiService.getAIGenerationAnalysis(analysisPayload);
      setAnalysis(analysisResult);
      setFinalTitle(analysisResult.titleSuggestions[0] || params.topic!);
      if (analysisResult.questionCountSuggestions.length > 0) {
        const standardSuggestion = analysisResult.questionCountSuggestions.find(s => s.label.toLowerCase().includes('standard')) || analysisResult.questionCountSuggestions[0];
        if (standardSuggestion) {
            setQuestionCount(standardSuggestion.count);
        }
      }
      
      const initialAiMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: `${analysisResult.interpretation}\n\nTo help create the best content, can you answer these questions?\n- ${analysisResult.followUpQuestions.join('\n- ')}`
      };
      setBrainstormHistory([initialAiMessage]);
      setStep(2);

    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to get AI analysis.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleSendBrainstormMessage = useCallback(async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || isProcessing) return;

    const newUserMessage: AIMessage = { id: crypto.randomUUID(), role: 'user', text: prompt };
    const loadingMessage: AIMessage = { id: crypto.randomUUID(), role: 'model', text: '', isLoading: true };
    
    const updatedHistory = [...brainstormHistory, newUserMessage, loadingMessage];
    setBrainstormHistory(updatedHistory);
    setChatInput('');
    setIsProcessing(true);

    try {
      const payload = getFullPayload();
      const aiResponseText = await aiService.brainstormWithAI(payload, [...brainstormHistory, newUserMessage]);
      
      const modelResponseMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: aiResponseText,
      };

      setBrainstormHistory(prev => [...prev.slice(0, -1), modelResponseMessage]);
    } catch (error) {
      const errorMessage: AIMessage = {
          id: crypto.randomUUID(),
          role: 'model',
          text: error instanceof Error ? error.message : "An unknown error occurred.",
      };
      setBrainstormHistory(prev => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [chatInput, isProcessing, brainstormHistory, getFullPayload]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Manually trigger the send message logic
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSendBrainstormMessage(fakeEvent);
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      handleAnalyze();
    } else {
      onGenerate(getFullPayload());
      handleClose();
    }
  };

  if (!isOpen) return null;
  
  const renderStep1 = () => (
    <>
      <div>
          <label htmlFor="topic" className="block text-sm font-bold text-text mb-1">Primary Topic</label>
          <input id="topic" type="text" value={params.topic} onChange={(e) => handleParamChange('topic', e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="e.g., The History of Ancient Rome" autoFocus />
          <p className="text-xs text-text-muted mt-1">The main subject of the content you want to generate. Also used if no other sources are provided.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-text">Source Material (Optional)</h3>
        <div>
          <input type="file" ref={fileInputRef} multiple className="hidden" accept=".txt,.md,.html" onChange={handleFileChange} />
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full">
              <Icon name="upload-cloud" className="w-5 h-5 mr-2"/>Upload Files
          </Button>
          {sourceFiles.length > 0 && (
              <ul className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                  {sourceFiles.map(file => (
                      <li key={file.name} className="flex items-center justify-between text-sm bg-background p-2 rounded-md border border-border">
                          <div className="flex items-center gap-2 min-w-0"><Icon name="file-text" className="w-4 h-4 text-text-muted flex-shrink-0" /><span className="truncate" title={file.name}>{file.name}</span></div>
                          <Button type="button" variant="ghost" size="sm" className="p-1 h-auto" onClick={() => handleRemoveFile(file.name)}><Icon name="trash-2" className="w-4 h-4 text-red-500" /></Button>
                      </li>
                  ))}
              </ul>
          )}
        </div>
        <div>
          <label htmlFor="source-url" className="block text-sm font-medium text-text-muted mb-1">From URL</label>
          <div className="relative"><Icon name="link" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" /><input id="source-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="w-full p-2 pl-9 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="https://..." /></div>
        </div>
        <div>
          <label htmlFor="paste-source" className="block text-sm font-medium text-text-muted mb-1">Paste Text</label>
          <textarea id="paste-source" value={pastedSource} onChange={(e) => setPastedSource(e.target.value)} rows={4} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Paste an article, notes, or any other text..." />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="generation-target" className="block text-sm font-medium text-text-muted mb-1">Content Type</label>
          <select id="generation-target" value={generationTarget} onChange={(e) => setGenerationTarget(e.target.value as 'series' | 'deck')} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
            <option value="series">Series</option>
            <option value="deck">Single Deck</option>
          </select>
        </div>
        <div>
          <label htmlFor="comprehensiveness" className="block text-sm font-medium text-text-muted mb-1">Comprehensiveness</label>
          <select id="comprehensiveness" value={params.comprehensiveness} onChange={(e) => handleParamChange('comprehensiveness', e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
             {options.comprehensivenessLevels.map(level => <option key={level} value={level}>{level}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="language" className="block text-sm font-medium text-text-muted mb-1">Language</label>
          <select id="language" value={params.language} onChange={(e) => handleParamChange('language', e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
             <option value="English">English</option>
             <option value="Swedish">Swedish</option>
          </select>
        </div>
      </div>
      <ToggleSwitch label="Learning Mode" description="Generates info sections followed by questions." checked={isLearningMode} onChange={setIsLearningMode} />

      <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-sm font-bold text-text -mb-2">Fine-Tuning</h3>
          <div>
            <label htmlFor="persona" className="block text-sm font-medium text-text-muted mb-1">AI Persona</label>
            <select id="persona" value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none">
              {options.personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="custom">Custom...</option>
            </select>
          </div>
          {personaId === 'custom' && (
             <div>
                <label htmlFor="custom-instructions" className="block text-sm font-medium text-text-muted mb-1">Custom Instructions</label>
                <textarea id="custom-instructions" value={params.customInstructions} onChange={(e) => handleParamChange('customInstructions', e.target.value)} rows={3} className="w-full p-2 bg-background border border-border rounded-md" placeholder="e.g., 'Act as a pirate and explain everything in character...'" />
             </div>
          )}
          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-text-muted mb-1">Creativity vs. Precision ({temperature.toFixed(1)})</label>
            <input id="temperature" type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full" />
          </div>
          <div>
            <label htmlFor="topics-to-include" className="block text-sm font-medium text-text-muted mb-1">Topics to Include (comma-separated)</label>
            <textarea id="topics-to-include" value={params.topicsToInclude} onChange={(e) => handleParamChange('topicsToInclude', e.target.value)} rows={2} className="w-full p-2 bg-background border border-border rounded-md" placeholder="e.g., 'republican era', 'julius caesar'" />
          </div>
          <div className="text-center -my-2">
             <Button type="button" variant="ghost" onClick={handleSuggestTopics} disabled={!params.topic?.trim() || isSuggestingTopics || isProcessing} className="px-2" aria-label="Get AI suggestions for topics to include and exclude">
                {isSuggestingTopics ? <Spinner size="sm" /> : <Icon name="zap" className="w-4 h-4 mr-1" />} Suggest Topics
              </Button>
          </div>
          <div>
            <label htmlFor="topics-to-exclude" className="block text-sm font-medium text-text-muted mb-1">Topics to Exclude (comma-separated)</label>
            <textarea id="topics-to-exclude" value={params.topicsToExclude} onChange={(e) => handleParamChange('topicsToExclude', e.target.value)} rows={2} className="w-full p-2 bg-background border border-border rounded-md" placeholder="e.g., 'imperial era', 'byzantine history'" />
          </div>
      </div>
    </>
  );

  const renderStep2 = () => (
    <div className="h-full flex flex-col">
        <div className="flex-grow overflow-y-auto space-y-4 -mx-6 px-6">
            {brainstormHistory.map(message => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'model' && <Icon name="bot" className="w-6 h-6 text-primary flex-shrink-0 mt-1" />}
                    <div className={`max-w-md p-3 rounded-2xl ${message.role === 'user' ? 'bg-primary text-on-primary rounded-br-lg' : 'bg-background rounded-bl-lg'}`}>
                        {message.isLoading ? (
                            <div className="flex items-center gap-2">
                                <Spinner size="sm" />
                                <span className="text-text-muted">Thinking...</span>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap">{message.text}</p>
                        )}
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
        <div className="flex-shrink-0 flex items-start gap-2 pt-4">
            <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Your response... (Shift+Enter for new line)"
                className="flex-grow p-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none px-4 resize-none overflow-y-auto"
                rows={1}
                style={{ maxHeight: '120px' }}
                disabled={isProcessing}
            />
            <Button type="button" onClick={handleSendBrainstormMessage} variant="primary" className="rounded-full w-10 h-10 p-0 flex-shrink-0" aria-label="Send message" disabled={isProcessing}>
                <Icon name="arrow-down" className="w-5 h-5 -rotate-90"/>
            </Button>
        </div>
    </div>
  );
  
  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
        <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col">
          {managingOptions ? (
            <AIOptionsManager onBack={() => setManagingOptions(false)} />
          ) : (
            <>
              <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
                <h2 className="text-xl font-bold">Generate with AI (Step {step} of 2)</h2>
                <Button type="button" variant="ghost" onClick={handleClose} className="p-1 h-auto" disabled={isProcessing}><Icon name="x" /></Button>
              </header>
              <main className="flex-grow p-6 overflow-y-auto">
                <form id="ai-gen-form" onSubmit={handleSubmit} className="space-y-6 h-full">
                  {step === 1 ? renderStep1() : renderStep2()}
                </form>
              </main>
              <footer className="flex-shrink-0 flex justify-between items-center p-4 bg-background/50 border-t border-border">
                {step === 1 ? (
                  <Button type="button" variant="ghost" onClick={() => setManagingOptions(true)}><Icon name="settings" className="w-4 h-4 mr-2" /> Manage Options</Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}><Icon name="chevron-left" className="w-4 h-4 mr-2" /> Back</Button>
                )}
                <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
                    <Button type="submit" form="ai-gen-form" variant="primary" disabled={isProcessing}>
                        {isProcessing ? <Spinner size="sm" /> : 
                          step === 1 ? (<>Next <Icon name="chevron-left" className="w-4 h-4 ml-2 rotate-180"/></>) : 
                                       (<><Icon name="zap" className="w-4 h-4 mr-2" /> Generate Content</>)}
                    </Button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
      {isTopicModalOpen && topicSuggestions && (
          <TopicSuggestionModal isOpen={isTopicModalOpen} onClose={() => setIsTopicModalOpen(false)} suggestedTopics={topicSuggestions} onApply={handleApplyTopicSelections}/>
      )}
    </>
  );
};