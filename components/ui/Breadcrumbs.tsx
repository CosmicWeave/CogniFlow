import React from 'react';
import Link from './Link';
import Icon from './Icon';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  if (items.length <= 1) {
    return null; // Don't render if there's only one or zero items (e.g., just "Home")
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center space-x-2 text-sm text-text-muted flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <Icon name="chevron-left" className="w-4 h-4 rotate-180 mx-2 flex-shrink-0" />
              )}
              {isLast ? (
                <span className="font-semibold text-text truncate" aria-current="page" title={item.label}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href!} className="hover:underline hover:text-primary truncate" title={item.label}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
