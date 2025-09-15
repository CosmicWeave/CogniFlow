import React, { useState, useRef, useLayoutEffect } from 'react';
import Button from './Button';
import Icon from './Icon';

interface TruncatedTextProps {
  html: string;
  className?: string;
}

const TruncatedText: React.FC<TruncatedTextProps> = ({ html, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canTruncate, setCanTruncate] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Use useLayoutEffect to measure before the browser paints to avoid flicker.
  // This effect checks if the content is taller than its clamped container.
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (element) {
      // The `line-clamp-3` class is applied by default. We check if the scrollHeight
      // (full content height) is greater than the clientHeight (visible height).
      // This tells us if the content is actually being truncated.
      if (element.scrollHeight > element.clientHeight) {
        setCanTruncate(true);
      } else {
        // If content fits within 3 lines, we don't need the toggle.
        setCanTruncate(false);
      }
    }
  }, [html]); // Rerun if the HTML content changes.

  return (
    <div>
      <div
        ref={contentRef}
        className={`${className} ${!isExpanded ? 'line-clamp-3' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {canTruncate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary hover:text-primary-hover -ml-1 px-1 py-1 text-sm mt-1"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Show less' : 'Show more'}
          <Icon name="chevron-down" className={`w-4 h-4 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>
      )}
    </div>
  );
};

export default TruncatedText;
