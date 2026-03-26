export const AUTH_USERNAME = "user";
export const AUTH_PASSWORD = "password";
export const AUTH_STORAGE_KEY = "pm-authenticated";

export const validateCredentials = (username: string, password: string): boolean =>
  username === AUTH_USERNAME && password === AUTH_PASSWORD;

export const getSessionAuthenticated = (): boolean =>
  window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";

export const setSessionAuthenticated = (): void => {
  window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
};

export const clearSessionAuthenticated = (): void => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};
