"use client";

import { useState, type FormEvent } from "react";
import type { Card, CardPriority, ChecklistItem } from "@/lib/kanban";
import { createId } from "@/lib/kanban";

type EditCardModalProps = {
  card: Card;
  onSave: (updated: Card) => void;
  onClose: () => void;
};

const PRIORITY_LABELS: Record<CardPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PRIORITY_COLORS: Record<CardPriority, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-red-100 text-red-700 border-red-200",
};

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const EditCardModal = ({ card, onSave, onClose }: EditCardModalProps) => {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<CardPriority | "">(card.priority ?? "");
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const [labelInput, setLabelInput] = useState((card.labels ?? []).join(", "));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist ?? []);
  const [newItemText, setNewItemText] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const addChecklistItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { id: createId("chk"), text, done: false }]);
    setNewItemText("");
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const deleteChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDetails = details.trim();
    if (!trimmedTitle) {
      setTitleError("Title is required");
      return;
    }
    if (!trimmedDetails) {
      setTitleError("Details are required");
      return;
    }

    const labels = labelInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    onSave({
      ...card,
      title: trimmedTitle,
      details: trimmedDetails,
      priority: priority || null,
      due_date: dueDate || null,
      labels,
      checklist,
    });
    onClose();
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
      data-testid="edit-card-modal"
    >
      <div className="w-full max-w-lg rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
            Edit Card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)] transition-colors"
            aria-label="Close"
            data-testid="close-edit-modal"
          >
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="edit-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Title *
            </label>
            <input
              id="edit-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(null); }}
              className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors"
              required
              data-testid="edit-card-title"
            />
            {titleError && (
              <p className="mt-1 text-xs text-red-500" role="alert">{titleError}</p>
            )}
          </div>

          {/* Details */}
          <div>
            <label htmlFor="edit-details" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Details *
            </label>
            <textarea
              id="edit-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors resize-none"
              required
              data-testid="edit-card-details"
            />
          </div>

          {/* Priority + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-priority" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Priority
              </label>
              <select
                id="edit-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as CardPriority | "")}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors"
                data-testid="edit-card-priority"
              >
                <option value="">None</option>
                {(Object.keys(PRIORITY_LABELS) as CardPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-due-date" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Due date
              </label>
              <input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors"
                data-testid="edit-card-due-date"
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <label htmlFor="edit-labels" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Labels <span className="font-normal normal-case tracking-normal">(comma-separated)</span>
            </label>
            <input
              id="edit-labels"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="e.g. frontend, bug, urgent"
              className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors"
              data-testid="edit-card-labels"
            />
          </div>

          {/* Checklist */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Checklist
              {checklist.length > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal text-[var(--gray-text)]">
                  {checklist.filter((i) => i.done).length}/{checklist.length}
                </span>
              )}
            </label>
            {checklist.length > 0 && (
              <ul className="mb-2 space-y-1" data-testid="checklist-items">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--surface)]">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="h-4 w-4 rounded border-[var(--stroke)] accent-[var(--primary-blue)]"
                      data-testid={`checklist-item-${item.id}`}
                    />
                    <span className={`flex-1 text-sm ${item.done ? "line-through text-[var(--gray-text)]" : "text-[var(--navy-dark)]"}`}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteChecklistItem(item.id)}
                      className="text-[var(--gray-text)] hover:text-red-500 transition-colors"
                      aria-label="Delete checklist item"
                      data-testid={`delete-checklist-item-${item.id}`}
                    >
                      <XIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                placeholder="Add checklist item…"
                className="flex-1 rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors"
                data-testid="new-checklist-item-input"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="rounded-xl border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--navy-dark)] hover:bg-[var(--surface)] transition-colors"
                data-testid="add-checklist-item-button"
              >
                Add
              </button>
            </div>
          </div>

          {/* Priority preview */}
          {priority && (
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[priority]}`}>
                {PRIORITY_LABELS[priority]} priority
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold text-[var(--gray-text)] hover:text-[var(--navy-dark)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              data-testid="save-card-button"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export { PRIORITY_COLORS, PRIORITY_LABELS };
