# Frontend Guide

## Purpose

This frontend is a Next.js app that currently provides a frontend-only Kanban demo.
It is the baseline UI that will later be integrated with the FastAPI backend.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- dnd-kit for drag-and-drop
- Vitest + Testing Library for unit/integration tests
- Playwright for end-to-end tests

## Current Structure

- `src/app/`
- `src/components/`
- `src/lib/`
- `src/test/`
- `tests/`

## App Entry Points

- `src/app/layout.tsx`
- Defines global metadata and font setup (`Space_Grotesk`, `Manrope`).
- Loads `src/app/globals.css`.

- `src/app/page.tsx`
- Renders `KanbanBoard` as the main page content.

- `src/app/globals.css`
- Defines project color tokens matching root AGENTS guidance.
- Includes shared surface, stroke, and typography CSS variables.

- `next.config.ts`
- Uses `output: "export"` to generate static build output (`frontend/out`).

## Kanban Implementation

- `src/components/KanbanBoard.tsx`
- Main board container and state owner.
- Uses in-memory state initialized from `initialData`.
- Supports:
  - login gate
  - logout
  - column rename
  - add card
  - delete card
  - drag and drop across/same column
- Uses `DndContext` and `DragOverlay` from dnd-kit.

- Uses localStorage-backed auth session key for MVP login persistence.

- `src/components/KanbanColumn.tsx`
- Renders one column.
- Provides editable column title input.
- Uses droppable region and sortable context.
- Hosts card list and per-column add-card form.

- `src/components/KanbanCard.tsx`
- Sortable card item with title/details and remove action.

- `src/components/KanbanCardPreview.tsx`
- Lightweight visual preview for drag overlay.

- `src/components/NewCardForm.tsx`
- Expand/collapse form for adding a card.
- Requires non-empty title.

## Data Model and Logic

- `src/lib/kanban.ts`
- Exposes core types:
  - `Card`
  - `Column`
  - `BoardData`
- Exposes `initialData` with five seeded columns.
- Exposes `moveCard(columns, activeId, overId)` for all drag outcomes.
- Exposes `createId(prefix)` for client-side card ids.

- `src/lib/auth.ts`
- Exposes hardcoded credential validation (`user` / `password`).
- Exposes localStorage session helpers.

## Existing Test Coverage

### Unit/Integration (Vitest)

- `src/lib/kanban.test.ts`
- Covers card reorder, cross-column move, and drop-to-column-end behavior.

- `src/lib/auth.test.ts`
- Covers credential checks and session storage helpers.

- `src/components/KanbanBoard.test.tsx`
- Covers:
  - login required before board access
  - invalid login handling
  - rendering five columns
  - renaming a column
  - adding and removing a card
  - login and logout flow

### End-to-End (Playwright)

- `tests/kanban.spec.ts`
- Covers:
  - login flow
  - page loads and shows board title + 5 columns
  - add card flow
  - drag card between columns
  - logout flow

## Commands

From `frontend/`:

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Unit/integration tests: `npm run test:unit`
- End-to-end tests: `npm run test:e2e`
- Full test run: `npm run test:all`

## Notes for Future Integration

- Current board state is local-only and resets on refresh.
- Auth state persists via localStorage across refresh.
- Backend integration should preserve current interactions while replacing state source with API data.
- Keep component responsibilities simple and centered on Kanban interactions.
