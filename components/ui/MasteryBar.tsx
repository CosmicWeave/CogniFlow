import React from 'react';

interface MasteryBarProps {
  level: number; // 0 to 1
}

const MasteryBar: React.FC<MasteryBarProps> = ({ level }) => {
  const percentage = Math.round(level * 100);
  let colorClass = 'bg-red-500';
  let label = 'Novice';
  
  if (percentage > 85) {
    colorClass = 'bg-green-500';
    label = 'Mastered';
  } else if (percentage > 65) {
    colorClass = 'bg-teal-500';
    label = 'Proficient';
  } else if (percentage > 40) {
    colorClass = 'bg-blue-500';
    label = 'Familiar';
  } else if (percentage > 15) {
    colorClass = 'bg-orange-500';
    label = 'Learning';
  }

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1 text-xs">
        <span className="font-semibold text-gray-600 dark:text-gray-300">Mastery: {label}</span>
        <span className="font-semibold text-gray-500 dark:text-gray-400">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`${colorClass} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Mastery level: ${label}, ${percentage}%`}
        ></div>
      </div>
    </div>
  );
};

export default MasteryBar;
