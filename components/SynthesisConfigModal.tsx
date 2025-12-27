
import React, { useState, useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAIOptions } from '../hooks/useAIOptions';
import { AIGenerationParams } from '../types';
import ToggleSwitch from './ui/ToggleSwitch';

interface SynthesisConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: Partial<AIGenerationParams>) => void;
  title: string;
  type: 'text' | 'questions';
}

const SynthesisConfigModal: React.FC<SynthesisConfigModalProps> = ({ isOpen, onClose, onConfirm, title, type }) => {
  const { options: aiOptions } = useAIOptions();
  const [persona, setPersona] = useState(type === 'text' ? 'the_master' : 'default');
  const [depth, setDepth] = useState(500); // Word count or count
  const [analogyIntensity, setAnalogyIntensity] = useState<'none' | 'standard' | 'aggressive'>('standard');
  const [useThinking, setUseThinking] = useState(true);

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const handleConfirm = () => {
    const config: Partial<AIGenerationParams> = {
        persona,
        targetWordCount: type === 'text' ? depth : undefined,
        count: type === 'questions' ? Math.floor(depth / 100) : undefined,
        analogyIntensity: type === 'text' ? analogyIntensity : undefined,
        thinkingBudget: useThinking ? 32768 : 0,
    };
    onConfirm(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[70] p-4">
      <div ref={modalRef} className="bg-surface rounded-xl shadow-2xl w-full max-w-md transform transition-all relative overflow-hidden flex flex-col">
        <header className="p-4 border-b border-border bg-background/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Icon name="bot" className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Synthesis Studio</h2>
            </div>
            <Button variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </header>

        <div className="p-6 space-y-6">
            <div className="text-center mb-2">
                <h3 className="font-bold text-text">{title}</h3>
                <p className="text-xs text-text-muted mt-1">Configure your conceptual transformer settings.</p>
            </div>

            <div className="space-y-4">
                {/* Persona Selection */}
                <div>
                    <label className="block text-xs font-black text-text-muted uppercase tracking-tighter mb-2">Instructional Persona</label>
                    <div className="grid grid-cols-2 gap-2">
                        {aiOptions.personas.slice(0, 6).map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPersona(p.id)}
                                className={`text-left p-2 rounded-lg border text-xs transition-all ${persona === p.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background hover:border-primary/50'}`}
                            >
                                <p className="font-bold">{p.name}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Depth Slider */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-black text-text-muted uppercase tracking-tighter">
                            {type === 'text' ? 'Expansion Density' : 'Question Volume'}
                        </label>
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {type === 'text' ? `${depth} words` : `${Math.floor(depth / 100)} items`}
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min={type === 'text' ? 100 : 100} 
                        max={type === 'text' ? 2000 : 1000} 
                        step={100}
                        value={depth}
                        onChange={(e) => setDepth(Number(e.target.value))}
                        className="w-full accent-primary"
                    />
                </div>

                {/* Analogy Intensity (Text Only) */}
                {type === 'text' && (
                    <div>
                        <label className="block text-xs font-black text-text-muted uppercase tracking-tighter mb-2">Analogy Architecture</label>
                        <div className="flex bg-background rounded-lg p-1 border border-border">
                            {(['none', 'standard', 'aggressive'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setAnalogyIntensity(mode)}
                                    className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${analogyIntensity === mode ? 'bg-primary text-on-primary shadow-sm' : 'text-text-muted hover:text-text'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reasoning Toggle */}
                <div className="pt-2 border-t border-border">
                    <ToggleSwitch 
                        label="Hyper-Reasoning Mode" 
                        checked={useThinking} 
                        onChange={setUseThinking}
                        description="Uses higher token budget for synthesis."
                    />
                </div>
            </div>
        </div>

        <footer className="p-4 bg-background/50 border-t border-border flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirm} className="px-6 font-bold">
                Start Upgrade
            </Button>
        </footer>
      </div>
    </div>
  );
};

export default SynthesisConfigModal;
