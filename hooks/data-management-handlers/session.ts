
import { useCallback, useMemo } from 'react';
import { Deck, Reviewable, QuizDeck, DeckType, FlashcardDeck, LearningDeck, ReviewRating, ReviewLog } from '../../types';
import * as db from '../../services/db';
import { useStore } from '../../store/store';
import { resetReviewable } from '../../services/srs';
import { useToast } from '../useToast';
import { useRouter } from '../../contexts/RouterContext';

export const useSessionHandlers = ({ sessionsToResume, setSessionsToResume, setGeneralStudyDeck, handleUpdateDeck }: any) => {
  const { navigate } = useRouter();
  const { dispatch } = useStore();
  const { addToast } = useToast();

  const handleSessionEnd = useCallback(async (deckId: string, seriesId?: string) => {
    const sessionKey = `session_deck_${deckId}`;
    if (sessionsToResume.has(deckId)) {
        const newSessions = new Set(sessionsToResume);
        newSessions.delete(deckId);
        setSessionsToResume(newSessions);
    }
    try {
        await db.deleteSessionState(sessionKey);
    } catch (e) {
        console.error(`Failed to clean up session state for ${sessionKey} from DB`, e);
    }
    if (deckId === 'general-study-deck') setGeneralStudyDeck(null);
    navigate(seriesId ? `/series/${seriesId}` : '/');
  }, [navigate, sessionsToResume, setSessionsToResume, setGeneralStudyDeck]);

  const handleStudyNextDeckInSeries = useCallback(async (deckId: string, seriesId: string, nextDeckId: string) => {
    const sessionKey = `session_deck_${deckId}`;
    if (sessionsToResume.has(deckId)) {
        const newSessions = new Set(sessionsToResume);
        newSessions.delete(deckId);
        setSessionsToResume(newSessions);
    }
    try {
        await db.deleteSessionState(sessionKey);
    } catch (e) {
        console.error(`Failed to clean up session state for ${sessionKey} from DB`, e);
    }
    if (deckId === 'general-study-deck') setGeneralStudyDeck(null);
    navigate(`/decks/${nextDeckId}/study?seriesId=${seriesId}`);
  }, [navigate, sessionsToResume, setSessionsToResume, setGeneralStudyDeck]);

  const handleItemReviewed = useCallback(async (deckId: string, reviewedItem: Reviewable, rating: ReviewRating | null, seriesId?: string) => {
    const { decks, deckSeries, seriesProgress } = useStore.getState();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;

    let newDeck: Deck;
    const { id, dueDate, interval, easeFactor, suspended, masteryLevel, lastReviewed, lapses } = reviewedItem;
    const srsUpdates = { dueDate, interval, easeFactor, suspended, masteryLevel, lastReviewed, lapses };
    if (deck.type === DeckType.Flashcard) newDeck = { ...deck, cards: ((deck as FlashcardDeck).cards || []).map(c => c.id === id ? { ...c, ...srsUpdates } : c) };
    else if (deck.type === DeckType.Learning) newDeck = { ...deck, questions: ((deck as LearningDeck).questions || []).map(q => q.id === id ? { ...q, ...srsUpdates } : q) };
    else newDeck = { ...deck, questions: ((deck as QuizDeck | LearningDeck).questions || []).map(q => q.id === id ? { ...q, ...srsUpdates } : q) };
    await handleUpdateDeck(newDeck, { silent: true });

    try {
        const reviewLog: ReviewLog = {
            itemId: reviewedItem.id, deckId: deckId, seriesId: seriesId, timestamp: new Date().toISOString(),
            rating: rating, newInterval: reviewedItem.interval, easeFactor: reviewedItem.easeFactor, masteryLevel: reviewedItem.masteryLevel || 0,
        };
        await db.addReviewLog(reviewLog);
    } catch (e) { console.error("Failed to log review:", e); }

    if (seriesId) {
        const updatedDeckFromState = newDeck;
        const items = ('cards' in updatedDeckFromState ? (updatedDeckFromState as FlashcardDeck).cards : (updatedDeckFromState as QuizDeck | LearningDeck).questions);
        const hasNewItems = Array.isArray(items) && items.some(item => !item.suspended && item.interval === 0);
        const isAlreadyCompleted = (seriesProgress.get(seriesId) || new Set()).has(deckId);
        if (!hasNewItems && !isAlreadyCompleted && items?.length > 0) {
            const newProgress = new Map(seriesProgress);
            const progressValue = newProgress.get(seriesId);
            const currentSeriesProgress = new Set(progressValue instanceof Set ? progressValue : []);
            currentSeriesProgress.add(deckId);
            newProgress.set(seriesId, currentSeriesProgress);
            try {
                await db.saveSeriesProgress(seriesId, currentSeriesProgress);
                const series = deckSeries.find(s => s.id === seriesId);
                const flatDeckIds = (series?.levels || []).flatMap(l => l?.deckIds || []);
                const isLastDeckInSeries = flatDeckIds.indexOf(deckId) === flatDeckIds.length - 1;
                if (isLastDeckInSeries && flatDeckIds.length > 0) addToast(`Congratulations! You've completed the series: "${series?.name}"!`, 'success');
                else addToast(`Deck "${updatedDeckFromState.name}" completed! Next chapter unlocked.`, 'success');
                dispatch({ type: 'SET_SERIES_PROGRESS', payload: newProgress });
            } catch (e) { console.error("Could not save series progress", e); }
        }
    }
  }, [handleUpdateDeck, addToast, dispatch]);

  const handleResetDeckProgress = useCallback(async (deckId: string) => {
    const deckToReset = useStore.getState().decks.find(d => d.id === deckId);
    if (!deckToReset) return;
    let updatedDeck: Deck;
    if (deckToReset.type === DeckType.Flashcard) updatedDeck = { ...deckToReset, cards: ((deckToReset as FlashcardDeck).cards || []).map(c => resetReviewable(c)) };
    else updatedDeck = { ...deckToReset, questions: ((deckToReset as QuizDeck | LearningDeck).questions || []).map(q => resetReviewable(q)) };
    await handleUpdateDeck(updatedDeck, { toastMessage: `Progress for deck "${updatedDeck.name}" has been reset.`});
  }, [handleUpdateDeck]);
  
  const handleStartGeneralStudy = useCallback(() => {
    const { decks, deckSeries, seriesProgress } = useStore.getState();
    const seriesDeckIds = new Set<string>();
    deckSeries.forEach(series => ((series.levels || []).filter(Boolean)).forEach(level => (level.deckIds || []).forEach(deckId => seriesDeckIds.add(deckId))));
    const unlockedSeriesDeckIds = new Set<string>();
    deckSeries.forEach(series => {
        if (!series.archived && !series.deletedAt) {
            const completedCount = seriesProgress.get(series.id)?.size || 0;
            let deckCount = 0;
            ((series.levels || []).filter(Boolean)).forEach(level => {
                (level.deckIds || []).forEach((deckId) => {
                    if (deckCount <= completedCount) unlockedSeriesDeckIds.add(deckId);
                    deckCount++;
                });
            });
        }
    });
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const allDueQuestions = decks
      .filter((deck): deck is QuizDeck => {
        if (deck.type !== DeckType.Quiz || deck.archived || deck.deletedAt) return false;
        if (seriesDeckIds.has(deck.id) && !unlockedSeriesDeckIds.has(deck.id)) return false;
        return true;
      })
      .flatMap(deck => 
        (deck.questions || [])
          .filter(q => !q.suspended && new Date(q.dueDate) <= today)
          .map(q => ({ ...q, originalDeckId: deck.id, originalDeckName: deck.name }))
      )
      .sort(() => Math.random() - 0.5);
    const virtualDeck: QuizDeck = {
      id: 'general-study-deck',
      name: 'General Study Session',
      description: 'A mix of all due questions.',
      type: DeckType.Quiz,
      questions: allDueQuestions
    };
    setGeneralStudyDeck(virtualDeck);
    navigate('/study/general');
  }, [navigate, setGeneralStudyDeck]);

  const handleStartSeriesStudy = useCallback(async (seriesId: string) => {
    const { decks, deckSeries, seriesProgress } = useStore.getState();
    const series = deckSeries.find(s => s.id === seriesId);
    if (!series) return;
    const unlockedSeriesDeckIds = new Set<string>();
    const completedCount = seriesProgress.get(series.id)?.size || 0;
    let deckCount = 0;
    ((series.levels || []).filter(Boolean)).forEach(level => {
        (level.deckIds || []).forEach(deckId => {
            if (deckCount <= completedCount) unlockedSeriesDeckIds.add(deckId);
            deckCount++;
        });
    });
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const seriesDecks = ((series.levels || []).filter(Boolean)).flatMap(l => l.deckIds || []).map(id => decks.find(d => d.id === id)).filter((d): d is QuizDeck | LearningDeck => !!(d && (d.type === DeckType.Quiz || d.type === DeckType.Learning)));
    const allDueQuestions = seriesDecks
      .filter(deck => unlockedSeriesDeckIds.has(deck.id))
      .flatMap(deck => 
        (deck.questions || [])
          .filter(q => !q.suspended && new Date(q.dueDate) <= today)
          .map(q => ({ ...q, originalDeckId: deck.id, originalDeckName: deck.name }))
      )
      .sort(() => Math.random() - 0.5);
    const virtualDeck: QuizDeck = {
      id: 'general-study-deck',
      name: `${series.name} - Study Session`,
      description: `A study session for due items in the series: ${series.name}`,
      type: DeckType.Quiz,
      questions: allDueQuestions
    };
    setGeneralStudyDeck(virtualDeck);
    navigate(`/study/general?seriesId=${seriesId}`);
  }, [navigate, setGeneralStudyDeck]);
  
  return useMemo(() => ({
    handleSessionEnd,
    handleStudyNextDeckInSeries,
    handleItemReviewed,
    handleResetDeckProgress,
    handleStartGeneralStudy,
    handleStartSeriesStudy,
  }), [handleSessionEnd, handleStudyNextDeckInSeries, handleItemReviewed, handleResetDeckProgress, handleStartGeneralStudy, handleStartSeriesStudy]);
};
