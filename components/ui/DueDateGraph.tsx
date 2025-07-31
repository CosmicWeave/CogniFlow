
import React from 'react';

interface DueDateData {
  dayLabel: string;
  count: number;
  date: string; // Full date string for tooltip title
}

interface DueDateGraphProps {
  data: DueDateData[];
}

const DueDateGraph: React.FC<DueDateGraphProps> = ({ data }) => {
  const maxCount = Math.max(...data.map(d => d.count), 1); // Avoid division by zero, min height is based on at least 1 item

  const width = 350;
  const height = 120;
  const padding = { top: 25, right: 15, bottom: 25, left: 15 };

  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  
  // Calculate space for each bar
  const totalBarSpace = graphWidth / data.length;
  const barWidth = Math.max(6, totalBarSpace * 0.1); // Thinner columns

  return (
    <div className="w-full">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Upcoming Due Dates (Next 7 Days)</h4>
        <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700/50">
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" aria-labelledby="due-date-graph-title" role="img" className="overflow-visible">
            <title id="due-date-graph-title">A bar chart showing the number of items due over the next 7 days.</title>
            
            {data.map((item, i) => {
              const barHeight = item.count > 0 ? (item.count / maxCount) * graphHeight : 0;
              const x = padding.left + (i * totalBarSpace) + (totalBarSpace - barWidth) / 2;
              const y = padding.top + graphHeight - barHeight;

              return (
                <g key={i} className="group" style={{ cursor: 'pointer' }}>
                  <title>{item.date}: {item.count} item{item.count !== 1 ? 's' : ''} due</title>
                  
                  {/* The bar itself */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="2" // Rounded corners
                    className="fill-blue-500 transition-colors group-hover:fill-blue-400"
                  />
                  
                  {/* Number above bar, appears on hover */}
                  <text
                    x={x + barWidth / 2}
                    y={y - 6} // Position above the bar
                    textAnchor="middle"
                    className="fill-gray-600 dark:fill-gray-300 font-semibold text-sm transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none"
                  >
                    {item.count}
                  </text>
                  
                  {/* Day label at bottom */}
                  <text
                    x={x + barWidth / 2}
                    y={height - padding.bottom + 15}
                    textAnchor="middle"
                    className="fill-gray-400 dark:fill-gray-500 text-xs pointer-events-none"
                  >
                    {item.dayLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
    </div>
  );
};

export default DueDateGraph;