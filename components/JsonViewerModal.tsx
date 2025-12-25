
import React, { useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useToast } from '../hooks/useToast';

interface JsonViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  title: string;
  filename?: string;
}

const JsonViewerModal: React.FC<JsonViewerModalProps> = ({ isOpen, onClose, data, title, filename = 'data.json' }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  useFocusTrap(modalRef, isOpen);

  const jsonString = React.useMemo(() => JSON.stringify(data, null, 2), [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      addToast('JSON copied to clipboard!', 'success');
    }).catch(err => {
      addToast('Failed to copy JSON.', 'error');
    });
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Download started.', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[70] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[90vh] flex flex-col">
        <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="code" className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-text">{title}</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </header>

        <main className="flex-grow p-4 overflow-hidden flex flex-col">
          <div className="flex-grow bg-background rounded-lg border border-border overflow-auto p-4 font-mono text-xs text-text-muted">
            <pre>{jsonString}</pre>
          </div>
        </main>

        <footer className="flex-shrink-0 p-4 border-t border-border flex justify-end gap-2 bg-background/50">
          <Button variant="secondary" onClick={handleCopy}>
            <Icon name="save" className="w-4 h-4 mr-2" /> Copy to Clipboard
          </Button>
          <Button variant="primary" onClick={handleDownload}>
            <Icon name="download" className="w-4 h-4 mr-2" /> Download .json
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default JsonViewerModal;
