"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/components/EditCardModal";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (card: Card) => void;
};

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group rounded-2xl border border-transparent bg-white px-3 py-3 shadow-[0_4px_12px_rgba(3,33,71,0.07)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && card.details !== "No details yet." && (
            <p className="mt-1 text-xs leading-5 text-[var(--gray-text)] line-clamp-3">
              {card.details}
            </p>
          )}

          {/* Priority + due date badges */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {card.priority && (
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[card.priority]}`}
                data-testid={`card-priority-${card.id}`}
              >
                {PRIORITY_LABELS[card.priority]}
              </span>
            )}
            {card.due_date && (
              <span
                className={clsx(
                  "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                  isOverdue(card.due_date)
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-[var(--stroke)] bg-[var(--surface)] text-[var(--gray-text)]"
                )}
                data-testid={`card-due-date-${card.id}`}
              >
                <CalendarIcon />
                {card.due_date}
              </span>
            )}
            {(card.labels ?? []).map((label) => (
              <span
                key={label}
                className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--gray-text)]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card);
            }}
            className="rounded-lg p-1.5 text-[var(--gray-text)] opacity-0 transition-all group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-500"
            aria-label={`Edit ${card.title}`}
            data-testid={`edit-card-${card.id}`}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="rounded-lg p-1.5 text-[var(--gray-text)] opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
            aria-label={`Delete ${card.title}`}
            data-testid={`delete-card-${card.id}`}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
};
