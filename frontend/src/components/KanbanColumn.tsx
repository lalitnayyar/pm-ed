import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

// Accent color per column position (cycles if >5 columns)
const COLUMN_ACCENTS = [
  "bg-[#888]",          // Backlog — gray
  "bg-[var(--primary-blue)]",   // Discovery — blue
  "bg-[var(--accent-yellow)]",  // In Progress — yellow
  "bg-[var(--secondary-purple)]", // Review — purple
  "bg-emerald-500",     // Done — green
] as const;

type KanbanColumnProps = {
  column: Column;
  columnIndex: number;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onEditCard: (card: Card) => void;
};

export const KanbanColumn = ({
  column,
  columnIndex,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
  onEditCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const accentColor = COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length];

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[480px] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-3 shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)] bg-[#fffdf0]"
      )}
      data-testid={`column-${column.id}`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx("h-2 w-2 flex-shrink-0 rounded-full", accentColor)} />
        <input
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-display text-sm font-semibold text-[var(--navy-dark)] outline-none truncate"
          aria-label="Column title"
        />
        <span className="flex-shrink-0 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--gray-text)]">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onEdit={onEditCard}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-[10px] font-semibold uppercase tracking-widest text-[var(--gray-text)]">
            Drop here
          </div>
        )}
      </div>

      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
