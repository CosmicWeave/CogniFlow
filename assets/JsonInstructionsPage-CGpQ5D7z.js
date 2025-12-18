import{a as z,r as l,j as e,B as m,I as r}from"./index-aMUeowKE.js";const o=({children:a})=>e.jsx("pre",{className:"bg-gray-100 dark:bg-gray-900/70 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700",children:e.jsx("code",{children:a})}),i=({title:a,iconName:s,children:p,defaultOpen:d=!1})=>{const[n,g]=l.useState(d);return e.jsxs("div",{className:"border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden",children:[e.jsxs("button",{onClick:()=>g(!n),className:"w-full flex justify-between items-center text-left p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors","aria-expanded":n,children:[e.jsxs("div",{className:"flex items-center",children:[s&&e.jsx(r,{name:s,className:"w-6 h-6 mr-3 text-gray-500 dark:text-gray-400"}),e.jsx("h3",{className:"text-xl font-semibold text-gray-800 dark:text-gray-200",children:a})]}),e.jsx(r,{name:"chevron-down",className:`w-6 h-6 transition-transform duration-300 ${n?"":"-rotate-90"} text-gray-500`})]}),n&&e.jsx("div",{className:"p-6 bg-white dark:bg-gray-800 animate-fade-in",children:p})]})},S=({fields:a})=>e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-left border-collapse mt-4 min-w-[500px]",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{className:"border-b-2 dark:border-gray-600 p-2 text-sm font-semibold text-gray-700 dark:text-gray-300",children:"Field"}),e.jsx("th",{className:"border-b-2 dark:border-gray-600 p-2 text-sm font-semibold text-gray-700 dark:text-gray-300",children:"Type"}),e.jsx("th",{className:"border-b-2 dark:border-gray-600 p-2 text-sm font-semibold text-gray-700 dark:text-gray-300",children:"Required"}),e.jsx("th",{className:"border-b-2 dark:border-gray-600 p-2 text-sm font-semibold text-gray-700 dark:text-gray-300",children:"Description"})]})}),e.jsx("tbody",{children:a.map(({field:s,type:p,description:d,required:n})=>e.jsxs("tr",{className:"border-b dark:border-gray-700/50",children:[e.jsx("td",{className:"p-2 align-top",children:e.jsx("code",{className:"bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm",children:s})}),e.jsx("td",{className:"p-2 align-top text-gray-600 dark:text-gray-400",children:p}),e.jsx("td",{className:"p-2 align-top",children:n?e.jsx(r,{name:"check-circle",className:"text-green-500"}):"No"}),e.jsx("td",{className:"p-2 align-top text-gray-600 dark:text-gray-400",dangerouslySetInnerHTML:{__html:d}})]},s))})]})}),Y=()=>{const{addToast:a}=z(),[s,p]=l.useState(""),[d,n]=l.useState("Beginner"),[g,q]=l.useState(""),[f,C]=l.useState(""),[y,E]=l.useState("Beginner"),[b,O]=l.useState("Beginner"),[u,v]=l.useState(null),x=["Novice","Beginner","Intermediate","Advanced","Expert","Mastery"],A=`[
  {
    "front": "What is the capital of France?",
    "back": "Paris"
  },
  {
    "front": "What is H2O?",
    "back": "Water"
  }
]`,L=`{
  "name": "Sample Science Quiz",
  "description": "A few questions to test your <b>basic</b> science knowledge.",
  "questions": [
    {
      "questionType": "multipleChoice",
      "questionText": "Which planet is known as the Red Planet?",
      "tags": ["astronomy", "planets"],
      "detailedExplanation": "Mars is often called the Red Planet because of the iron oxide prevalent on its surface, which gives it a reddish appearance.",
      "options": [
        { "id": "opt1", "text": "Venus", "explanation": "Venus is known for its thick, toxic atmosphere, not its red color." },
        { "id": "opt2", "text": "Mars", "explanation": "Correct! Mars has a reddish appearance due to iron oxide on its surface." },
        { "id": "opt3", "text": "Jupiter", "explanation": "Jupiter is a gas giant, the largest planet in our solar system, known for its stripes and Great Red Spot." }
      ],
      "correctAnswerId": "opt2"
    }
  ]
}`,I=[{field:"name",type:"string",required:!0,description:"The title of the quiz deck."},{field:"description",type:"string",required:!0,description:"A brief summary of the deck's content. Can include basic HTML for formatting (e.g., `<b>`, `<i>`, `<br>`)."},{field:"questions",type:"Array<Question>",required:!0,description:"An array containing all question objects for the deck."},{field:"questionType",type:"string",required:!0,description:'Must be "multipleChoice" for now.'},{field:"questionText",type:"string",required:!0,description:"The question being asked."},{field:"tags",type:"Array<string>",required:!1,description:"An array of keywords for organization."},{field:"detailedExplanation",type:"string",required:!0,description:"The full explanation shown after answering."},{field:"options",type:"Array<Option>",required:!0,description:"An array of possible answers."},{field:"correctAnswerId",type:"string",required:!0,description:"The `id` of the correct option."},{field:"options[].id",type:"string",required:!0,description:"A unique identifier for this option within the question."},{field:"options[].text",type:"string",required:!0,description:"The answer text shown to the user."},{field:"options[].explanation",type:"string",required:!1,description:"A brief explanation for why this specific option is right or wrong. While technically optional, providing this for all options is **strongly recommended** for high-quality questions."}],F=`{
  "seriesName": "Intro to Web Development",
  "seriesDescription": "A progressive series covering the <b>fundamentals</b> of web development.",
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
                { "id": "1", "text": "HyperText Markup Language", "explanation": "Correct. It's the standard markup language for documents designed to be displayed in a web browser." },
                { "id": "2", "text": "High-Level Text Machine Language", "explanation": "Incorrect. This is not a standard term in web development." }
              ],
              "correctAnswerId": "1"
            }
          ]
        },
        { "name": "Level 1.2: CSS Fundamentals", "description": "...", "questions": [] }
      ]
    }
  ]
}`,P=[{field:"seriesName",type:"string",required:!0,description:"The title for the entire series."},{field:"seriesDescription",type:"string",required:!0,description:"A brief summary of what the whole series covers. Can include basic HTML for formatting."},{field:"levels",type:"Array<Level>",required:!0,description:"An array containing all the levels in the series."},{field:"levels[].title",type:"string",required:!0,description:'The heading for a group of decks (e.g., "Level 1: Core Concepts").'},{field:"levels[].decks",type:"Array<QuizDeck>",required:!0,description:"An array of quiz decks for that level. The schema for each deck is the same as the Single Quiz Deck format."}],k=`Please act as a world-class instructional designer and subject matter expert. Your task is to generate a comprehensive, detailed, and world-class TEXT outline for a learning path. The output must be plain text, not a JSON object.

