import React from 'react';

// This component is designed to render a string of HTML that may contain <script> tags.
// React's `dangerouslySetInnerHTML` does not execute scripts for security reasons.
// This component works around that by manually finding, creating, and appending
// the scripts to the DOM, which forces the browser to execute them.
// This is necessary for full compatibility with Anki cards that use custom JavaScript.

interface DangerousHtmlRendererProps {
  html: string;
  className?: string;
  as?: React.ElementType;
}

const DangerousHtmlRenderer: React.FC<DangerousHtmlRendererProps> = ({ html, className, as: Component = 'div' }) => {
  // A unique ID is needed to target the container element after it renders.
  const id = `html-container-${React.useId()}`;

  React.useEffect(() => {
    const container = document.getElementById(id);
    if (!container) return;

    // After the container is rendered with the static HTML, find all the script tags within it.
    const scripts = Array.from(container.getElementsByTagName('script'));
    const newScripts: HTMLScriptElement[] = [];

    scripts.forEach(oldScript => {
      // Create a new script element.
      const newScript = document.createElement('script');
      
      // Copy all attributes (like src, type, etc.) from the original script tag.
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      
      if (oldScript.text && !oldScript.src) {
        newScript.text = `try { ${oldScript.text} } catch (e) { console.error('Error in custom card script:', e); }`;
      } else {
        newScript.text = oldScript.text;
      }
      
      // Append the new script to the document body to execute it.
      document.body.appendChild(newScript);
      newScripts.push(newScript);
    });

    // Return a cleanup function that will be called when the component unmounts or re-renders.
    // This removes the dynamically added scripts to prevent memory leaks and unexpected behavior.
    return () => {
      newScripts.forEach(s => {
        if (document.body.contains(s)) {
          document.body.removeChild(s);
        }
      });
    };
  }, [html, id]); // Re-run the effect if the HTML content or the unique ID changes.

  return (
    <Component
      id={id}
      className={className}
      // Render the static part of the HTML. Scripts inside will be inert until the useEffect hook runs.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default DangerousHtmlRenderer;