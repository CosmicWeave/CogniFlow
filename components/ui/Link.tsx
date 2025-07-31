import React from 'react';
import { useRouter } from '../../contexts/RouterContext';

// By omitting 'onClick' from the standard anchor attributes and redefining it,
// we can accept a broader event type that works for both anchor links and
// components passed via 'passAs' (like a Button).
interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> {
  href: string;
  children: React.ReactNode;
  className?: string;
  passAs?: React.ElementType;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  [key: string]: any; // To allow for other props like 'variant' for a Button
}

const Link: React.FC<LinkProps> = ({ href, children, passAs: Component, ...props }) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    // If it's a middle-click or ctrl-click on an anchor, let the browser handle it via the href.
    if (e.currentTarget.tagName === 'A' && (e.metaKey || e.ctrlKey)) {
      return;
    }

    // For all other cases (left-click), prevent the default browser action.
    e.preventDefault();

    // If an external onClick handler was provided (e.g., onUpdateLastOpened), call it.
    if (props.onClick) {
        props.onClick(e);
    }

    // Use our client-side router to navigate.
    navigate(href);
  };
  
  // The href for the actual DOM element must be correctly formatted for hash routing.
  const hashHref = `#${href}`;

  if (Component) {
    // If we're rendering as a custom component (e.g., a Button),
    // we pass the onClick handler and other props. The component itself isn't a link,
    // so it doesn't get an href.
    return (
        <Component {...props} onClick={handleClick}>
            {children}
        </Component>
    );
  }

  // If we are rendering a standard anchor tag, we must provide the correct hash-based href
  // so that browser features like "Open in new tab" work correctly.
  return (
    <a {...props} href={hashHref} onClick={handleClick}>
      {children}
    </a>
  );
};

export default Link;
