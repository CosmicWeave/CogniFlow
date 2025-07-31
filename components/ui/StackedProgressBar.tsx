import React from 'react';

interface ProgressBarSegment {
  value: number;
  color: string;
  label: string;
}

interface StackedProgressBarProps {
  data: ProgressBarSegment[];
  total: number;
}

const StackedProgressBar: React.FC<StackedProgressBarProps> = ({ data, total }) => {
  if (total === 0) {
    return <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"></div>;
  }
  
  return (
    <div className="flex w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={data.reduce((acc, d) => acc + d.value, 0)} aria-valuemin={0} aria-valuemax={total}>
      {data.map((segment, index) => {
        if (segment.value === 0) return null;
        const percentage = (segment.value / total) * 100;
        return (
          <div
            key={index}
            className={`${segment.color} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
            title={`${segment.label}: ${segment.value} item(s)`}
          />
        );
      })}
    </div>
  );
};

export default StackedProgressBar;
