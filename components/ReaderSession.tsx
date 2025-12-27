// components/ReaderSession.tsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LearningDeck, InfoCard, DeckLearningProgress } from '../types';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import Button from './ui/Button';
import Icon from './ui/Icon';
import ProgressBar from './ui/ProgressBar';
import { useStore } from '../store/store';
import { useData } from '../contexts/DataManagementContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import Spinner from './ui/Spinner';
import { stripHtml } from '../services/utils.ts';

interface ReaderSessionProps {
  deck: LearningDeck;
  onExit: () => void;
  onPractice: () => void;
}

type ReaderTheme = 'white' | 'sepia' | 'charcoal' | 'black';

const ReaderSession: React.FC<ReaderSessionProps> = ({ deck, onExit, onPractice }) => {
  const { learningProgress, aiGenerationStatus } = useStore();
  const dataHandlers = useData();
  const deckProgress = useMemo(() => 
    learningProgress[deck.id] || { deckId: deck.id, readInfoCardIds: [], unlockedQuestionIds: [], cardScrollIndices: {} }
  , [learningProgress, deck.id]);
  
  const readSet = useMemo(() => new Set(deckProgress.readInfoCardIds), [deckProgress]);

  const savedIndex = deck.infoCards?.findIndex(c => c.id === deckProgress.lastReadCardId);
  const initialIndex = savedIndex !== -1 ? savedIndex : (deck.infoCards?.findIndex(c => !readSet.has(c.id)) ?? 0);

  const [currentIndex, setCurrentIndex] = useState(initialIndex === -1 ? 0 : initialIndex);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTOCOpen, setIsTOCOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(deckProgress.readerTheme || 'white');
  const [readerFont, setReaderFont] = useState<'sans' | 'serif'>(deckProgress.readerFont || 'serif');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  
  // Reading Progress State
  const [scrollPercent, setScrollPercent] = useState(0);
  
  const lastScrollY = useRef(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const restorationTimerRef = useRef<number | null>(null);

  const currentCard = deck.infoCards?.[currentIndex];
  const totalCards = deck.infoCards?.length || 0;
  const isGenerating = aiGenerationStatus.currentTask?.deckId === deck.id || deck.generationStatus === 'generating';
  const isStub = currentCard && (!currentCard.content || currentCard.content.trim() === '');
  const totalTargetCount = deck.curriculum?.chapters?.length || totalCards;

  const isCardLocked = useMemo(() => {
      if (!currentCard) return false;
      const prerequisites = currentCard.prerequisiteIds || [];
      return prerequisites.some(id => !readSet.has(id));
  }, [currentCard, readSet]);

  const lockedByTitles = useMemo(() => {
      if (!currentCard || !isCardLocked) return [];
      const prerequisites = currentCard.prerequisiteIds || [];
      return prerequisites
          .filter(id => !readSet.has(id))
          .map(id => {
              const prereq = deck.infoCards.find(ic => ic.id === id);
              if (prereq?.content) return prereq.content.replace(/<[^>]+>/g, '').substring(0, 50) + "...";
              const currCh = deck.curriculum?.chapters.find(c => c.id === id);
              return currCh?.title || "Foundational Topic";
          });
  }, [currentCard, isCardLocked, readSet, deck.infoCards, deck.curriculum]);

  const updateProgress = useCallback(async (overrides: Partial<DeckLearningProgress> = {}) => {
      const newProgress: DeckLearningProgress = {
          ...deckProgress,
          lastReadCardId: currentCard?.id,
          readerTheme,
          readerFont,
          cardScrollIndices: {
              ...(deckProgress.cardScrollIndices || {}),
              [currentCard?.id || '']: scrollPositionRef.current
          },
          ...overrides
      };
      await dataHandlers?.handleUpdateLearningProgress(newProgress);
  }, [deckProgress, currentCard, readerTheme, readerFont, dataHandlers]);

  // Handle auto-hiding header on scroll and track scroll index
  useEffect(() => {
    const handleScroll = () => {
        const container = containerRef.current;
        if (!container) return;

        const currentScroll = container.scrollTop;
        const maxScroll = container.scrollHeight - container.clientHeight;
        const isAtBottom = maxScroll > 0 && currentScroll >= maxScroll - 20;

        if (currentScroll < 50 || isAtBottom) {
            setIsHeaderVisible(true);
        } else if (currentScroll > lastScrollY.current) {
            setIsHeaderVisible(false);
        } else {
            setIsHeaderVisible(true);
        }
        lastScrollY.current = currentScroll;

        // Calculate reading progress for this specific card
        if (maxScroll > 0) {
            setScrollPercent((currentScroll / maxScroll) * 100);
        } else {
            setScrollPercent(100); // Not scrollable means already at "bottom"
        }
    };
    
    const container = containerRef.current;
    if (container) {
        container.addEventListener('scroll', handleScroll, { passive: true });
        // Initial check
        handleScroll();
    }
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [currentIndex, isStub, isCardLocked]);

  // Intersection Observer for Tracking Reading Position
  useEffect(() => {
      const container = containerRef.current;
      if (!container || !currentCard || isStub || isCardLocked) return;

      const observerOptions = {
          root: container,
          rootMargin: '0px 0px -90% 0px', // Monitor the top 10% of the viewport
          threshold: [0, 1]
      };

      const observer = new IntersectionObserver((entries) => {
          const proseContainer = container.querySelector('.prose');
          if (!proseContainer) return;

          const children = Array.from(proseContainer.children);
          
          const visibleEntries = entries
              .filter(e => e.isIntersecting)
              .sort((a, b) => {
                  return children.indexOf(a.target) - children.indexOf(b.target);
              });

          if (visibleEntries.length > 0) {
              const topmostElement = visibleEntries[0].target;
              const index = children.indexOf(topmostElement);
              if (index !== -1) {
                  scrollPositionRef.current = index;
              }
          }
      }, observerOptions);

      const timer = window.setTimeout(() => {
          const proseContainer = container.querySelector('.prose');
          if (proseContainer) {
              Array.from(proseContainer.children).forEach(child => observer.observe(child));
          }
      }, 500);

      return () => {
          window.clearTimeout(timer);
          observer.disconnect();
      };
  }, [currentCard, isStub, isCardLocked]);

  // Restore Position
  useEffect(() => {
      if (restorationTimerRef.current) window.clearTimeout(restorationTimerRef.current);
      
      const container = containerRef.current;
      if (!container || !currentCard) return;

      const savedElementIndex = deckProgress.cardScrollIndices?.[currentCard.id];
      
      if (savedElementIndex !== undefined && savedElementIndex > 0) {
          restorationTimerRef.current = window.setTimeout(() => {
              const proseContainer = container.querySelector('.prose');
              if (proseContainer) {
                  const targetElement = proseContainer.children[savedElementIndex];
                  if (targetElement) {
                      targetElement.scrollIntoView({ block: 'start', behavior: 'instant' });
                      scrollPositionRef.current = savedElementIndex;
                  }
              }
          }, 100);
      } else {
          container.scrollTo({ top: 0, behavior: 'instant' });
          scrollPositionRef.current = 0;
      }

      updateProgress();
  }, [currentIndex, deck.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
            setIsSettingsOpen(false);
        }
    };
    if (isSettingsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  const handleMarkRead = useCallback(async () => {
    if (!currentCard || isCardLocked || isStub) return;
    const newReadIds = Array.from(new Set([...deckProgress.readInfoCardIds, currentCard.id]));
    const newUnlockedQuestions = Array.from(new Set([...deckProgress.unlockedQuestionIds, ...currentCard.unlocksQuestionIds]));
    await updateProgress({ readInfoCardIds: newReadIds, unlockedQuestionIds: newUnlockedQuestions });
  }, [currentCard, deckProgress, isCardLocked, isStub, updateProgress]);

  const handleNext = useCallback(async () => {
    if (!isCardLocked && !isStub) await handleMarkRead();
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  }, [currentIndex, totalCards, handleMarkRead, isCardLocked, isStub]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsCompleted(false);
    }
  };

  const jumpToChapter = (index: number) => {
      setCurrentIndex(index);
      setIsTOCOpen(false);
  };

  useKeyboardShortcuts({
      'ArrowRight': handleNext,
      'ArrowLeft': handlePrevious,
      'Space': handleNext,
      'KeyT': () => setIsTOCOpen(p => !p),
      'KeyS': () => setIsSettingsOpen(p => !p)
  });

  const themeColors = {
      white: 'bg-[#FFFFFF] text-[#1A1A1A]',
      sepia: 'bg-[#F4ECD8] text-[#5B4636]',
      charcoal: 'bg-[#2C2C2C] text-[#D1D1D1]',
      black: 'bg-[#000000] text-[#E0E0E0]'
  };

  const proseClasses = `
    flex-grow prose max-w-prose mx-auto ${readerFont === 'serif' ? 'font-serif' : 'font-sans'}
    ${readerTheme === 'white' ? 'prose-slate' : ''}
    ${readerTheme === 'sepia' ? 'prose-stone' : ''}
    ${readerTheme === 'charcoal' || readerTheme === 'black' ? 'prose-invert' : ''}
    leading-relaxed md:leading-loose text-lg md:text-xl
    prose-p:mb-8 prose-p:mt-2
    prose-headings:font-bold prose-headings:tracking-tight prose-headings:mt-12 prose-headings:mb-6
    prose-img:rounded-lg prose-img:shadow-xl prose-img:my-10
    prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-black/5 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r prose-blockquote:italic
    prose-pre:bg-black/10 prose-pre:rounded-xl
    drop-cap-enabled
  `;

  if (isCompleted && !isGenerating) {
      return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-6 ${themeColors[readerTheme]} animate-fade-in`}>
            <div className="max-w-md text-center">
                <div className="mb-8 inline-flex p-6 bg-primary/10 rounded-full text-primary">
                    <Icon name="check-circle" className="w-20 h-20" />
                </div>
                <h2 className="text-4xl font-black mb-4">Finis.</h2>
                <p className="opacity-70 mb-10 text-lg">You have absorbed the knowledge of this section. The next stage of mastery awaits.</p>
                <div className="flex flex-col gap-4">
                    <Button variant="primary" size="lg" onClick={onPractice} className="py-4 font-bold text-xl rounded-full shadow-lg">
                        Begin Practice Session
                    </Button>
                    <Button variant="ghost" onClick={onExit} className="rounded-full">Return to Library</Button>
                </div>
            </div>
        </div>
      );
  }

  const barBgColor = readerTheme === 'black' ? 'rgba(0,0,0,0.8)' : (readerTheme === 'charcoal' ? 'rgba(44,44,44,0.8)' : (readerTheme === 'sepia' ? 'rgba(244,236,216,0.8)' : 'rgba(255,255,255,0.8)'));
  const borderColor = readerTheme === 'black' || readerTheme === 'charcoal' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col overflow-y-auto no-scrollbar transition-colors duration-500 ${themeColors[readerTheme]}`} ref={containerRef}>
      
      {isTOCOpen && (
          <div className="fixed inset-0 z-[120] flex animate-fade-in">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsTOCOpen(false)}></div>
              <div className={`relative w-80 h-full shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0 ${themeColors[readerTheme]} border-r border-black/10`}>
                  <header className="p-6 border-b border-black/5 flex justify-between items-center">
                      <h3 className="font-black uppercase tracking-widest text-sm opacity-50">Contents</h3>
                      <Button variant="ghost" size="sm" onClick={() => setIsTOCOpen(false)} className="p-1 h-auto"><Icon name="x" /></Button>
                  </header>
                  <nav className="flex-grow overflow-y-auto p-4 space-y-1">
                      {deck.infoCards.map((ic, idx) => {
                          const title = ic.content.match(/<h[123]>(.*?)<\/h/)?.[1] || stripHtml(ic.content).substring(0, 30) || `Chapter ${idx + 1}`;
                          const isCurrent = idx === currentIndex;
                          const isRead = readSet.has(ic.id);
                          return (
                              <button 
                                key={ic.id}
                                onClick={() => jumpToChapter(idx)}
                                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all ${isCurrent ? 'bg-primary text-on-primary shadow-md scale-[1.02]' : 'hover:bg-black/5'}`}
                              >
                                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border ${isCurrent ? 'border-white/40' : 'border-black/10 opacity-50'}`}>{idx + 1}</span>
                                  <span className={`flex-grow truncate text-sm ${isCurrent ? 'font-bold' : (isRead ? 'opacity-100' : 'opacity-50')}`}>{title}</span>
                                  {isRead && !isCurrent && <Icon name="check-circle" className="w-4 h-4 text-green-500" />}
                              </button>
                          );
                      })}
                  </nav>
                  <footer className="p-6 border-t border-black/5">
                      <Button variant="secondary" onClick={onPractice} className="w-full rounded-full">Practice Deck</Button>
                  </footer>
              </div>
          </div>
      )}

      <header className={`fixed top-0 left-0 right-0 z-[110] transition-all duration-500 h-16 flex flex-col justify-center backdrop-blur-md border-b ${isHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`} style={{ backgroundColor: barBgColor, borderColor }}>
          <div className="flex items-center justify-between px-6 w-full">
              <div className="flex items-center gap-4 flex-1 min-w-0 mr-4">
                  <Button variant="ghost" size="sm" onClick={() => setIsTOCOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-black/5 flex-shrink-0">
                      <Icon name="list" className="w-6 h-6" />
                  </Button>
                  <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-tighter opacity-50 truncate" title={deck.name}>{deck.name}</span>
                      <span className="text-xs font-bold truncate">Chapter {currentIndex + 1} of {totalTargetCount}</span>
                  </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0" ref={settingsRef}>
                  <div className="relative">
                      <button 
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-all"
                      >
                          <span className={`text-lg ${readerFont === 'serif' ? 'font-serif' : 'font-sans'}`}>Aa</span>
                      </button>
                      
                      {isSettingsOpen && (
                          <div className="absolute top-full right-0 mt-2 w-72 bg-surface shadow-2xl border border-border rounded-2xl p-5 animate-fade-in z-[120]">
                              <div className="space-y-6">
                                  <div>
                                      <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3 block">Typography</label>
                                      <div className="flex bg-background rounded-xl p-1 border border-border">
                                          <button onClick={() => setReaderFont('sans')} className={`flex-1 py-2 rounded-lg text-sm transition-all ${readerFont === 'sans' ? 'bg-primary text-white shadow-md font-bold' : 'text-text-muted hover:text-text'}`}>San Serif</button>
                                          <button onClick={() => setReaderFont('serif')} className={`flex-1 py-2 rounded-lg text-sm transition-all ${readerFont === 'serif' ? 'bg-primary text-white shadow-md font-serif font-bold' : 'text-text-muted hover:text-text font-serif'}`}>Serif</button>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3 block">Theme</label>
                                      <div className="grid grid-cols-4 gap-3">
                                          {(['white', 'sepia', 'charcoal', 'black'] as ReaderTheme[]).map(t => (
                                              <button 
                                                key={t}
                                                onClick={() => setReaderTheme(t)}
                                                className={`aspect-square rounded-full border-2 transition-all ${readerTheme === t ? 'border-primary scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: t === 'white' ? '#FFF' : (t === 'sepia' ? '#F4ECD8' : (t === 'charcoal' ? '#2C2C2C' : '#000')) }}
                                                title={t}
                                              />
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={onExit} className="p-2 rounded-full hover:bg-black/5"><Icon name="x" className="w-6 h-6" /></Button>
              </div>
          </div>
          
          {/* Subtle Progress Bar - Always visible, themed color */}
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-text/5 z-[111]">
              <div className="h-full bg-text/20 transition-all duration-150 ease-out" style={{ width: `${scrollPercent}%` }} />
          </div>
      </header>

      <main className="flex-grow pt-24 px-6 md:px-12 pb-32">
          {isCardLocked ? (
              <div className="max-w-prose mx-auto py-20 text-center animate-fade-in">
                  <div className="mb-8 inline-flex p-8 bg-red-500/10 rounded-full text-red-500">
                      <Icon name="lock" className="w-16 h-16" />
                  </div>
                  <h3 className="text-3xl font-black mb-4">Chapter Encrypted</h3>
                  <p className="opacity-70 mb-10 text-lg">Knowledge architecture requires a sequential flow. Please complete the following foundational sections first:</p>
                  <div className="space-y-3">
                      {lockedByTitles.map((t, i) => (
                          <div key={i} className="p-4 bg-black/5 rounded-xl text-left font-bold flex items-center gap-3">
                              <span className="w-2 h-2 rounded-full bg-primary"></span>
                              <span className="truncate">{t}</span>
                          </div>
                      ))}
                  </div>
                  <Button variant="secondary" onClick={handlePrevious} className="mt-10 rounded-full px-8">Return to Prerequisites</Button>
              </div>
          ) : isStub ? (
              <div className="max-w-prose mx-auto py-24 text-center animate-fade-in">
                  <div className="relative mb-10 inline-block">
                      <div className="absolute inset-0 bg-primary rounded-full blur-3xl opacity-20 animate-pulse"></div>
                      <Icon name="bot" className="relative w-24 h-24 text-primary animate-bounce" />
                  </div>
                  <h3 className="text-4xl font-black mb-6">Synthesizing...</h3>
                  <p className="text-xl opacity-60 max-w-md mx-auto leading-relaxed">The Hyper-Course engine is actively weaving this chapter from your source documents. Verifying claims and drafting diagrams.</p>
                  <div className="mt-12 h-1 rounded-full w-48 mx-auto bg-black/5 overflow-hidden">
                      <div className="h-full bg-primary w-1/2 animate-infinite-load"></div>
                  </div>
              </div>
          ) : currentCard && (
              <div className={proseClasses}>
                  <DangerousHtmlRenderer html={currentCard.content} />
              </div>
          )}
      </main>

      <footer className={`fixed bottom-0 left-0 right-0 z-[110] transition-all duration-500 h-16 flex items-center justify-between px-6 backdrop-blur-md border-t ${isHeaderVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`} style={{ backgroundColor: barBgColor, borderColor }}>
          <div className="flex-1 flex justify-start">
              <Button 
                variant="ghost" 
                onClick={handlePrevious} 
                disabled={currentIndex === 0}
                className="rounded-xl px-2 sm:px-4 py-2 font-bold text-sm hover:bg-black/5 disabled:opacity-10 transition-all flex items-center gap-1.5"
              >
                  <Icon name="chevron-left" className="w-5 h-5" />
                  <span className="hidden sm:inline">Previous</span>
              </Button>
          </div>
          
          <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-25 select-none">
                  {currentIndex + 1} / {totalTargetCount}
              </span>
          </div>

          <div className="flex-1 flex justify-end">
              <Button 
                variant="ghost" 
                onClick={handleNext} 
                className="rounded-xl px-2 sm:px-4 py-2 font-black text-sm text-primary hover:bg-primary/5 transition-all flex items-center gap-1.5"
              >
                  <span className="hidden sm:inline">{currentIndex === totalCards - 1 ? 'Finish' : 'Next'}</span>
                  {currentIndex < totalCards - 1 ? (
                    <Icon name="chevron-left" className="w-5 h-5 rotate-180" />
                  ) : (
                    <Icon name="check-circle" className="w-5 h-5" />
                  )}
              </Button>
          </div>
      </footer>

      <style>{`
          .font-serif { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; }
          .font-sans { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          
          .drop-cap-enabled p:first-of-type::first-letter {
            float: left;
            font-size: 4.5rem;
            line-height: 4rem;
            padding-right: 0.5rem;
            font-weight: 900;
            color: var(--color-primary);
          }

          @keyframes infinite-load {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(250%); }
          }
          .animate-infinite-load { animation: infinite-load 2s ease-in-out infinite; }
          
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default ReaderSession;
