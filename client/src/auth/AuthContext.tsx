import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api";

/**
 * Reactive auth state for the admin panel.
 *
 * Why this exists: route guards in main.tsx used to call `api.isLoggedIn()`
 * (a plain function of localStorage) inline in JSX. That value is computed
 * once per render and never re-evaluated when localStorage changes, so after a
 * successful login the `/admin` guard still believed the user was logged out
 * and bounced them back to `/login` — the admin had to refresh the page to get
 * in (and likewise on logout).
 *
 * This context holds the auth flag in React state. `login`/`logout` update the
 * state, which re-renders every route guard immediately — no page refresh
 * needed.
 */
interface AuthContextValue {
  isAuthenticated: boolean;
  /** Calls api.login and flips the auth flag on success. */
  login: (password: string) => Promise<void>;
  /** Clears the token and the auth flag. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialise from localStorage so a reload of an already-logged-in tab keeps
  // the session without a flicker through /login.
  const [isAuthenticated, setAuthenticated] = useState<boolean>(() =>
    api.isLoggedIn(),
  );

  const login = useCallback(async (password: string) => {
    await api.login(password); // throws on wrong password; flag stays false.
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setAuthenticated(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, login, logout }),
    [isAuthenticated, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the reactive auth state. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
