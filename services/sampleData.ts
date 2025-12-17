
import { QuizDeck, DeckType, Question, DeckSeries, FlashcardDeck, LearningDeck, InfoCard } from '../types.ts';
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
        name: 'Level 1.1: Simple Addition',
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
        name: 'Level 1.2: Simple Subtraction',
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
        name: 'Level 2.1: Simple Multiplication',
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
        levels: [
            {
                title: 'Level 1: Fundamentals',
                deckIds: [additionDeck.id, subtractionDeck.id]
            },
            {
                title: 'Level 2: Next Steps',
                deckIds: [multiplicationDeck.id]
            }
        ],
        createdAt: new Date().toISOString(),
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

export const createSampleFlashcardDeck = (): FlashcardDeck => {
    return {
        id: crypto.randomUUID(),
        name: 'Sample: Spanish Basics',
        description: 'Common Spanish words and phrases.',
        type: DeckType.Flashcard,
        cards: [
            { id: crypto.randomUUID(), front: 'Hola', back: 'Hello', dueDate: new Date().toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR, masteryLevel: 0, lapses: 0 },
            { id: crypto.randomUUID(), front: 'Gracias', back: 'Thank you', dueDate: new Date().toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR, masteryLevel: 0, lapses: 0 },
            { id: crypto.randomUUID(), front: 'Por favor', back: 'Please', dueDate: new Date().toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR, masteryLevel: 0, lapses: 0 },
            { id: crypto.randomUUID(), front: 'Buenos días', back: 'Good morning', dueDate: new Date().toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR, masteryLevel: 0, lapses: 0 },
            { id: crypto.randomUUID(), front: 'Amigo', back: 'Friend', dueDate: new Date().toISOString(), interval: 0, easeFactor: INITIAL_EASE_FACTOR, masteryLevel: 0, lapses: 0 },
        ],
        lastOpened: new Date().toISOString(),
    };
};

export const createSampleLearningDeck = (): LearningDeck => {
    const infoCardId1 = crypto.randomUUID();
    const infoCardId2 = crypto.randomUUID();
    const q1Id = crypto.randomUUID();
    const q2Id = crypto.randomUUID();

    const infoCards: InfoCard[] = [
        {
            id: infoCardId1,
            content: '<h3>The Water Cycle: Evaporation</h3><p><b>Evaporation</b> is the process by which water changes from a liquid to a gas or vapor. The sun provides the energy that drives the water cycle, heating water in oceans and lakes.</p>',
            unlocksQuestionIds: [q1Id]
        },
        {
            id: infoCardId2,
            content: '<h3>The Water Cycle: Condensation</h3><p><b>Condensation</b> is the process by which water vapor in the air is changed into liquid water. Condensation is crucial to the water cycle because it is responsible for the formation of clouds.</p>',
            unlocksQuestionIds: [q2Id]
        }
    ];

    const questions: Question[] = [
        {
            id: q1Id,
            questionType: 'multipleChoice',
            questionText: 'What provides the energy for evaporation?',
            options: [
                { id: crypto.randomUUID(), text: 'The Sun', explanation: 'Correct! Solar energy heats the water.' },
                { id: crypto.randomUUID(), text: 'The Wind', explanation: 'Wind helps move vapor, but the Sun provides the heat energy.' },
                { id: crypto.randomUUID(), text: 'The Moon', explanation: 'The Moon affects tides, not evaporation.' }
            ],
            correctAnswerId: '', // Filled below
            detailedExplanation: 'The sun heats the water, causing water molecules to move faster and escape as vapor.',
            dueDate: new Date().toISOString(),
            interval: 0,
            easeFactor: INITIAL_EASE_FACTOR,
            suspended: false,
            masteryLevel: 0,
            lapses: 0,
            infoCardIds: [infoCardId1]
        },
        {
            id: q2Id,
            questionType: 'multipleChoice',
            questionText: 'What forms when water vapor condenses?',
            options: [
                { id: crypto.randomUUID(), text: 'Clouds', explanation: 'Correct! Clouds are made of tiny liquid water droplets.' },
                { id: crypto.randomUUID(), text: 'Wind', explanation: 'Wind is moving air.' },
                { id: crypto.randomUUID(), text: 'Light', explanation: 'Light is energy.' }
            ],
            correctAnswerId: '', // Filled below
            detailedExplanation: 'As water vapor cools higher in the atmosphere, it condenses into tiny droplets that form clouds.',
            dueDate: new Date().toISOString(),
            interval: 0,
            easeFactor: INITIAL_EASE_FACTOR,
            suspended: false,
            masteryLevel: 0,
            lapses: 0,
            infoCardIds: [infoCardId2]
        }
    ];
    
    // Fix correct IDs
    questions[0].correctAnswerId = questions[0].options[0].id;
    questions[1].correctAnswerId = questions[1].options[0].id;

    return {
        id: crypto.randomUUID(),
        name: 'Sample: The Water Cycle',
        description: 'A guided learning deck explaining how water moves around the Earth.',
        type: DeckType.Learning,
        infoCards,
        questions,
        lastOpened: new Date().toISOString(),
    };
};

