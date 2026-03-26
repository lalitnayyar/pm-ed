import {
  AUTH_STORAGE_KEY,
  clearSessionAuthenticated,
  getSessionAuthenticated,
  setSessionAuthenticated,
  validateCredentials,
} from "@/lib/auth";

describe("auth", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("validates hardcoded credentials", () => {
    expect(validateCredentials("user", "password")).toBe(true);
    expect(validateCredentials("user", "wrong")).toBe(false);
    expect(validateCredentials("wrong", "password")).toBe(false);
  });

  it("stores and clears session auth state", () => {
    expect(getSessionAuthenticated()).toBe(false);

    setSessionAuthenticated();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true");
    expect(getSessionAuthenticated()).toBe(true);

    clearSessionAuthenticated();
    expect(getSessionAuthenticated()).toBe(false);
  });
});
