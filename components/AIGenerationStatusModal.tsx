import React, { useRef } from 'react';
import { useStore } from '../store/store.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import Spinner from './ui/Spinner.tsx';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';

interface AIGenerationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: (taskId?: string) => void;
}

const AIGenerationStatusModal: React.FC<AIGenerationStatusModalProps> = ({ isOpen, onClose, onCancel }) => {
  const { currentTask, queue } = useStore(state => state.aiGenerationStatus);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const handleCancelCurrent = () => {
    onCancel(); // No taskId cancels current task
  };
  
  const handleCancelQueued = (taskId: string) => {
      onCancel(taskId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-lg transform transition-all relative max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-status-title"
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 id="ai-status-title" className="text-xl font-bold text-text">
            AI Generation Status
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close">
            <Icon name="x" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
            <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">Current Task</h3>
                <div className="bg-background p-4 rounded-lg">
                    {currentTask ? (
                        <div className="flex items-center gap-4">
                            <Spinner size="sm" />
                            <p className="text-text-muted flex-grow">{currentTask.statusText || 'Processing your request...'}</p>
                            <Button variant="danger" size="sm" onClick={handleCancelCurrent}>Cancel</Button>
                        </div>
                    ) : (
                        <p className="text-text-muted text-center py-4">No AI tasks are currently running.</p>
                    )}
                </div>
            </div>

            {queue && queue.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">Queued Tasks ({queue.length})</h3>
                    <ul className="space-y-2">
                        {queue.map((task) => (
                            <li key={task.id} className="bg-background p-3 rounded-lg flex items-center justify-between gap-4">
                                <p className="text-text-muted text-sm truncate flex-grow">{task.statusText}</p>
                                <Button variant="ghost" size="sm" className="p-1 h-auto hover:text-red-500" onClick={() => handleCancelQueued(task.id)} aria-label={`Cancel task: ${task.statusText}`}>
                                    <Icon name="x-circle" className="w-5 h-5"/>
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIGenerationStatusModal;