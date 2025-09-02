
# AI Content Generation Reference for CogniFlow

This document provides a set of expert-led prompts and best practices for generating high-quality learning content for CogniFlow using external AI tools like Google's Gemini, OpenAI's ChatGPT, or Anthropic's Claude.

**Core Philosophy:** CogniFlow is a focused learning tool. The optional, built-in AI feature generates a structural "scaffold" for a learning path. You then populate each deck with content on demand, giving you fine-grained control.

## 🏆 The Expert-Led Workflow (Recommended)

For the best results, we strongly recommend a multi-step process. This allows you to guide the AI and review the structure of your learning path before committing to full content generation.

### Step 1: Generate a Learning Path Outline (Plain Text)

First, generate a human-readable outline. This lets you check the structure, topics, and progression without dealing with complex JSON. This step is performed with an external AI chat service.

**The Prompt:**
Use this prompt with your AI chat service. Fill in the `[YOUR TOPIC HERE]` and other optional fields.

```
Please act as a world-class instructional designer and subject matter expert. Your task is to generate a comprehensive, detailed, and world-class TEXT outline for a learning path. The output must be plain text, not a JSON object.

**Topic:** [YOUR TOPIC HERE]
**User's Current Level:** [USER'S LEVEL HERE - OPTIONAL]
**Desired Comprehensiveness:** [e.g., Standard, In-Depth - OPTIONAL]
**Custom Instructions:** [e.g., 'Focus on practical examples' - OPTIONAL]
**Learning Goal:** [e.g., 'Master a subject' - OPTIONAL]
**Learning Style:** [e.g., 'Practical Application & Scenarios' - OPTIONAL]
**Focus Topics:** [e.g., 'The Roman Republic, not the Empire' - OPTIONAL]
**Topics to Exclude:** [e.g., 'military history' - OPTIONAL]
**Language:** [e.g., 'Spanish' - OPTIONAL]


The goal is to create a structured and progressive learning path that guides the user towards mastery, similar in quality and detail to the provided example structure.

**INSTRUCTIONS & REQUIREMENTS:**

1.  **Learning Path Structure:**
    -   Organize the learning path into a suitable number of logical "Levels" (e.g., 2-10). The number should correspond to the topic's complexity and the desired comprehensiveness.
    -   Each Level should contain 1-6 related "Decks".
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

### Step 2: Generate JSON Scaffold from Outline

Once you have the text outline, you can create the structure in CogniFlow. You can do this automatically with the in-app AI generator, or manually by creating a JSON scaffold.

**The Prompt (for manual creation):**
Paste your entire text outline into the AI chat. Then, use this prompt to convert it into a JSON "scaffold".

```
You are an expert content creator. I have provided a text outline for a learning path. Your task is to convert this outline into a structured JSON object that will serve as a scaffold.

**PRIMARY INSTRUCTIONS:**

1.  **Source Material:** Use ONLY the text outline I've provided as your source.
2.  **Structure:** Create a single JSON object with `seriesName`, `seriesDescription`, and a `levels` array.
3.  **Levels and Decks:** Inside the `levels` array, create objects for each level, including its `title`. Each level object should have a `decks` array. Populate this with deck objects, each containing its `name` and `description` from the outline.
4.  **Empty Questions:** For every deck object, include a `"questions": []` key-value pair. The questions array MUST be empty.

**JSON OUTPUT FORMAT:**
- The final output MUST be ONLY a single, raw JSON object, starting with `{` and ending with `}`. Do not include any surrounding text, explanations, or markdown formatting.
- The JSON object must follow this exact schema:
{
  "seriesName": "The full series name from the outline",
  "seriesDescription": "The full series description from the outline",
  "levels": [
    {
      "title": "The title of the first level",
      "decks": [
        {
          "name": "The name of the first deck in this level",
          "description": "The description for this deck",
          "questions": []
        }
      ]
    }
  ]
}

Now, based on the text outline I provided, please generate the complete JSON scaffold.
```
- **To import:** Use the `Create / Import Deck` modal in CogniFlow and paste the generated JSON scaffold. This will create the series with empty decks.

### Step 3: Generate Questions for Each Deck

Now that the series exists in CogniFlow, navigate to the series page. You will see a "Generate Questions" button on each empty deck. Clicking this button will automatically generate the questions for that specific deck.

---

## ⚡ Quick-Start Prompts (Alternatives)

These prompts generate full JSON objects in one go. They are faster but offer less control.

### Generate a Full Series (JSON)
```
Please act as an expert instructional designer and generate a complete, structured Deck Series in a single JSON object.

**Topic:** [YOUR TOPIC HERE]
**User's Current Level:** [USER'S LEVEL HERE - OPTIONAL]
**Desired Comprehensiveness:** [e.g., Standard, In-Depth - OPTIONAL]
**Custom Instructions:** [e.g., 'Focus on practical examples' - OPTIONAL]
**Learning Goal:** [e.g., 'Master a subject' - OPTIONAL]
**Learning Style:** [e.g., 'Practical Application & Scenarios' - OPTIONAL]
**Focus Topics:** [e.g., 'The Roman Republic, not the Empire' - OPTIONAL]
**Topics to Exclude:** [e.g., 'military history' - OPTIONAL]
**Language:** [e.g., 'Spanish' - OPTIONAL]


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