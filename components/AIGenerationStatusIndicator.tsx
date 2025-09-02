import React from 'react';
import { useStore } from '../store/store';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface AIGenerationStatusIndicatorProps {
  onOpen: () => void;
  onCancel: () => void;
}

const AIGenerationStatusIndicator: React.FC<AIGenerationStatusIndicatorProps> = ({ onOpen, onCancel }) => {
    const { isGenerating, statusText } = useStore(state => state.aiGenerationStatus);

    if (!isGenerating) {
        return null;
    }

    return (
        <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2">
            <button
                onClick={onOpen}
                className="bg-surface rounded-full shadow-lg flex items-center justify-center p-2 group"
                aria-label="View AI generation status"
                title={statusText || 'AI task in progress...'}
            >
                <div className="relative w-12 h-12 flex items-center justify-center">
                    {/* Spinning border */}
                    <svg className="absolute w-full h-full animate-spin" style={{ animationDuration: '1.5s' }} viewBox="0 0 24 24">
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            className="text-primary/50"
                            strokeDasharray="40 100" // Creates a dashed effect that spins
                        />
                    </svg>
                    <Icon name="bot" className="w-6 h-6 text-primary" />
                </div>
            </button>
             <Button
                variant="danger"
                onClick={onCancel}
                className="rounded-full w-10 h-10 p-0 shadow-lg"
                aria-label="Cancel AI generation"
                title="Cancel AI generation"
            >
                <Icon name="x" className="w-5 h-5" />
            </Button>
        </div>
    );
};

export default AIGenerationStatusIndicator;