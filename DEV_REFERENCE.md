# CogniFlow AI Developer Reference Guide

This document serves as the primary technical reference for developing the CogniFlow application. It outlines the architecture, state management, data flow, and key conventions to ensure consistency, maintainability, and quality in all future updates.

## 1. Core Technologies

- **UI Framework:** React 18 with TypeScript
- **State Management:** Zustand
- **Styling:** Tailwind CSS with a custom CSS variable-based theming system.
- **Client-Side Storage:** IndexedDB (via `services/db.ts`)
- **Routing:** Custom hash-based router (`contexts/RouterContext.ts`)
- **External Libraries:** `JSZip` & `sql.js` for Anki imports.

---

## 2. Project Structure

- `components/`: Contains all React components.
  - `ui/`: Reusable, low-level UI elements (e.g., `Button.tsx`, `Icon.tsx`).
  - `Page Components`: Top-level components for each view (e.g., `DashboardPage.tsx`, `DeckDetailsPage.tsx`).
  - `Feature Components`: Complex, stateful components (e.g., `DeckList.tsx`, `StudySession.tsx`).
- `contexts/`: React context providers for shared concerns (Theming, Toasts, Routing).
- `hooks/`: Custom React hooks for shared logic (e.g., `useDataManagement.ts`, `useToast.ts`).
- `services/`: Modules for handling side effects and business logic.
  - `db.ts`: The **only** module that directly interacts with IndexedDB.
  - `srs.ts`: The core Spaced Repetition System (SRS) logic.
  - `importService.ts`: Logic for parsing and validating imported data (JSON, Anki).
  - `syncService.ts`: Cross-tab state synchronization using a `BroadcastChannel`.
- `store/`: Zustand global state management.
- `types.ts`: Centralized TypeScript type definitions for the entire application.

---

## 3. State Management & Data Flow

CogniFlow uses a hybrid approach to state management, which is crucial to understand.

### 3.1. Zustand Global Store (`store/store.ts`)

The Zustand store is the **single source of truth** for core application data that is frequently read across the app.

- **State (`AppState`):** Holds `decks`, `folders`, and `deckSeries`.
- **Actions (`AppAction`):** A Redux-style reducer (`appReducer`) is used for predictable state transitions.
- **Usage:**
  - To **read** data: `const decks = useStore(state => state.decks);`
  - To **write** data: `const dispatch = useStore(state => state.dispatch); dispatch({ type: 'UPDATE_DECK', payload: updatedDeck });`

### 3.2. Local Component State (`useState`)

Standard React state is used for UI-specific, ephemeral state that doesn't need to be shared globally. Examples include:
- Modal open/close status (`isImportModalOpen` in `App.tsx`).
- Form input values (`searchTerm` in `AllDecksPage.tsx`).
- UI modes (`isEditing` in `DeckDetailsPage.tsx`).

### 3.3. The Data Management Layer (`hooks/useDataManagement.ts`)

This is the **most important hook** for data manipulation. **All C.R.U.D. operations on core data (decks, series, folders) must be handled here.**

**Core Responsibility:** To orchestrate the entire data modification process.

**Typical Flow for an Action (e.g., Updating a Deck):**
1.  **Component Call:** A component calls a handler from the `useDataManagement` hook (e.g., `handleUpdateDeck(deck)`).
2.  **Optimistic UI Update:** The handler immediately calls `dispatch` to update the Zustand store. This makes the UI feel instantaneous.
3.  **Data Persistence:** The handler then calls the corresponding function in `services/db.ts` (e.g., `db.updateDeck(deck)`) to save the change to IndexedDB.
4.  **User Feedback:** The handler shows a toast notification to the user via `useToast`.
5.  **Error Handling:** If the database operation fails, an error toast is shown. The UI remains in the optimistic state but will be corrected on the next full data load.

> **Golden Rule:** Never call `services/db.ts` directly from a component. Always go through `useDataManagement.ts`.

---

## 4. Key Conventions & Best Practices

- **Optimistic UI:** Always update the Zustand store *before* the async database operation. This provides a fast, responsive user experience.
- **Modals & Focus Management:**
  - Modal open/close state should live in the highest common ancestor component, typically `App.tsx`.
  - Always use the `useFocusTrap` hook on modals to ensure accessibility.
  - When opening a modal, store a reference to the triggering element (`modalTriggerRef.current`). When the modal closes, return focus to that element.
- **Routing:**
  - Use the `<Link>` component for user-facing navigation. It correctly handles the hash-based routing.
  - Use the `useRouter().navigate()` hook for programmatic navigation inside functions.
- **Styling:**
  - Adhere to the theming system defined in `index.html` and `ThemeContext`. Use theme variables (e.g., `bg-primary`, `text-text-muted`) instead of hardcoded colors.
  - Components should be responsive and mobile-first.
- **Type Safety:**
  - Leverage the centralized types from `types.ts`.
  - Avoid `any` wherever possible.
- **Cross-Tab Sync:** The `syncService` uses a `BroadcastChannel` to notify other tabs of data changes. The `onDataChange` listener in `App.tsx` triggers a full data reload from IndexedDB, ensuring all tabs stay in sync.
- **Anki Imports:** The heavy lifting of unzipping and parsing the Anki SQLite database is offloaded to a Web Worker (`services/ankiImport.worker.ts`) to prevent freezing the main UI thread. A fallback parser (`parseAnkiPkgMainThread`) exists in `ankiImportService.ts` in case the worker fails.
