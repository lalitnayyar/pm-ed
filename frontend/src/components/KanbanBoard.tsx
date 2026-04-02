"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { EditCardModal } from "@/components/EditCardModal";
import { BoardSelector } from "@/components/BoardSelector";
import { ProfileModal } from "@/components/ProfileModal";
import {
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
  apiLogin,
  apiRegister,
  apiLogout,
  type AuthUser,
} from "@/lib/auth";
import {
  apiBoardsList,
  apiBoardCreate,
  apiBoardGet,
  apiBoardSave,
  apiBoardDelete,
  apiBoardRename,
  apiBoardActivity,
  apiSearch,
  type BoardInfo,
  type ActivityEntry,
  type CardSearchResult,
  type UserProfile,
} from "@/lib/api";
import { createId, initialData, moveCard, type BoardData, type Card } from "@/lib/kanban";

const AiIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2a5 5 0 0 1 5 5c0 2.5-1.5 4.5-3.5 5.5L15 21H9l1.5-8.5C8.5 11.5 7 9.5 7 7a5 5 0 0 1 5-5z" />
    <line x1="9" y1="21" x2="15" y2="21" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

type AuthMode = "login" | "register";

export const KanbanBoard = () => {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // ── Board state ────────────────────────────────────────────────────────────
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [isBoardSynced, setIsBoardSynced] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  const [isBoardLoading, setIsBoardLoading] = useState(false);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CardSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Init: restore session from localStorage ────────────────────────────────
  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
    setIsAuthResolved(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  // ── Load boards when authenticated ────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setBoards([]);
      setActiveBoardId(null);
      setIsBoardSynced(false);
      return;
    }

    const loadBoards = async () => {
      try {
        const boardList = await apiBoardsList(token);
        setBoards(boardList);
        if (boardList.length > 0) {
          setActiveBoardId(boardList[0].id);
        }
      } catch {
        handleLogout();
      }
    };

    void loadBoards();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load board data when active board changes ──────────────────────────────
  useEffect(() => {
    if (!token || !activeBoardId) {
      setIsBoardSynced(false);
      return;
    }

    const loadBoard = async () => {
      setIsBoardLoading(true);
      try {
        const detail = await apiBoardGet(token, activeBoardId);
        setBoard(detail.board);
        setIsBoardSynced(true);
      } catch {
        setBoard(initialData);
        setIsBoardSynced(true);
      } finally {
        setIsBoardLoading(false);
      }
    };

    void loadBoard();
  }, [token, activeBoardId]);

  // ── Persist board changes ──────────────────────────────────────────────────
  const updateBoard = (updater: (prev: BoardData) => BoardData) => {
    if (!token || !activeBoardId) return;
    setBoard((prev) => {
      const next = updater(prev);
      if (isBoardSynced) {
        void apiBoardSave(token, activeBoardId, next)
          .then(() => setHasSaveError(false))
          .catch(() => setHasSaveError(true));
      }
      return next;
    });
  };

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleAuthSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      let payload;
      if (authMode === "login") {
        payload = await apiLogin(username.trim(), password);
      } else {
        payload = await apiRegister(username.trim(), password, email.trim() || undefined);
      }
      setStoredAuth(payload.token, payload.user);
      setToken(payload.token);
      setUser(payload.user);
      setPassword("");
      setEmail("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (token) void apiLogout(token);
    clearStoredAuth();
    setToken(null);
    setUser(null);
    setBoards([]);
    setActiveBoardId(null);
    setIsBoardSynced(false);
    setUsername("");
    setPassword("");
    setEmail("");
  };

  // ── Profile handler ───────────────────────────────────────────────────────
  const handleOpenProfile = () => {
    if (!user || !token) return;
    setProfileUser({ id: 0, username: user.username, email: user.email ?? null, created_at: "" });
    setIsProfileOpen(true);
  };

  // ── Activity log handler ──────────────────────────────────────────────────
  const handleOpenActivity = useCallback(async () => {
    if (!token || !activeBoardId) return;
    setIsActivityOpen(true);
    setActivityLoading(true);
    try {
      const entries = await apiBoardActivity(token, activeBoardId);
      setActivityEntries(entries);
    } catch {
      setActivityEntries([]);
    } finally {
      setActivityLoading(false);
    }
  }, [token, activeBoardId]);

  // ── Search handler ────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!token || !q.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    setIsSearching(true);
    setShowSearchDropdown(true);
    try {
      const results = await apiSearch(token, q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [token]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Board management handlers ──────────────────────────────────────────────
  const handleSelectBoard = (boardId: number) => {
    if (boardId === activeBoardId) return;
    setActiveBoardId(boardId);
  };

  const handleCreateBoard = async (name: string, description: string) => {
    if (!token) return;
    const detail = await apiBoardCreate(token, name, description);
    const newInfo: BoardInfo = {
      id: detail.id,
      name: detail.name,
      description: detail.description,
      created_at: detail.updated_at,
      updated_at: detail.updated_at,
    };
    setBoards((prev) => [...prev, newInfo]);
    setActiveBoardId(detail.id);
  };

  const handleDeleteBoard = async (boardId: number) => {
    if (!token) return;
    await apiBoardDelete(token, boardId);
    const remaining = boards.filter((b) => b.id !== boardId);
    setBoards(remaining);
    if (activeBoardId === boardId) {
      setActiveBoardId(remaining[0]?.id ?? null);
    }
  };

  const handleRenameBoard = async (boardId: number, name: string) => {
    if (!token) return;
    await apiBoardRename(token, boardId, name);
    setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, name } : b)));
  };

  // ── Card handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id) return;

    updateBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    updateBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId ? { ...col, title } : col
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const newId = createId("card");
    updateBoard((prev) => ({
      columns: prev.columns.map((col) =>
        col.id === columnId
          ? { ...col, cardIds: [...col.cardIds, newId] }
          : col
      ),
      cards: {
        ...prev.cards,
        [newId]: { id: newId, title, details },
      },
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    updateBoard((prev) => {
      const { [cardId]: _removed, ...remainingCards } = prev.cards;
      return {
        columns: prev.columns.map((col) =>
          col.id === columnId
            ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) }
            : col
        ),
        cards: remainingCards,
      };
    });
  };

  const handleEditCard = (card: Card) => {
    setEditingCard(card);
  };

  const handleSaveCard = (updated: Card) => {
    updateBoard((prev) => ({
      ...prev,
      cards: { ...prev.cards, [updated.id]: updated },
    }));
    setEditingCard(null);
  };

  const handleAiBoardUpdate = (updatedBoard: BoardData) => {
    if (!token || !activeBoardId) return;
    setBoard(updatedBoard);
    void apiBoardSave(token, activeBoardId, updatedBoard)
      .then(() => setHasSaveError(false))
      .catch(() => setHasSaveError(true));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  // ── Render: loading ────────────────────────────────────────────────────────
  if (!isAuthResolved) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[540px] items-center justify-center px-6">
        <p className="text-sm text-[var(--gray-text)]">Loading...</p>
      </main>
    );
  }

  // ── Render: not authenticated ──────────────────────────────────────────────
  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[540px] items-center justify-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Project Manager
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            {authMode === "login" ? "Sign in" : "Create account"}
          </h1>

          {authMode === "login" && (
            <p className="mt-2 text-xs text-[var(--gray-text)]">
              Demo: <strong>user</strong> / <strong>password</strong>
            </p>
          )}

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleAuthSubmit(e)}>
            <div>
              <label htmlFor="login-username" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Username
              </label>
              <input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                required
                data-testid="auth-username"
              />
            </div>

            {authMode === "register" && (
              <div>
                <label htmlFor="register-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                  Email <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                  data-testid="auth-email"
                />
              </div>
            )}

            <div>
              <label htmlFor="login-password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                required
                data-testid="auth-password"
              />
              {authMode === "register" && (
                <p className="mt-1 text-xs text-[var(--gray-text)]">Minimum 6 characters</p>
              )}
            </div>

            {authError && (
              <p className="text-sm text-red-600" role="alert" data-testid="auth-error">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110 disabled:opacity-60"
              data-testid="auth-submit"
            >
              {isAuthSubmitting
                ? authMode === "login" ? "Signing in…" : "Creating account…"
                : authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-[var(--gray-text)]">
            {authMode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setAuthMode("register"); setAuthError(null); }}
                  className="font-semibold text-[var(--primary-blue)] hover:underline"
                  data-testid="switch-to-register"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setAuthMode("login"); setAuthError(null); }}
                  className="font-semibold text-[var(--primary-blue)] hover:underline"
                  data-testid="switch-to-login"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  // ── Render: authenticated ──────────────────────────────────────────────────
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
            <div className="flex-shrink-0">
              <h1 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
            </div>
            <BoardSelector
              boards={boards}
              activeBoardId={activeBoardId}
              onSelect={handleSelectBoard}
              onCreate={(name, desc) => handleCreateBoard(name, desc)}
              onDelete={(id) => handleDeleteBoard(id)}
              onRename={(id, name) => handleRenameBoard(id, name)}
            />
          </div>

          {/* Search bar */}
          <div className="relative flex-1 min-w-[180px] max-w-xs" ref={searchRef}>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2">
              <SearchIcon />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => void handleSearch(e.target.value)}
                placeholder="Search cards…"
                className="flex-1 bg-transparent text-xs text-[var(--navy-dark)] outline-none placeholder:text-[var(--gray-text)]"
                data-testid="search-input"
              />
            </div>
            {showSearchDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-[var(--stroke)] bg-white shadow-lg overflow-hidden" data-testid="search-dropdown">
                {isSearching ? (
                  <p className="px-4 py-3 text-xs text-[var(--gray-text)]">Searching…</p>
                ) : searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-[var(--gray-text)]">No results found.</p>
                ) : (
                  <ul>
                    {searchResults.map((r) => (
                      <li key={`${r.board_id}-${r.card_id}`}>
                        <button
                          type="button"
                          className="w-full px-4 py-2.5 text-left hover:bg-[var(--surface)] transition-colors"
                          onClick={() => {
                            if (r.board_id !== activeBoardId) handleSelectBoard(r.board_id);
                            setShowSearchDropdown(false);
                            setSearchQuery("");
                          }}
                          data-testid={`search-result-${r.card_id}`}
                        >
                          <p className="text-xs font-semibold text-[var(--navy-dark)] truncate">{r.card_title}</p>
                          <p className="text-[10px] text-[var(--gray-text)]">{r.board_name} · {r.column_title}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {user && (
              <button
                type="button"
                onClick={handleOpenProfile}
                className="text-xs text-[var(--gray-text)] hover:text-[var(--navy-dark)] hover:underline transition-colors"
                data-testid="current-user"
              >
                {user.username}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleOpenActivity()}
              className="flex items-center gap-1.5 rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              data-testid="activity-log-button"
            >
              <ActivityIcon />
              Activity
            </button>
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
              data-testid="logout-button"
            >
              Log out
            </button>
          </div>
        </header>

        {isBoardLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-[var(--gray-text)]">Loading board…</p>
          </div>
        ) : (
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
                  cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onEditCard={handleEditCard}
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
        )}
      </main>

      {editingCard && (
        <EditCardModal
          card={editingCard}
          onSave={handleSaveCard}
          onClose={() => setEditingCard(null)}
        />
      )}

      {isProfileOpen && profileUser && token && (
        <ProfileModal
          token={token}
          user={profileUser}
          onClose={() => setIsProfileOpen(false)}
          onUpdated={(updated) => {
            setProfileUser(updated);
            if (user) setStoredAuth(token, { ...user, email: updated.email });
          }}
        />
      )}

      {/* Activity log panel */}
      {isActivityOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsActivityOpen(false); }}
          data-testid="activity-panel"
        >
          <div className="mt-16 mr-2 w-full max-w-sm rounded-3xl border border-[var(--stroke)] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--stroke)]">
              <h2 className="font-display text-sm font-semibold text-[var(--navy-dark)]">Activity Log</h2>
              <button
                type="button"
                onClick={() => setIsActivityOpen(false)}
                className="text-xs text-[var(--gray-text)] hover:text-[var(--navy-dark)] transition-colors"
                data-testid="close-activity-panel"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {activityLoading ? (
                <p className="text-xs text-[var(--gray-text)]">Loading…</p>
              ) : activityEntries.length === 0 ? (
                <p className="text-xs text-[var(--gray-text)]">No activity yet on this board.</p>
              ) : (
                <ul className="space-y-2" data-testid="activity-entries">
                  {activityEntries.map((entry) => (
                    <li key={entry.id} className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface)] px-3 py-2">
                      <p className="text-xs text-[var(--navy-dark)]">
                        <span className="font-semibold">{entry.username}</span>{" "}
                        {entry.action}
                        {entry.target ? ` — ${entry.target}` : ""}
                      </p>
                      <p className="text-[10px] text-[var(--gray-text)]">{entry.created_at}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <AiChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onBoardUpdate={handleAiBoardUpdate}
        currentBoard={board}
        username={user?.username ?? "user"}
      />
    </div>
  );
};
