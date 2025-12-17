
import React, { useState, useMemo } from 'react';
import { Deck, DeckType, FlashcardDeck, QuizDeck, LearningDeck } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';
import { useRouter } from '../contexts/RouterContext';

interface DeckPrintViewProps {
  deck: Deck;
}

type PrintLayout = 'table' | 'cards-side' | 'cards-fold';

const DeckPrintView: React.FC<DeckPrintViewProps> = ({ deck }) => {
  const { navigate } = useRouter();
  const [layout, setLayout] = useState<PrintLayout>('table');
  const [textSize, setTextSize] = useState(1); // multiplier
  const [showTags, setShowTags] = useState(false);

  const items = useMemo(() => {
    if (deck.type === DeckType.Flashcard) {
      return (deck as FlashcardDeck).cards.map(c => ({
        id: c.id,
        front: c.front,
        back: c.back,
        tags: c.tags || []
      }));
    } else {
      // For quiz/learning, create pseudo-flashcards
      return ((deck as QuizDeck | LearningDeck).questions || []).map(q => {
        const correct = q.options.find(o => o.id === q.correctAnswerId);
        return {
          id: q.id,
          front: q.questionText,
          back: `<strong>Answer:</strong> ${correct?.text || '?'}<br/><br/>${q.detailedExplanation || ''}`,
          tags: q.tags || []
        };
      });
    }
  }, [deck]);

  const handlePrint = () => {
    window.print();
  };

  const fontSizeClass = `text-[${1 * textSize}rem]`;
  const scaleStyle = { fontSize: `${textSize}em` };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col md:flex-row">
      {/* Settings Sidebar - Hidden on Print */}
      <aside className="w-full md:w-80 bg-surface border-b md:border-r border-border p-6 flex flex-col gap-6 print:hidden z-10 shadow-lg md:h-screen md:sticky md:top-0">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" onClick={() => navigate(`/decks/${deck.id}`)} className="-ml-2">
              <Icon name="chevron-left" /> Back
            </Button>
            <h2 className="font-bold text-lg">Print Settings</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Layout</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setLayout('table')}
                  className={`p-3 rounded-md border text-left flex items-center gap-3 transition-colors ${layout === 'table' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-background'}`}
                >
                  <Icon name="list" className="w-5 h-5" />
                  <div>
                    <div className="font-semibold text-sm">Study Sheet</div>
                    <div className="text-xs opacity-70">Compact list of Q&A</div>
                  </div>
                </button>
                <button
                  onClick={() => setLayout('cards-side')}
                  className={`p-3 rounded-md border text-left flex items-center gap-3 transition-colors ${layout === 'cards-side' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-background'}`}
                >
                  <Icon name="columns" className="w-5 h-5" />
                  <div>
                    <div className="font-semibold text-sm">Flashcards (Side-by-Side)</div>
                    <div className="text-xs opacity-70">Front and Back next to each other</div>
                  </div>
                </button>
                <button
                  onClick={() => setLayout('cards-fold')}
                  className={`p-3 rounded-md border text-left flex items-center gap-3 transition-colors ${layout === 'cards-fold' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-background'}`}
                >
                  <Icon name="layers" className="w-5 h-5" />
                  <div>
                    <div className="font-semibold text-sm">Flashcards (Foldable)</div>
                    <div className="text-xs opacity-70">Front above Back for folding</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Text Size: {Math.round(textSize * 100)}%</label>
              <input 
                type="range" 
                min="0.8" 
                max="1.5" 
                step="0.1" 
                value={textSize} 
                onChange={(e) => setTextSize(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} className="rounded text-primary focus:ring-primary" />
              <span className="text-sm">Show Tags</span>
            </label>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-border">
          <Button variant="primary" onClick={handlePrint} className="w-full py-3 text-lg shadow-md">
            <Icon name="printer" className="mr-2 w-5 h-5" /> Print / Save PDF
          </Button>
          <p className="text-xs text-text-muted text-center mt-3">
            Use your browser's print dialog to save as PDF.
          </p>
        </div>
      </aside>

      {/* Print Preview Area */}
      <main className="flex-grow p-8 bg-white text-black print:p-0 print:w-full">
        <div className="max-w-4xl mx-auto print:max-w-none print:mx-0">
          <div className="mb-8 border-b-2 border-black pb-4 print:mb-4">
            <h1 className="text-3xl font-bold">{deck.name}</h1>
            <p className="text-gray-600 mt-1">{deck.description?.replace(/<[^>]+>/g, '')}</p>
            <p className="text-sm text-gray-500 mt-2">Generated by CogniFlow • {items.length} items</p>
          </div>

          {/* Table Layout */}
          {layout === 'table' && (
            <div className="space-y-4 print:space-y-2">
              {items.map((item, index) => (
                <div key={item.id} className="flex flex-col sm:flex-row border-b border-gray-300 py-4 break-inside-avoid print:py-2" style={scaleStyle}>
                  <div className="w-full sm:w-1/3 pr-4 font-semibold print:w-1/3">
                    <DangerousHtmlRenderer html={item.front} />
                    {showTags && item.tags.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {item.tags.map(t => <span key={t} className="text-[0.7em] bg-gray-200 px-1 rounded">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="w-full sm:w-2/3 pl-0 sm:pl-4 mt-2 sm:mt-0 print:w-2/3 print:pl-4 print:mt-0">
                    <DangerousHtmlRenderer html={item.back} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Side-by-Side Cards Layout */}
          {layout === 'cards-side' && (
            <div className="grid grid-cols-1 gap-4 print:block">
              {items.map((item) => (
                <div key={item.id} className="flex border border-black break-inside-avoid mb-4 print:mb-2" style={{ pageBreakInside: 'avoid' }}>
                  <div className="w-1/2 p-4 border-r border-black flex flex-col justify-center items-center text-center min-h-[150px]" style={scaleStyle}>
                    <DangerousHtmlRenderer html={item.front} />
                    {showTags && item.tags.length > 0 && <p className="text-[0.6em] text-gray-500 mt-2">{item.tags.join(', ')}</p>}
                  </div>
                  <div className="w-1/2 p-4 flex flex-col justify-center items-center text-center min-h-[150px]" style={scaleStyle}>
                    <DangerousHtmlRenderer html={item.back} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Foldable Cards Layout */}
          {layout === 'cards-fold' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
              {items.map((item) => (
                <div key={item.id} className="border border-black break-inside-avoid flex flex-col" style={{ pageBreakInside: 'avoid' }}>
                  <div className="p-6 border-b border-black border-dashed flex-grow flex flex-col justify-center items-center text-center min-h-[180px]" style={scaleStyle}>
                    {/* Front is upside down for folding if user wants simple flip? Usually fold over vertical edge. 
                        Wait, standard fold-over horizontal: Top part is front (right side up), Bottom part is back (upside down) OR vice versa.
                        Let's keep both right-side up for a simple "fold in half" card. 
                    */}
                    <DangerousHtmlRenderer html={item.front} />
                    {showTags && item.tags.length > 0 && <p className="text-[0.6em] text-gray-500 mt-2">{item.tags.join(', ')}</p>}
                  </div>
                  <div className="p-6 flex-grow flex flex-col justify-center items-center text-center min-h-[180px]" style={scaleStyle}>
                    <DangerousHtmlRenderer html={item.back} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DeckPrintView;
