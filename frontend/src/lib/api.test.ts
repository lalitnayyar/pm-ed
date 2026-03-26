import { getBoard, saveBoard } from "@/lib/api";
import { initialData } from "@/lib/kanban";

describe("api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads board from api", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ username: "user", board: initialData, updated_at: "now" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const board = await getBoard();
    expect(board.columns).toHaveLength(5);
  });

  it("throws when board fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 500 }));

    await expect(getBoard()).rejects.toThrow(/failed to fetch board/i);
  });

  it("saves board to api", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await saveBoard(initialData);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/board?username=user",
      expect.objectContaining({ method: "PUT" })
    );
  });
});
