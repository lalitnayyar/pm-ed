import type { BoardData } from "@/lib/kanban";
import { authHeader } from "@/lib/auth";

const DEFAULT_USERNAME = "user";

// ── Response types ────────────────────────────────────────────────────────────

type BoardApiResponse = {
  username: string;
  board: BoardData;
  updated_at: string;
};

export type BoardInfo = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type BoardDetailResponse = {
  id: number;
  name: string;
  description: string;
  board: BoardData;
  updated_at: string;
};

// ── Legacy board endpoints (used by AI chat, backward compat) ─────────────────

export const getBoard = async (username: string = DEFAULT_USERNAME): Promise<BoardData> => {
  const response = await fetch(`/api/board?username=${encodeURIComponent(username)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to fetch board: ${response.status}`);
  const payload = (await response.json()) as BoardApiResponse;
  return payload.board;
};

export const saveBoard = async (
  board: BoardData,
  username: string = DEFAULT_USERNAME
): Promise<void> => {
  const response = await fetch(`/api/board?username=${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board }),
  });
  if (!response.ok) throw new Error(`Failed to save board: ${response.status}`);
};

// ── Multi-board API (requires auth token) ─────────────────────────────────────

export const apiBoardsList = async (token: string): Promise<BoardInfo[]> => {
  const resp = await fetch("/api/boards", { headers: authHeader(token) });
  if (!resp.ok) throw new Error("Failed to list boards");
  const data = (await resp.json()) as { boards: BoardInfo[] };
  return data.boards;
};

export const apiBoardCreate = async (
  token: string,
  name: string,
  description = ""
): Promise<BoardDetailResponse> => {
  const resp = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ name, description }),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? "Failed to create board");
  }
  return resp.json() as Promise<BoardDetailResponse>;
};

export const apiBoardGet = async (
  token: string,
  boardId: number
): Promise<BoardDetailResponse> => {
  const resp = await fetch(`/api/boards/${boardId}`, { headers: authHeader(token) });
  if (!resp.ok) throw new Error("Failed to load board");
  return resp.json() as Promise<BoardDetailResponse>;
};

export const apiBoardSave = async (
  token: string,
  boardId: number,
  board: BoardData
): Promise<BoardDetailResponse> => {
  const resp = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ board }),
  });
  if (!resp.ok) throw new Error("Failed to save board");
  return resp.json() as Promise<BoardDetailResponse>;
};

export const apiBoardRename = async (
  token: string,
  boardId: number,
  name: string,
  description?: string
): Promise<BoardDetailResponse> => {
  const resp = await fetch(`/api/boards/${boardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ name, description }),
  });
  if (!resp.ok) throw new Error("Failed to rename board");
  return resp.json() as Promise<BoardDetailResponse>;
};

export const apiBoardDelete = async (token: string, boardId: number): Promise<void> => {
  const resp = await fetch(`/api/boards/${boardId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? "Failed to delete board");
  }
};

// ── User profile ──────────────────────────────────────────────────────────────

export type UserProfile = {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
};

export const apiGetMe = async (token: string): Promise<UserProfile> => {
  const resp = await fetch("/api/users/me", { headers: authHeader(token) });
  if (!resp.ok) throw new Error("Failed to fetch profile");
  return resp.json() as Promise<UserProfile>;
};

// ── Search ────────────────────────────────────────────────────────────────────

export type CardSearchResult = {
  board_id: number;
  board_name: string;
  card_id: string;
  card_title: string;
  card_details: string;
  column_title: string;
};

export const apiSearch = async (
  token: string,
  query: string
): Promise<CardSearchResult[]> => {
  const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    headers: authHeader(token),
  });
  if (!resp.ok) throw new Error("Search failed");
  const data = (await resp.json()) as { results: CardSearchResult[]; total: number };
  return data.results;
};

// ── Activity log ─────────────────────────────────────────────────────────────

export type ActivityEntry = {
  id: number;
  board_id: number;
  user_id: number;
  username: string;
  action: string;
  target: string;
  created_at: string;
};

export const apiBoardActivity = async (
  token: string,
  boardId: number
): Promise<ActivityEntry[]> => {
  const resp = await fetch(`/api/boards/${boardId}/activity`, { headers: authHeader(token) });
  if (!resp.ok) throw new Error("Failed to load activity");
  const data = (await resp.json()) as { entries: ActivityEntry[] };
  return data.entries;
};

export const apiUpdateProfile = async (
  token: string,
  payload: { email?: string; current_password?: string; new_password?: string }
): Promise<UserProfile> => {
  const resp = await fetch("/api/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? "Failed to update profile");
  }
  return resp.json() as Promise<UserProfile>;
};
