"use client";

import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

/** Minimal login/signup modal. Credentials live only in this component's state while typing. */
export function AuthModal() {
  const { authPrompt, closeAuthPrompt, login, signup, demoLogin } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"form" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Clear the password whenever the modal closes.
  useEffect(() => {
    if (!authPrompt.open) {
      setPassword("");
      setError(null);
      setBusy(null);
    }
  }, [authPrompt.open]);

  if (!authPrompt.open) return null;

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy("form");
    if (mode === "login") {
      const result = await login(email.trim(), password);
      setBusy(null);
      if (result.success) closeAuthPrompt();
      else setError(result.error ?? "Sign-in failed.");
      return;
    }
    const result = await signup(email.trim(), password);
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? "Sign-up failed.");
    } else if (result.needsEmailConfirmation) {
      setPassword("");
      setMode("login");
      setNotice(
        `We sent a confirmation link to ${email.trim()}. Open it to verify your email, then sign in here.`
      );
    } else {
      closeAuthPrompt();
    }
  };

  const handleDemo = async () => {
    if (busy) return;
    setError(null);
    setBusy("demo");
    const result = await demoLogin();
    setBusy(null);
    if (result.success) closeAuthPrompt();
    else setError(result.error ?? "Demo sign-in failed.");
  };

  const inputClass =
    "w-full h-9 px-3 rounded-lg border border-[#BFD7F7] bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 p-4"
      onClick={closeAuthPrompt}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rico-auth-title"
        className="w-full max-w-sm rounded-2xl border border-[#BFD7F7] bg-[#F4F9FF] p-5 shadow-xl font-[Inter,system-ui,sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h2 id="rico-auth-title" className="text-base font-semibold text-slate-800">
            {mode === "login" ? "Sign in to Rico" : "Create your Rico account"}
          </h2>
          <button
            type="button"
            onClick={closeAuthPrompt}
            className="p-1 rounded-md text-slate-500 hover:bg-[#DCEBFE]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {authPrompt.reason && !notice && (
          <p className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {authPrompt.reason}
          </p>
        )}
        {notice && (
          <p className="mb-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {notice}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            disabled={busy !== null}
          />
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            disabled={busy !== null}
          />
          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy !== null}
            className="h-9 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy === "form" && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-3 text-xs text-slate-600 text-center">
          {mode === "login" ? "No account yet? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="font-medium text-sky-700 hover:underline"
            disabled={busy !== null}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <div className="mt-4 pt-3 border-t border-[#D6E8FD]">
          <button
            type="button"
            onClick={handleDemo}
            disabled={busy !== null}
            className="w-full h-8 rounded-lg border border-[#BFD7F7] bg-white text-xs text-slate-700 hover:bg-[#EBF3FE] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy === "demo" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Judge demo (mock payments only)
          </button>
        </div>
      </div>
    </div>
  );
}
