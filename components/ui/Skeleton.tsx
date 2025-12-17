import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'text', width, height }) => {
  const baseClasses = "animate-pulse bg-gray-200 dark:bg-gray-700/50";
  const variantClasses = {
    text: "rounded h-4 w-full",
    circular: "rounded-full",
    rectangular: "rounded-md",
  };
  
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div 
        className={`${baseClasses} ${variantClasses[variant]} ${className}`} 
        style={style}
        aria-hidden="true"
    />
  );
};

export default Skeleton;