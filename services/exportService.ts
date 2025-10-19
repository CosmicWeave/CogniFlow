
import { Deck, DeckSeries, DeckType, FlashcardDeck, QuizDeck, ImportedCard, ImportedQuizDeck, LearningDeck } from '../types';

function triggerDownload(jsonString: string, filename: string) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9 -]/gi, '_').replace(/\s+/g, '-').toLowerCase().substring(0, 30);
}

export const exportDeck = (deck: Deck): void => {
    let exportData: any;
    const filename = `cogniflow-deck-${sanitizeFilename(deck.name)}.json`;

    if (deck.type === DeckType.Flashcard) {
        const flashcardDeck = deck as FlashcardDeck;
        const importedCards: ImportedCard[] = (flashcardDeck.cards || []).map(card => ({
            front: card.front,
            back: card.back,
        }));
        exportData = importedCards;
    } else if (deck.type === DeckType.Quiz || deck.type === DeckType.Learning) {
        const quizDeck = deck as QuizDeck | LearningDeck;
        const importedQuizDeck: ImportedQuizDeck = {
            name: quizDeck.name,
            description: quizDeck.description,
            questions: (quizDeck.questions || []).map(q => ({
                questionType: q.questionType,
                questionText: q.questionText,
                options: (q.options || []).map(o => ({ id: o.id, text: o.text, explanation: o.explanation })),
                correctAnswerId: q.correctAnswerId,
                detailedExplanation: q.detailedExplanation,
                tags: q.tags,
            })),
        };
        exportData = importedQuizDeck;
    } else {
        throw new Error(`Unsupported deck type for export: ${(deck as any).type}`);
    }
    
    const jsonString = JSON.stringify(exportData, null, 2);
    triggerDownload(jsonString, filename);
};

export const exportSeries = (series: DeckSeries, allDecks: Deck[]): void => {
    const seriesDecks = new Map<string, Deck>();
    const allSeriesDeckIds = new Set((series.levels || []).flatMap(level => level?.deckIds || []));
    allDecks.forEach(deck => {
        if (allSeriesDeckIds.has(deck.id)) {
            seriesDecks.set(deck.id, deck);
        }
    });

    const exportableLevels = (series.levels || []).map(level => {
        const levelDecks = (level.deckIds || [])
            .map(deckId => seriesDecks.get(deckId))
            .filter((deck): deck is Deck => !!deck)
            .map(deck => {
                if (deck.type === DeckType.Flashcard) {
                    const flashcardDeck = deck as FlashcardDeck;
                    return {
                        type: DeckType.Flashcard,
                        name: flashcardDeck.name,
                        description: flashcardDeck.description,
                        cards: (flashcardDeck.cards || []).map(card => ({
                            front: card.front,
                            back: card.back,
                        })),
                    };
                } else if (deck.type === DeckType.Quiz || deck.type === DeckType.Learning) {
                    const quizDeck = deck as QuizDeck | LearningDeck;
                    return {
                        type: DeckType.Quiz, // Treat Learning as Quiz for export simplicity
                        name: quizDeck.name,
                        description: quizDeck.description,
                        questions: (quizDeck.questions || []).map(q => ({
                            questionType: q.questionType,
                            questionText: q.questionText,
                            options: (q.options || []).map(o => ({ id: o.id, text: o.text, explanation: o.explanation })),
                            correctAnswerId: q.correctAnswerId,
                            detailedExplanation: q.detailedExplanation,
                            tags: q.tags,
                        })),
                    };
                }
                return null;
            }).filter(Boolean);

        return {
            title: level.title,
            decks: levelDecks,
        };
    });
    
    const exportData = {
        seriesName: series.name,
        seriesDescription: series.description,
        levels: exportableLevels,
    };
    
    const filename = `cogniflow-series-${sanitizeFilename(series.name)}.json`;
    const jsonString = JSON.stringify(exportData, null, 2);
    triggerDownload(jsonString, filename);
};
