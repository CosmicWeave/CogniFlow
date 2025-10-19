
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';

type TopicSelection = 'include' | 'exclude' | 'ignore';

interface TopicSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestedTopics: { include: string[]; exclude: string[] };
  onApply: (selections: { included: string[]; excluded: string[] }) => void;
}

const TopicSuggestionModal: React.FC<TopicSuggestionModalProps> = ({ isOpen, onClose, suggestedTopics, onApply }) => {
  const [selections, setSelections] = useState<Map<string, TopicSelection>>(new Map());
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const allTopics = useMemo(() => {
    const topicSet = new Set([...suggestedTopics.include, ...suggestedTopics.exclude]);
    return Array.from(topicSet).sort();
  }, [suggestedTopics]);

  useEffect(() => {
    if (isOpen) {
      const initialSelections = new Map<string, TopicSelection>();
      allTopics.forEach(topic => {
        if (suggestedTopics.include.includes(topic)) {
          initialSelections.set(topic, 'include');
        } else if (suggestedTopics.exclude.includes(topic)) {
          initialSelections.set(topic, 'exclude');
        } else {
          initialSelections.set(topic, 'ignore');
        }
      });
      setSelections(initialSelections);
    }
  }, [isOpen, allTopics, suggestedTopics]);

  const handleSelectionChange = (topic: string, selection: TopicSelection) => {
    setSelections(prev => new Map(prev).set(topic, selection));
  };

  const handleApply = () => {
    const included: string[] = [];
    const excluded: string[] = [];
    for (const [topic, selection] of selections.entries()) {
      if (selection === 'include') {
        included.push(topic);
      } else if (selection === 'exclude') {
        excluded.push(topic);
      }
    }
    onApply({ included, excluded });
  };

  if (!isOpen) return null;

  const choiceClasses = (value: TopicSelection, selectedValue: TopicSelection) => 
    `px-3 py-1 text-xs rounded-full cursor-pointer transition-colors border ${
      value === selectedValue
        ? 'font-semibold ' + (value === 'include' ? 'bg-green-100 dark:bg-green-900/50 border-green-500 text-green-700 dark:text-green-300' 
                             : value === 'exclude' ? 'bg-red-100 dark:bg-red-900/50 border-red-500 text-red-700 dark:text-red-300'
                             : 'bg-background border-border text-text-muted')
        : 'bg-surface hover:bg-border/50 border-border text-text-muted'
    }`;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4">
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col"
      >
        <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold">Categorize AI Topic Suggestions</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </header>

        <main className="flex-grow p-6 overflow-y-auto">
          <p className="text-sm text-text-muted mb-4">Review the topics suggested by the AI. Choose whether to include, exclude, or ignore each one.</p>
          <ul className="space-y-2">
            {allTopics.map(topic => (
              <li key={topic} className="flex items-center justify-between p-3 bg-background rounded-md border border-border">
                <span className="text-text flex-grow">{topic}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className={choiceClasses('include', selections.get(topic)!)}>
                    <input
                      type="radio"
                      name={`topic-${topic}`}
                      checked={selections.get(topic) === 'include'}
                      onChange={() => handleSelectionChange(topic, 'include')}
                      className="sr-only"
                    />
                    Include
                  </label>
                  <label className={choiceClasses('exclude', selections.get(topic)!)}>
                    <input
                      type="radio"
                      name={`topic-${topic}`}
                      checked={selections.get(topic) === 'exclude'}
                      onChange={() => handleSelectionChange(topic, 'exclude')}
                      className="sr-only"
                    />
                    Exclude
                  </label>
                   <label className={choiceClasses('ignore', selections.get(topic)!)}>
                    <input
                      type="radio"
                      name={`topic-${topic}`}
                      checked={selections.get(topic) === 'ignore'}
                      onChange={() => handleSelectionChange(topic, 'ignore')}
                      className="sr-only"
                    />
                    Ignore
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </main>

        <footer className="flex-shrink-0 flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
          <Button type="button" variant="primary" onClick={handleApply}>Apply Selections</Button>
        </footer>
      </div>
    </div>
  );
};

export default TopicSuggestionModal;
