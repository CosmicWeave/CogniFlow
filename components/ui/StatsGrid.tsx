
import React from 'react';
import Icon from './Icon';

interface StatsGridProps {
  stats: {
    streak: number;
    totalReviews: number;
    matureCount: number;
  };
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
  <div className="bg-surface p-6 rounded-lg shadow-md border border-border flex items-center">
    <div className="flex-shrink-0">{icon}</div>
    <div className="ml-5 w-0 flex-1">
      <dt className="text-sm font-medium text-text-muted truncate">{label}</dt>
      <dd className="text-2xl font-bold text-text">{value}</dd>
    </div>
  </div>
);

const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <StatCard
        icon={<Icon name="zap" className="h-8 w-8 text-orange-400" />}
        label="Current Streak"
        value={`${stats.streak} day${stats.streak !== 1 ? 's' : ''}`}
      />
      <StatCard
        icon={<Icon name="check-circle" className="h-8 w-8 text-blue-400" />}
        label="Total Reviews"
        value={stats.totalReviews.toLocaleString()}
      />
      <StatCard
        icon={<Icon name="trending-up" className="h-8 w-8 text-green-400" />}
        label="Mature Items"
        value={stats.matureCount.toLocaleString()}
      />
    </div>
  );
};

export default StatsGrid;
