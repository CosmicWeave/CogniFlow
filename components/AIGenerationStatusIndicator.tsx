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
    const queueLength = queue?.length || 0;
    const totalTasks = (isGenerating ? 1 : 0) + queueLength;

    if (totalTasks === 0) {
        return null;
    }
    
    const statusText = currentTask?.statusText || `${queueLength} task(s) queued...`;

    return (
        <div className="fixed bottom-6 left-6 z-40">
            <button
                onClick={onOpen}
                className="bg-surface rounded-lg shadow-lg flex items-center p-2 gap-3 transition-all hover:shadow-xl animate-fade-in"
                aria-label="View AI generation status"
            >
                <div className="relative w-10 h-10 flex items-center justify-center">
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
                <div className="flex flex-col text-left pr-2">
                    <span className="font-semibold text-sm text-text">
                        {isGenerating ? 'AI is working...' : 'AI Queue'}
                    </span>
                    <span className="text-xs text-text-muted truncate max-w-[200px]" title={statusText}>
                        {statusText}
                    </span>
                </div>
                {totalTasks > 0 && (
                    <div className="bg-primary text-on-primary text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center self-center mr-2">
                        {totalTasks}
                    </div>
                )}
            </button>
        </div>
    );
};

export default AIGenerationStatusIndicator;
