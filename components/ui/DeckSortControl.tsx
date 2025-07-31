import React from 'react';

type SortPreference = 'lastOpened' | 'name' | 'dueCount';

interface DeckSortControlProps {
  currentSort: SortPreference;
  onSortChange: (preference: SortPreference) => void;
}

const sortOptions: { key: SortPreference; label: string }[] = [
  { key: 'lastOpened', label: 'Recent' },
  { key: 'name', label: 'Name' },
  { key: 'dueCount', label: 'Due' },
];

const DeckSortControl: React.FC<DeckSortControlProps> = ({ currentSort, onSortChange }) => {
  return (
    <div className="inline-flex rounded-md shadow-sm bg-gray-100 dark:bg-gray-800 p-1" role="group">
      {sortOptions.map((option, index) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSortChange(option.key)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
            ${currentSort === option.key
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
            }
            ${index === 0 ? 'rounded-l-md' : ''}
            ${index === sortOptions.length - 1 ? 'rounded-r-md' : ''}
          `}
          aria-pressed={currentSort === option.key}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default DeckSortControl;
