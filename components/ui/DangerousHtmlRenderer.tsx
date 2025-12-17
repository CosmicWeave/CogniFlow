import React from 'react';
import DOMPurify from 'dompurify';

// This component is designed to render a string of HTML that may contain <script> tags.
// React's `dangerouslySetInnerHTML` does not execute scripts for security reasons.
// This component works around that by manually finding, creating, and appending
// the scripts to the DOM, which forces the browser to execute them.
// This is necessary for full compatibility with Anki cards that use custom JavaScript.
//
// SAFETY: We use DOMPurify to sanitize the HTML structure (removing dangerous attributes
// like 'onload' on images) to prevent XSS, while explicitly allowing <script> tags
// so that user-provided Anki card templates can function as intended.

interface DangerousHtmlRendererProps {
  html: string;
  className?: string;
  as?: React.ElementType;
}

const DangerousHtmlRenderer: React.FC<DangerousHtmlRendererProps> = ({ html, className, as: Component = 'div' }) => {
  // A unique ID is needed to target the container element after it renders.
  const id = `html-container-${React.useId()}`;

  // Sanitize the HTML content before rendering.
  // We explicitly ALLOW 'script' tags because they are required for Anki card functionality.
  // However, we strip dangerous attributes from other tags to mitigate common XSS vectors.
  const sanitizedHtml = React.useMemo(() => {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['script', 'style', 'iframe', 'video', 'audio', 'source', 'track', 'img'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'src', 'data-src', 'type', 'controls', 'autoplay', 'loop', 'muted', 'poster', 'preload', 'class', 'id', 'style'],
      FORCE_BODY: true, // Ensures we get content even if it's a full html document
    });
  }, [html]);

  React.useEffect(() => {
    const container = document.getElementById(id);
    if (!container) return;

    // 1. Optimize Image Loading
    // Find all images and set loading="lazy" and decoding="async" to prevent UI blocking
    const images = Array.from(container.getElementsByTagName('img'));
    images.forEach(img => {
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
      if (!img.hasAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
      }
    });

    // 2. Execute Scripts
    // DOMPurify with ADD_TAGS: ['script'] preserves script tags in the output string.
    // However, injecting string HTML into the DOM via dangerouslySetInnerHTML (innerHTML)
    // does not execute scripts for security. We must manually recreate them.
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
  }, [sanitizedHtml, id]); // Re-run the effect if the sanitized HTML content or the unique ID changes.

  return (
    <Component
      id={id}
      className={className}
      // Render the static part of the HTML. Scripts inside will be inert until the useEffect hook runs.
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default DangerousHtmlRenderer;