
import React from 'react';
import Link from './Link';
import Icon from './Icon';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

const truncateLabel = (label: string, maxLength: number): string => {
    if (!label) return "";
    const strLabel = String(label);
    if (strLabel.length > maxLength) {
        return strLabel.substring(0, maxLength) + '...';
    }
    return strLabel;
};

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  if (!items || items.length <= 1) {
    return null; // Don't render if there's only one or zero items (e.g., just "Home")
  }

  const renderLabel = (label: string) => (
    <>
      <span className="sm:hidden" title={label}>{truncateLabel(label, 8)}</span>
      <span className="hidden sm:inline" title={label}>{truncateLabel(label, 25)}</span>
    </>
  );

  return (
    <nav aria-label="Breadcrumb" className="mb-4 sm:mb-6">
      <ol className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-text-muted flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <Icon name="chevron-left" className="w-3 h-3 sm:w-4 sm:h-4 rotate-180 mx-1 sm:mx-2 flex-shrink-0" />
              )}
              {isLast ? (
                <span className="font-semibold text-text" aria-current="page">
                  {renderLabel(item.label)}
                </span>
              ) : (
                <Link href={item.href!} className="hover:underline hover:text-primary whitespace-nowrap">
                  {renderLabel(item.label)}
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
