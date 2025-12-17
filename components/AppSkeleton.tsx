import React from 'react';
import Skeleton from './ui/Skeleton';

const AppSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <div className="bg-surface/80 border-b border-border h-16 fixed top-0 left-0 right-0 z-20">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Skeleton width={120} height={24} />
          <div className="flex gap-2">
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="circular" width={32} height={32} />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <main className="container mx-auto px-4 pt-24 pb-20">
        {/* Buttons / Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
            <Skeleton variant="rectangular" width={200} height={48} className="rounded-lg" />
            <Skeleton variant="rectangular" width={160} height={48} className="rounded-lg" />
        </div>

        {/* Recent Series Section */}
        <div className="mb-8">
            <div className="flex justify-between mb-4">
                <Skeleton width={150} height={32} />
                <Skeleton width={80} height={32} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface rounded-lg shadow-md p-4 border border-transparent h-48 flex flex-col justify-between">
                    <div className="flex gap-4">
                        <Skeleton variant="rectangular" width={40} height={40} />
                        <div className="flex-1 space-y-2">
                            <Skeleton width="70%" height={24} />
                            <Skeleton width="90%" height={16} />
                            <Skeleton width="60%" height={16} />
                        </div>
                    </div>
                    <div className="space-y-2 mt-4">
                        <Skeleton variant="rectangular" height={8} className="rounded-full" />
                        <Skeleton variant="rectangular" height={8} className="rounded-full" />
                    </div>
                </div>
                <div className="bg-surface rounded-lg shadow-md p-4 border border-transparent h-48 flex flex-col justify-between">
                    <div className="flex gap-4">
                        <Skeleton variant="rectangular" width={40} height={40} />
                        <div className="flex-1 space-y-2">
                            <Skeleton width="60%" height={24} />
                            <Skeleton width="80%" height={16} />
                        </div>
                    </div>
                    <div className="space-y-2 mt-4">
                        <Skeleton variant="rectangular" height={8} className="rounded-full" />
                        <Skeleton variant="rectangular" height={8} className="rounded-full" />
                    </div>
                </div>
            </div>
        </div>

        {/* Recent Decks Section */}
        <div className="space-y-4">
            <div className="flex justify-between mb-4">
                <Skeleton width={150} height={32} />
                <Skeleton width={80} height={32} />
            </div>
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface rounded-lg shadow-md p-4 flex justify-between items-center h-24">
                    <div className="flex gap-4 items-center flex-1">
                        <Skeleton variant="circular" width={24} height={24} />
                        <div className="space-y-2 flex-1 max-w-md">
                            <Skeleton width="50%" height={20} />
                            <Skeleton width="80%" height={14} />
                        </div>
                    </div>
                    <Skeleton variant="rectangular" width={80} height={32} className="rounded-md" />
                </div>
            ))}
        </div>
      </main>
    </div>
  );
};

export default AppSkeleton;