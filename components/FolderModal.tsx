
import React, { useState, useEffect, useRef } from 'react';
import { Folder } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface FolderModalProps {
  folder: Folder | null; // null for creating a new folder
  onClose: () => void;
  onSave: (folderData: { id: string | null; name: string }) => void;
}

const FolderModal: React.FC<FolderModalProps> = ({ folder, onClose, onSave }) => {
  const [name, setName] = useState('');
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
    }
  }, [folder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Folder name cannot be empty.", "error");
      return;
    }
    onSave({
      id: folder?.id || null,
      name: name.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md transform transition-all relative">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold">{folder ? 'Edit Folder' : 'Create New Folder'}</h2>
            <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="folder-name" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Folder Name</label>
              <input
                id="folder-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g., University Courses"
              />
            </div>
          </div>

          <div className="flex justify-end p-4 bg-gray-100/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit" variant="primary">
              <Icon name="save" className="w-4 h-4 mr-2" />
              {folder ? 'Save Changes' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FolderModal;