**Topic:** [YOUR TOPIC HERE]
**User's Current Level:** [USER'S LEVEL HERE]

The goal is to create a structured and progressive learning path that guides the user towards deep, comprehensive mastery of the topic, similar in quality and detail to the provided example structure.

**INSTRUCTIONS & REQUIREMENTS:**

1.  **Learning Path Structure:**
    -   Organize the learning path into logical "Levels" (e.g., Level 1, Level 2, up to Level 4 or 5). Each level must have a title and represent a significant step up in knowledge.
    -   Each Level should contain one or more related "Decks".
    -   The name of each deck must reflect this structure, e.g., "Level 1.1: Foundations of X", "Level 1.2: Core Concepts of Y", "Level 2.1: Advanced Techniques in Z".

2.  **High-Quality Content (Crucial):**
    -   **Comprehensive Coverage:** The outline must cover the topic in sufficient depth for the specified user level, ensuring a thorough understanding.
    -   **Series Name & Description:** Create a compelling and descriptive name (e.g., "Topic Mastery Path: The Contextual Approach") and a comprehensive summary for the entire learning path. The description can use basic HTML for formatting (e.g., <b>, <i>, <br>).
    -   **Engaging Tone:** All names and descriptions should be written to be engaging and spark curiosity, not just be descriptive. Avoid a dry, academic tone.
    -   **Level Goal & Focus:** For each Level, provide a clear "Goal" and "Focus".
    -   **Deck Topics:** For each Deck, provide a detailed, itemized list of specific "Topics" to be covered.
    -   **Progressive Difficulty:** The path must be logically sequenced, starting with foundational definitions and historical context, moving to practical applications, then to assessment and planning, and finally to interdisciplinary challenges.
    -   **Context-Specific:** If the user's topic has a specific context (e.g., a geographical location, a particular framework), embed that context deeply into the entire outline.
    -   **Clarity with Acronyms:** When using an acronym, write it out fully in parentheses the first time it is used (e.g., "Sustainable Forest Management (SFM)").
    -   **Approximate Question Count:** Suggest an approximate number of questions for each deck.
    -   **Metric System:** All generated content should prefer the metric system (e.g., meters, kilograms, Celsius).

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
`,j=`You are an expert content creator. I have provided a text outline for a learning path. Your task is to convert this outline into a structured JSON object that will serve as a scaffold.

