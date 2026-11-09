"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { AuthUser, UserSession } from "./types";

type AuthResult = { success: boolean; error?: string };
type SignupResult = AuthResult & { needsEmailConfirmation?: boolean; message?: string };

interface AuthContextValue {
  user: AuthUser | null;
  session: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<AuthResult>;
  signup: (email: string, password?: string, fullName?: string) => Promise<SignupResult>;
  demoLogin: () => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Login/signup modal, opened from the profile icon or when a protected request returns 401. */
  authPrompt: { open: boolean; reason?: string };
  openAuthPrompt: (reason?: string) => void;
  closeAuthPrompt: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authPrompt, setAuthPrompt] = useState<{ open: boolean; reason?: string }>({ open: false });

  // Session state only ever comes from the server; the cookie is HTTP-only and no token is kept here.
  const applySession = (data: Record<string, unknown>) => {
    const s = data.session as UserSession | null | undefined;
    setSession(s ? { ...s, accessToken: "" } : null);
    setUser((data.user as AuthUser | null | undefined) ?? null);
  };

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await readJson(res);
      if (res.ok && data.authenticated && data.session) {
        applySession(data);
      } else {
        applySession({});
      }
    } catch (err) {
      console.warn("Failed to retrieve auth session:", err);
      applySession({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const openAuthPrompt = useCallback((reason?: string) => setAuthPrompt({ open: true, reason }), []);
  const closeAuthPrompt = useCallback(() => setAuthPrompt({ open: false }), []);

  // A protected API returning 401 usually means the access token ended, so renew it once from the
  // HTTP-only refresh cookie and retry; a 401 is issued before the route does any work. If that
  // fails, a user action (non-GET) asks them to sign in; background GETs stay silent.
  const refreshing = useRef<Promise<"renewed" | "ended" | "unavailable"> | null>(null);
  const promptRef = useRef(openAuthPrompt);
  promptRef.current = openAuthPrompt;
  useEffect(() => {
    const original = window.fetch;
    const renew = () =>
      (refreshing.current ??= original("/api/auth/refresh", { method: "POST" })
        .then(async (r) => {
          if (r.ok) {
            applySession(await readJson(r));
            return "renewed" as const;
          }
          return r.status === 401 ? ("ended" as const) : ("unavailable" as const);
        })
        .catch(() => "unavailable" as const)
        .finally(() => {
          refreshing.current = null;
        }));

    const wrapped: typeof window.fetch = async (input, init) => {
      let res = await original(input, init);
      try {
        if (res.status === 401) {
          const url = new URL(
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
            window.location.origin
          );
          const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
          if (
            url.origin === window.location.origin &&
            url.pathname.startsWith("/api/") &&
            !url.pathname.startsWith("/api/auth/") &&
            !(input instanceof Request)
          ) {
            const outcome = await renew();
            if (outcome === "renewed") {
              res = await original(input, init);
              if (res.status !== 401) return res;
            }
            if (outcome !== "unavailable") applySession({});
            if (method !== "GET") {
              promptRef.current("Please sign in to continue. Your session may have ended.");
            }
          }
        }
      } catch {
        // Never let the prompt logic break the request itself.
      }
      return res;
    };
    window.fetch = wrapped;
    return () => {
      if (window.fetch === wrapped) window.fetch = original;
    };
  }, []);

  const login = async (email: string, password?: string): Promise<AuthResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) {
        return { success: false, error: (data.error as string) || "Sign-in failed. Please try again." };
      }
      applySession(data);
      return { success: true };
    } catch {
      return { success: false, error: "Could not reach the server. Check your connection and try again." };
    }
  };

  const signup = async (email: string, password?: string, fullName?: string): Promise<SignupResult> => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) {
        return { success: false, error: (data.error as string) || "Sign-up failed. Please try again." };
      }
      if (data.needsEmailConfirmation) {
        // The server issues a mock-only placeholder session here; drop it so the user is clearly
        // signed out until they confirm their email and sign in.
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        applySession({});
        return { success: true, needsEmailConfirmation: true, message: data.message as string };
      }
      applySession(data);
      return { success: true, message: data.message as string };
    } catch {
      return { success: false, error: "Could not reach the server. Check your connection and try again." };
    }
  };

  const demoLogin = async (): Promise<AuthResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemo: true }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) {
        return { success: false, error: (data.error as string) || "Demo sign-in failed." };
      }
      applySession(data);
      return { success: true };
    } catch {
      return { success: false, error: "Could not reach the server." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      applySession({});
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: user !== null,
        isLoading,
        login,
        signup,
        demoLogin,
        logout,
        refreshSession: fetchSession,
        authPrompt,
        openAuthPrompt,
        closeAuthPrompt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
