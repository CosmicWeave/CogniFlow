
import React from 'react';
import Button from './Button';
import Icon from './Icon';

interface RichTextToolbarProps {
  targetId: string;
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
}

const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ targetId, value, onChange, className = '' }) => {
  const insertTag = (tag: string, endTag?: string) => {
    const textarea = document.getElementById(targetId) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);

    let newText = '';
    let newCursorPos = 0;

    if (endTag) {
        // Wrap selection
        newText = `${beforeText}<${tag}>${selectedText}</${endTag}>${afterText}`;
        newCursorPos = start + tag.length + 2 + selectedText.length + endTag.length + 3; // roughly at end
    } else {
        // Self-closing or simple insertion
        newText = `${beforeText}<${tag}>${afterText}`;
        newCursorPos = start + tag.length + 2;
    }

    // Special handling for common tags to position cursor nicely
    if (tag === 'b' || tag === 'i' || tag === 'u' || tag === 'code') {
        newText = `${beforeText}<${tag}>${selectedText}</${tag}>${afterText}`;
        if (selectedText.length === 0) {
            // If no selection, place cursor inside tags: <b>|</b>
            newCursorPos = start + tag.length + 2;
        } else {
            // If selection, place cursor after
            newCursorPos = start + tag.length + 2 + selectedText.length + tag.length + 3;
        }
    } else if (tag === 'br') {
        newText = `${beforeText}<br>\n${afterText}`;
        newCursorPos = start + 5;
    } else if (tag === 'ul') {
        const listItems = selectedText.split('\n').map(item => `  <li>${item}</li>`).join('\n');
        const content = listItems || '  <li></li>';
        newText = `${beforeText}<ul>\n${content}\n</ul>${afterText}`;
        newCursorPos = listItems ? start + content.length + 11 : start + 9;
    }

    // React specific: update state
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, newText);
    }
    
    // Trigger change event for React to pick up
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
    
    onChange(newText);

    // Restore focus and set cursor
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className={`flex flex-wrap items-center gap-1 p-1 bg-surface border-b border-border rounded-t-md ${className}`}>
      <Button type="button" variant="ghost" size="sm" onClick={() => insertTag('b')} title="Bold" className="px-2 h-8 min-w-[2rem] font-bold">B</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => insertTag('i')} title="Italic" className="px-2 h-8 min-w-[2rem] italic">I</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => insertTag('u')} title="Underline" className="px-2 h-8 min-w-[2rem] underline">U</Button>
      <div className="w-px h-4 bg-border mx-1"></div>
      <Button type="button" variant="ghost" size="sm" onClick={() => insertTag('code')} title="Code" className="px-2 h-8 min-w-[2rem] font-mono text-xs">{'</>'}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => insertTag('br')} title="Line Break" className="px-2 h-8 min-w-[2rem] text-xs">BR</Button>
      <div className="w-px h-4 bg-border mx-1"></div>
      <Button type="button" variant="ghost" size="sm" onClick={() => insertTag('ul')} title="List" className="px-2 h-8 min-w-[2rem]"><Icon name="list" className="w-4 h-4" /></Button>
    </div>
  );
};

export default RichTextToolbar;
