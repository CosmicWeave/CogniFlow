import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AIAction, AIMessage, Deck, DeckSeries, Folder } from '../types.ts';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Spinner from './ui/Spinner';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import * as db from '../services/db.ts';
import { useDecksList, useFoldersList, useSeriesList, useStore } from '../store/store.ts';
import { getAIResponse } from '../services/aiChatService.ts';
import { useData } from '../contexts/DataManagementContext.tsx';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteAction: (action: AIAction) => void;
  history: AIMessage[];
}

const AIChatModal: React.FC<AIChatModalProps> = ({ isOpen, onClose, onExecuteAction, history }) => {
    const { dispatch } = useStore();
    const dataHandlers = useData();
    const decks = useDecksList();
    const folders = useFoldersList();
    const deckSeries = useSeriesList();
    
    const [userInput, setUserInput] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const activeDeck = dataHandlers?.activeDeck;
    const activeSeries = dataHandlers?.activeSeries;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    useEffect(() => {
        if (isOpen) {
            db.saveAIChatHistory(history);
        }
    }, [history, isOpen]);

    const mentionOptions = useMemo(() => {
        const options: { id: string, name: string, type: 'deck' | 'series' | 'folder' }[] = [];
        
        if (activeDeck) options.push({ id: activeDeck.id, name: `this deck (${activeDeck.name})`, type: 'deck' });
        if (activeSeries) options.push({ id: activeSeries.id, name: `this series (${activeSeries.name})`, type: 'series' });
        
        folders.forEach(f => options.push({ id: f.id, name: f.name, type: 'folder' }));
        decks.filter(d => !d.deletedAt && !d.archived).forEach(d => options.push({ id: d.id, name: d.name, type: 'deck' }));
        
        return options.filter(o => o.name.toLowerCase().includes(mentionFilter.toLowerCase()));
    }, [decks, folders, activeDeck, activeSeries, mentionFilter]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setUserInput(val);
        
        const lastAt = val.lastIndexOf('@');
        if (lastAt !== -1 && lastAt >= val.length - 15) { // reasonable proximity
            setShowMentions(true);
            setMentionFilter(val.substring(lastAt + 1));
        } else {
            setShowMentions(false);
        }
    };

    const handleSelectMention = (option: typeof mentionOptions[0]) => {
        const lastAt = userInput.lastIndexOf('@');
        const newVal = userInput.substring(0, lastAt) + `@${option.name} `;
        setUserInput(newVal);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const prompt = userInput.trim();
        if (!prompt) return;

        setUserInput('');
        setShowMentions(false);

        const newUserMessage: AIMessage = { id: crypto.randomUUID(), role: 'user', text: prompt };
        const loadingMessage: AIMessage = { id: crypto.randomUUID(), role: 'model', text: '', isLoading: true };
        
        const updatedHistory = [...history, newUserMessage, loadingMessage];
        dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: updatedHistory });

        try {
            const actions = await getAIResponse(prompt, { 
                decks, 
                folders, 
                series: deckSeries,
                activeContext: {
                    deck: activeDeck || undefined,
                    series: activeSeries || undefined
                }
            });
            
            const modelResponseMessage: AIMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                text: actions.find(a => a.confirmationMessage)?.confirmationMessage || "I've processed your request.",
                actions: actions,
            };

            dispatch({ 
                type: 'SET_AI_CHAT_HISTORY', 
                payload: [...history, newUserMessage, modelResponseMessage]
            });

        } catch (error) {
            const errorMessage: AIMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                text: error instanceof Error ? error.message : "An unknown error occurred.",
            };
            dispatch({ 
                type: 'SET_AI_CHAT_HISTORY', 
                payload: [...history, newUserMessage, errorMessage]
            });
        }
    };
    
    const handleActionClick = (action: AIAction) => {
        onExecuteAction(action);
        onClose();
    };

    const formatMessageText = (text: string) => {
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-white p-2 rounded my-2 overflow-x-auto text-xs"><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded text-sm font-mono">$1</code>')
            .replace(/\n/g, '<br />');
        
        return formatted;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex flex-col items-center justify-end" onClick={onClose}>
            <div 
                className="bg-surface w-full max-w-2xl h-[70vh] max-h-[600px] rounded-t-2xl shadow-2xl flex flex-col transform transition-transform duration-300 animate-fade-in relative"
                style={{ animationName: 'slideUp', animationDuration: '0.3s' }}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Icon name="bot" className="w-6 h-6 text-primary" />
                        <h2 className="text-xl font-bold text-text">AI Assistant</h2>
                    </div>
                    <Button variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
                </header>
                
                <main className="flex-grow p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {history.map(message => (
                            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.role === 'model' && <Icon name="bot" className="w-6 h-6 text-primary flex-shrink-0 mt-1" />}
                                <div className={`max-w-md p-3 rounded-2xl ${message.role === 'user' ? 'bg-primary text-on-primary rounded-br-lg' : 'bg-background rounded-bl-lg'}`}>
                                    {message.isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <Spinner size="sm" />
                                            <span className="text-text-muted">Thinking...</span>
                                        </div>
                                    ) : (
                                        <DangerousHtmlRenderer html={formatMessageText(message.text)} className="prose dark:prose-invert max-w-none text-sm" />
                                    )}
                                    {message.actions && message.actions.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                                            {message.actions.map((action, index) => (
                                                action.action !== 'NO_ACTION' && (
                                                    <Button key={index} size="sm" variant="secondary" onClick={() => handleActionClick(action)}>
                                                        {action.confirmationMessage}
                                                    </Button>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                         <div ref={messagesEndRef} />
                    </div>
                </main>

                <footer className="flex-shrink-0 p-4 border-t border-border relative">
                    {showMentions && mentionOptions.length > 0 && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-surface border border-border rounded-lg shadow-2xl max-h-48 overflow-y-auto z-10 animate-fade-in">
                            <div className="p-2 text-xs font-bold text-text-muted uppercase border-b border-border">Reference Content</div>
                            {mentionOptions.map(option => (
                                <button
                                    key={`${option.type}-${option.id}`}
                                    className="w-full text-left px-4 py-2 hover:bg-primary/10 flex items-center gap-2 text-sm transition-colors"
                                    onClick={() => handleSelectMention(option)}
                                >
                                    <Icon name={option.type === 'deck' ? 'laptop' : (option.type === 'series' ? 'layers' : 'folder')} className="w-4 h-4 text-text-muted" />
                                    <span className="truncate">{option.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={userInput}
                            onChange={handleInputChange}
                            placeholder="Ask a question or type @ to reference..."
                            className="flex-grow p-2 bg-background border border-border rounded-full focus:ring-2 focus:ring-primary focus:outline-none px-4"
                            autoFocus
                        />
                        <Button type="submit" variant="primary" className="rounded-full w-10 h-10 p-0" aria-label="Send message">
                            <Icon name="arrow-down" className="w-5 h-5 -rotate-90"/>
                        </Button>
                    </form>
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

export default AIChatModal;