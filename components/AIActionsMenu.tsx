
// components/AIActionsMenu.tsx

import React, { useState, useRef, useEffect } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Spinner from './ui/Spinner';
import { Deck, DeckType } from '../types';
import { useModal } from '../contexts/ModalContext';

interface AIActionsMenuProps {
    deck: Deck;
    onGenerateMore: () => void;
    onRework: () => void;
    onAnalyze: () => void;
    onAutoTag?: () => void;
    onHardenDistractors?: () => void;
    onGenerateAudio?: () => void;
    onHolisticUpgrade?: (type: 'text' | 'questions', config: any) => void;
    isGenerating: boolean;
}

const AIActionsMenu: React.FC<AIActionsMenuProps> = ({ 
    deck, 
    onGenerateMore, 
    onRework,
    onAnalyze, 
    onAutoTag, 
    onHardenDistractors, 
    onGenerateAudio,
    onHolisticUpgrade,
    isGenerating 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { openModal } = useModal();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleAction = (fn: () => void) => {
        fn();
        setIsOpen(false);
    };

    const handleTriggerConfig = (type: 'text' | 'questions') => {
        setIsOpen(false);
        openModal('synthesisConfig', {
            title: type === 'text' ? 'Holistic Course Upgrade' : 'Mass Assessment Deepening',
            type,
            onConfirm: (config: any) => onHolisticUpgrade?.(type, config)
        });
    };

    return (
        <div className="relative inline-block" ref={menuRef}>
            <Button 
                variant="primary" 
                onClick={() => setIsOpen(!isOpen)} 
                disabled={isGenerating}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 border-none shadow-md hover:shadow-lg transition-all"
            >
                {isGenerating ? <Spinner size="sm" /> : <Icon name="bot" className="w-5 h-5 mr-2" />}
                {isGenerating ? 'AI Processing...' : '✨ AI Actions'}
                <Icon name="chevron-down" className={`ml-2 w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface rounded-xl shadow-2xl border border-border z-50 py-2 animate-fade-in origin-bottom-left overflow-hidden">
                    <div className="px-4 py-2 border-b border-border mb-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Synthesis Studio</span>
                    </div>
                    
                    <button 
                        onClick={() => handleAction(onGenerateMore)}
                        className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/10 transition-colors group"
                    >
                        <Icon name="zap" className="w-4 h-4 mr-3 text-primary group-hover:scale-110 transition-transform" />
                        Expand Deck with AI
                    </button>

                    <button 
                        onClick={() => handleAction(onRework)}
                        className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/10 transition-colors group"
                    >
                        <Icon name="refresh-ccw" className="w-4 h-4 mr-3 text-blue-500 group-hover:scale-110 transition-transform" />
                        Rework Entire Deck
                    </button>

                    <div className="my-1 border-t border-border"></div>
                    <div className="px-4 py-1">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">Conceptual Transformers</span>
                    </div>

                    {onHolisticUpgrade && (
                        <button 
                            onClick={() => handleTriggerConfig('text')}
                            className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                        >
                            <Icon name="bot" className="w-4 h-4 mr-3 text-indigo-500 group-hover:scale-110 transition-transform" />
                            Holistic Text Upgrade (All)
                        </button>
                    )}

                    {onHolisticUpgrade && deck.type === DeckType.Learning && (
                        <button 
                            onClick={() => handleTriggerConfig('questions')}
                            className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                        >
                            <Icon name="layers" className="w-4 h-4 mr-3 text-indigo-500 group-hover:scale-110 transition-transform" />
                            Deepen All Quizzes
                        </button>
                    )}

                    <div className="my-1 border-t border-border"></div>

                    <button 
                        onClick={() => handleAction(onAnalyze)}
                        className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/10 transition-colors group"
                    >
                        <Icon name="save" className="w-4 h-4 mr-3 text-yellow-500 group-hover:scale-110 transition-transform" />
                        Analyze & Improve
                    </button>

                    {(deck.type === DeckType.Quiz || deck.type === DeckType.Learning) && (
                        <>
                            {onAutoTag && (
                                <button 
                                    onClick={() => handleAction(onAutoTag)}
                                    className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/10 transition-colors group"
                                >
                                    <Icon name="filter" className="w-4 h-4 mr-3 text-indigo-500 group-hover:scale-110 transition-transform" />
                                    Smart-Tag Questions
                                </button>
                            )}
                            {onHardenDistractors && (
                                <button 
                                    onClick={() => handleAction(onHardenDistractors)}
                                    className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/10 transition-colors group"
                                >
                                    <Icon name="trending-up" className="w-4 h-4 mr-3 text-red-500 group-hover:scale-110 transition-transform" />
                                    Harden Distractors
                                </button>
                            )}
                        </>
                    )}

                    {deck.type === DeckType.Flashcard && onGenerateAudio && (
                        <button 
                            onClick={() => handleAction(onGenerateAudio)}
                            className="flex items-center w-full px-4 py-2.5 text-sm text-left text-text hover:bg-primary/10 transition-colors group"
                        >
                            <Icon name="mic" className="w-4 h-4 mr-3 text-green-500 group-hover:scale-110 transition-transform" />
                            Generate Audio
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIActionsMenu;
