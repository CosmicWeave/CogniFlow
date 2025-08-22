# AI Content Generation Reference for CogniFlow

This document provides a set of expert-led prompts and best practices for generating high-quality learning content for CogniFlow using external AI tools like Google's Gemini, OpenAI's ChatGPT, or Anthropic's Claude.

**Core Philosophy:** CogniFlow is a focused learning tool. It does *not* have a built-in AI. This ensures your study environment remains private, fast, and distraction-free. You use these prompts with your preferred external AI service and then import the generated content.

## 🏆 The Expert-Led Workflow (Recommended)

For the best results, we strongly recommend a two-step process. This allows you to guide the AI and review the structure of your learning path before committing to full content generation.

### Step 1: Generate a Learning Path Outline (Plain Text)

First, generate a human-readable outline. This lets you check the structure, topics, and progression without dealing with complex JSON.

**The Prompt:**
Use this prompt with your AI chat service. Fill in the `[YOUR TOPIC HERE]` and `[USER'S LEVEL HERE]` fields.

```
Please act as a world-class instructional designer and subject matter expert. Your task is to generate a comprehensive, detailed, and world-class TEXT outline for a learning path. The output must be plain text, not a JSON object.

**Topic:** [YOUR TOPIC HERE]
**User's Current Level:** [USER'S LEVEL HERE]

The goal is to create a structured and progressive learning path that guides the user towards mastery, similar in quality and detail to the provided example structure.

**INSTRUCTIONS & REQUIREMENTS:**

1.  **Learning Path Structure:**
    -   Organize the learning path into logical "Levels" (e.g., Level 1, Level 2, up to Level 4 or 5). Each level must have a title and represent a significant step up in knowledge.
    -   Each Level should contain one or more related "Decks".
    -   The name of each deck must reflect this structure, e.g., "Level 1.1: Foundations of X", "Level 1.2: Core Concepts of Y", "Level 2.1: Advanced Techniques in Z".

2.  **High-Quality Content (Crucial):**
    -   **Series Name & Description:** Create a compelling and descriptive name (e.g., "Topic Mastery Path: The Contextual Approach") and a comprehensive summary for the entire learning path.
    -   **Level Goal & Focus:** For each Level, provide a clear "Goal" and "Focus".
    -   **Deck Topics:** For each Deck, provide a detailed, itemized list of specific "Topics" to be covered.
    -   **Progressive Difficulty:** The path must be logically sequenced, starting with foundational definitions and historical context, moving to practical applications, then to assessment and planning, and finally to interdisciplinary challenges.
    -   **Context-Specific:** If the user's topic has a specific context (e.g., a geographical location, a particular framework), embed that context deeply into the entire outline.
    -   **Approximate Question Count:** Suggest an approximate number of questions for each deck.

**EXAMPLE STRUCTURE:**
Ecological Sustainable Forestry Mastery Path: The Scanian Approach
This learning path provides a deep understanding of...
Level 1: Core Principles & Historical Context in Skåne
Goal: Define ecological sustainable forestry...
Focus: Shifting from purely extractive forestry...
Level 1.1: Foundations of Sustainable Forest Management (SFM) in Skåne
Topics: Definitional evolution of forestry...
Approx. Questions: 30-40

---

Now, based on all the above requirements, generate the complete text outline.

Finally, at the very end of your response, provide a JSON object with the series name and description you created, like this:
{
  "seriesName": "The full series name you generated above",
  "seriesDescription": "The full series description you generated above"
}
```

### Step 2: Generate JSON for Each Deck Individually

Once you are happy with the text outline, generate the JSON for each deck one at a time. This makes the process manageable and allows you to review content as you go.

**The Prompt:**
First, paste your entire text outline into the AI chat. Then, use this prompt to generate the JSON for the *first* deck.

```
You are an expert content creator. I have provided a text outline for a learning path. Your task is to generate the JSON for the **first deck (e.g., Level 1.1)** from that outline.

**PRIMARY INSTRUCTIONS:**

1.  **Source Material:** Use ONLY the text outline I've provided as your source.
2.  **Question Quantity:** Generate the approximate number of questions specified in the outline for this first deck.
3.  **Content Generation:** Create world-class questions and answers based *only* on the "Topics" listed for this specific deck in the outline.

**CRITICAL CONTENT QUALITY REQUIREMENTS:**
- **Factual Accuracy:** This is paramount. The correct answer and all parts of the explanation must be unequivocally correct and verifiable.
- **Relevance & Practical Application:** Frame questions in real-world scenarios to help a user apply the information. Questions must be relevant to the deck's topics.
- **Clarity & Simplicity:** Questions must be easy to understand, unambiguous, and free of jargon (unless the jargon is the learning objective). Test only one core concept per question.
- **Problem-Solving Focus:** Design questions that require applying knowledge, not just recalling facts. Avoid trivial pursuit and focus on genuinely useful information. For practical topics, ask skill-based questions that test the ability to perform a task or make a decision.
- **High-Quality Explanations:** The `detailedExplanation` is crucial. It must explain the reasoning, principles, or facts behind the correct answer. Provide additional context, examples, or connections to related concepts to deepen understanding. If applicable, cite sources for complex information.
- **Engaging Content:** While factual, make the questions and explanations as engaging as possible to maintain learner interest.

**JSON OUTPUT FORMAT:**
- The final output MUST be ONLY a single, raw JSON object, starting with `{` and ending with `}`. Do not include any surrounding text, explanations, or markdown formatting.
- The JSON object must follow this exact schema:
{
  "name": "The exact name for the deck from your outline, e.g., 'Level 1.1: Foundations...'",
  "description": "A concise description of this specific deck's content, based on its topics.",
  "questions": [
    {
      "questionType": "multipleChoice",
      "questionText": "The text of the first question...",
      "tags": ["relevant", "tags"],
      "detailedExplanation": "A thorough explanation that meets all quality requirements.",
      "options": [
        { "id": "q1_opt1", "text": "First answer option" },
        { "id": "q1_opt2", "text": "Second answer option" }
      ],
      "correctAnswerId": "q1_opt2"
    }
  ]
}

Now, based on the text outline I provided, please generate the JSON for the **first deck**.
```
- **To get the next deck**, simply send another message like: "Great, now please generate the JSON for the **second deck (Level 1.2)** from the outline."

