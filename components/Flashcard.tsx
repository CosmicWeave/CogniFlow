import React from 'react';
import type { Card } from '../types';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import { useSettings } from '../hooks/useSettings';
import MasteryBar from './ui/MasteryBar';
import { getEffectiveMasteryLevel } from '../services/srs';

interface FlashcardProps {
  card: Card;
  isFlipped: boolean;
}

const Flashcard: React.FC<FlashcardProps> = ({ card, isFlipped }) => {
  const { disableAnimations } = useSettings();
  const contentClasses = "text-2xl text-center text-gray-900 dark:text-gray-100 break-words prose dark:prose-invert max-w-none prose-img:mx-auto prose-img:max-h-48 prose-audio:mx-auto";
  const effectiveMastery = getEffectiveMasteryLevel(card);

  if (disableAnimations) {
    return (
      <div className="w-full h-80">
        {card.css && <div dangerouslySetInnerHTML={{ __html: card.css }} />}
        <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg shadow-lg flex flex-col justify-between p-6 border border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="flex-grow flex items-center justify-center">
             <DangerousHtmlRenderer
              html={isFlipped ? card.back : card.front}
              className={contentClasses}
            />
          </div>
          {isFlipped && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
              <MasteryBar level={effectiveMastery} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-80 perspective-1000">
      {/* 
        Inject card-specific styles from Anki.
        Browsers are lenient and will apply style tags rendered inside a div, 
        so this approach works for applying custom CSS.
      */}
      {card.css && <div dangerouslySetInnerHTML={{ __html: card.css }} />}
      
      <div
        className={`relative w-full h-full transition-transform duration-700 transform-style-preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front of the card */}
        <div className="absolute w-full h-full backface-hidden bg-gray-100 dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center p-6 border border-gray-200 dark:border-gray-700 overflow-y-auto">
          <DangerousHtmlRenderer
            html={card.front}
            className={contentClasses}
          />
        </div>
        
        {/* Back of the card */}
        <div className="absolute w-full h-full backface-hidden bg-gray-100 dark:bg-gray-800 rounded-lg shadow-lg flex flex-col justify-between p-6 border border-gray-200 dark:border-gray-700 rotate-y-180 overflow-y-auto">
           <div className="flex-grow flex items-center justify-center">
              <DangerousHtmlRenderer
                html={card.back}
                className={contentClasses}
              />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
              <MasteryBar level={effectiveMastery} />
            </div>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;