
import React, { useState, useEffect, useRef } from 'react';
import { DeckSeries } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface EditSeriesModalProps {
  series: DeckSeries | null;
  onClose: () => void;
  onSave: (data: { id: string | null; name: string; description: string }) => void;
}

const EditSeriesModal: React.FC<EditSeriesModalProps> = ({ series, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);

  const isNew = series === null;

  useEffect(() => {
    if (series) {
      setName(series.name);
      setDescription(series.description);
    } else {
      // Reset for "new series" case
      setName('');
      setDescription('');
    }
  }, [series]);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(pastedText);
            if (typeof parsed.seriesName === 'string' && typeof parsed.seriesDescription === 'string') {
                e.preventDefault(); // Prevent the raw JSON from being pasted into the input
                setName(parsed.seriesName);
                setDescription(parsed.seriesDescription);
                addToast('Series details populated from JSON!', 'success');
            }
        } catch (error) { /* Not a valid JSON, or not the format we want. Ignore and let the default paste happen. */ }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Series name cannot be empty.", "error");
      return;
    }
    onSave({
      id: isNew ? null : series.id,
      name: name.trim(),
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-lg transform transition-all relative">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold">{isNew ? 'Create New Series' : 'Edit Series'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="series-name" className="block text-sm font-medium text-text-muted mb-1">Series Name</label>
              <input
                id="series-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onPaste={handlePaste}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="e.g., Introduction to Algebra"
              />
            </div>
            <div>
              <label htmlFor="series-description" className="block text-sm font-medium text-text-muted mb-1">Description</label>
              <textarea
                id="series-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onPaste={handlePaste}
                rows={3}
                className="w-full p-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="A collection of decks covering core concepts."
              />
            </div>
          </div>

          <div className="flex justify-end p-4 bg-background/50 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">
              <Icon name="save" className="w-4 h-4 mr-2" />
              {isNew ? 'Create Series' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSeriesModal;
