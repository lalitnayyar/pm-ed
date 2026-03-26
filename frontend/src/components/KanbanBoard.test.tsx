import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AUTH_STORAGE_KEY } from "@/lib/auth";
import { KanbanBoard } from "@/components/KanbanBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

const signIn = async () => {
  await userEvent.type(screen.getByLabelText(/username/i), "user");
  await userEvent.type(screen.getByLabelText(/password/i), "password");
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("KanbanBoard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("requires login before showing the board", () => {
    render(<KanbanBoard />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /kanban studio/i })).not.toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    render(<KanbanBoard />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/invalid username or password/i);
  });

  it("renders five columns", () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("logs in and logs out", async () => {
    render(<KanbanBoard />);

    await signIn();
    expect(screen.getByRole("heading", { name: /kanban studio/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("opens and closes AI chat", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    render(<KanbanBoard />);

    // Chat should not be visible initially
    expect(screen.queryByRole("heading", { name: /ai assistant/i })).not.toBeInTheDocument();

    // Open chat
    await userEvent.click(screen.getByRole("button", { name: /ai chat/i }));
    expect(screen.getByRole("heading", { name: /ai assistant/i })).toBeInTheDocument();

    // Close chat
    await userEvent.click(screen.getByRole("button", { name: /close chat/i }));
    expect(screen.queryByRole("heading", { name: /ai assistant/i })).not.toBeInTheDocument();
  });

  it("applies board updates from AI", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");

    // Mock the AI chat endpoint
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/ai/chat")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              username: "user",
              reply: "Renamed backlog",
              boardUpdate: {
                columns: [
                  { id: "col-backlog", title: "Updated Backlog", cardIds: ["card-1", "card-2"] },
                  { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
                  { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
                  { id: "col-review", title: "Review", cardIds: ["card-6"] },
                  { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
                ],
                cards: {
                  "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft quarterly themes with impact statements and metrics." },
                  "card-2": { id: "card-2", title: "Gather customer signals", details: "Review support tags, sales notes, and churn feedback." },
                  "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch initial dashboard layout and key drill-downs." },
                  "card-4": { id: "card-4", title: "Refine status language", details: "Standardize column labels and tone across the board." },
                  "card-5": { id: "card-5", title: "Design card layout", details: "Add hierarchy and spacing for scanning dense lists." },
                  "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify hover, focus, and loading states." },
                  "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy approved and asset pack delivered." },
                  "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Document release notes and share internally." },
                },
              },
              updated_at: "2026-03-26T12:00:00Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      // Mock other API calls
      return Promise.reject(new Error("Unhandled fetch"));
    });

    render(<KanbanBoard />);

    // Open chat
    await userEvent.click(screen.getByRole("button", { name: /ai chat/i }));

    // Send message to AI
    const input = screen.getByPlaceholderText(/ask me to/i);
    await userEvent.type(input, "Rename backlog");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    // Wait for AI response
    await screen.findByText("Renamed backlog");

    // Check that column title was updated
    const columnTitles = screen.getAllByText(/backlog/i);
    expect(columnTitles.some((el) => el.textContent?.includes("Updated Backlog"))).toBe(true);
  });
});