export const createSampleCourse = (): LearningDeck => {
    const infoId1 = crypto.randomUUID();
    const infoId2 = crypto.randomUUID();
    const q1Id = crypto.randomUUID();
    const q2Id = crypto.randomUUID();

    const infoCards: InfoCard[] = [
        {
            id: infoId1,
            content: '<h3>Digital Photography: The Exposure Triangle</h3><p>Exposure is determined by three key elements, often called the "Exposure Triangle":</p><ul><li><b>Aperture:</b> The size of the lens opening (f-stop). Controls depth of field.</li><li><b>Shutter Speed:</b> How long the sensor is exposed to light. Controls motion blur.</li><li><b>ISO:</b> The sensor\'s sensitivity to light. Controls digital noise.</li></ul><p>Balancing these three is the key to a properly exposed image.</p>',
            unlocksQuestionIds: [q1Id]
        },
        {
            id: infoId2,
            content: '<h3>Digital Photography: Composition</h3><p>Good composition guides the viewer\'s eye. One of the most fundamental rules is the <b>Rule of Thirds</b>.</p><p>Imagine breaking an image down into thirds (both horizontally and vertically) so that you have 9 parts. The rule suggests that you should place key elements of your scene along these lines or at their intersections.</p>',
            unlocksQuestionIds: [q2Id]
        }
    ];

    const questions: Question[] = [
        {
            id: q1Id,
            questionType: 'multipleChoice',
            questionText: 'Which element of the exposure triangle primarily controls depth of field (how much of the scene is in focus)?',
            options: [
                { id: crypto.randomUUID(), text: 'ISO', explanation: 'ISO controls sensitivity and noise.' },
                { id: crypto.randomUUID(), text: 'Shutter Speed', explanation: 'Shutter speed controls motion blur.' },
                { id: crypto.randomUUID(), text: 'Aperture', explanation: 'Correct! A wide aperture (low f-number) creates a shallow depth of field.' }
            ],
            correctAnswerId: '', // Filled below
            detailedExplanation: 'Aperture refers to the opening of the lens\'s diaphragm through which light travels. Large openings (small f-numbers) create a shallow depth of field (blurry background), while small openings (large f-numbers) keep more in focus.',
            dueDate: new Date().toISOString(),
            interval: 0,
            easeFactor: INITIAL_EASE_FACTOR,
            suspended: false,
            masteryLevel: 0,
            lapses: 0,
            infoCardIds: [infoId1]
        },
        {
            id: q2Id,
            questionType: 'multipleChoice',
            questionText: 'According to the Rule of Thirds, where is the best place to put your main subject?',
            options: [
                { id: crypto.randomUUID(), text: 'Dead center', explanation: 'Centering is valid but can be static. The Rule of Thirds suggests off-center placement.' },
                { id: crypto.randomUUID(), text: 'At the intersections of the grid lines', explanation: 'Correct! These "power points" create a more balanced and interesting image.' },
                { id: crypto.randomUUID(), text: 'In the extreme corner', explanation: 'This can make the subject feel like it is falling out of the frame.' }
            ],
            correctAnswerId: '', // Filled below
            detailedExplanation: 'The Rule of Thirds grid creates four intersection points. Placing your subject on one of these points generally creates a more energetic and interesting composition than simply centering the subject.',
            dueDate: new Date().toISOString(),
            interval: 0,
            easeFactor: INITIAL_EASE_FACTOR,
            suspended: false,
            masteryLevel: 0,
            lapses: 0,
            infoCardIds: [infoId2]
        }
    ];
    
    questions[0].correctAnswerId = questions[0].options[2].id;
    questions[1].correctAnswerId = questions[1].options[1].id;

    return {
        id: crypto.randomUUID(),
        name: 'Sample Course: Photography Basics',
        description: 'A mini-course covering exposure and composition fundamentals.',
        type: DeckType.Learning,
        infoCards,
        questions,
        lastOpened: new Date().toISOString(),
    };
};
