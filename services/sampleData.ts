import { QuizDeck, DeckType, Question, DeckSeries } from '../types';
import { INITIAL_EASE_FACTOR } from '../constants';

const createQuestion = (
    text: string, 
    optionsWithCorrect: { text: string; correct?: boolean; explanation?: string }[], 
    explanation: string
): Question => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const questionOptions = optionsWithCorrect.map(o => ({ 
        id: crypto.randomUUID(), 
        text: o.text, 
        explanation: o.explanation 
    }));
    
    const correctOption = questionOptions[optionsWithCorrect.findIndex(o => o.correct)];

    if (!correctOption) {
        throw new Error(`No correct option specified for question: "${text}"`);
    }

    return {
        id: crypto.randomUUID(),
        questionType: 'multipleChoice',
        questionText: text,
        tags: ['nature', 'sample'],
        detailedExplanation: explanation,
        options: questionOptions,
        correctAnswerId: correctOption.id,
        dueDate: today.toISOString(),
        interval: 0,
        easeFactor: INITIAL_EASE_FACTOR,
        suspended: false,
        masteryLevel: 0,
        lastReviewed: undefined,
    };
};

export const createSampleSeries = (): { series: DeckSeries, decks: QuizDeck[] } => {
    // Deck 1: Addition
    const additionDeck: QuizDeck = {
        id: crypto.randomUUID(),
        name: 'Chapter 1: Simple Addition',
        description: 'Practice basic addition problems.',
        type: DeckType.Quiz,
        questions: [
            createQuestion('What is 1 + 1?', [{text: '2', correct: true}, {text: '1'}, {text: '3'}], '1 plus 1 equals 2.'),
            createQuestion('What is 2 + 3?', [{text: '5', correct: true}, {text: '4'}, {text: '6'}], '2 plus 3 equals 5.'),
            createQuestion('What is 5 + 4?', [{text: '9', correct: true}, {text: '8'}, {text: '10'}], '5 plus 4 equals 9.'),
        ],
    };

    // Deck 2: Subtraction
    const subtractionDeck: QuizDeck = {
        id: crypto.randomUUID(),
        name: 'Chapter 2: Simple Subtraction',
        description: 'Practice basic subtraction problems.',
        type: DeckType.Quiz,
        questions: [
            createQuestion('What is 5 - 2?', [{text: '3', correct: true}, {text: '2'}, {text: '4'}], '5 minus 2 equals 3.'),
            createQuestion('What is 10 - 4?', [{text: '6', correct: true}, {text: '5'}, {text: '7'}], '10 minus 4 equals 6.'),
        ],
    };
    
    // Deck 3: Multiplication
    const multiplicationDeck: QuizDeck = {
        id: crypto.randomUUID(),
        name: 'Chapter 3: Simple Multiplication',
        description: 'Practice basic multiplication problems.',
        type: DeckType.Quiz,
        questions: [
            createQuestion('What is 2 * 3?', [{text: '6', correct: true}, {text: '5'}, {text: '8'}], '2 times 3 is 6.'),
            createQuestion('What is 4 * 5?', [{text: '20', correct: true}, {text: '15'}, {text: '25'}], '4 times 5 is 20.'),
        ],
    };

    const decks = [additionDeck, subtractionDeck, multiplicationDeck];

    // The Series
    const series: DeckSeries = {
        id: crypto.randomUUID(),
        type: 'series',
        name: 'Sample: Basic Math Series',
        description: 'A sample series to demonstrate the progressive learning path feature. Complete each deck to unlock the next!',
        deckIds: decks.map(d => d.id)
    };
    
    return { series, decks };
};

export const createNatureSampleDeck = (): QuizDeck => {
    const sampleQuestions: Question[] = [
        createQuestion(
            'Which process allows plants to convert light energy into chemical energy?',
            [
                { text: 'Respiration' },
                { text: 'Photosynthesis', correct: true },
                { text: 'Transpiration' },
                { text: 'Germination' },
            ],
            'Photosynthesis is the vital process used by plants, algae, and certain bacteria to harness energy from sunlight and turn it into chemical energy in the form of glucose.'
        ),
        createQuestion(
            'What is the largest rainforest in the world?',
            [
                { text: 'The Congo Rainforest' },
                { text: 'The Valdivian Temperate Rainforest' },
                { text: 'The Daintree Rainforest' },
                { text: 'The Amazon Rainforest', correct: true },
            ],
            'The Amazon Rainforest is the world\'s largest tropical rainforest, famed for its biodiversity. It spans across nine countries in South America.'
        ),
        createQuestion(
            'What type of rock is formed from the cooling and solidification of magma or lava?',
            [
                { text: 'Igneous Rock', correct: true },
                { text: 'Sedimentary Rock' },
                { text: 'Metamorphic Rock' },
                { text: 'Sandstone' },
            ],
            'Igneous rock is formed through the cooling and solidification of magma (molten rock below the surface) or lava (molten rock on the surface). Examples include granite and basalt.'
        ),
         createQuestion(
            'Which layer of the Earth\'s atmosphere is closest to the surface?',
            [
                { text: 'Stratosphere' },
                { text: 'Mesosphere' },
                { text: 'Troposphere', correct: true },
                { text: 'Thermosphere' },
            ],
            'The Troposphere is the lowest layer of Earth\'s atmosphere, and is also where nearly all weather conditions take place. It contains about 75% of the atmosphere\'s mass.'
        ),
        createQuestion(
            'What is the name for the process of water movement through a plant and its evaporation from aerial parts, such as leaves, stems and flowers?',
            [
                { text: 'Condensation' },
                { text: 'Precipitation' },
                { text: 'Transpiration', correct: true },
                { text: 'Photosynthesis' },
            ],
            'Transpiration is essentially evaporation of water from plant leaves. It is a key part of the water cycle, and an important process in plant life.'
        ),
    ];

    return {
        id: crypto.randomUUID(),
        name: 'Sample: Wonders of Nature',
        description: 'A sample quiz deck to introduce you to CogniFlow. Test your knowledge about the natural world!',
        type: DeckType.Quiz,
        questions: sampleQuestions,
        lastOpened: new Date().toISOString(),
    };
};