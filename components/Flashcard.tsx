import React from 'react';
// FIX: Corrected import path for types
import type { Card } from '../types';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import MasteryBar from './ui/MasteryBar';
import { getEffectiveMasteryLevel } from '../services/srs';

interface FlashcardProps {
  card: Card;
  isFlipped: boolean;
}

const Flashcard: React.FC<FlashcardProps> = ({ card, isFlipped }) => {
  const contentClasses = "text-xl text-left text-text break-words prose dark:prose-invert max-w-none prose-img:mx-auto prose-img:max-h-64 prose-audio:mx-auto";
  const mastery = getEffectiveMasteryLevel(card);

  return (
    <div className="w-full bg-surface rounded-lg shadow-lg border border-border">
      {/* 
        Anki CSS is injected here. The card.css property contains the full <style> tag, 
        so we render it inside a div and the browser applies it.
      */}
      {card.css && <div dangerouslySetInnerHTML={{ __html: card.css }} />}
      
      {/* Front Content */}
      <div className="p-6 md:p-8 min-h-[12rem] flex items-center justify-center">
        <DangerousHtmlRenderer
          html={card.front}
          className={contentClasses}
        />
      </div>
      
      {/* Separator and Back Content (conditional) */}
      {isFlipped && (
        <div className="animate-fade-in" style={{ animationDuration: '400ms' }}>
          <hr className="border-border/50" />
          <div className="p-6 md:p-8 bg-background/30 dark:bg-black/10">
             <DangerousHtmlRenderer
                html={card.back}
                className={contentClasses}
              />
            <div className="mt-6 pt-6 border-t border-border/50">
              <MasteryBar level={mastery} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Flashcard;