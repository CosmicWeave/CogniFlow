
import React, { useMemo } from 'react';
import { Reviewable } from '../../types';

interface ForecastGraphProps {
  items: Reviewable[];
}

const ForecastGraph: React.FC<ForecastGraphProps> = ({ items }) => {
  const forecastData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts: number[] = Array(30).fill(0);
    
    items.forEach(item => {
      const dueDate = new Date(item.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      
      if (diffTime >= 0) {
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 30) {
          counts[diffDays]++;
        }
      }
    });

    const labels = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      if (i % 7 === 0 || i === 0) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return '';
    });

    return { counts, labels };
  }, [items]);

  const maxCount = Math.max(...forecastData.counts, 1); // Avoid division by zero

  const width = 350;
  const height = 180;
  const padding = { top: 25, right: 10, bottom: 25, left: 10 };

  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const barWidth = graphWidth / forecastData.counts.length - 2;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" aria-labelledby="forecast-graph-title" role="img" className="overflow-visible">
        <title id="forecast-graph-title">A bar chart showing the number of items due each day for the next 30 days.</title>
        
        {forecastData.counts.map((count, i) => {
          const barHeight = count > 0 ? (count / maxCount) * graphHeight : 0;
          const x = padding.left + i * (barWidth + 2);
          const y = padding.top + graphHeight - barHeight;

          return (
            <g key={i} className="group cursor-pointer">
              <title>{forecastData.labels[i] || new Date(new Date().setDate(new Date().getDate() + i)).toLocaleDateString()}: {count} items</title>
              
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="2"
                className="fill-primary/60 transition-colors group-hover:fill-primary"
              />
              
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                className="text-xs font-semibold fill-text-muted transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none"
              >
                {count}
              </text>
            </g>
          );
        })}
        {/* X-axis labels */}
        {forecastData.labels.map((label, i) => {
          if (!label) return null;
          return (
             <text
                key={i}
                x={padding.left + i * (barWidth + 2) + barWidth / 2}
                y={height - padding.bottom + 15}
                textAnchor="middle"
                className="text-xs fill-text-muted"
            >
                {label}
            </text>
          )
        })}
      </svg>
    </div>
  );
};

export default ForecastGraph;