**PRIMARY INSTRUCTIONS:**

1.  **Source Material:** Use ONLY the text outline I've provided as your source.
2.  **Structure:** Create a single JSON object with \`seriesName\`, \`seriesDescription\`, and a \`levels\` array.
3.  **Levels and Decks:** Inside the \`levels\` array, create objects for each level, including its \`title\`. Each level object should have a \`decks\` array. Populate this with deck objects, each containing its \`name\` and \`description\` from the outline.
4.  **Empty Questions:** For every deck object, include a \`"questions": []\` key-value pair. The questions array MUST be empty.

**JSON OUTPUT FORMAT:**
- The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`. Do not include any surrounding text, explanations, or markdown formatting.
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
        },
        {
          "name": "The name of the second deck in this level",
          "description": "The description for this deck",
          "questions": []
        }
      ]
    }
  ]
}

Now, based on the text outline I provided, please generate the complete JSON scaffold.`,w=`You are an expert content creator. I have provided a text outline for a learning path. Your task is to generate the JSON for the **first deck (e.g., Level 1.1)** from that outline.

**PRIMARY INSTRUCTIONS:**

1.  **Source Material:** Use ONLY the text outline I've provided as your source.
2.  **Question Quantity:** Generate the approximate number of questions specified in the outline for this first deck.
3.  **Content Generation:** Create world-class questions and answers based *only* on the "Topics" listed for this specific deck in the outline.

