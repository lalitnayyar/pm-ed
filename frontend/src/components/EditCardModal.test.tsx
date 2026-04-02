import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditCardModal } from "@/components/EditCardModal";
import type { Card } from "@/lib/kanban";

const mockCard: Card = {
  id: "card-1",
  title: "Test Card",
  details: "Some details here",
  priority: null,
  due_date: null,
  labels: [],
};

describe("EditCardModal", () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with card title and details pre-filled", () => {
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);
    expect(screen.getByTestId("edit-card-title")).toHaveValue("Test Card");
    expect(screen.getByTestId("edit-card-details")).toHaveValue("Some details here");
  });

  it("calls onClose when cancel button clicked", async () => {
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when X button clicked", async () => {
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);
    await userEvent.click(screen.getByTestId("close-edit-modal"));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop clicked", async () => {
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);
    await userEvent.click(screen.getByTestId("edit-card-modal"));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("saves updated title and details", async () => {
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);

    const titleInput = screen.getByTestId("edit-card-title");
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    const detailsInput = screen.getByTestId("edit-card-details");
    fireEvent.change(detailsInput, { target: { value: "Updated details" } });

    await userEvent.click(screen.getByTestId("save-card-button"));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated Title", details: "Updated details" })
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("shows error for whitespace-only title and does not save", async () => {
    // Use whitespace — passes HTML `required` but our trimming catches it
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);
    fireEvent.change(screen.getByTestId("edit-card-title"), { target: { value: "   " } });
    await userEvent.click(screen.getByTestId("save-card-button"));
    expect(screen.getByRole("alert")).toHaveTextContent(/title is required/i);
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("saves priority selection", async () => {
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);
    fireEvent.change(screen.getByTestId("edit-card-priority"), { target: { value: "high" } });
    await userEvent.click(screen.getByTestId("save-card-button"));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "high" })
    );
  });

  it("saves due date", async () => {
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);
    fireEvent.change(screen.getByTestId("edit-card-due-date"), { target: { value: "2026-12-01" } });
    await userEvent.click(screen.getByTestId("save-card-button"));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: "2026-12-01" })
    );
  });

  it("saves labels from comma-separated input", async () => {
    render(<EditCardModal card={mockCard} onSave={mockOnSave} onClose={mockOnClose} />);
    fireEvent.change(screen.getByTestId("edit-card-labels"), {
      target: { value: "frontend, bug, urgent" },
    });
    await userEvent.click(screen.getByTestId("save-card-button"));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["frontend", "bug", "urgent"] })
    );
  });

  it("pre-fills existing priority", () => {
    const cardWithPriority: Card = { ...mockCard, priority: "medium" };
    render(<EditCardModal card={cardWithPriority} onSave={mockOnSave} onClose={mockOnClose} />);
    expect(screen.getByTestId("edit-card-priority")).toHaveValue("medium");
  });

  it("pre-fills existing due date", () => {
    const cardWithDate: Card = { ...mockCard, due_date: "2026-06-15" };
    render(<EditCardModal card={cardWithDate} onSave={mockOnSave} onClose={mockOnClose} />);
    expect(screen.getByTestId("edit-card-due-date")).toHaveValue("2026-06-15");
  });

  it("pre-fills existing labels", () => {
    const cardWithLabels: Card = { ...mockCard, labels: ["api", "v2"] };
    render(<EditCardModal card={cardWithLabels} onSave={mockOnSave} onClose={mockOnClose} />);
    expect(screen.getByTestId("edit-card-labels")).toHaveValue("api, v2");
  });

  it("sets priority to null when None selected", async () => {
    const cardWithPriority: Card = { ...mockCard, priority: "high" };
    render(<EditCardModal card={cardWithPriority} onSave={mockOnSave} onClose={mockOnClose} />);
    fireEvent.change(screen.getByTestId("edit-card-priority"), { target: { value: "" } });
    await userEvent.click(screen.getByTestId("save-card-button"));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ priority: null })
    );
  });
});
