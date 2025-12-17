import React from 'react';
import Skeleton from './ui/Skeleton';

const StatsSkeleton: React.FC = () => {
  return (
    <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-surface p-6 rounded-lg shadow-md border border-border h-64 flex flex-col">
                <div className="mb-4">
                    <Skeleton width={180} height={24} />
                    <Skeleton width={250} height={16} className="mt-2" />
                </div>
                <div className="flex-1 flex items-end gap-2 pb-4 px-2">
                    {/* Fake graph lines */}
                    <Skeleton width="15%" height="30%" className="rounded-t-sm" />
                    <Skeleton width="15%" height="50%" className="rounded-t-sm" />
                    <Skeleton width="15%" height="40%" className="rounded-t-sm" />
                    <Skeleton width="15%" height="70%" className="rounded-t-sm" />
                    <Skeleton width="15%" height="60%" className="rounded-t-sm" />
                    <Skeleton width="15%" height="80%" className="rounded-t-sm" />
                </div>
            </div>
            <div className="bg-surface p-6 rounded-lg shadow-md border border-border h-64">
                <div className="mb-4">
                    <Skeleton width={150} height={24} />
                    <Skeleton width={200} height={16} className="mt-2" />
                </div>
                 <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3 bg-background rounded-md border border-transparent">
                            <Skeleton width="80%" height={16} />
                            <Skeleton width="30%" height={12} className="mt-2" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};

export default StatsSkeleton;