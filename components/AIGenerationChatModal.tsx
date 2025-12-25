import React, { useState, useEffect, useRef } from 'react';
import { AIMessage, AIGenerationParams, AIGenerationTask } from '../types.ts';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Spinner from './ui/Spinner';
import * as aiService from '../services/aiService.ts';
import { useAIOptions } from '../hooks/useAIOptions.ts';
import { useData } from '../contexts/DataManagementContext.tsx';
import { useToast } from '../hooks/useToast.ts';
import { useStore } from '../store/store.ts';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';

interface AIGenerationChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: AIGenerationParams;
}

const AIGenerationChatModal: React.FC<AIGenerationChatModalProps> = ({ isOpen, onClose, params }) => {
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentOutline, setCurrentOutline] = useState('');
    const [outlineMetadata, setOutlineMetadata] = useState<any>({});
    const [userInput, setUserInput] = useState('');
    const { options: aiOptions } = useAIOptions();
    const dataHandlers = useData();
    const { addToast } = useToast();
    const { dispatch, deckSeries } = useStore();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    useEffect(() => {
        if (!isOpen) {
            hasInitializedRef.current = false;
            return;
        }
        if (hasInitializedRef.current) return;

        hasInitializedRef.current = true;

        const generateInitialOutline = async () => {
            setIsLoading(true);
            setMessages([]);
            const persona = aiOptions.personas.find(p => p.id === params.persona) || aiOptions.personas[0];
            
            const series = params.seriesId ? deckSeries[params.seriesId] : null;
            const seriesContext = series ? { name: series.name, description: series.description } : undefined;

            try {
                const { outline, metadata } = await aiService.generateOutlineWithAI(params, persona, seriesContext);
                setCurrentOutline(outline);
                setOutlineMetadata(metadata);
                setMessages([{
                    id: crypto.randomUUID(),
                    role: 'model',
                    text: `Here is a draft outline for your ${params.generationType.startsWith('series-') ? 'series' : 'deck'} on "${params.topic}":\n\n${outline}`
                }]);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to generate initial outline.";
                addToast(message, 'error');
                setMessages([{ id: crypto.randomUUID(), role: 'model', text: `Sorry, I couldn't generate an outline. Error: ${message}` }]);
            } finally {
                setIsLoading(false);
            }
        };
        generateInitialOutline();
    }, [isOpen, params, aiOptions.personas, addToast, deckSeries]);

    const handleRefine = async (e: React.FormEvent) => {
        e.preventDefault();
        const prompt = userInput.trim();
        if (!prompt || isLoading) return;

        setUserInput('');
        const newUserMessage: AIMessage = { id: crypto.randomUUID(), role: 'user', text: prompt };
        const updatedHistory = [...messages, newUserMessage];
        setMessages(updatedHistory);
        setIsLoading(true);
        
        const persona = aiOptions.personas.find(p => p.id === params.persona) || aiOptions.personas[0];
        try {
            const refinedOutline = await aiService.refineOutlineWithAI(updatedHistory, params, persona);
            setCurrentOutline(refinedOutline);
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: `Here is the refined outline:\n\n${refinedOutline}` }]);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to refine outline.";
            addToast(message, 'error');
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: `Sorry, I had trouble with that request. Error: ${message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async () => {
        const taskId = crypto.randomUUID();
        const { generationType } = params;
        
        if (generationType.startsWith('series-')) {
            const task: AIGenerationTask = {
                id: taskId,
                type: 'generateFullSeriesFromScaffold',
                payload: { outline: currentOutline, generationType: params.generationType },
                statusText: `Generating series structure for "${params.topic}"`,
            };
            dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            addToast('Series generation started. Check the status indicator below.', 'info');
        } else if (['deck-flashcard', 'deck-vocab', 'deck-atomic'].includes(generationType)) {
             const task: AIGenerationTask = {
                id: taskId,
                type: 'generateFlashcardDeckWithAI',
                payload: params, // Params includes topic, style, persona etc.
                statusText: `Generating flashcards for "${params.topic}"`,
            };
            dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            addToast('Flashcard generation started. Check the status indicator below.', 'info');
        } else if (['single-deck-learning', 'deck-course'].includes(generationType)) {
             const task: AIGenerationTask = {
                id: taskId,
                type: 'generateLearningDeckWithAI',
                payload: params,
                statusText: `Generating learning content for "${params.topic}"`,
            };
            dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            addToast('Learning content generation started. Check the status indicator below.', 'info');
        } else if (['single-deck-quiz', 'quiz-blooms'].includes(generationType)) {
            const task: AIGenerationTask = {
                id: taskId,
                type: 'generateDeckFromOutline',
                payload: { 
                    outline: currentOutline, 
                    metadata: outlineMetadata,
                    seriesId: params.seriesId,
                    levelIndex: params.levelIndex 
                },
                statusText: `Generating deck content for "${params.topic}"`,
            };
            dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            addToast('Deck generation started. Check the status indicator below.', 'info');
        }
        onClose();
    };

    const formatMessageText = (text: string) => {
        // Simple Markdown-to-HTML converter
        let formatted = text
            // Header 3
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-2">$1</h3>')
            // Header 2
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-3 border-b border-border pb-1">$1</h2>')
            // Header 1
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            // Italic
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            // List Items
            .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
            // Code Block
            .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-white p-2 rounded my-2 overflow-x-auto text-xs"><code>$1</code></pre>')
            // Inline Code
            .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded text-sm font-mono">$1</code>')
            // Newlines to breaks (if not in pre tags, roughly)
            .replace(/\n/g, '<br />');
        
        return formatted;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex flex-col items-center justify-end" onClick={onClose}>
            <div 
                className="bg-surface w-full max-w-3xl h-[85vh] max-h-[800px] rounded-t-2xl shadow-2xl flex flex-col transform transition-transform duration-300 animate-fade-in"
                style={{ animationName: 'slideUp', animationDuration: '0.3s' }}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Icon name="bot" className="w-6 h-6 text-primary" />
                        <h2 className="text-xl font-bold text-text">AI Content Generation</h2>
                    </div>
                    <Button variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
                </header>
                
                <main className="flex-grow p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {messages.map(message => (
                            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.role === 'model' && <Icon name="bot" className="w-6 h-6 text-primary flex-shrink-0 mt-1" />}
                                <div className={`max-w-xl p-3 rounded-2xl ${message.role === 'user' ? 'bg-primary text-on-primary rounded-br-lg' : 'bg-background rounded-bl-lg'}`}>
                                    <DangerousHtmlRenderer html={formatMessageText(message.text)} className="prose dark:prose-invert max-w-none text-sm" />
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                             <div className="flex justify-start gap-3">
                                <Icon name="bot" className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                                <div className="max-w-xl p-3 rounded-2xl bg-background rounded-bl-lg">
                                    <div className="flex items-center gap-2">
                                        <Spinner size="sm" />
                                        <span className="text-text-muted">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </main>

                <footer className="flex-shrink-0 p-4 border-t border-border space-y-3">
                    <form onSubmit={handleRefine} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Refine the outline..."
                            className="flex-grow p-2 bg-background border border-border rounded-full focus:ring-2 focus:ring-primary focus:outline-none px-4"
                            disabled={isLoading}
                        />
                        <Button type="submit" variant="secondary" className="rounded-full w-10 h-10 p-0" aria-label="Send message" disabled={isLoading}>
                            <Icon name="arrow-down" className="w-5 h-5 -rotate-90"/>
                        </Button>
                    </form>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
                        <Button variant="primary" onClick={handleGenerate} disabled={isLoading || messages.length === 0}>
                           <Icon name="zap" className="w-5 h-5 mr-2" />
                           {`Generate ${params.generationType.startsWith('series-') ? 'Series' : 'Deck'}`}
                        </Button>
                    </div>
                </footer>
            </div>
             <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>
        </div>
    );
};

export default AIGenerationChatModal;