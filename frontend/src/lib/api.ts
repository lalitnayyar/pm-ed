import type { BoardData } from "@/lib/kanban";

const DEFAULT_USERNAME = "user";

type BoardApiResponse = {
  username: string;
  board: BoardData;
  updated_at: string;
};

export const getBoard = async (username: string = DEFAULT_USERNAME): Promise<BoardData> => {
  const response = await fetch(`/api/board?username=${encodeURIComponent(username)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch board: ${response.status}`);
  }

  const payload = (await response.json()) as BoardApiResponse;
  return payload.board;
};

export const saveBoard = async (
  board: BoardData,
  username: string = DEFAULT_USERNAME
): Promise<void> => {
  const response = await fetch(`/api/board?username=${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ board }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save board: ${response.status}`);
  }
};
