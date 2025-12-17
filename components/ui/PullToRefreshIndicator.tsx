
import React from 'react';
import Icon from './Icon';
import Spinner from './Spinner';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
}

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({ pullDistance, isRefreshing, threshold }) => {
  // When refresh is triggered, show a centered spinner
  if (isRefreshing) {
    return (
      <div className="fixed top-0 left-0 right-0 h-20 flex items-center justify-center z-50 transition-all duration-300">
        <Spinner size="md" />
      </div>
    );
  }

  // Don't render anything if the user isn't pulling
  if (pullDistance <= 0) {
    return null;
  }
  
  const progress = Math.min(pullDistance / threshold, 1);
  const hasMetThreshold = progress >= 1;
  const scale = Math.min(0.5 + progress * 0.5, 1);

  // SVG circle properties
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-20 flex items-center justify-center z-10 pointer-events-none"
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold * 1.5) - 80}px) scale(${scale})`,
        opacity: Math.min(pullDistance / (threshold / 2), 1),
      }}
    >
      <div className="relative w-12 h-12 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg transition-transform duration-200" style={{ transform: hasMetThreshold ? 'scale(1.1)' : 'scale(1)' }}>
        {/* Circular progress SVG */}
        <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 44 44">
          <circle
            className="text-gray-300/50 dark:text-gray-600/50"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            r={radius}
            cx="22"
            cy="22"
          />
          <circle
            className="text-blue-500"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="22"
            cy="22"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              transition: hasMetThreshold ? 'stroke-dashoffset 0.1s linear' : 'none',
            }}
          />
        </svg>
        {/* Icon inside the circle */}
        <Icon
          name={hasMetThreshold ? 'refresh-ccw' : 'arrow-down'}
          className={`w-6 h-6 transition-colors duration-200 ${
            hasMetThreshold ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
          }`}
        />
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;