**CRITICAL CONTENT QUALITY REQUIREMENTS:**
- **Factual Accuracy:** This is paramount. The correct answer and all parts of the explanation must be unequivocally correct and verifiable.
- **In-Depth Coverage:** The questions must cover the deck's topics comprehensively, moving beyond surface-level facts to ensure a deep understanding.
- **Relevance & Practical Application:** Frame questions in real-world scenarios to help a user apply the information. Questions must be relevant to the deck's topics.
- **Clarity & Simplicity:** Questions must be easy to understand, unambiguous, and free of jargon (unless the jargon is the learning objective). Test only one core concept per question.
- **Clarity with Acronyms:** When using an acronym, provide the full term in parentheses upon its first use (e.g., 'Central Processing Unit (CPU)').
- **Problem-Solving Focus:** Design questions that require applying knowledge, not just recalling facts. Avoid trivial pursuit and focus on genuinely useful information. For practical topics, ask skill-based questions that test the ability to perform a task or make a decision.
- **High-Quality Explanations:** The \`detailedExplanation\` is crucial. It must explain the reasoning, principles, or facts behind the correct answer. Provide additional context, examples, or connections to related concepts to deepen understanding. If applicable, cite sources for complex information.
- **Metric System:** Prefer the metric system (e.g., meters, kilograms, Celsius) for all units.
- **Engaging Content:** Write questions and explanations in an interesting way that makes the user want to learn more. Use surprising facts, real-world scenarios, or narrative elements where appropriate to maintain learner interest.
- **Unpredictable Answer Length:** The length of the correct answer's text must be varied. It should not consistently be the longest or shortest option. This is critical to avoid giving away the answer.
- **Option Explanations:** Every option, correct or incorrect, MUST have a brief \`explanation\` field.

**JSON OUTPUT FORMAT:**
- The final output MUST be ONLY a single, raw JSON object, starting with \`{\` and ending with \`}\`. Do not include any surrounding text, explanations, or markdown formatting.
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
        { "id": "q1_opt1", "text": "First answer option", "explanation": "Brief reason why this option is correct or incorrect." },
        { "id": "q1_opt2", "text": "Second answer option", "explanation": "Brief reason why this option is correct or incorrect." }
      ],
      "correctAnswerId": "q1_opt2"
    }
  ]
}

Now, based on the text outline I provided, please generate the JSON for the **first deck**.`,T=`Please act as an expert instructional designer and generate a complete, structured Deck Series in a single JSON object.

**Topic:** [YOUR TOPIC HERE]
**User's Current Level:** [USER'S LEVEL HERE]

**CONTENT REQUIREMENTS FOR ALL QUESTIONS:**
-   **Comprehensive Coverage:** The generated series must be comprehensive, covering the topic in-depth to provide a thorough understanding for the specified user level.
-   **Factual Accuracy:** All correct answers and explanations must be verifiable and factually correct.
-   **Engaging Content Style:** Frame questions and explanations in an interesting way. Use surprising facts, real-world examples, or historical context to make the material more memorable and engaging. Avoid a dry, academic, textbook-like tone.
-   **Practical Application:** Frame questions to enable the user to put the learned information into practice.
-   **Clarity:** Questions must be easy to understand and unambiguous.
-   **Clarity with Acronyms:** When using an acronym, provide the full term in parentheses upon its first use (e.g., 'CPU (Central Processing Unit)').
-   **Metric System:** Prefer the metric system (e.g., meters, kilograms, Celsius) for all units.
-   **Unpredictable Answer Length:** The length of the correct answer's text must be varied and not consistently be the longest or shortest option.
-   **Option Explanations:** Every option, correct or incorrect, MUST have a brief \`explanation\` field.

**FINAL JSON OUTPUT FORMAT:**
The final output MUST be ONLY a single, raw JSON object without any surrounding text or markdown. The root object must have this exact schema:
{
  "seriesName": "A descriptive name for the whole series",
  "seriesDescription": "A brief description of what the series covers. Can include basic HTML for formatting.",
  "levels": [
    {
      "title": "Level 1: The Basics",
      "decks": [
        {
          "name": "Level 1.1: Deck Name",
          "description": "Description of this deck's content. Can include basic HTML for formatting.",
          "questions": [
            {
              "questionType": "multipleChoice",
              "questionText": "...",
              "tags": ["tag1", "tag2"],
              "detailedExplanation": "...",
              "options": [ { "id": "q1_opt1", "text": "...", "explanation": "Brief reason..." }, { "id": "q1_opt2", "text": "...", "explanation": "Brief reason..." } ],
              "correctAnswerId": "q1_opt2"
            }
          ]
        }
      ]
    }
  ]
}

Now, generate the complete JSON object based on all the above requirements.`,N="Please generate a JSON object for a single multiple-choice quiz.\n\n**Topic:** [YOUR TOPIC HERE]\n**Designed for Level:** [USER'S LEVEL HERE]\n\n**CONTENT REQUIREMENTS:**\n-   **Engaging & Curiosity-Driven:** All content must be written in an engaging style that sparks curiosity. Avoid a dry, academic, textbook-like tone. Use surprising facts, real-world scenarios, or narrative elements where appropriate to make the material more memorable.\n-   **Factual Accuracy:** All information must be factually correct and from reliable, verifiable sources.\n-   **In-Depth Questions:** The questions should cover the topic comprehensively, moving beyond surface-level facts to ensure a deep understanding.\n-   **Relevance:** Questions must be directly pertinent to the chosen topic and appropriate for the specified level.\n-   **Question Quantity:** Generate 10-100 high-quality questions. Do not include multiple questions that are essentially asking the same thing.\n-   **Clarity:** Questions must be easy to understand and unambiguous.\n-   **Clarity with Acronyms:** When using an acronym, provide the full term in parentheses upon its first use (e.g., 'CPU (Central Processing Unit)').\n-   **Problem-Solving Focus:** Prioritize questions that require applying knowledge to solve a problem.\n-   **Explanation Quality:** The `detailedExplanation` must explain the reasoning behind the correct answer and provide additional context.\n-   **Metric System:** Prefer the metric system (e.g., meters, kilograms, Celsius) for all units.\n-   **Unpredictable Answer Length:** The length of the correct answer's text must be varied and not consistently be the longest or shortest option.\n-   **Option Explanations:** Every option, correct or incorrect, MUST have a brief `explanation` field.\n\n**JSON SCHEMA & RULES:**\n-   The final output must be ONLY the raw JSON object, starting with `{` and ending with `}`.\n-   The root object must contain `name`, `description`, and `questions` (array).\n-   Each question object must contain `questionType` (\"multipleChoice\"), `questionText`, `tags` (array), `detailedExplanation`, `options` (array), and `correctAnswerId`.\n-   Each option object must contain a unique `id`, `text`, and a brief `explanation`.\n-   Do NOT include top-level SRS fields like `id` or `dueDate` on the questions.\n\nNow, generate the complete JSON deck based on all the above requirements.",h=(t,c)=>{navigator.clipboard.writeText(t).then(()=>{a("Prompt copied to clipboard!","success"),v(c),setTimeout(()=>v(null),2e3)}).catch(Q=>{a("Failed to copy prompt.","error"),console.error("Could not copy text: ",Q)})},R=()=>{const t=s.trim()||"[YOUR TOPIC HERE]",c=k.replace("[YOUR TOPIC HERE]",t).replace("[USER'S LEVEL HERE]",d);h(c,"outline-prompt")},U=()=>{h(j,"scaffold-prompt")},M=()=>{h(w,"deck-from-outline-prompt")},D=()=>{const t=g.trim()||"[YOUR TOPIC HERE]",c=T.replace("[YOUR TOPIC HERE]",t).replace("[USER'S LEVEL HERE]",y);h(c,"series-prompt")},J=()=>{const t=f.trim()||"[YOUR TOPIC HERE]",c=N.replace("[YOUR TOPIC HERE]",t).replace("[USER'S LEVEL HERE]",b);h(c,"quiz-prompt")};return e.jsxs("div",{className:"max-w-4xl mx-auto animate-fade-in space-y-6 pb-10",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-4xl font-bold text-gray-900 dark:text-gray-100",children:"AI & JSON Import Guide"}),e.jsx("p",{className:"mt-2 text-lg text-gray-500 dark:text-gray-400",children:"Use this expert-led workflow to generate high-quality learning content with AI, or follow the formats to import your own data."})]}),e.jsx(i,{title:"Step 1: Generate Learning Outline (Text)",iconName:"list",defaultOpen:!0,children:e.jsxs("div",{className:"space-y-4 bg-green-900/10 dark:bg-green-900/20 p-6 rounded-lg border border-green-500/20",children:[e.jsx("p",{className:"text-green-800/90 dark:text-green-200/90",children:"Begin by generating a high-level, human-readable outline for your learning path using an external AI chat service. This allows you to review and approve the structure before generating the full content."}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{htmlFor:"outline-topic-input",className:"block text-sm font-medium text-green-700 dark:text-green-300",children:"Enter Topic"}),e.jsx("input",{id:"outline-topic-input",type:"text",value:s,onChange:t=>p(t.target.value),className:"w-full p-2 mt-1 bg-green-50 dark:bg-gray-900 border border-green-300 dark:border-green-700 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none",placeholder:"e.g., The History of Ancient Rome"})]}),e.jsxs("div",{children:[e.jsx("label",{htmlFor:"outline-level-select",className:"block text-sm font-medium text-green-700 dark:text-green-300",children:"My Current Level Is"}),e.jsx("select",{id:"outline-level-select",value:d,onChange:t=>n(t.target.value),className:"w-full p-2 mt-1 bg-green-50 dark:bg-gray-900 border border-green-300 dark:border-green-700 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none",children:x.map(t=>e.jsx("option",{value:t,children:t},t))})]})]}),e.jsx("p",{className:"text-xs text-green-600/80 dark:text-green-400/80 mt-1",children:"Your topic and level will be inserted into the prompt."}),e.jsxs("div",{className:"relative",children:[e.jsx(o,{children:k}),e.jsx(m,{variant:"secondary",className:"absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600",onClick:R,children:u==="outline-prompt"?e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"check-circle",className:"w-4 h-4 mr-1"})," Copied!"]}):e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"download",className:"w-4 h-4 mr-1"})," Copy Prompt"]})})]})]})}),e.jsx(i,{title:"Step 2: Create the Series Scaffold",iconName:"code",children:e.jsxs("div",{className:"space-y-4 bg-yellow-900/10 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-500/20",children:[e.jsx("p",{className:"text-yellow-800/90 dark:text-yellow-200/90",children:'You can now create the series structure in CogniFlow. Use the in-app "Generate with AI" feature with your topic. This will automatically create the series with empty decks, ready for you to populate.'}),e.jsx("p",{className:"text-sm text-yellow-700/90 dark:text-yellow-300/90",children:'Alternatively, you can manually convert your text outline from Step 1 into a JSON "scaffold" using the prompt below and import it via the "Create / Import" modal.'}),e.jsxs("div",{className:"relative",children:[e.jsx(o,{children:j}),e.jsx(m,{variant:"secondary",className:"absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600",onClick:U,children:u==="scaffold-prompt"?e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"check-circle",className:"w-4 h-4 mr-1"})," Copied!"]}):e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"download",className:"w-4 h-4 mr-1"})," Copy Prompt"]})})]})]})}),e.jsx(i,{title:"Step 3: Generate Questions for Each Deck",iconName:"zap",children:e.jsxs("div",{className:"space-y-4 bg-blue-900/10 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-500/20",children:[e.jsx("p",{className:"text-blue-800/90 dark:text-blue-200/90",children:'Navigate to your newly created series page in CogniFlow. Each empty deck will have a "Generate Questions" button. Click it to have the AI populate that specific deck with high-quality, relevant questions automatically.'}),e.jsx("p",{className:"text-sm text-blue-700/90 dark:text-blue-300/90",children:"If you are working with an external AI and your JSON scaffold from Step 2, you can use the prompt below to generate the questions for each deck. Paste your text outline into the chat first, then use the prompt. Copy the generated `questions` array into the correct deck in your scaffold JSON. Repeat for all decks, then import the final JSON file."}),e.jsxs("div",{className:"relative",children:[e.jsx(o,{children:w}),e.jsx(m,{variant:"secondary",className:"absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600",onClick:M,children:u==="deck-from-outline-prompt"?e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"check-circle",className:"w-4 h-4 mr-1"})," Copied!"]}):e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"download",className:"w-4 h-4 mr-1"})," Copy Prompt"]})})]})]})}),e.jsx(i,{title:"Alternative: Generate Full Series at Once (JSON)",iconName:"zap",children:e.jsxs("div",{className:"space-y-4 bg-purple-900/10 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-500/20",children:[e.jsx("p",{className:"text-purple-700/90 dark:text-purple-300/90",children:"For a faster, one-shot approach, use this powerful prompt to generate a complete, structured learning path on any topic. This is less controlled but much quicker."}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{htmlFor:"series-topic-input",className:"block text-sm font-medium text-purple-700 dark:text-purple-300",children:"Enter Topic"}),e.jsx("input",{id:"series-topic-input",type:"text",value:g,onChange:t=>q(t.target.value),className:"w-full p-2 mt-1 bg-purple-50 dark:bg-gray-900 border border-purple-300 dark:border-purple-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none",placeholder:"e.g., Quantum Physics"})]}),e.jsxs("div",{children:[e.jsx("label",{htmlFor:"series-level-select",className:"block text-sm font-medium text-purple-700 dark:text-purple-300",children:"My Current Level Is"}),e.jsx("select",{id:"series-level-select",value:y,onChange:t=>E(t.target.value),className:"w-full p-2 mt-1 bg-purple-50 dark:bg-gray-900 border border-purple-300 dark:border-purple-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none",children:x.map(t=>e.jsx("option",{value:t,children:t},t))})]})]}),e.jsx("p",{className:"text-xs text-purple-600/80 dark:text-purple-400/80 mt-1",children:"Your topic and level will be inserted into the prompt."}),e.jsxs("div",{className:"relative",children:[e.jsx(o,{children:T}),e.jsx(m,{variant:"secondary",className:"absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600",onClick:D,children:u==="series-prompt"?e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"check-circle",className:"w-4 h-4 mr-1"})," Copied!"]}):e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"download",className:"w-4 h-4 mr-1"})," Copy Prompt"]})})]})]})}),e.jsx(i,{title:"Alternative: Generate a Single Quiz Deck",iconName:"zap",children:e.jsxs("div",{className:"space-y-4 bg-blue-900/10 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-500/20",children:[e.jsx("p",{className:"text-blue-700/90 dark:text-blue-300/90",children:"Use this prompt to generate a single quiz deck on any topic, tailored to a specific difficulty level."}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4 mb-4",children:[e.jsxs("div",{children:[e.jsx("label",{htmlFor:"quiz-topic-input",className:"block text-sm font-medium text-blue-700 dark:text-blue-300",children:"Enter Topic"}),e.jsx("input",{id:"quiz-topic-input",type:"text",value:f,onChange:t=>C(t.target.value),className:"w-full p-2 mt-1 bg-blue-50 dark:bg-gray-900 border border-blue-300 dark:border-blue-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none",placeholder:"e.g., The Roman Empire"})]}),e.jsxs("div",{children:[e.jsx("label",{htmlFor:"quiz-level-select",className:"block text-sm font-medium text-blue-700 dark:text-blue-300",children:"Deck Difficulty Level"}),e.jsx("select",{id:"quiz-level-select",value:b,onChange:t=>O(t.target.value),className:"w-full p-2 mt-1 bg-blue-50 dark:bg-gray-900 border border-blue-300 dark:border-blue-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none",children:x.map(t=>e.jsx("option",{value:t,children:t},t))})]})]}),e.jsxs("div",{className:"relative",children:[e.jsx(o,{children:N}),e.jsx(m,{variant:"secondary",className:"absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600",onClick:J,children:u==="quiz-prompt"?e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"check-circle",className:"w-4 h-4 mr-1"})," Copied!"]}):e.jsxs(e.Fragment,{children:[e.jsx(r,{name:"download",className:"w-4 h-4 mr-1"})," Copy Prompt"]})})]})]})}),e.jsxs(i,{title:"Format 1: Full Deck Series (JSON)",iconName:"list",children:[e.jsx("p",{className:"text-gray-600 dark:text-gray-400 mb-4",children:"To import an entire learning path at once, provide a single JSON object containing the series details and a `levels` array. Each level has a title and contains its own array of decks."}),e.jsx(o,{children:F}),e.jsx("h4",{className:"text-lg font-semibold mt-6 mb-2",children:"Field Definitions"}),e.jsx(S,{fields:P})]}),e.jsxs(i,{title:"Format 2: Single Quiz Deck (JSON)",iconName:"help-circle",children:[e.jsx("p",{className:"text-gray-600 dark:text-gray-400 mb-4",children:"For a single multiple-choice quiz, provide a JSON object with a name, description, and an array of question objects. See the field definitions below for more details."}),e.jsx(o,{children:L}),e.jsx("h4",{className:"text-lg font-semibold mt-6 mb-2",children:"Field Definitions"}),e.jsx(S,{fields:I})]}),e.jsxs(i,{title:"Format 3: Simple Flashcard Deck (JSON)",iconName:"laptop",children:[e.jsxs("p",{className:"text-gray-600 dark:text-gray-400 mb-4",children:["For basic front-and-back flashcards, provide a JSON array. Each object in the array must have a ",e.jsx("code",{className:"bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm",children:"front"})," and a ",e.jsx("code",{className:"bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded-sm",children:"back"})," key, both with string values. This format is ideal for quick, manual creation or for exporting from other simple flashcard apps."]}),e.jsx(o,{children:A})]}),e.jsx(i,{title:"General Tips & Troubleshooting",iconName:"settings",children:e.jsxs("ul",{className:"space-y-4 list-disc list-inside text-gray-600 dark:text-gray-400",children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Validate Your JSON:"})," Before importing, it's a good idea to paste your JSON into an online validator to check for syntax errors. A common mistake is a trailing comma after the last item in an array or object.",e.jsx("br",{}),e.jsx("code",{children:'[ { "key": "value" }, ] &larr; Invalid Trailing Comma'})]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Check Your Quotes:"}),` All keys and string values in JSON must be enclosed in double quotes ("). Single quotes (') are not valid.`]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Schema Mismatches:"}),' Ensure your JSON structure matches one of the three formats above. For example, pasting an array of flashcards into the "Bulk Add" modal inside a quiz deck will fail. The main "Import" modal is more flexible and can detect the format automatically.']}),e.jsxs("li",{children:[e.jsx("strong",{children:"Unique IDs:"}),' When creating quiz questions, ensure the `id` for each option within a single question is unique. You can use simple strings like "opt1", "opt2", or a UUID.']}),e.jsxs("li",{children:[e.jsx("strong",{children:"AI-Generated Content:"})," Always review content generated by an AI for factual accuracy before studying it. The prompts are designed to request accuracy, but AI can still make mistakes."]})]})})]})};export{Y as default};
