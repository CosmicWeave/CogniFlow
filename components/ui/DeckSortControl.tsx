import React from 'react';

// Renamed for clarity and exported for reuse
export type DeckSortPreference = 'lastOpened' | 'name' | 'dueCount';

interface DeckSortControlProps<T extends string> {
  currentSort: T;
  onSortChange: (preference: T) => void;
  sortOptions?: readonly { key: T; label: string }[];
}

const defaultDeckSortOptions: readonly { key: DeckSortPreference; label: string }[] = [
  { key: 'lastOpened', label: 'Recent' },
  { key: 'name', label: 'Name' },
  { key: 'dueCount', label: 'Due' },
];

const DeckSortControl = <T extends string>({
  currentSort,
  onSortChange,
  sortOptions,
}: DeckSortControlProps<T>): React.ReactElement => {
  // Use provided options, or fall back to the default deck sorting options.
  // The type assertion is safe because if `sortOptions` is undefined, this component
  // is being used for default deck sorting, for which T will be DeckSortPreference.
  const options = sortOptions ?? (defaultDeckSortOptions as typeof sortOptions);

  return (
    <div className="inline-flex rounded-md shadow-sm bg-gray-100 dark:bg-gray-800 p-1" role="group">
      {options && options.map((option, index) => (
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
            ${index === options.length - 1 ? 'rounded-r-md' : ''}
          `}
          aria-pressed={currentSort === option.key}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

// Kept for backward compatibility with AllDecksPage
export type SortPreference = DeckSortPreference;
export default DeckSortControl;