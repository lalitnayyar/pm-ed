"use client";

import { useState, type FormEvent } from "react";
import type { BoardInfo } from "@/lib/api";

type BoardSelectorProps = {
  boards: BoardInfo[];
  activeBoardId: number | null;
  onSelect: (boardId: number) => void;
  onCreate: (name: string, description: string) => Promise<void>;
  onDelete: (boardId: number) => Promise<void>;
  onRename: (boardId: number, name: string) => Promise<void>;
};

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6" />
    <path d="M10,11v6M14,11v6" />
    <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6" />
  </svg>
);

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const BoardSelector = ({
  boards,
  activeBoardId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: BoardSelectorProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);
    setCreateError(null);
    try {
      await onCreate(newName.trim(), newDescription.trim());
      setNewName("");
      setNewDescription("");
      setIsCreating(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create board");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameSubmit = async (boardId: number) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await onRename(boardId, renameValue.trim());
    } catch {
      // best-effort
    }
    setRenamingId(null);
  };

  const startRename = (board: BoardInfo) => {
    setRenamingId(board.id);
    setRenameValue(board.name);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {boards.map((board) => (
        <div key={board.id} className="group relative flex items-center gap-0.5">
          {renamingId === board.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => void handleRenameSubmit(board.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRenameSubmit(board.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="rounded-full border border-[var(--primary-blue)] bg-white px-2.5 py-0.5 text-xs font-semibold text-[var(--navy-dark)] outline-none w-32"
              data-testid="rename-board-input"
            />
          ) : (
            <button
              type="button"
              onClick={() => onSelect(board.id)}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                activeBoardId === board.id
                  ? "border-[var(--primary-blue)] bg-[var(--primary-blue)] text-white"
                  : "border-[var(--stroke)] bg-[var(--surface)] text-[var(--gray-text)] hover:border-[var(--primary-blue)] hover:text-[var(--navy-dark)]"
              }`}
              data-testid={`board-tab-${board.id}`}
            >
              {board.name}
            </button>
          )}
          {renamingId !== board.id && (
            <span className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => startRename(board)}
                className="rounded p-0.5 text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                aria-label={`Rename ${board.name}`}
                data-testid={`rename-board-${board.id}`}
              >
                <PencilIcon />
              </button>
              {boards.length > 1 && (
                <button
                  type="button"
                  onClick={() => void onDelete(board.id)}
                  className="rounded p-0.5 text-[var(--gray-text)] hover:text-red-500"
                  aria-label={`Delete ${board.name}`}
                  data-testid={`delete-board-${board.id}`}
                >
                  <TrashIcon />
                </button>
              )}
            </span>
          )}
        </div>
      ))}

      {isCreating ? (
        <form onSubmit={(e) => void handleCreate(e)} className="flex items-center gap-1.5">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Board name"
            className="rounded-full border border-[var(--stroke)] bg-white px-2.5 py-0.5 text-xs font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] w-28"
            data-testid="new-board-name-input"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-full border border-[var(--stroke)] bg-white px-2.5 py-0.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] w-36"
            data-testid="new-board-desc-input"
          />
          {createError && (
            <span className="text-xs text-red-500">{createError}</span>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !newName.trim()}
            className="rounded-full bg-[var(--primary-blue)] px-2.5 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
            data-testid="create-board-submit"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => { setIsCreating(false); setNewName(""); setCreateError(null); }}
            className="rounded-full border border-[var(--stroke)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--gray-text)]"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-[var(--stroke)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--gray-text)] hover:border-[var(--primary-blue)] hover:text-[var(--navy-dark)] transition-colors"
          data-testid="add-board-button"
        >
          <PlusIcon />
          New board
        </button>
      )}
    </div>
  );
};
