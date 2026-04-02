import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { setStoredAuth } from "@/lib/auth";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const MOCK_USER = {
  id: 1,
  username: "user",
  email: null,
  created_at: "2026-01-01T00:00:00Z",
};

const MOCK_BOARDS = [{ id: 1, name: "My Board", description: "", created_at: "2026-01-01Z", updated_at: "2026-01-01Z" }];

const MOCK_BOARD_DETAIL = {
  id: 1,
  name: "My Board",
  description: "",
  board: initialData,
  updated_at: "2026-01-01Z",
};

/** Mock all board-related fetch calls needed after login. */
function mockBoardFetch(extraMocks?: Record<string, unknown>) {
  vi.spyOn(global, "fetch").mockImplementation((url: RequestInfo | URL) => {
    const path = typeof url === "string" ? url : url.toString();

    if (path.includes("/api/auth/login")) {
      return Promise.resolve(new Response(JSON.stringify({ token: "tok-123", user: MOCK_USER }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    if (path.includes("/api/auth/register")) {
      return Promise.resolve(new Response(JSON.stringify({ token: "tok-456", user: { ...MOCK_USER, username: "newuser" } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    if (path.includes("/api/auth/logout")) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (path.includes("/api/users/me")) {
      return Promise.resolve(new Response(JSON.stringify(MOCK_USER), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    if (path.includes("/api/search")) {
      const mockResults = (extraMocks?.["/api/search"] as unknown[]) ?? [];
      return Promise.resolve(new Response(JSON.stringify({ results: mockResults, total: mockResults.length }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    if (path.match(/\/api\/boards\/\d+\/activity/)) {
      const mockEntries = (extraMocks?.["/api/boards/activity"] as unknown[]) ?? [];
      return Promise.resolve(new Response(JSON.stringify({ entries: mockEntries }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    if (path.includes("/api/boards") && !path.match(/\/api\/boards\/\d/)) {
      // GET /api/boards or POST /api/boards
      if (extraMocks?.["/api/boards"]) {
        return Promise.resolve(new Response(JSON.stringify(extraMocks["/api/boards"]), {
          status: 200, headers: { "Content-Type": "application/json" },
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({ boards: MOCK_BOARDS }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    if (path.match(/\/api\/boards\/\d+/)) {
      return Promise.resolve(new Response(JSON.stringify(MOCK_BOARD_DETAIL), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    if (path.includes("/api/ai/chat")) {
      return Promise.resolve(new Response(JSON.stringify({
        username: "user", reply: "done", boardUpdate: null, updated_at: null,
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return Promise.reject(new Error(`Unhandled fetch: ${path}`));
  });
}

/** Set localStorage to simulate an already-authenticated session. */
function setAuthSession() {
  setStoredAuth("tok-123", MOCK_USER);
}

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    mockBoardFetch();
  });

  it("requires login before showing the board", () => {
    render(<KanbanBoard />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /kanban studio/i })).not.toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      const path = String(url);
      if (path.includes("/api/auth/login")) {
        return Promise.resolve(new Response(
          JSON.stringify({ detail: "Invalid username or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ));
      }
      return Promise.reject(new Error("Unhandled"));
    });

    render(<KanbanBoard />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid username or password/i);
  });

  it("renders five columns when authenticated", async () => {
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    fireEvent.change(input, { target: { value: "New Name" } });
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", { name: /delete new card/i });
    await userEvent.click(deleteButton);
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("logs in and logs out", async () => {
    render(<KanbanBoard />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("heading", { name: /kanban studio/i });
    expect(screen.getByTestId("current-user")).toHaveTextContent("user");

    await userEvent.click(screen.getByTestId("logout-button"));
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("can switch to register mode", async () => {
    render(<KanbanBoard />);
    await userEvent.click(screen.getByTestId("switch-to-register"));
    expect(screen.getByRole("heading", { name: /create account/i })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("switch-to-login"));
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("opens and closes AI chat", async () => {
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    expect(screen.queryByRole("heading", { name: /ai assistant/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /ai chat/i }));
    expect(screen.getByRole("heading", { name: /ai assistant/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /close chat/i }));
    expect(screen.queryByRole("heading", { name: /ai assistant/i })).not.toBeInTheDocument();
  });

  it("opens edit card modal when edit button is clicked", async () => {
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    // Hover to reveal edit button on first card
    const firstCard = screen.getAllByTestId(/^card-/i)[0];
    const cardId = firstCard.getAttribute("data-testid")?.replace("card-", "");
    const editButton = screen.getByTestId(`edit-card-${cardId}`);
    await userEvent.click(editButton);

    expect(screen.getByTestId("edit-card-modal")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("close-edit-modal"));
    expect(screen.queryByTestId("edit-card-modal")).not.toBeInTheDocument();
  });

  it("shows search input in header", async () => {
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("shows search results dropdown when typing", async () => {
    const mockResult = {
      board_id: 1, board_name: "My Board", card_id: "card-1",
      card_title: "Found Card", card_details: "details", column_title: "Backlog",
    };
    mockBoardFetch({ "/api/search": [mockResult] });
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "Found" } });
    await screen.findByTestId("search-dropdown");
    await screen.findByTestId("search-result-card-1");
    expect(screen.getByText("Found Card")).toBeInTheDocument();
  });

  it("shows empty search state when no results", async () => {
    mockBoardFetch({ "/api/search": [] });
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "nomatch" } });
    await screen.findByTestId("search-dropdown");
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it("opens and closes activity log panel", async () => {
    mockBoardFetch({
      "/api/boards/activity": [{
        id: 1, board_id: 1, user_id: 1, username: "user",
        action: "updated board", target: "", created_at: "2026-01-01T00:00:00Z",
      }],
    });
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    await userEvent.click(screen.getByTestId("activity-log-button"));
    await screen.findByTestId("activity-panel");
    await screen.findByTestId("activity-entries");
    expect(screen.getByText(/updated board/i)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("close-activity-panel"));
    expect(screen.queryByTestId("activity-panel")).not.toBeInTheDocument();
  });

  it("shows empty activity log message when no entries", async () => {
    mockBoardFetch({ "/api/boards/activity": [] });
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    await userEvent.click(screen.getByTestId("activity-log-button"));
    await screen.findByTestId("activity-panel");
    await waitFor(() => {
      expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
    });
  });

  it("opens profile modal when username is clicked", async () => {
    setAuthSession();
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    await userEvent.click(screen.getByTestId("current-user"));
    await screen.findByTestId("profile-modal");
    expect(screen.getByTestId("profile-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("close-profile-modal"));
    expect(screen.queryByTestId("profile-modal")).not.toBeInTheDocument();
  });
});
