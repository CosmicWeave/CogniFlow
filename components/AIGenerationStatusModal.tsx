import React, { useRef, useMemo } from 'react';
import { useStore } from '../store/store.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import Spinner from './ui/Spinner.tsx';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import { LearningDeck } from '../types.ts';

interface AIGenerationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: (taskId?: string) => void;
}

const AIGenerationStatusModal: React.FC<AIGenerationStatusModalProps> = ({ isOpen, onClose, onCancel }) => {
  const { currentTask, queue, streamingDrafts, chapterPhases } = useStore(state => state.aiGenerationStatus);
  const decks = useStore(state => state.decks);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const handleCancelCurrent = () => {
    onCancel(); // No taskId cancels current task
  };
  
  const handleCancelQueued = (taskId: string) => {
      onCancel(taskId);
  };

  // Extract Curriculum status for Deep Courses
  const courseProgress = useMemo(() => {
    if (currentTask?.type !== 'generateDeepCourse' || !currentTask.deckId) return null;
    const deck = decks[currentTask.deckId] as LearningDeck;
    if (!deck || !deck.curriculum) return null;

    const allChapters = deck.curriculum.chapters;
    
    return allChapters.map(ch => ({
        ...ch,
        phase: chapterPhases[ch.id] || 'queued'
    }));
  }, [currentTask, decks, chapterPhases]);

  if (!isOpen) return null;

  const getPhaseColor = (phase: string) => {
      switch(phase) {
          case 'complete': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]';
          case 'drafting': return 'bg-blue-400 animate-pulse';
          case 'auditing': return 'bg-amber-400 animate-pulse';
          case 'illustrating': return 'bg-purple-400 animate-pulse';
          case 'finalizing': return 'bg-primary animate-pulse';
          case 'failed': return 'bg-red-500';
          default: return 'bg-border';
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-xl transform transition-all relative max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-status-title"
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 id="ai-status-title" className="text-xl font-bold text-text flex items-center gap-2">
            <Icon name="bot" className="text-primary w-6 h-6" />
            AI Pipeline
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close">
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 no-scrollbar">
            {/* Active Task Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Active Process</h3>
                    {currentTask && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold animate-pulse">
                            AGENT RUNNING
                        </span>
                    )}
                </div>
                <div className="bg-background/50 border border-border rounded-xl p-5 shadow-inner">
                    {currentTask ? (
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-primary/10 rounded-full">
                                    <Spinner size="sm" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="text-sm font-bold text-text truncate mb-1">
                                        {currentTask.type === 'generateDeepCourse' ? 'Synthesizing Hyper-Course' : 'Standard Generation'}
                                    </p>
                                    <p className="text-xs text-text-muted leading-relaxed">
                                        {currentTask.statusText || 'Executing instructional logic...'}
                                    </p>
                                </div>
                                <Button variant="danger" size="sm" onClick={handleCancelCurrent} className="flex-shrink-0">
                                    Abort
                                </Button>
                            </div>
                            
                            {/* Chapter Visualization (only for Deep Course) */}
                            {courseProgress && (
                                <div className="pt-4 border-t border-border/50">
                                    <p className="text-[10px] font-bold text-text-muted uppercase mb-3">Project Blueprint</p>
                                    <div className="grid grid-cols-5 gap-2">
                                        {courseProgress.map((ch, idx) => (
                                            <div 
                                                key={ch.id} 
                                                title={`${idx + 1}. ${ch.title} (${ch.phase})`}
                                                className={`h-2.5 rounded-full transition-all duration-500 ${getPhaseColor(ch.phase)}`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-3 text-[9px] text-text-muted font-mono uppercase">
                                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Draft</div>
                                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Audit</div>
                                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400"></span> Visual</div>
                                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Done</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <Icon name="check-circle" className="w-10 h-10 text-text-muted/30 mx-auto mb-2" />
                            <p className="text-sm text-text-muted">No active background processes.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Queue Section */}
            {queue && queue.length > 0 && (
                <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Waitlist ({queue.length})</h3>
                    <ul className="space-y-2">
                        {queue.map((task) => (
                            <li key={task.id} className="bg-background border border-border p-3 rounded-lg flex items-center justify-between gap-4 group transition-colors hover:border-primary/30">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Icon name="layers" className="w-4 h-4 text-text-muted/50" />
                                    <p className="text-text text-xs font-medium truncate">{task.statusText}</p>
                                </div>
                                <button 
                                    onClick={() => handleCancelQueued(task.id)} 
                                    className="text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                    aria-label="Remove from queue"
                                >
                                    <Icon name="x-circle" className="w-4 h-4"/>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Pipeline Info */}
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                <div className="flex gap-3">
                    <Icon name="info" className="w-5 h-5 text-primary flex-shrink-0" />
                    <p className="text-xs text-text-muted leading-relaxed">
                        The <b>Hyper-Course Engine</b> uses multiple agent passes. First, it architects a curriculum, then parallel agents draft chapters, followed by search-grounded audits and visual enrichment. Closing this modal will not stop the process.
                    </p>
                </div>
            </div>
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="primary" onClick={onClose} className="px-8">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIGenerationStatusModal;