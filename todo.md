# CogniFlow Development Roadmap & Todo

## 🔥 High Priority (Immediate Fixes & Performance)

- [x] **Fix Type Safety in AI Handlers**: Removed `any` types in `hooks/data-management-handlers/ai.ts` and ensured strict typing.
- [x] **Optimize Large List Rendering**: Implement virtualization for `CardListEditor` and `DeckList`.
- [x] **Conflict Resolution UI**: Improve `MergeConflictModal` for field-level merging.
- [x] **Error Boundary Enhancements**: Added "Copy Report" button.
- [x] **Database Concurrency**: Review `services/db.ts` for transaction safety.
- [x] **Prevent Duplicate Imports**: Logic to detect duplicate content.
- [x] **Strict TypeScript Config**: Resolve all remaining `strict: true` errors.

## 🚀 Next Generation: The "Hyper-Course" Engine

The "Hyper-Course" engine leverages Gemini 3 Pro's deep reasoning and multi-agent orchestration to synthesize master-level educational ecosystems.

### 🛠 Technical Architecture Improvements
- [x] **Deterministic State Machine & Transactional Checkpointing**:
    - Persists every sub-phase to IndexedDB for resumability.
- [x] **Multi-Agent Epistemic Integrity Layer (Critic-Reviewer Loop)**:
    - Agent A (Instructional Designer) drafts via `gemini-3-pro-preview`.
    - Agent B (Epistemic Auditor/Critic) uses `googleSearch` to verify claims.
- [x] **Adaptive Context Window Management (Logical State Vector)**:
    - Recursive summaries of prerequisites feed into subsequent chapters.
- [x] **Parallel Batch Processing with Terminology Locking**:
    - Leverage a Task-Graph Executor for independent chapters.
- [x] **Streaming Progress (Live Synthesis Engine)**:
    - Real-time writing feedback in the UI.
- [x] **Resilient Node Recovery (DAG Fault Tolerance)**:
    - Isolated node retries with exponential backoff.
- [x] **Live-Learning Mode (Real-time Consumption)**:
    - Users can read Chapter 1 while Chapter 5 is synthesizing.
- [x] **Agentic Self-Correction Loop**:
    - **Behaviour**: The "Global Auditor" triggers "Refine" tasks on completed chapters automatically if inconsistencies are detected.
    - **Status**: Implemented refinement pass in `onGenerateDeepCourse`.

### 📚 Factual Visual Enrichments (100% Accuracy Only)
- [x] **Grounded Visual Landmark Identification**:
    - AI identifies nodes requiring visual aids.
- [x] **Factual Diagram Synthesis via SVG**:
    - AI generates mathematically and structurally accurate SVG code.
- [x] **Search-Grounded Image Synthesis**:
    - Use `gemini-3-pro-image-preview` with `googleSearch`.
- [x] **Animated SVG Kinetics**:
    - SVG Agent includes CSS `@keyframes` for educational motion.
- [x] **Veo Process Integration**:
    - High-fidelity 5s educational loops via `veo-3.1-fast-generate-preview`.

### 🧩 Advanced Pedagogical Logic
- [x] **Directed Acyclic Graph (DAG) Prerequisite Engine**:
    - Knowledge graphs enforced in the Reader.
- [x] **Bloom's Taxonomy Audit Pass**:
    - Assessment span from Recall to Evaluation.
- [x] **Epistemic Consistency Audit**:
    - Global Auditor pass for cross-chapter terminology.
- [x] **Project Observability Dashboard**:
    - **Behaviour**: The AI Status Modal is now a visual "Generation Project" view showing the state of every chapter in the curriculum.
    - **Status**: Upgraded modal with granular phase tracking.

## ✨ AI Features (Gemini Integration)

- [x] **Multimodal Card Generation**: Upload images to generate cards.
- [x] **Deck Doctor**: Quality audit using `gemini-3-pro-preview`.
- [x] **Smart Deck Builder**: Auto-generate Vocab/Atomic decks.
- [x] **Distractor Hardening**: AI-generated challenging incorrect answers.
- [x] **Concrete Example Generator**: Real-world usage examples for cards.

## 🎨 UI/UX Polish

- [x] **Swipe Gestures**: Mobile-first review interactions.
- [x] **Keyboard Shortcuts**: Power-user study hotkeys.
- [x] **Zen Mode**: Distraction-free toggle for study sessions.

## 📦 Data & Sync

- [x] **Payload Compression**: Client-side Gzip/Zip via JSZip.
- [x] **Client-Side Encryption**: AES-GCM password-protected cloud backups.
- [x] **PDF Export**: High-fidelity printable study materials.
