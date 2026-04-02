"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AiChat } from "@/components/AiChat";
import {
  clearSessionAuthenticated,
  getSessionAuthenticated,
  setSessionAuthenticated,
  validateCredentials,
} from "@/lib/auth";
import { getBoard, saveBoard } from "@/lib/api";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

const AiIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2a5 5 0 0 1 5 5c0 2.5-1.5 4.5-3.5 5.5L15 21H9l1.5-8.5C8.5 11.5 7 9.5 7 7a5 5 0 0 1 5-5z"/>
    <line x1="9" y1="21" x2="15" y2="21"/>
  </svg>
);

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isBoardSynced, setIsBoardSynced] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    setIsAuthenticated(getSessionAuthenticated());
    setIsAuthResolved(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  useEffect(() => {
    const loadBoard = async () => {
      if (!isAuthenticated) {
        setIsBoardSynced(false);
        return;
      }

      try {
        const persistedBoard = await getBoard();
        setBoard(persistedBoard);
      } catch {
        setBoard(initialData);
      } finally {
        setIsBoardSynced(true);
      }
    };

    void loadBoard();
  }, [isAuthenticated]);

  const updateBoard = (updater: (prev: BoardData) => BoardData) => {
    setBoard((prev) => {
      const next = updater(prev);
      if (isBoardSynced) {
        void saveBoard(next)
          .then(() => setHasSaveError(false))
          .catch(() => setHasSaveError(true));
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    updateBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    updateBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    updateBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    updateBoard((prev) => {
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const handleAiBoardUpdate = (updatedBoard: BoardData) => {
    setBoard(updatedBoard);
    if (isBoardSynced) {
      void saveBoard(updatedBoard)
        .then(() => setHasSaveError(false))
        .catch(() => setHasSaveError(true));
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateCredentials(username.trim(), password)) {
      setAuthError("Invalid username or password.");
      return;
    }

    setSessionAuthenticated();
    setAuthError(null);
    setPassword("");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearSessionAuthenticated();
    setIsAuthenticated(false);
    setIsBoardSynced(false);
    setUsername("");
    setPassword("");
  };

  if (!isAuthResolved) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[540px] items-center justify-center px-6">
        <p className="text-sm text-[var(--gray-text)]">Loading...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[540px] items-center justify-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Project Manager
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
          <p className="mt-3 text-sm text-[var(--gray-text)]">
            Use username <strong>user</strong> and password <strong>password</strong>.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
            <div>
              <label
                htmlFor="login-username"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
              >
                Username
              </label>
              <input
                id="login-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                required
              />
            </div>

            {authError ? (
              <p className="text-sm text-red-600" role="alert">
                {authError}
              </p>
            ) : null}

            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110"
            >
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {hasSaveError && (
        <div role="alert" className="fixed left-0 right-0 top-0 z-50 bg-red-600 px-6 py-2 text-center text-sm font-medium text-white">
          Changes could not be saved — check your connection.
        </div>
      )}
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-4 pb-10 pt-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--stroke)] bg-white/80 px-5 py-3 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="min-w-0 flex-shrink-0">
              <h1 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {board.columns.map((column) => (
                <span
                  key={column.id}
                  className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--gray-text)]"
                >
                  {column.title}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-[var(--primary-blue)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              <AiIcon />
              AI Chat
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Log out
            </button>
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-3 lg:grid-cols-5">
            {board.columns.map((column, index) => (
              <KanbanColumn
                key={column.id}
                column={column}
                columnIndex={index}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <AiChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onBoardUpdate={handleAiBoardUpdate}
        currentBoard={board}
        username={username}
      />
    </div>
  );
};
