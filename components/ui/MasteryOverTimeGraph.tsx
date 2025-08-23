
import React, { useMemo, useState } from 'react';
import { ReviewLog } from '../../types';

interface MasteryOverTimeGraphProps {
  reviews: ReviewLog[];
}

interface DataPoint {
  date: Date;
  avgMastery: number;
}

const MasteryOverTimeGraph: React.FC<MasteryOverTimeGraphProps> = ({ reviews }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: DataPoint } | null>(null);

  const data = useMemo((): DataPoint[] => {
    if (!reviews || reviews.length === 0) return [];
    
    const reviewsByDay = new Map<string, { totalMastery: number; count: number }>();
    reviews.forEach(review => {
      const dateString = new Date(review.timestamp).toISOString().split('T')[0];
      const dayData = reviewsByDay.get(dateString) || { totalMastery: 0, count: 0 };
      dayData.totalMastery += review.masteryLevel;
      dayData.count++;
      reviewsByDay.set(dateString, dayData);
    });

    const aggregatedData = Array.from(reviewsByDay.entries()).map(([dateString, { totalMastery, count }]) => ({
      date: new Date(dateString),
      avgMastery: totalMastery / count,
    }));
    
    aggregatedData.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Return last 90 days of activity
    return aggregatedData.slice(-90);
  }, [reviews]);
  
  if (data.length < 2) {
    return <div className="text-center text-sm text-text-muted py-8">Not enough review history to plot a graph.</div>;
  }

  const width = 350;
  const height = 150;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };

  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  
  const minDate = data[0].date.getTime();
  const maxDate = data[data.length - 1].date.getTime();
  
  const xScale = (date: Date) => ((date.getTime() - minDate) / (maxDate - minDate)) * graphWidth + padding.left;
  const yScale = (mastery: number) => height - padding.bottom - (mastery * graphHeight);

  const pathData = data.map(point => `${xScale(point.date)},${yScale(point.avgMastery)}`).join(' L ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    
    let closestPoint = data[0];
    let minDistance = Infinity;
    
    data.forEach(point => {
        const pointX = xScale(point.date);
        const distance = Math.abs(x - pointX);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
        }
    });

    if (minDistance < 20) { // Threshold to show tooltip
        setTooltip({ x: xScale(closestPoint.date), y: yScale(closestPoint.avgMastery), data: closestPoint });
    } else {
        setTooltip(null);
    }
  };

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        aria-labelledby="mastery-graph-title"
        role="img"
        className="overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <title id="mastery-graph-title">A line chart showing average mastery over time.</title>
        
        {/* Y-axis labels and grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(val => (
            <g key={val}>
                <line x1={padding.left} y1={yScale(val)} x2={width - padding.right} y2={yScale(val)} className="stroke-current text-border/70" strokeWidth="0.5" />
                <text x={padding.left - 8} y={yScale(val) + 4} textAnchor="end" className="text-xs fill-text-muted">{`${val * 100}%`}</text>
            </g>
        ))}
        
        {/* X-axis labels */}
        <text x={padding.left} y={height - 5} textAnchor="start" className="text-xs fill-text-muted">{data[0].date.toLocaleDateString('en-us', {month:'short', day:'numeric'})}</text>
        <text x={width - padding.right} y={height - 5} textAnchor="end" className="text-xs fill-text-muted">{data[data.length - 1].date.toLocaleDateString('en-us', {month:'short', day:'numeric'})}</text>

        {/* Line graph */}
        <path d={`M ${pathData}`} className="stroke-primary" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        
        {/* Tooltip */}
        {tooltip && (
            <g>
                <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} className="stroke-current text-border" strokeDasharray="2,2" />
                <circle cx={tooltip.x} cy={tooltip.y} r="4" className="fill-primary" />
                 <g transform={`translate(${tooltip.x > width / 2 ? tooltip.x - 100 : tooltip.x + 10}, ${padding.top})`}>
                    <rect x="0" y="0" width="90" height="35" rx="4" className="fill-surface opacity-90" stroke="rgb(var(--color-border))" />
                    <text x="5" y="15" className="text-xs fill-text font-semibold">{tooltip.data.date.toLocaleDateString('en-us', {month:'short', day:'numeric'})}</text>
                    <text x="5" y="30" className="text-xs fill-text-muted">Mastery: {Math.round(tooltip.data.avgMastery * 100)}%</text>
                </g>
            </g>
        )}
      </svg>
    </div>
  );
};

export default MasteryOverTimeGraph;
