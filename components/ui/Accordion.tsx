import React, { createContext, useContext, useState, useEffect } from 'react';
import Icon from './Icon';

// --- Accordion Context for managing state ---
type AccordionContextType = {
  value: string | string[];
  onValueChange: (value: string) => void;
  type: 'single' | 'multiple';
};

const AccordionContext = createContext<AccordionContextType | null>(null);

const useAccordion = () => {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an <Accordion> component.');
  }
  return context;
};

// --- Accordion Item Context for item-specific value ---
type AccordionItemContextType = {
  value: string;
  isOpen: boolean;
};

const AccordionItemContext = createContext<AccordionItemContextType | null>(null);

const useAccordionItem = () => {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error('AccordionTrigger/Content must be used within an <AccordionItem> component.');
  }
  return context;
};

// --- Main Accordion Component ---
interface AccordionProps {
  children: React.ReactNode;
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  children,
  type = 'single',
  defaultValue,
  className = '',
}) => {
  const [value, setValue] = useState<string | string[]>(defaultValue || (type === 'multiple' ? [] : ''));

  const onValueChange = (itemValue: string) => {
    if (type === 'multiple') {
      setValue(currentValue => {
        const arr = Array.isArray(currentValue) ? currentValue : [];
        return arr.includes(itemValue) ? arr.filter(v => v !== itemValue) : [...arr, itemValue];
      });
    } else {
      setValue(currentValue => (currentValue === itemValue ? '' : itemValue));
    }
  };

  useEffect(() => {
    if (defaultValue === undefined) {
      setValue(type === 'multiple' ? [] : '');
    } else {
      setValue(defaultValue);
    }
  }, [defaultValue, type]);

  return (
    <AccordionContext.Provider value={{ value, onValueChange, type }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
};

// --- Accordion Item Component ---
interface AccordionItemProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({ children, value, className = '' }) => {
  const { value: contextValue, type } = useAccordion();
  const isOpen = type === 'multiple' ? (Array.isArray(contextValue) && contextValue.includes(value)) : contextValue === value;
  
  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div className={className}>{children}</div>
    </AccordionItemContext.Provider>
  );
};

// --- Accordion Trigger Component ---
interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const AccordionTrigger: React.FC<AccordionTriggerProps> = ({ children, className = '', ...props }) => {
  const { onValueChange } = useAccordion();
  const { value, isOpen } = useAccordionItem();
  const contentId = `accordion-content-${value}`;
  const headerId = `accordion-header-${value}`;

  return (
    <h3 id={headerId} className="m-0 font-medium">
      <button
        type="button"
        onClick={() => onValueChange(value)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={`w-full flex justify-between items-center text-left p-4 bg-surface hover:bg-border/20 transition-colors ${className}`}
        {...props}
      >
        {children}
        <Icon name="chevron-down" className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} text-text-muted`}/>
      </button>
    </h3>
  );
};

// --- Accordion Content Component ---
interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

export const AccordionContent: React.FC<AccordionContentProps> = ({ children, className = '' }) => {
  const { value, isOpen } = useAccordionItem();
  const contentId = `accordion-content-${value}`;
  const headerId = `accordion-header-${value}`;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      id={contentId}
      role="region"
      aria-labelledby={headerId}
      className={`animate-fade-in ${className}`}
    >
      {children}
    </div>
  );
};
