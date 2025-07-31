

import React from 'react';
import Icon from './ui/Icon';
import Button from './ui/Button';
import { useToast } from '../hooks/useToast';

const CodeBlock = ({ children }: { children: React.ReactNode }) => (
  <pre className="bg-gray-100 dark:bg-gray-900/70 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
    <code>{children}</code>
  </pre>
);

const JsonInstructionsPage: React.FC = () => {
  const { addToast } = useToast();

  const flashcardJson = `[
  {
    "front": "What is the capital of France?",
    "back": "Paris"
  },
  {
    "front": "What is H2O?",
    "back": "Water"
  }
]`;

  const quizJson = `{
  "name": "Sample Science Quiz",
  "description": "A few questions to test your basic science knowledge.",
  "questions": [
    {
      "questionType": "multipleChoice",
      "questionText": "Which planet is known as the Red Planet?",
      "tags": ["astronomy", "planets"],
      "detailedExplanation": "Mars is often called the Red Planet because of its reddish appearance, which is due to iron oxide (rust) on its surface.",
      "options": [
        {
          "id": "opt1",
          "text": "Venus"
        },
        {
          "id": "opt2",
          "text": "Mars"
        },
        {
          "id": "opt3",
          "text": "Jupiter",
          "explanation": "Jupiter is a gas giant, the largest planet in our solar system."
        }
      ],
      "correctAnswerId": "opt2"
    }
  ]
}`;

  const aiPrompt = `Please generate a JSON object for a multiple-choice quiz on the topic of [YOUR TOPIC HERE].

Follow these instructions exactly:
1.  Create exactly 5 high-quality questions on the specified topic.
2.  The content must be accurate and educational. For each question, provide one correct answer and several plausible but incorrect options (distractors).
3.  Provide clear and concise explanations for the correct answer.
4.  The final output must be ONLY the raw JSON object. Do not include any surrounding text, explanations, or markdown code fences like \`\`\`json.

**JSON Schema:**

The root object must contain:
- \`name\`: (string) The title of the deck.
- \`description\`: (string) A brief description of the deck's content.
- \`questions\`: (array) A list of question objects.

Each object within the \`questions\` array must contain:
- \`questionType\`: (string) Must be the exact value "multipleChoice".
- \`questionText\`: (string) The text of the question.
- \`tags\`: (array of strings) A list of 1-2 relevant lowercase keywords.
- \`detailedExplanation\`: (string) A thorough explanation of why the correct answer is correct.
- \`options\`: (array of option objects) Each object represents an answer and must contain:
    - \`id\`: (string) A unique identifier for the option (e.g., "q1-opt1").
    - \`text\`: (string) The answer text.
    - \`explanation\`: (string, optional) A short explanation for this specific option.
- \`correctAnswerId\`: (string) The \`id\` of the correct option from the \`options\` array.

**Important Rules:**
- Do NOT include \`id\` or other SRS fields (like \`dueDate\`, \`interval\`) on the main question objects; they are generated automatically by the app.
- Ensure every \`correctAnswerId\` perfectly matches one of the \`id\`s within its corresponding \`options\` array.
- The output must be a single, raw JSON object starting with \`{\` and ending with \`}\`.

Now, generate the complete JSON deck for the topic: [YOUR TOPIC HERE]`;

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast('Prompt copied to clipboard!', 'success');
    }).catch(err => {
      addToast('Failed to copy prompt.', 'error');
      console.error('Could not copy text: ', err);
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-10 pb-10">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">JSON Import Guide</h1>
        <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
          Follow these formats to import your own decks using JSON. You can import either simple flashcards or more complex quiz decks.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">Format 1: Simple Flashcard Deck</h2>
        <p className="text-gray-600 dark:text-gray-400">
          For basic front-and-back flashcards, provide a JSON array. Each object in the array must have a <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">front</code> and a <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">back</code> key, both with string values.
        </p>
        <CodeBlock>{flashcardJson}</CodeBlock>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">Format 2: Quiz Deck</h2>
        <p className="text-gray-600 dark:text-gray-400">
          For multiple-choice quizzes, provide a single JSON object with the following structure:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 pl-4">
          <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">name</code>: (String) The title of your quiz deck.</li>
          <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">description</code>: (String) A brief summary of the deck's content.</li>
          <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">questions</code>: (Array) A list of question objects.</li>
        </ul>
        <p className="text-gray-600 dark:text-gray-400">Each question object within the array must contain:</p>
         <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 pl-4">
            <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">questionType</code>: (String) Must be exactly "multipleChoice".</li>
            <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">questionText</code>: (String) The question itself.</li>
            <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">options</code>: (Array) A list of possible answers. Each option object needs a unique <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">id</code> and the answer <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">text</code>. An optional <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">explanation</code> can be added.</li>
            <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">correctAnswerId</code>: (String) The <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">id</code> of the correct option.</li>
            <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">detailedExplanation</code>: (String) An explanation shown after you answer.</li>
            <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm">tags</code>: (Array of Strings) Tags to categorize the question.</li>
        </ul>
        <CodeBlock>{quizJson}</CodeBlock>
      </section>
      
      <section className="space-y-4 bg-blue-900/10 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-500/20">
        <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-300">Generate a Quiz Deck with AI</h2>
        <p className="text-blue-700/90 dark:text-blue-300/90">
          You can use an AI chat service (like ChatGPT, Claude, Gemini, etc.) to quickly generate quiz content. Copy the prompt below, replace the placeholder, and paste it into the chat. The AI should provide a valid JSON object that you can paste directly into the import field.
        </p>
        <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
          <strong>Note:</strong> Always double-check AI-generated content for accuracy.
        </p>
        <div className="relative">
            <CodeBlock>{aiPrompt}</CodeBlock>
            <Button
              variant="secondary"
              className="absolute top-2 right-2 px-2 py-1 text-xs"
              onClick={() => handleCopyToClipboard(aiPrompt)}
            >
              <Icon name="download" className="w-4 h-4 mr-1" />
              Copy Prompt
            </Button>
        </div>
      </section>

    </div>
  );
};

export default JsonInstructionsPage;