import React from 'react';
import { useStore } from '../store/store';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface AIGenerationStatusIndicatorProps {
  onOpen: () => void;
  onCancel: () => void;
}

const AIGenerationStatusIndicator: React.FC<AIGenerationStatusIndicatorProps> = ({ onOpen, onCancel }) => {
    const { currentTask, queue } = useStore(state => state.aiGenerationStatus);
    const isGenerating = currentTask !== null;
    const totalTasks = (currentTask ? 1 : 0) + queue.length;

    if (totalTasks === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2">
            <button
                onClick={onOpen}
                className="bg-surface rounded-full shadow-lg flex items-center justify-center p-2 group relative"
                aria-label="View AI generation status"
                title={currentTask?.statusText || `${queue.length} task(s) queued...`}
            >
                <div className="relative w-12 h-12 flex items-center justify-center">
                    {/* Spinning border */}
                    <svg className="absolute w-full h-full" style={{ animation: isGenerating ? 'spin 1.5s linear infinite' : 'none' }} viewBox="0 0 24 24">
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            className={isGenerating ? "text-primary/50" : "text-text-muted/50"}
                            strokeDasharray={isGenerating ? "40 100" : "5 15"}
                        />
                    </svg>
                    <Icon name="bot" className={`w-6 h-6 ${isGenerating ? 'text-primary' : 'text-text-muted'}`} />
                </div>
                 {totalTasks > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-on-primary text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {totalTasks}
                    </span>
                 )}
            </button>
        </div>
    );
};

export default AIGenerationStatusIndicator;