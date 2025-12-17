
# CogniFlow Development Roadmap & Todo

## 🔥 High Priority (Immediate Fixes & Performance)

- [x] **Fix Type Safety in AI Handlers**: Remove `any` types in `hooks/data-management-handlers/ai.ts` and ensure strict typing for `AIGenerationTask` payloads.
- [x] **Optimize Large List Rendering**: Implement virtualization (e.g., `react-window`) for `CardListEditor` and `DeckList` to handle decks with 1000+ items smoothly without DOM lag.
- [x] **Conflict Resolution UI**: Improve the `MergeConflictModal` to allow field-level merging (e.g., keep local mastery scores but take remote deck name) rather than just "all local" or "all remote".
- [x] **Error Boundary Enhancements**: Add a "Send Report" button in `components/ErrorBoundary.tsx` that copies the stack trace, component stack, and state snapshot to the clipboard.
- [x] **Database Concurrency**: Review `services/db.ts` for transaction safety. Ensure `readwrite` transactions are not blocking UI rendering unnecessarily.
- [x] **Image Loading Strategy**: Implement lazy loading for images inside flashcards and `DangerousHtmlRenderer` to speed up initial deck load times.
- [x] **Prevent Duplicate Imports**: Add logic to `services/importService.ts` (specifically the handlers) to detect if a deck with the exact same content ID already exists before importing.
- [x] **Strict TypeScript Config**: Enable `strict: true` in `tsconfig.json` and resolve all resulting type errors to prevent runtime regressions.
- [x] **Memory Leak Audit**: Profile the app using Chrome DevTools to identify and fix event listener leaks in `StudySession` and `Sidebar`.

## ✨ AI Features (Gemini Integration)

### Content Generation
- [x] **Multimodal Card Generation**: Add a feature to upload an image (diagram, textbook page) and use `gemini-2.5-flash-image` to extract info and generate questions/cards.
- [x] **Deck Doctor**: Analyze existing decks for quality issues (too verbose, ambiguous answers) and suggest refinements using `gemini-3-pro-preview`.
- [x] **Smart Deck Builder**: Auto-generate specialized deck types including "Vocabulary Builder" (Definition/Pronunciation/Example) and "Atomic Concepts" (One fact per card).
- [x] **Bloom's Taxonomy Quiz**: Generate quizzes structured by cognitive levels (Remembering -> Creating) to ensure deep learning.
- [x] **Context-Aware Generation**: Generate content specifically for a Series level or to expand an existing deck.
- [x] **Auto-Structure Series**: Automatically generate a full curriculum (Levels & Empty Decks) from a single topic prompt.
- [x] **Pedagogical Guardrails**: Implement AI validation steps to ensure generated answers are unambiguous and factually correct before adding them to a deck.
- [x] **Distractor Hardening**: Improve multiple-choice quizzes by using AI to generate more plausible and challenging distractors based on common misconceptions.
- [x] **Concrete Example Generator**: Automatically enrich abstract definition cards by generating concrete, real-world examples as context or additional fields.

### Interactive Learning
- [x] **Text-to-Speech (TTS)**: Implement `gemini-2.5-flash-preview-tts` to generate high-quality audio for language flashcards automatically. Store audio as base64 in IndexedDB.
- [x] **Explain Like I'm 5**: Add a button in `StudySession` to have AI explain the answer simply if the user hits "Hard" or "Again".

### Metadata & Organization
- [x] **Smart Tagging**: Create a background task that uses AI to automatically tag untagged questions based on their content for better filtering.
- [x] **Auto-Icon Selection**: When creating a deck, use AI to suggest a relevant Lucide icon based on the deck name.
- [ ] **Persona Avatars**: Allow users to generate or select custom avatars for their AI personas to personalize the chat experience.

## 🎨 UI/UX Polish

### Interactions
- [x] **Swipe Gestures**: Implement Tinder-style swipe gestures (Left for "Again", Right for "Good", Up for "Easy") in `components/Flashcard.tsx` for mobile users.
- [x] **Keyboard Shortcuts**: Add global hotkeys for review sessions.
- [x] **Drag-and-Drop Reordering**: Allow users to reorder cards in `CardListEditor` and `QuestionListEditor`.
- [x] **Drag-and-Drop Reordering**: Allow users to reorder learning blocks in `LearningItemListEditor`.
- [x] **Pull-to-Refresh Enhancements**: Add a custom animation or haptic feedback curve to the pull-to-refresh indicator.

### Visuals
- [x] **Transition Animations**: Use CSS transitions for smoother route changes between `DeckList` and `StudySession`.
- [x] **Custom Fonts**: Allow users to select a font for their flashcards (Sans, Serif, Mono).
- [x] **Dark Mode Contrast Audit**: Audit colors in `types.ts` (theme definitions) to ensure WCAG AA contrast compliance in Dark Mode, especially for `rose` and `latte` themes.
- [x] **Rich Text Editor**: Replace the plain `textarea` in `EditCardModal`, `EditQuestionModal` and `EditLearningBlockModal` with a lightweight toolbar for bold, italics, and code blocks.
- [x] **Skeleton Loaders**: Replace full-page spinners with skeleton UI components for `DeckList` and `Dashboard` to improve perceived performance.
- [x] **Theme Builder**: Create a UI that allows users to pick their own Primary, Background, and Surface colors and save them as a custom theme.
- [x] **Zen Mode**: Add a toggle in the study session to hide all headers, footers, and progress bars for a distraction-free experience.

## 🛠 Technical Debt & Refactoring

