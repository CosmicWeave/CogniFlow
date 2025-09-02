import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/store';
import { AIAction, AIMessage } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Spinner from './ui/Spinner';
import { getAIResponse } from '../services/aiChatService';

interface AIChatModalProps {
  onExecuteAction: (action: AIAction) => void;
}

const AIChatModal: React.FC<AIChatModalProps> = ({ onExecuteAction }) => {
    const { dispatch, isAIChatOpen, aiChatHistory, decks, folders, deckSeries } = useStore();
    const [userInput, setUserInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleClose = () => {
        dispatch({ type: 'TOGGLE_AI_CHAT', payload: false });
    };
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiChatHistory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const prompt = userInput.trim();
        if (!prompt) return;

        setUserInput('');

        const newUserMessage: AIMessage = { id: crypto.randomUUID(), role: 'user', text: prompt };
        const loadingMessage: AIMessage = { id: crypto.randomUUID(), role: 'model', text: '', isLoading: true };
        
        const updatedHistory = [...aiChatHistory, newUserMessage, loadingMessage];
        dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: updatedHistory });

        try {
            const actions = await getAIResponse(prompt, { decks, folders, series: deckSeries });
            
            const modelResponseMessage: AIMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                text: actions.find(a => a.confirmationMessage)?.confirmationMessage || "Here are the actions I can perform for you.",
                actions: actions,
            };

            // Replace loading message with the actual response
            dispatch({ 
                type: 'SET_AI_CHAT_HISTORY', 
                payload: [...aiChatHistory, newUserMessage, modelResponseMessage]
            });

        } catch (error) {
            const errorMessage: AIMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                text: error instanceof Error ? error.message : "An unknown error occurred.",
            };
            dispatch({ 
                type: 'SET_AI_CHAT_HISTORY', 
                payload: [...aiChatHistory, newUserMessage, errorMessage]
            });
        }
    };
    
    const handleActionClick = (action: AIAction) => {
        onExecuteAction(action);
        handleClose();
    };

    if (!isAIChatOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-end" onClick={handleClose}>
            <div 
                className="bg-surface w-full max-w-2xl h-[70vh] max-h-[600px] rounded-t-2xl shadow-2xl flex flex-col transform transition-transform duration-300 animate-fade-in"
                style={{ animationName: 'slideUp', animationDuration: '0.3s' }}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Icon name="bot" className="w-6 h-6 text-primary" />
                        <h2 className="text-xl font-bold text-text">AI Assistant</h2>
                    </div>
                    <Button variant="ghost" onClick={handleClose} className="p-1 h-auto"><Icon name="x" /></Button>
                </header>
                
                <main className="flex-grow p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {aiChatHistory.map(message => (
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
                                    {message.actions && message.actions.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                                            {message.actions.map((action, index) => (
                                                action.action !== 'NO_ACTION' && (
                                                    <Button key={index} size="sm" variant="secondary" onClick={() => handleActionClick(action)}>
                                                        {action.action.replace(/_/g, ' ').toLowerCase()}
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

                <footer className="flex-shrink-0 p-4 border-t border-border">
                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="e.g., 'Rename my history deck...'"
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