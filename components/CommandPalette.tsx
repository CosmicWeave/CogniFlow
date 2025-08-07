

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Deck, DeckSeries, Card, Question, QuizDeck } from '../types';
import { useRouter } from '../contexts/RouterContext';
import Icon, { IconName } from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';

// Local types for items in the palette to decouple from main app types
interface PaletteAction {
  type: 'action';
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
  keywords?: string[];
  searchableOnly?: boolean;
}
interface PaletteDeck {
  type: 'deck';
  id: string;
  name: string;
  itemType: 'quiz' | 'flashcard';
}
interface PaletteSeries {
  type: 'series';
  id: string;
  name: string;
}
interface PaletteCard {
  type: 'card';
  id: string;
  deckId: string;
  deckName: string;
  front: string;
}
interface PaletteQuestion {
  type: 'question';
  id: string;
  deckId: string;
  deckName: string;
  text: string;
}

type PaletteItem = PaletteAction | PaletteDeck | PaletteSeries | PaletteCard | PaletteQuestion;

interface Command {
  id: string;
  label: string;
  icon: IconName;
  action: () => void;
  keywords?: string[];
  searchableOnly?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  decks: Deck[];
  series: DeckSeries[];
  actions: Command[];
}

const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, decks, series, actions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLUListElement>(null);
  const { navigate } = useRouter();

  useFocusTrap(modalRef, isOpen);

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    
    actions.forEach(a => items.push({ type: 'action', id: a.id, label: a.label, icon: a.icon, run: a.action, keywords: a.keywords, searchableOnly: a.searchableOnly }));
    decks.filter(d => !d.archived && !d.deletedAt).forEach(d => items.push({ type: 'deck', id: d.id, name: d.name, itemType: d.type }));
    series.filter(s => !s.archived && !s.deletedAt).forEach(s => items.push({ type: 'series', id: s.id, name: s.name }));

    decks.filter(d => !d.archived && !d.deletedAt).forEach(d => {
      if (d.type === 'flashcard') {
        d.cards.forEach(c => items.push({ type: 'card', id: c.id, deckId: d.id, deckName: d.name, front: c.front }));
      } else {
        (d as QuizDeck).questions.forEach(q => items.push({ type: 'question', id: q.id, deckId: d.id, deckName: d.name, text: q.questionText }));
      }
    });

    return items;
  }, [actions, decks, series]);

  const filteredResults = useMemo<PaletteItem[]>(() => {
    if (!searchTerm.trim()) {
      return allItems.filter(item => item.type === 'action' && !(item as PaletteAction).searchableOnly);
    }

    const lowercasedTerm = searchTerm.toLowerCase();
    const results = allItems.filter(item => {
      switch (item.type) {
        case 'action': {
          const actionItem = item as PaletteAction;
          const labelMatch = actionItem.label.toLowerCase().includes(lowercasedTerm);
          const keywordMatch = (actionItem.keywords || []).some(k => k.toLowerCase().includes(lowercasedTerm));
          return labelMatch || keywordMatch;
        }
        case 'deck': return item.name.toLowerCase().includes(lowercasedTerm);
        case 'series': return item.name.toLowerCase().includes(lowercasedTerm);
        case 'card': return stripHtml(item.front).toLowerCase().includes(lowercasedTerm);
        case 'question': return item.text.toLowerCase().includes(lowercasedTerm);
        default: return false;
      }
    });
    return results.slice(0, 50);
  }, [searchTerm, allItems]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = { Actions: [], Series: [], Decks: [], Cards: [] };
    filteredResults.forEach(item => {
      if (item.type === 'action') groups.Actions.push(item);
      else if (item.type === 'series') groups.Series.push(item);
      else if (item.type === 'deck') groups.Decks.push(item);
      else if (item.type === 'card' || item.type === 'question') groups.Cards.push(item);
    });
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [filteredResults]);

  const flatResults = useMemo(() => groupedResults.flatMap(([, items]) => items), [groupedResults]);

  const handleSelect = useCallback((item: PaletteItem) => {
    switch (item.type) {
      case 'action': item.run(); break;
      case 'deck': navigate(`/decks/${item.id}`); break;
      case 'series': navigate(`/series/${item.id}`); break;
      case 'card': case 'question': navigate(`/decks/${item.deckId}`); break;
    }
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % (flatResults.length || 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + (flatResults.length || 1)) % (flatResults.length || 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selectedItem = flatResults[activeIndex];
            if (selectedItem) handleSelect(selectedItem);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, flatResults, handleSelect, onClose]);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setActiveIndex(0);
    }
  }, [isOpen]);
  
  useEffect(() => {
     setActiveIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    document.getElementById(`cmdk-item-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const renderItem = (item: PaletteItem, index: number) => {
    let iconName: IconName;
    let title = '';
    let subtitle: string | undefined;

    switch (item.type) {
      case 'action':
        iconName = item.icon;
        title = item.label;
        break;
      case 'deck':
        iconName = item.itemType === 'quiz' ? 'help-circle' : 'laptop';
        title = item.name;
        break;
      case 'series':
        iconName = 'layers';
        title = item.name;
        break;
      case 'card':
        iconName = 'laptop';
        title = stripHtml(item.front);
        subtitle = `In: ${item.deckName}`;
        break;
      case 'question':
        iconName = 'help-circle';
        title = item.text;
        subtitle = `In: ${item.deckName}`;
        break;
    }

    return (
      <li
        key={item.id}
        id={`cmdk-item-${index}`}
        role="option"
        aria-selected={activeIndex === index}
        onClick={() => handleSelect(item)}
        className={`flex items-center gap-4 px-4 py-3 cursor-pointer rounded-md ${activeIndex === index ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
      >
        <Icon name={iconName} className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <p className={`font-medium truncate ${activeIndex === index ? 'text-blue-800 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}`}>{title}</p>
          {subtitle && <p className={`text-sm truncate ${activeIndex === index ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>{subtitle}</p>}
        </div>
      </li>
    );
  };
  
  let itemCounter = 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start pt-4 sm:pt-[15vh] z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform transition-all relative max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
          <Icon name="search" className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search for anything or type a command..."
            className="w-full bg-transparent focus:outline-none text-lg placeholder:text-gray-400 dark:placeholder:text-gray-500"
            autoFocus
          />
           <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">ESC</div>
        </div>
        <div className="flex-grow overflow-y-auto p-2">
            {flatResults.length > 0 ? (
                <ul ref={resultsContainerRef} role="listbox">
                    {groupedResults.map(([groupName, items]) => (
                        <li key={groupName}>
                            <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{groupName}</p>
                            <ul className="space-y-1">
                                {items.map(item => renderItem(item, itemCounter++))}
                            </ul>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center py-10 px-4">
                    <p className="text-gray-600 dark:text-gray-400">No results found for "{searchTerm}".</p>
                </div>
            )}
        </div>
        <div className="hidden sm:flex flex-shrink-0 justify-end items-center p-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
                <Icon name="terminal" className="inline-block w-4 h-4 mr-2" />
                <kbd className="font-sans">Cmd+K</kbd> to toggle
            </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