- [x] **Split `useDataManagement`**: This hook is becoming a "God Object". Refactor `useDataManagement.ts` to strictly compose smaller hooks (`useDeckActions`, `useSeriesActions`, `useSyncActions`) rather than defining handlers inline.
- [x] **State Normalization**: Refactor `store/store.ts` to store decks and cards in normalized Maps/Objects instead of Arrays to improve lookup performance O(1) vs O(n).
- [x] **Service Layer Abstraction**: Create a generic `StorageInterface` so `db.ts` can be swapped for other storage engines (e.g., LocalStorage for demo mode, or a different DB).
- [x] **Sanitization**: Ensure `DangerousHtmlRenderer` heavily sanitizes inputs (using `dompurify`) to prevent XSS from imported Anki decks while allowing necessary formatting.
- [x] **Asset Management**: Move `icon.svg` and other static assets to a dedicated `/public/assets` folder structure.
- [x] **Route Code Splitting**: Use `React.lazy` and `Suspense` in `AppRouter.tsx` to load page components only when needed, reducing initial bundle size.
- [x] **Zod Schema Validation**: Implement `zod` schemas for all external data inputs (JSON import, API responses) to ensure runtime type safety.
- [x] **Custom Hook Extraction**: Extract logic like `useKeyboardShortcuts` and `useSwipeGestures` into dedicated, reusable hooks.
- [ ] **Dependency Audit**: Audit `package.json` for unused dependencies and update critical libraries to their latest stable versions.

## 📱 Mobile & PWA

- [x] **Share Target API**: Allow users to share text from other apps (e.g., a browser) directly to CogniFlow to trigger the "Generate Deck from Text" AI flow.
- [x] **Push Notifications**: Implement local notifications to remind users when cards are due (if supported by the browser/OS).
- [x] **Landscape Mode Optimization**: Optimize `StudySession.tsx` layout for landscape mode on mobile (currently cards might take up too much vertical space).
- [x] **App Shortcuts**: Define `shortcuts` in `manifest.webmanifest` for quick actions like "Resume Study" or "Add Card" from the home screen icon.
- [x] **Background Sync**: Use the Background Sync API to retry failed syncs (e.g., offline reviews) when the connection returns, even if the app is closed.
- [x] **Install Prompt Strategy**: Refine the logic for `useInstallPrompt` to show a custom, less intrusive "Install App" banner after the user has completed a specific number of reviews.

## 🧪 Testing & Quality Assurance

- [ ] **Unit Tests (SRS)**: Add unit tests for `services/srs.ts` to verify the SM-2 algorithm edge cases (e.g., long intervals, lapsing, ease factor decay).
- [ ] **Integration Tests**: Test the full flow of "Create Deck -> Add Card -> Study -> Rate -> Check Database Update".
- [ ] **Anki Import Tests**: Create a suite of sample `.apkg` files (with media, without media, cloze deletions) to verify the worker parser `services/ankiImport.worker.ts`.
- [ ] **End-to-End (E2E) Testing**: Set up Playwright or Cypress to test critical user paths (Syncing, Studying, AI Generation).
- [ ] **Accessibility (a11y) Tests**: Use `axe-core` to automatically detect accessibility violations in the DOM.
- [ ] **Visual Regression Testing**: Setup Storybook for UI components and use Chromatic or a similar tool to catch visual regressions.

## 📦 Data & Sync

- [x] **Payload Compression**: Implement client-side compression (Gzip) for backup uploads to reduce bandwidth usage and latency.
- [ ] **Chunked Uploads**: Implement chunking for large backup files to prevent timeouts and enable reliable uploads on poor connections.
- [x] **Client-Side Encryption**: Encrypt backup data with the user's API key (or a separate secret) before uploading to ensure privacy.
- [x] **CSV Import/Export**: Add support for standard CSV format (Front, Back, Tags) for interoperability with other tools beyond Anki.
- [ ] **Incremental Backup**: Optimize Google Drive backup to only patch changes if possible, or implement chunked uploads for very large backups (>10MB).
- [ ] **Smart Merge**: Implement a smarter JSON merge strategy for `mergeService.ts` that can merge non-conflicting fields automatically.
- [x] **Sync Status Details**: Show a detailed log of exactly *what* was synced (e.g., "5 cards uploaded, 2 decks downloaded") in the Sync History.
- [ ] **WebDAV Support**: Add support for syncing to self-hosted cloud storage solutions like Nextcloud via WebDAV.
- [x] **PDF Export**: Generate printable PDF layouts (A4/Letter) for physical flashcards.
- [ ] **Quizlet Import**: Implement a text parser to support pasting content directly from Quizlet exports.

## 🧩 Algorithms

- [ ] **FSRS Support**: Investigate implementing the FSRS (Free Spaced Repetition Scheduler) algorithm as an alternative to SM-2 for potentially more efficient scheduling.
- [x] **Leech Handling**: Automatically tag cards that are failed repeatedly ("leeches") and suggest suspending or rewriting them.
- [x] **Cram Mode Options**: Add options to Cram mode (e.g., "Sort by Difficulty", "Sort by Date Added").
- [x] **Workload Simulator**: Create a tool that simulates future review load based on current deck settings and hypothetical performance, helping users plan their study schedule.
- [x] **Sick Day / Vacation Mode**: Add a feature to shift all due dates forward by X days to handle breaks without breaking streaks or creating massive backlogs.

## 🚀 Infrastructure & DevOps

- [ ] **Pre-commit Hooks**: Set up Husky and lint-staged to run ESLint and Prettier on commit to enforce code quality.
- [ ] **CI Pipeline**: Create a GitHub Actions workflow to run tests and build the app on every push to main.
- [ ] **Lighthouse CI**: Integrate Lighthouse CI to track performance, accessibility, and SEO scores over time.
- [ ] **Error Logging Service**: Integrate a lightweight error logging service (or a self-hosted instance of Sentry) for capturing runtime errors in production builds.
