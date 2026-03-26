import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChat } from "@/components/AiChat";
import { initialData } from "@/lib/kanban";

describe("AiChat", () => {
  const mockOnClose = vi.fn();
  const mockOnBoardUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when not open", () => {
    render(
      <AiChat
        isOpen={false}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );
    expect(screen.queryByRole("heading", { name: /ai assistant/i })).not.toBeInTheDocument();
  });

  it("renders when open", () => {
    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );
    expect(screen.getByRole("heading", { name: /ai assistant/i })).toBeInTheDocument();
  });

  it("closes when close button is clicked", async () => {
    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /close chat/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("initializes with helpful message when no messages", () => {
    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );
    expect(
      screen.getByText(/ask me to create, edit, or move cards/i)
    ).toBeInTheDocument();
  });

  it("sends message when form is submitted", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          username: "user",
          reply: "Message received",
          boardUpdate: null,
          updated_at: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );

    const input = screen.getByPlaceholderText(/ask me to/i);
    await userEvent.type(input, "Hello AI");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Hello AI"),
      })
    );

    // Wait for assistant message
    await screen.findByText("Message received");
    expect(screen.getByText("Message received")).toBeInTheDocument();
  });

  it("displays user messages in chat", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          username: "user",
          reply: "Got it",
          boardUpdate: null,
          updated_at: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );

    const input = screen.getByPlaceholderText(/ask me to/i);
    await userEvent.type(input, "Create a new card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByText("Create a new card")).toBeInTheDocument();
  });

  it("calls onBoardUpdate when AI returns board changes", async () => {
    const updatedBoard = {
      columns: [
        {
          id: "col-backlog",
          title: "Renamed Backlog",
          cardIds: ["card-1", "card-2"],
        },
        ...initialData.columns.slice(1),
      ],
      cards: initialData.cards,
    };

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          username: "user",
          reply: "Renamed the backlog",
          boardUpdate: updatedBoard,
          updated_at: "2026-03-26T12:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );

    const input = screen.getByPlaceholderText(/ask me to/i);
    await userEvent.type(input, "Rename backlog");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("Renamed the backlog");
    expect(mockOnBoardUpdate).toHaveBeenCalledWith(updatedBoard);
  });

  it("displays error message on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );

    const input = screen.getByPlaceholderText(/ask me to/i);
    await userEvent.type(input, "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText(/error/i);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it("disables input while loading", async () => {
    let resolveResponse: (value: Response) => void = () => {};
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    vi.spyOn(global, "fetch").mockReturnValue(responsePromise);

    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );

    const input = screen.getByPlaceholderText(/ask me to/i) as HTMLInputElement;
    const sendButton = screen.getByRole("button", { name: /send/i });

    await userEvent.type(input, "Hello");
    await userEvent.click(sendButton);

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();

    resolveResponse(
      new Response(
        JSON.stringify({
          username: "user",
          reply: "Response",
          boardUpdate: null,
          updated_at: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await screen.findByText("Thinking...");
  });

  it("clears input after sending message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          username: "user",
          reply: "OK",
          boardUpdate: null,
          updated_at: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );

    const input = screen.getByPlaceholderText(/ask me to/i) as HTMLInputElement;
    await userEvent.type(input, "Hello");
    expect(input.value).toBe("Hello");

    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("OK");
    expect(input.value).toBe("");
  });

  it("sends conversation history with messages", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          username: "user",
          reply: "Second response",
          boardUpdate: null,
          updated_at: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { rerender } = render(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );

    // First message
    let input = screen.getByPlaceholderText(/ask me to/i);
    await userEvent.type(input, "First message");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("First message");

    // Rerender to ensure component is still mounted
    rerender(
      <AiChat
        isOpen={true}
        onClose={mockOnClose}
        onBoardUpdate={mockOnBoardUpdate}
        currentBoard={initialData}
        username="user"
      />
    );

    // Second message
    input = screen.getByPlaceholderText(/ask me to/i);
    await userEvent.type(input, "Second message");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    // Check that second call includes conversation history
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const lastCall = calls[calls.length - 1];
    const bodyText = lastCall[1]?.body as string;
    const bodyObj = JSON.parse(bodyText);

    // Should have conversation history from first exchange
    expect(bodyObj.conversationHistory.length).toBeGreaterThan(0);
  });
});
