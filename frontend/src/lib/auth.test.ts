import { describe, it, expect, beforeEach } from "vitest";
import {
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
  type AuthUser,
} from "@/lib/auth";

const mockUser: AuthUser = {
  id: 1,
  username: "testuser",
  email: "test@example.com",
  created_at: "2026-01-01T00:00:00Z",
};

describe("auth storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no token stored", () => {
    expect(getStoredToken()).toBeNull();
  });

  it("returns null when no user stored", () => {
    expect(getStoredUser()).toBeNull();
  });

  it("stores and retrieves token and user", () => {
    setStoredAuth("my-token", mockUser);
    expect(getStoredToken()).toBe("my-token");
    const stored = getStoredUser();
    expect(stored?.username).toBe("testuser");
    expect(stored?.id).toBe(1);
  });

  it("clearStoredAuth removes token and user", () => {
    setStoredAuth("tok", mockUser);
    clearStoredAuth();
    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it("getStoredUser returns null for corrupt data", () => {
    window.localStorage.setItem("pm-auth-user", "{not valid json");
    expect(getStoredUser()).toBeNull();
  });
});
