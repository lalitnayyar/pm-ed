import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BoardSelector } from "@/components/BoardSelector";
import type { BoardInfo } from "@/lib/api";

const mockBoards: BoardInfo[] = [
  { id: 1, name: "My Board", description: "", created_at: "2026-01-01Z", updated_at: "2026-01-01Z" },
  { id: 2, name: "Sprint 1", description: "First sprint", created_at: "2026-01-02Z", updated_at: "2026-01-02Z" },
];

describe("BoardSelector", () => {
  const onSelect = vi.fn();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onRename = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all board tabs", () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    expect(screen.getByTestId("board-tab-1")).toBeInTheDocument();
    expect(screen.getByTestId("board-tab-2")).toBeInTheDocument();
  });

  it("marks active board with different style", () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    const activeTab = screen.getByTestId("board-tab-1");
    expect(activeTab.className).toContain("bg-[var(--primary-blue)]");
  });

  it("calls onSelect when a board tab is clicked", async () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    await userEvent.click(screen.getByTestId("board-tab-2"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("shows add board button", () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    expect(screen.getByTestId("add-board-button")).toBeInTheDocument();
  });

  it("shows create form when add board clicked", async () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    await userEvent.click(screen.getByTestId("add-board-button"));
    expect(screen.getByTestId("new-board-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("create-board-submit")).toBeInTheDocument();
  });

  it("calls onCreate with name and description", async () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    await userEvent.click(screen.getByTestId("add-board-button"));
    await userEvent.type(screen.getByTestId("new-board-name-input"), "New Sprint");
    await userEvent.type(screen.getByTestId("new-board-desc-input"), "Sprint desc");
    await userEvent.click(screen.getByTestId("create-board-submit"));
    expect(onCreate).toHaveBeenCalledWith("New Sprint", "Sprint desc");
  });

  it("cancels create form", async () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    await userEvent.click(screen.getByTestId("add-board-button"));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByTestId("new-board-name-input")).not.toBeInTheDocument();
  });

  it("shows delete button only when more than one board", () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    // Delete buttons exist (hidden via CSS, but in DOM) when >1 board
    expect(screen.getByTestId("delete-board-1")).toBeInTheDocument();
  });

  it("does not show delete button for single board", () => {
    render(
      <BoardSelector
        boards={[mockBoards[0]]}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    expect(screen.queryByTestId("delete-board-1")).not.toBeInTheDocument();
  });

  it("calls onDelete when delete button clicked", async () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    await userEvent.click(screen.getByTestId("delete-board-2"));
    expect(onDelete).toHaveBeenCalledWith(2);
  });

  it("shows rename input when pencil clicked", async () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    await userEvent.click(screen.getByTestId("rename-board-1"));
    expect(screen.getByTestId("rename-board-input")).toHaveValue("My Board");
  });

  it("calls onRename on Enter key", async () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    await userEvent.click(screen.getByTestId("rename-board-1"));
    const input = screen.getByTestId("rename-board-input");
    fireEvent.change(input, { target: { value: "Renamed Board" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith(1, "Renamed Board");
  });

  it("cancels rename on Escape key", async () => {
    render(
      <BoardSelector
        boards={mockBoards}
        activeBoardId={1}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onRename={onRename}
      />
    );
    await userEvent.click(screen.getByTestId("rename-board-1"));
    fireEvent.keyDown(screen.getByTestId("rename-board-input"), { key: "Escape" });
    expect(screen.queryByTestId("rename-board-input")).not.toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });
});
