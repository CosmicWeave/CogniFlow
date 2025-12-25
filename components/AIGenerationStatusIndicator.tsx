import React from 'react';
import { useStore } from '../store/store.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useSettings } from '../hooks/useSettings.ts';

interface AIGenerationStatusIndicatorProps {
  onOpen: () => void;
  onCancel: () => void;
}

const AIGenerationStatusIndicator: React.FC<AIGenerationStatusIndicatorProps> = ({ onOpen, onCancel }) => {
    const { currentTask, queue, streamingDrafts } = useStore(state => state.aiGenerationStatus);
    const { aiFeaturesEnabled } = useSettings();
    const isGenerating = currentTask !== null;
    const queueLength = queue?.length || 0;
    const totalTasks = (isGenerating ? 1 : 0) + queueLength;

    if (!aiFeaturesEnabled || totalTasks === 0) {
        return null;
    }
    
    // For Deep Course, identify if this is a composite task
    const isComposite = currentTask?.type === 'generateDeepCourse';
    
    // Get the most recent active stream text for the UI
    const activeStreamId = Object.keys(streamingDrafts).pop();
    const streamSnippet = activeStreamId ? streamingDrafts[activeStreamId].slice(-60) : null;

    const statusText = streamSnippet 
        ? `...${streamSnippet}` 
        : (currentTask?.statusText || `${queueLength} task(s) queued...`);

    return (
        <div className="fixed bottom-6 left-6 z-40">
            <button
                onClick={onOpen}
                className={`bg-surface rounded-lg shadow-lg flex items-center p-2 gap-3 transition-all hover:shadow-xl animate-fade-in border-l-4 ${isGenerating ? 'border-primary' : 'border-text-muted'} min-w-[240px]`}
                aria-label="View AI generation status"
            >
                <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
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
                    <Icon name={isComposite ? "layers" : "bot"} className={`w-6 h-6 ${isGenerating ? 'text-primary' : 'text-text-muted'}`} />
                </div>
                <div className="flex flex-col text-left pr-2 flex-grow min-w-0">
                    <span className="font-semibold text-sm text-text truncate">
                        {isGenerating ? (isComposite ? 'Synthesizing Course...' : 'AI is working...') : 'AI Queue'}
                    </span>
                    <span className="text-[10px] text-text-muted truncate font-mono italic" title={statusText}>
                        {statusText}
                    </span>
                </div>
                {totalTasks > 0 && (
                    <div className="bg-primary text-on-primary text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center self-center flex-shrink-0">
                        {totalTasks}
                    </div>
                )}
            </button>
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AIGenerationStatusIndicator;
