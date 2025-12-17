
import React, { useState, useRef, useEffect } from 'react';
// FIX: Corrected import path for types
import { Card, ReviewRating } from '../types';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer.tsx';
import MasteryBar from './ui/MasteryBar.tsx';
import { getEffectiveMasteryLevel } from '../services/srs.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import Spinner from './ui/Spinner.tsx';
import { playPcmAudio, stripHtml } from '../services/utils.ts';
import { generateMnemonic } from '../services/aiService.ts';
import { useToast } from '../hooks/useToast.ts';

interface FlashcardProps {
  card: Card;
  isFlipped: boolean;
  onGenerateAudio?: (card: Card, side: 'front' | 'back') => Promise<string | undefined>;
  deckId?: string; // Needed for update
  onReview?: (rating: ReviewRating) => void;
  textSize?: string;
}

const AudioButton: React.FC<{ 
    audioData?: string, 
    onGenerate?: () => Promise<void>, 
    canGenerate: boolean 
}> = ({ audioData, onGenerate, canGenerate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const handlePlay = async () => {
        if (!audioData) return;
        setIsPlaying(true);
        try {
            await playPcmAudio(audioData);
        } catch(e) {
            console.error("Audio playback error", e);
        } finally {
            setIsPlaying(false);
        }
    };

    const handleGenerate = async () => {
        if (!onGenerate) return;
        setIsLoading(true);
        try {
            await onGenerate();
        } finally {
            setIsLoading(false);
        }
    };

    if (audioData) {
        return (
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); handlePlay(); }}
                className={`rounded-full p-2 h-auto ${isPlaying ? 'text-primary' : 'text-text-muted hover:text-primary'}`}
                title="Play Audio"
            >
                <Icon name="volume-2" className="w-5 h-5" />
            </Button>
        );
    }

    if (canGenerate) {
        return (
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                disabled={isLoading}
                className="rounded-full p-2 h-auto text-text-muted hover:text-primary"
                title="Generate Audio with AI"
            >
                {isLoading ? <Spinner size="sm" /> : <Icon name="mic" className="w-5 h-5" />}
            </Button>
        );
    }

    return null;
};

const MnemonicButton: React.FC<{ card: Card }> = ({ card }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const { addToast } = useToast();

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const frontText = stripHtml(card.front);
            const backText = stripHtml(card.back);
            const result = await generateMnemonic(frontText, backText);
            setMnemonic(result);
        } catch (e) {
            addToast('Failed to generate mnemonic.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (mnemonic) {
        return (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-sm">
                <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">AI Mnemonic</span>
                    <button onClick={() => setMnemonic(null)} className="text-text-muted hover:text-text"><Icon name="x" className="w-3 h-3" /></button>
                </div>
                <DangerousHtmlRenderer html={mnemonic} className="text-text font-medium" />
            </div>
        );
    }

    return (
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
            disabled={isLoading}
            className="rounded-full p-2 h-auto text-text-muted hover:text-purple-500"
            title="Generate Mnemonic with AI"
        >
            {isLoading ? <Spinner size="sm" /> : <Icon name="bot" className="w-5 h-5" />}
        </Button>
    );
};