---

## ⚡ Quick-Start Prompts (Alternatives)

These prompts generate full JSON objects in one go. They are faster but offer less control and may result in very large outputs that some AI models struggle with.

### Generate a Full Series (JSON)
```
Please act as an expert instructional designer and generate a complete, structured Deck Series in a single JSON object.

**Topic:** [YOUR TOPIC HERE]
**User's Current Level:** [USER'S LEVEL HERE]

**CONTENT REQUIREMENTS FOR ALL QUESTIONS:**
-   **Factual Accuracy:** All correct answers and explanations must be verifiable and factually correct.
-   **Practical Application:** Frame questions to enable the user to put the learned information into practice.
-   **Clarity:** Questions must be easy to understand and unambiguous.

**FINAL JSON OUTPUT FORMAT:**
The final output MUST be ONLY a single, raw JSON object without any surrounding text or markdown. The root object must have this exact schema:
{
  "seriesName": "A descriptive name for the whole series",
  "seriesDescription": "A brief description of what the series covers.",
  "levels": [
    {
      "title": "Level 1: The Basics",
      "decks": [
        {
          "name": "Level 1.1: Deck Name",
          "description": "Description of this deck's content.",
          "questions": [
            {
              "questionType": "multipleChoice",
              "questionText": "...",
              "tags": ["tag1", "tag2"],
              "detailedExplanation": "...",
              "options": [ { "id": "q1_opt1", "text": "..." }, { "id": "q1_opt2", "text": "..." } ],
              "correctAnswerId": "q1_opt2"
            }
          ]
        }
      ]
    }
  ]
}

Now, generate the complete JSON object based on all the above requirements.
```

### Generate a Single Quiz Deck (JSON)
```
Please generate a JSON object for a single multiple-choice quiz.

**Topic:** [YOUR TOPIC HERE]
**Designed for Level:** [USER'S LEVEL HERE]

**CONTENT REQUIREMENTS:**
-   **Factual Accuracy:** All correct answers and explanations must be verifiable and factually correct.
-   **Relevance:** Questions must be directly pertinent to the chosen topic and appropriate for the specified level.
-   **Practical Application:** Frame questions to enable the user to put the learned information into practice.
-   **Question Quantity:** Generate 10-100 high-quality questions. Do not include multiple questions that are essentially asking the same thing.
-   **Clarity:** Questions must be easy to understand and unambiguous.
-   **Problem-Solving Focus:** Prioritize questions that require applying knowledge to solve a problem.
-   **Explanation Quality:** The `detailedExplanation` must explain the reasoning behind the correct answer and provide additional context.

**JSON SCHEMA & RULES:**
-   The final output must be ONLY the raw JSON object, starting with `{` and ending with `}`.
-   The root object must contain `name`, `description`, and `questions` (array).
-   Each question object must contain `questionType` ("multipleChoice"), `questionText`, `tags` (array), `detailedExplanation`, `options` (array), and `correctAnswerId`.
-   Each option object must contain a unique `id` and `text`.
-   Do NOT include top-level SRS fields like `id` or `dueDate` on the questions.

Now, generate the complete JSON deck based on all the above requirements.
```

---

## ⚙️ JSON Format Quick Reference

Use the main `Create / Import Deck` modal to import these formats. It will automatically detect the structure.

### Format 1: Full Deck Series
A single JSON object representing a complete, multi-level learning path.

```json
{
  "seriesName": "Intro to Web Development",
  "seriesDescription": "A progressive series covering the fundamentals of web development.",
  "levels": [
    {
      "title": "Level 1: The Foundation",
      "decks": [
        {
          "name": "Level 1.1: HTML Basics",
          "description": "The building blocks of the web.",
          "questions": [
            {
              "questionType": "multipleChoice",
              "questionText": "What does HTML stand for?",
              "tags": ["html", "basics"],
              "detailedExplanation": "HTML stands for HyperText Markup Language...",
              "options": [
                { "id": "1", "text": "HyperText Markup Language" },
                { "id": "2", "text": "High-Level Text Machine Language" }
              ],
              "correctAnswerId": "1"
            }
          ]
        }
      ]
    }
  ]
}
```

### Format 2: Single Quiz Deck
A single JSON object representing one multiple-choice quiz.

```json
{
  "name": "Sample Science Quiz",
  "description": "A few questions to test your basic science knowledge.",
  "questions": [
    {
      "questionType": "multipleChoice",
      "questionText": "Which planet is known as the Red Planet?",
      "tags": ["astronomy", "planets"],
      "detailedExplanation": "Mars is often called the Red Planet...",
      "options": [
        { "id": "opt1", "text": "Venus" },
        { "id": "opt2", "text": "Mars" },
        { "id": "opt3", "text": "Jupiter", "explanation": "Jupiter is a gas giant..." }
      ],
      "correctAnswerId": "opt2"
    }
  ]
}
```

### Format 3: Simple Flashcards
A JSON array of simple front/back card objects.

```json
[
  {
    "front": "What is the capital of France?",
    "back": "Paris"
  },
  {
    "front": "What is H2O?",
    "back": "Water"
  }
]
```