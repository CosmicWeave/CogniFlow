

import React, { useRef, useEffect } from 'react';
import Icon from './ui/Icon';
import Button from './ui/Button';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Link from './ui/Link';
import { useSettings } from '../hooks/useSettings';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
  onCreateSeries: () => void;
  onGenerateAI: () => void;
  onInstall: (() => void) | null;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onImport, onCreateSeries, onGenerateAI, onInstall }) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { aiFeaturesEnabled } = useSettings();
  useFocusTrap(sidebarRef, isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-60 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar Container: Handles positioning and animation */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full w-full max-w-xs z-[51] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-title"
      >
        {/* Sidebar Content: Handles visual styling (background, shadow) */}
        <div className="bg-surface shadow-xl h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 id="sidebar-title" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
              Menu
            </h2>
            <Button variant="ghost" onClick={onClose} className="p-1 h-auto" aria-label="Close menu">
              <Icon name="x" />
            </Button>
          </div>
          <nav className="flex-grow p-4 space-y-2">
            <Link href="/" onClick={onClose} className="flex items-center px-3 py-2 text-text rounded-md hover:bg-border/30 text-lg">
              <Icon name="laptop" className="w-6 h-6 mr-3" /> Home
            </Link>
             <Link href="/series" onClick={onClose} className="flex items-center px-3 py-2 text-text rounded-md hover:bg-border/30 text-lg">
              <Icon name="layers" className="w-6 h-6 mr-3" /> Series
            </Link>
            <Link href="/decks" onClick={onClose} className="flex items-center px-3 py-2 text-text rounded-md hover:bg-border/30 text-lg">
              <Icon name="folder" className="w-6 h-6 mr-3" /> Decks
            </Link>
             <Link href="/progress" onClick={onClose} className="flex items-center px-3 py-2 text-text rounded-md hover:bg-border/30 text-lg">
               <Icon name="trending-up" className="w-6 h-6 mr-3" />
              Progress
            </Link>
             <Link href="/archive" onClick={onClose} className="flex items-center px-3 py-2 text-text rounded-md hover:bg-border/30 text-lg">
               <Icon name="archive" className="w-6 h-6 mr-3" />
              Archive
            </Link>
            <Link href="/trash" onClick={onClose} className="flex items-center px-3 py-2 text-text rounded-md hover:bg-border/30 text-lg">
               <Icon name="trash-2" className="w-6 h-6 mr-3" />
              Trash
            </Link>
             <Link href="/settings" onClick={onClose} className="flex items-center px-3 py-2 text-text rounded-md hover:bg-border/30 text-lg">
               <Icon name="settings" className="w-6 h-6 mr-3" />
              Settings
            </Link>
            <Link href="/instructions/json" onClick={onClose} className="flex items-center px-3 py-2 text-text rounded-md hover:bg-border/30 text-lg">
               <Icon name="help-circle" className="w-6 h-6 mr-3" />
              JSON Guide
            </Link>
          </nav>
          <div className="p-4 border-t border-border space-y-2">
            {aiFeaturesEnabled && (
                <Button variant="primary" onClick={onGenerateAI} className="w-full">
                  <Icon name="zap" className="w-5 h-5 mr-2" />
                  Generate with AI
                </Button>
            )}
            <Button variant="secondary" onClick={onCreateSeries} className="w-full">
              <Icon name="layers" className="w-5 h-5 mr-2" />
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