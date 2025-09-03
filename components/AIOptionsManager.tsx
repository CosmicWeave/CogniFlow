
import React, { useState } from 'react';
import { useAIOptions, AIOptionCategories } from '../hooks/useAIOptions';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface AIOptionsManagerProps {
  onBack: () => void;
}

const OptionEditor: React.FC<{
    title: string;
    category: AIOptionCategories;
    options: string[];
    addOption: (category: AIOptionCategories, value: string) => void;
    updateOption: (category: AIOptionCategories, index: number, newValue: string) => void;
    deleteOption: (category: AIOptionCategories, index: number) => void;
}> = ({ title, category, options, addOption, updateOption, deleteOption }) => {
    const [newOption, setNewOption] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState('');

    const handleAdd = () => {
        addOption(category, newOption);
        setNewOption('');
    };

    const handleStartEdit = (index: number, value: string) => {
        setEditingIndex(index);
        setEditingValue(value);
    };

    const handleSaveEdit = () => {
        if (editingIndex !== null) {
            updateOption(category, editingIndex, editingValue);
        }
        setEditingIndex(null);
        setEditingValue('');
    };

    return (
        <div className="space-y-3 p-4 bg-background rounded-lg border border-border">
            <h4 className="font-semibold text-text">{title}</h4>
            <ul className="space-y-2">
                {options.map((option, index) => (
                    <li key={index} className="flex items-center gap-2 p-2 bg-surface rounded-md">
                        {editingIndex === index ? (
                            <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={handleSaveEdit}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                className="flex-grow p-1 bg-background border border-primary rounded-md focus:outline-none"
                                autoFocus
                            />
                        ) : (
                            <span className="flex-grow text-text-muted">{option}</span>
                        )}

                        {editingIndex === index ? (
                            <Button size="sm" variant="ghost" onClick={handleSaveEdit}><Icon name="check-circle" className="w-4 h-4 text-green-500" /></Button>
                        ) : (
                            <>
                                <Button size="sm" variant="ghost" onClick={() => handleStartEdit(index, option)}><Icon name="edit" className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteOption(category, index)}><Icon name="trash-2" className="w-4 h-4 text-red-500" /></Button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
                <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Add new option..."
                    className="flex-grow p-2 bg-surface border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <Button variant="secondary" onClick={handleAdd}>Add</Button>
            </div>
        </div>
    );
};

const AIOptionsManager: React.FC<AIOptionsManagerProps> = ({ onBack }) => {
    const { options, addOption, updateOption, deleteOption } = useAIOptions();

    return (
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="p-1" onClick={onBack}>
                    <Icon name="chevron-left" />
                </Button>
                <h3 className="text-xl font-bold text-text">Manage AI Options</h3>
            </div>
            
            <OptionEditor
                title="Understanding Levels"
                category="understandingLevels"
                options={options.understandingLevels}
                {...{ addOption, updateOption, deleteOption }}
            />
            <OptionEditor
                title="Comprehensiveness Levels"
                category="comprehensivenessLevels"
                options={options.comprehensivenessLevels}
                {...{ addOption, updateOption, deleteOption }}
            />
            <OptionEditor
                title="Learning Goals"
                category="learningGoalOptions"
                options={options.learningGoalOptions}
                {...{ addOption, updateOption, deleteOption }}
            />
            <OptionEditor
                title="Learning Styles"
                category="learningStyleOptions"
                options={options.learningStyleOptions}
                {...{ addOption, updateOption, deleteOption }}
            />
            <OptionEditor
                title="Output Languages"
                category="languageOptions"
                options={options.languageOptions}
                {...{ addOption, updateOption, deleteOption }}
            />
        </div>
    );
};

export default AIOptionsManager;
