


import React, { useRef } from 'react';
import Icon from './ui/Icon';
import Button from './ui/Button';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Link from './ui/Link';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
  onCreateSeries: () => void;
  onInstall: (() => void) | null;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onImport, onCreateSeries, onInstall }) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sidebarRef, isOpen);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full w-full max-w-xs bg-white dark:bg-gray-800 shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-title"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id="sidebar-title" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
              Menu
            </h2>
            <Button variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close menu">
              <Icon name="x" />
            </Button>
          </div>
          <nav className="flex-grow p-4 space-y-2">
            <Link href="/" onClick={onClose} className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">
              <Icon name="laptop" className="w-6 h-6 mr-3" /> Decks
            </Link>
             <Link href="/archive" onClick={onClose} className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">
               <Icon name="archive" className="w-6 h-6 mr-3" />
              Archive
            </Link>
            <Link href="/trash" onClick={onClose} className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">
               <Icon name="trash-2" className="w-6 h-6 mr-3" />
              Trash
            </Link>
             <Link href="/settings" onClick={onClose} className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">
               <Icon name="settings" className="w-6 h-6 mr-3" />
              Settings
            </Link>
            <Link href="/instructions/json" onClick={onClose} className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">
               <Icon name="help-circle" className="w-6 h-6 mr-3" />
              JSON Guide
            </Link>
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <Button variant="primary" onClick={onCreateSeries} className="w-full">
              <Icon name="list" className="w-5 h-5 mr-2" />
              Create New Series
            </Button>
             <Button variant="secondary" onClick={onImport} className="w-full">
              <Icon name="plus" className="w-5 h-5 mr-2" />
              Create / Import Deck
            </Button>
            {onInstall && (
              <Button variant="secondary" onClick={onInstall} className="w-full">
                <Icon name="download" className="w-5 h-5 mr-2" />
                Install App
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;