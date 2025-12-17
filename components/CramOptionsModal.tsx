
import React, { useState, useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';

export type CramSortOption = 'random' | 'hardest' | 'newest' | 'oldest';

export interface CramOptions {
    sort: CramSortOption;
    limit: number | 'all';
}

interface CramOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (options: CramOptions) => void;
    totalItems: number;
}

const CramOptionsModal: React.FC<CramOptionsModalProps> = ({ isOpen, onClose, onStart, totalItems }) => {
    const [sort, setSort] = useState<CramSortOption>('random');
    const [limit, setLimit] = useState<number | 'all'>('all');
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, isOpen);

    const handleStart = () => {
        onStart({ sort, limit });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
            <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-sm transform transition-all relative">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 className="text-xl font-bold text-text">Cram Session Options</h2>
                    <Button variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">Sort Order</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['random', 'hardest', 'newest', 'oldest'] as CramSortOption[]).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setSort(opt)}
                                    className={`p-2 rounded-md text-sm border capitalize transition-colors ${sort === opt ? 'bg-primary text-on-primary border-primary' : 'bg-background border-border text-text hover:border-primary'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-text-muted mt-2">
                            {sort === 'random' && "Shuffle cards randomly."}
                            {sort === 'hardest' && "Focus on cards with high lapse counts and low ease factors."}
                            {sort === 'newest' && "Review the most recently added cards first."}
                            {sort === 'oldest' && "Review cards from the beginning of the deck."}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">Card Limit</label>
                        <select 
                            value={limit} 
                            onChange={(e) => setLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary outline-none"
                        >
                            <option value="all">All ({totalItems})</option>
                            <option value="10" disabled={totalItems < 10}>10 Items</option>
                            <option value="20" disabled={totalItems < 20}>20 Items</option>
                            <option value="50" disabled={totalItems < 50}>50 Items</option>
                            <option value="100" disabled={totalItems < 100}>100 Items</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end p-4 bg-background/50 border-t border-border">
                    <Button variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
                    <Button variant="primary" onClick={handleStart}><Icon name="zap" className="w-4 h-4 mr-2"/> Start Cramming</Button>
                </div>
            </div>
        </div>
    );
};

export default CramOptionsModal;
