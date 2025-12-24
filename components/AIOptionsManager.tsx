
import React, { useState } from 'react';
import { useAIOptions, AIOptionCategories, AIPersona } from '../hooks/useAIOptions.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useToast } from '../hooks/useToast.ts';

interface AIOptionsManagerProps {
  onBack: () => void;
}

const StringListEditor: React.FC<{
    title: string;
    category: AIOptionCategories;
}> = ({ title, category }) => {
    const { options, updateCategory } = useAIOptions();
    const [items, setItems] = useState<string[]>(options[category] as string[]);
    const [newItem, setNewItem] = useState('');

    const handleAddItem = () => {
        if(newItem.trim()) {
            const newItems = [...items, newItem.trim()];
            setItems(newItems);
            updateCategory(category, newItems);
            setNewItem('');
        }
    };
    
    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        updateCategory(category, newItems);
    };

    return (
        <div className="p-4 bg-background border border-border rounded-lg">
            <h4 className="font-semibold text-text mb-2">{title}</h4>
            <ul className="space-y-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-center justify-between p-2 bg-surface rounded-md border border-border/50">
                        <span className="text-sm">{item}</span>
                        <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => handleRemoveItem(index)}>
                            <Icon name="trash-2" className="w-4 h-4 text-red-500" />
                        </Button>
                    </li>
                ))}
            </ul>
             <div className="flex items-center gap-2 mt-2">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                    placeholder="Add..."
                    className="flex-grow p-1.5 text-sm bg-surface border border-border rounded-md"
                />
                <Button variant="secondary" size="sm" onClick={handleAddItem}>Add</Button>
            </div>
        </div>
    );
};

const PersonaEditor: React.FC = () => {
    const { options, updateCategory } = useAIOptions();
    const [personas, setPersonas] = useState<AIPersona[]>(() => JSON.parse(JSON.stringify(options.personas)));
    const { addToast } = useToast();

    const handlePersonaChange = (index: number, field: keyof Omit<AIPersona, 'id'>, value: string) => {
        const newPersonas = [...personas];
        newPersonas[index] = { ...newPersonas[index], [field]: value };
        setPersonas(newPersonas);
    };

    const handleAddPersona = () => {
        setPersonas([...personas, { id: crypto.randomUUID(), name: '', instruction: '' }]);
    };

    const handleRemovePersona = (index: number) => {
        if(personas[index].id === 'default') return; // Cannot remove default
        setPersonas(personas.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        updateCategory('personas', personas.filter(p => p.name.trim() && p.instruction.trim()));
        addToast('Personas saved!', 'success');
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-text">AI Personas</h4>
                <Button variant="secondary" size="sm" onClick={handleSave}>Save Personas</Button>
            </div>
            {personas.map((persona, index) => (
                <div key={persona.id} className="space-y-2 p-3 bg-background border border-border rounded-md">
                    <input
                        type="text"
                        placeholder="Persona Name (e.g., Cheerful Tutor)"
                        value={persona.name}
                        onChange={(e) => handlePersonaChange(index, 'name', e.target.value)}
                        className="w-full p-2 text-sm bg-surface border border-border rounded-md"
                        disabled={persona.id === 'default'}
                    />
                    <textarea
                        placeholder="System instruction for this persona..."
                        value={persona.instruction}
                        onChange={(e) => handlePersonaChange(index, 'instruction', e.target.value)}
                        rows={3}
                        className="w-full p-2 text-sm bg-surface border border-border rounded-md"
                    />
                    {persona.id !== 'default' && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemovePersona(index)} className="text-red-500">
                            <Icon name="trash-2" className="w-4 h-4 mr-2" /> Remove Persona
                        </Button>
                    )}
                </div>
            ))}
             <Button variant="ghost" size="sm" onClick={handleAddPersona}>
                <Icon name="plus" className="w-4 h-4 mr-2" /> Add Persona
            </Button>
        </div>
    );
};


const AIOptionsManager: React.FC<AIOptionsManagerProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={onBack} className="p-1 h-auto"><Icon name="chevron-left" /></Button>
                    <h2 className="text-xl font-bold">Manage AI Options</h2>
                </div>
            </header>
            <main className="flex-grow p-6 overflow-y-auto space-y-6 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StringListEditor title="Understanding Levels" category="understandingLevels" />
                    <StringListEditor title="Comprehensiveness Levels" category="comprehensivenessLevels" />
                    <StringListEditor title="Learning Goals" category="learningGoalOptions" />
                    <StringListEditor title="Learning Styles" category="learningStyleOptions" />
                    <StringListEditor title="Languages" category="languageOptions" />
                    <StringListEditor title="Tones" category="toneOptions" />
                </div>
                
                <div className="border-t border-border pt-6 pb-4">
                    <PersonaEditor />
                </div>
            </main>
        </div>
    );
};

export default AIOptionsManager;
