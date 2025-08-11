
import React, { useMemo } from 'react';
import { ReviewLog } from '../../types';

interface ActivityHeatmapProps {
  reviews: ReviewLog[];
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ reviews }) => {
  const { grid, maxCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    // Start from the end of today to include today's activity
    endDate.setDate(endDate.getDate() + 1);

    const startDate = new Date(endDate);
    // Go back 52 weeks (364 days) plus the current day of the week to fill the first column
    startDate.setDate(startDate.getDate() - 364 - today.getDay());

    const reviewCountsByDay: Map<string, number> = new Map();
    reviews.forEach(review => {
      const date = new Date(review.timestamp);
      date.setHours(0, 0, 0, 0);
      const dateString = date.toISOString().split('T')[0];
      reviewCountsByDay.set(dateString, (reviewCountsByDay.get(dateString) || 0) + 1);
    });

    const maxCount = Math.max(...Array.from(reviewCountsByDay.values()), 1);

    const grid: Array<{ date: Date; count: number } | null> = [];
    let currentDate = new Date(startDate);
    
    // Fill up the grid for 53 weeks to ensure a full year is displayed
    while (grid.length < 53 * 7) {
      const dateString = currentDate.toISOString().split('T')[0];
      const count = reviewCountsByDay.get(dateString) || 0;
      grid.push({ date: new Date(currentDate), count });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { grid, maxCount };
  }, [reviews]);
  
  const getColorClass = (count: number) => {
    if (count === 0) return 'fill-gray-200 dark:fill-gray-700/50';
    const intensity = Math.min(count / (maxCount * 0.75), 1); // Scale intensity
    if (intensity > 0.8) return 'fill-green-600';
    if (intensity > 0.5) return 'fill-green-500';
    if (intensity > 0.2) return 'fill-green-400';
    return 'fill-green-300';
  };

  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    for(let i=0; i < 53; i++) {
        const date = grid[i * 7]?.date;
        if(date) {
            const month = date.getMonth();
            if(month !== lastMonth) {
                labels.push({
                    month: date.toLocaleString('default', { month: 'short' }),
                    col: i
                });
            }
            lastMonth = month;
        }
    }
    return labels;
  }, [grid]);

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox="0 0 848 128">
        {/* Month labels */}
        {monthLabels.map(({ month, col }) => (
            <text key={col} x={16 * col + 24} y="15" className="text-xs fill-text-muted">{month}</text>
        ))}
        {/* Day labels */}
        <text x="0" y="37" className="text-xs fill-text-muted">Mon</text>
        <text x="0" y="69" className="text-xs fill-text-muted">Wed</text>
        <text x="0" y="101" className="text-xs fill-text-muted">Fri</text>
        
        {grid.map((day, i) => {
          if (!day) return null;
          const weekIndex = Math.floor(i / 7);
          const dayIndex = i % 7;
          return (
            <rect
              key={i}
              x={16 * weekIndex + 24}
              y={16 * dayIndex + 24}
              width="12"
              height="12"
              rx="2"
              ry="2"
              className={getColorClass(day.count)}
            >
              <title>{`${day.date.toDateString()}: ${day.count} review${day.count !== 1 ? 's' : ''}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
};

export default ActivityHeatmap;