const Flashcard: React.FC<FlashcardProps> = ({ card, isFlipped, onGenerateAudio, deckId, onReview, textSize = 'text-xl' }) => {
  const contentClasses = `${textSize} text-left text-text break-words prose dark:prose-invert max-w-none prose-img:mx-auto prose-img:max-h-64 prose-audio:mx-auto transition-all duration-200`;
  const mastery = getEffectiveMasteryLevel(card);
  const { aiFeaturesEnabled } = useSettings();

  // Swipe Gesture State
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);
  const [offset, setOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 100;

  const handleGenerateSide = async (side: 'front' | 'back') => {
      if (onGenerateAudio && deckId) {
          await onGenerateAudio(card, side);
      }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (!isFlipped || !onReview) return; // Only allow swipe when reviewing
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchStart || !isDragging) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - touchStart.x;
      const deltaY = currentY - touchStart.y;
      
      // Prevent scrolling while swiping horizontally
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // e.preventDefault(); // Warning: Unable to preventDefault inside passive event listener
      }
      
      setOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
      if (!isDragging || !onReview) return;
      
      // Determine action based on offset
      if (offset.x > SWIPE_THRESHOLD) {
          // Swipe Right -> Good
          onReview(ReviewRating.Good);
      } else if (offset.x < -SWIPE_THRESHOLD) {
          // Swipe Left -> Again
          onReview(ReviewRating.Again);
      } else if (offset.y < -SWIPE_THRESHOLD) {
          // Swipe Up -> Easy
          onReview(ReviewRating.Easy);
      }

      // Reset
      setTouchStart(null);
      setOffset({ x: 0, y: 0 });
      setIsDragging(false);
  };

  // Visual cues opacity calculations
  const opacityRight = Math.min(Math.max(offset.x / (SWIPE_THRESHOLD * 1.5), 0), 0.8); // Green (Good)
  const opacityLeft = Math.min(Math.max(-offset.x / (SWIPE_THRESHOLD * 1.5), 0), 0.8); // Red (Again)
  const opacityUp = Math.min(Math.max(-offset.y / (SWIPE_THRESHOLD * 1.5), 0), 0.8); // Blue (Easy)

  const cardStyle = {
      transform: isDragging ? `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x * 0.05}deg)` : 'none',
      transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      cursor: isFlipped && onReview ? 'grab' : 'default',
  };

  return (
    <div 
        ref={cardRef}
        className="w-full relative touch-none select-none" // touch-none prevents browser scroll interference
        style={cardStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      {/* Swipe Overlay Indicators */}
      {isDragging && (
          <>
            <div className="absolute inset-0 bg-green-500/30 rounded-lg pointer-events-none z-10 flex items-center justify-center" style={{ opacity: opacityRight }}>
                <span className="text-4xl font-bold text-green-800 bg-white/50 px-4 py-2 rounded-lg backdrop-blur-sm">GOOD</span>
            </div>
            <div className="absolute inset-0 bg-red-500/30 rounded-lg pointer-events-none z-10 flex items-center justify-center" style={{ opacity: opacityLeft }}>
                <span className="text-4xl font-bold text-red-800 bg-white/50 px-4 py-2 rounded-lg backdrop-blur-sm">AGAIN</span>
            </div>
            <div className="absolute inset-0 bg-blue-500/30 rounded-lg pointer-events-none z-10 flex items-center justify-center" style={{ opacity: opacityUp }}>
                <span className="text-4xl font-bold text-blue-800 bg-white/50 px-4 py-2 rounded-lg backdrop-blur-sm">EASY</span>
            </div>
          </>
      )}

      <div className="w-full bg-surface rounded-lg shadow-lg border border-border">
        {/* 
          Anki CSS is injected here. The card.css property contains the full <style> tag, 
          so we render it inside a div and the browser applies it.
        */}
        {card.css && <div dangerouslySetInnerHTML={{ __html: card.css }} />}
        
        {/* Front Content */}
        <div className="p-6 md:p-8 min-h-[12rem] lg:min-h-[20rem] flex flex-col items-center justify-center relative">
          <div className="absolute top-4 right-4">
              <AudioButton 
                  audioData={card.frontAudio} 
                  onGenerate={() => handleGenerateSide('front')}
                  canGenerate={aiFeaturesEnabled && !!onGenerateAudio}
              />
          </div>
          <DangerousHtmlRenderer
            html={card.front}
            className={contentClasses}
          />
        </div>
        
        {/* Separator and Back Content (conditional) */}
        {isFlipped && (
          <div className="animate-fade-in" style={{ animationDuration: '400ms' }}>
            <hr className="border-border/50" />
            <div className="p-6 md:p-8 bg-background/30 dark:bg-black/10 relative">
               <div className="absolute top-4 right-4 flex gap-2">
                  {aiFeaturesEnabled && <MnemonicButton card={card} />}
                  <AudioButton 
                      audioData={card.backAudio} 
                      onGenerate={() => handleGenerateSide('back')}
                      canGenerate={aiFeaturesEnabled && !!onGenerateAudio}
                  />
              </div>
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
    </div>
  );
};

export default Flashcard;
