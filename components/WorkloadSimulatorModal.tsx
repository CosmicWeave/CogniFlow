
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Reviewable } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { simulateWorkload, SimulationDay } from '../services/srsSimulator';
import Spinner from './ui/Spinner';

interface WorkloadSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Reviewable[];
}

const SimulationGraph: React.FC<{ data: SimulationDay[] }> = ({ data }) => {
    if (data.length === 0) return null;

    const maxLoad = Math.max(...data.map(d => d.totalLoad), 10);
    const height = 200;
    const width = 100; // percent
    
    // SVG viewbox dimensions
    const viewBoxWidth = 500;
    const viewBoxHeight = 250;
    const padding = { top: 20, right: 10, bottom: 30, left: 40 };
    
    const graphWidth = viewBoxWidth - padding.left - padding.right;
    const graphHeight = viewBoxHeight - padding.top - padding.bottom;
    
    // Sample data to avoid overcrowding x-axis if many days
    const displayData = data; 
    const barWidth = Math.max(2, (graphWidth / displayData.length) - 1);

    const yScale = (val: number) => graphHeight - ((val / maxLoad) * graphHeight);

    return (
        <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="w-full h-full overflow-visible">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                const val = Math.round(maxLoad * tick);
                const y = yScale(val) + padding.top;
                return (
                    <g key={tick}>
                        <line x1={padding.left} y1={y} x2={viewBoxWidth - padding.right} y2={y} className="stroke-border/50" strokeDasharray="3,3" />
                        <text x={padding.left - 5} y={y + 4} className="text-[10px] fill-text-muted" textAnchor="end">{val}</text>
                    </g>
                );
            })}

            {displayData.map((d, i) => {
                const x = padding.left + (i * (graphWidth / displayData.length));
                const yTotal = yScale(d.totalLoad) + padding.top;
                const heightTotal = graphHeight - yScale(d.totalLoad);
                
                const heightNew = (d.newCount / d.totalLoad) * heightTotal || 0;
                const heightReview = heightTotal - heightNew;
                const yNew = yTotal; // New starts at top
                const yReview = yTotal + heightNew; // Review starts below New

                return (
                    <g key={i} className="group">
                        <title>{`${d.date}: ${d.reviewCount} reviews + ${d.newCount} new = ${d.totalLoad} total`}</title>
                        {/* New Cards Bar (Top part) */}
                        {d.newCount > 0 && (
                            <rect
                                x={x}
                                y={yNew}
                                width={barWidth}
                                height={heightNew}
                                className="fill-blue-400 dark:fill-blue-500 hover:fill-blue-300 transition-colors"
                            />
                        )}
                        {/* Reviews Bar (Bottom part) */}
                        {d.reviewCount > 0 && (
                            <rect
                                x={x}
                                y={yReview}
                                width={barWidth}
                                height={heightReview}
                                className="fill-green-500 dark:fill-green-600 hover:fill-green-400 transition-colors"
                            />
                        )}
                    </g>
                );
            })}

            {/* X Axis Labels (Sparse) */}
            {displayData.map((d, i) => {
                if (i % Math.ceil(displayData.length / 5) === 0) {
                    return (
                        <text 
                            key={i} 
                            x={padding.left + (i * (graphWidth / displayData.length)) + barWidth/2} 
                            y={viewBoxHeight - 10} 
                            className="text-[10px] fill-text-muted" 
                            textAnchor="middle"
                        >
                            {d.date}
                        </text>
                    );
                }
                return null;
            })}
        </svg>
    );
};

const WorkloadSimulatorModal: React.FC<WorkloadSimulatorModalProps> = ({ isOpen, onClose, items }) => {
  const [days, setDays] = useState(30);
  const [newCardsPerDay, setNewCardsPerDay] = useState(0); // Default to 0 for pure backlog check
  const [retention, setRetention] = useState(90);
  const [isSimulating, setIsSimulating] = useState(false);
  const [data, setData] = useState<SimulationDay[]>([]);
  
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  // Debounced Simulation
  useEffect(() => {
      if (!isOpen) return;
      setIsSimulating(true);
      const timer = setTimeout(() => {
          // Wrap in simple timeout to unblock UI thread for render
          const results = simulateWorkload(items, days, newCardsPerDay, retention / 100);
          setData(results);
          setIsSimulating(false);
      }, 100);
      return () => clearTimeout(timer);
  }, [days, newCardsPerDay, retention, items, isOpen]);

  const stats = useMemo(() => {
      if (data.length === 0) return null;
      const maxLoad = Math.max(...data.map(d => d.totalLoad));
      const avgLoad = Math.round(data.reduce((acc, d) => acc + d.totalLoad, 0) / data.length);
      const totalNew = data.reduce((acc, d) => acc + d.newCount, 0);
      return { maxLoad, avgLoad, totalNew };
  }, [data]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div ref={modalRef} className="bg-surface rounded-lg shadow-xl w-full max-w-3xl transform transition-all relative max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
              <Icon name="trending-up" className="text-primary" /> Workload Simulator
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} className="p-1 h-auto"><Icon name="x" /></Button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Controls */}
                <div className="space-y-4 md:col-span-1 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Duration: {days} days</label>
                        <input 
                            type="range" min="7" max="180" step="7" 
                            value={days} onChange={(e) => setDays(Number(e.target.value))}
                            className="w-full accent-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">New Cards / Day: {newCardsPerDay}</label>
                        <input 
                            type="range" min="0" max="50" step="5" 
                            value={newCardsPerDay} onChange={(e) => setNewCardsPerDay(Number(e.target.value))}
                            className="w-full accent-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Est. Retention: {retention}%</label>
                        <input 
                            type="range" min="70" max="99" step="1" 
                            value={retention} onChange={(e) => setRetention(Number(e.target.value))}
                            className="w-full accent-primary"
                        />
                    </div>
                    
                    {stats && (
                        <div className="bg-background rounded-lg p-3 space-y-2 text-sm border border-border">
                            <div className="flex justify-between">
                                <span className="text-text-muted">Peak Load:</span>
                                <span className="font-bold text-text">{stats.maxLoad}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Average Load:</span>
                                <span className="font-bold text-text">{stats.avgLoad}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Total New:</span>
                                <span className="font-bold text-blue-500">{stats.totalNew}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Visualization */}
                <div className="md:col-span-2 h-64 md:h-auto flex flex-col">
                    <div className="flex items-center gap-4 text-xs text-text-muted mb-2 justify-end">
                        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm"></span> New Cards</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm"></span> Reviews</div>
                    </div>
                    <div className="flex-grow relative bg-background/50 rounded-lg border border-border p-2">
                        {isSimulating ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-sm">
                                <Spinner size="lg" />
                            </div>
                        ) : (
                            <SimulationGraph data={data} />
                        )}
                    </div>
                    <p className="text-xs text-text-muted mt-2 text-center">
                        This is a projection based on the SM-2 algorithm. Actual workload may vary.
                    </p>
                </div>
            </div>
        </div>

        <div className="flex justify-end p-4 bg-background/50 border-t border-border">
          <Button type="button" variant="primary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

export default WorkloadSimulatorModal;
