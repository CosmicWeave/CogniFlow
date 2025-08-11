
import React, { useMemo } from 'react';
import { ReviewLog, ReviewRating } from '../../types';

interface RetentionStatsProps {
  reviews: ReviewLog[];
}

const RetentionStats: React.FC<RetentionStatsProps> = ({ reviews }) => {
  const stats = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentReviews = reviews.filter(r => r.rating !== null && new Date(r.timestamp) >= thirtyDaysAgo);

    const counts = {
      [ReviewRating.Again]: 0,
      [ReviewRating.Hard]: 0,
      [ReviewRating.Good]: 0,
      [ReviewRating.Easy]: 0,
    };
    
    let total = 0;
    recentReviews.forEach(review => {
        if (review.rating && counts.hasOwnProperty(review.rating)) {
            counts[review.rating]++;
            total++;
        }
    });

    const getPercentage = (count: number) => (total > 0 ? ((count / total) * 100).toFixed(1) : '0.0');

    return {
        total,
        again: { count: counts[ReviewRating.Again], percent: getPercentage(counts[ReviewRating.Again]) },
        hard: { count: counts[ReviewRating.Hard], percent: getPercentage(counts[ReviewRating.Hard]) },
        good: { count: counts[ReviewRating.Good], percent: getPercentage(counts[ReviewRating.Good]) },
        easy: { count: counts[ReviewRating.Easy], percent: getPercentage(counts[ReviewRating.Easy]) },
        correctPercent: getPercentage(counts[ReviewRating.Hard] + counts[ReviewRating.Good] + counts[ReviewRating.Easy]),
    };
  }, [reviews]);

  if(stats.total === 0) {
    return (
        <div className="text-center py-10">
            <p className="text-text-muted">Not enough data from the last 30 days.</p>
        </div>
    );
  }

  const barData = [
    { label: 'Again', percent: stats.again.percent, color: 'bg-red-500' },
    { label: 'Hard', percent: stats.hard.percent, color: 'bg-orange-500' },
    { label: 'Good', percent: stats.good.percent, color: 'bg-green-500' },
    { label: 'Easy', percent: stats.easy.percent, color: 'bg-blue-500' },
  ];

  return (
    <div className="space-y-6">
        <div className="text-center">
            <p className="text-lg text-text-muted">Reviews Marked Correct</p>
            <p className="text-4xl font-bold text-green-500">{stats.correctPercent}%</p>
        </div>
      <div className="flex w-full h-4 rounded-full overflow-hidden" role="progressbar">
        {barData.map(d => (
            d.percent !== "0.0" && (
            <div
                key={d.label}
                className={d.color}
                style={{ width: `${d.percent}%` }}
                title={`${d.label}: ${d.percent}%`}
            />
            )
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2"></span><span className="text-text-muted">Again: <strong>{stats.again.count}</strong> ({stats.again.percent}%)</span></div>
        <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2"></span><span className="text-text-muted">Hard: <strong>{stats.hard.count}</strong> ({stats.hard.percent}%)</span></div>
        <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2"></span><span className="text-text-muted">Good: <strong>{stats.good.count}</strong> ({stats.good.percent}%)</span></div>
        <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2"></span><span className="text-text-muted">Easy: <strong>{stats.easy.count}</strong> ({stats.easy.percent}%)</span></div>
      </div>
    </div>
  );
};

export default RetentionStats;
