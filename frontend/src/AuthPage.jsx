import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  Route,
  Sparkles,
} from "lucide-react";
import { supabase, authRedirectUrl } from "./account";
import { beginAccountLogin, finishAccountLogin } from "./workspaceSession";
import ThemeToggle from "./Theme";
import "./account-flow.css";

export default function AuthPage({ mode, navigate, onPasswordUpdated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const signup = mode === "signup";
  const forgot = mode === "forgot";
  const reset = mode === "reset";
  const title = reset
    ? "A fresh start."
    : forgot
      ? "Let’s get you back in."
      : signup
        ? "Your next chapter starts here."
        : "Welcome back.";

  async function googleLogin() {
    if (!supabase || busy || googleBusy) return;
    setError("");
    setMessage("");
    setGoogleBusy(true);
    beginAccountLogin();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authRedirectUrl(),
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch {
      finishAccountLogin(null);
      setError(
        "Google sign-in could not start. Please try again or sign in with email.",
      );
      setGoogleBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!supabase || busy || googleBusy) return;
    setError("");
    setMessage("");
    setBusy(true);
    if (!forgot && !reset) beginAccountLogin();
    try {
      if (signup && !name.trim()) throw new Error("Please enter your name.");
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      let result;
      if (reset) {
        result = await supabase.auth.updateUser({ password });
      } else if (forgot) {
        result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
      } else if (signup) {
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: redirectTo,
          },
        });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }
      if (result.error) throw result.error;
      if (reset) {
        onPasswordUpdated();
        navigate("explore");
      } else if (forgot) {
        setMessage(
          "If an account exists for this email, a password-reset link will arrive shortly.",
        );
      } else if (signup && !result.data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        navigate("explore");
      }
    } catch (err) {
      finishAccountLogin(null);
      setError(
        err.message || "We couldn’t complete that request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a href="#home" className="brand">
          <span className="brand-icon">
            <Route size={23} />
          </span>
          CareerBridge
        </a>
        <div className="auth-story-copy">
          <span className="eyebrow">
            <Sparkles size={15} /> YOUR POSSIBILITIES, CONNECTED
          </span>
          <h1>
            Big futures.
            <br />
            <em>Small first steps.</em>
          </h1>
          <p>
            Keep your skills, favourite careers and next steps in one space that
            grows with you.
          </p>
          <div className="auth-path">
            <span>You are here</span>
            <i />
            <span>What comes next?</span>
          </div>
        </div>
        <p className="auth-footnote">
          A little curiosity can take you somewhere new.
        </p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-toolbar">
          <a href="#home" className="text-link">
            <ArrowLeft size={16} /> Back to home
          </a>
          <ThemeToggle />
        </div>
        <div className="auth-form-wrap">
          <div className="auth-symbol">
            <LockKeyhole size={24} />
          </div>
          <h2>{title}</h2>
          <p>
            {reset
              ? "Choose a new password for your account."
              : forgot
                ? "We’ll email you a link to reset your password."
                : signup
                  ? "Create an account to save your profile and your plans."
                  : "Sign in to pick up where you left off."}
          </p>
          {!supabase && (
            <div className="alert info" role="status">
              Accounts are not connected yet. You can explore as a guest while
              account setup is completed.
            </div>
          )}
          {!forgot && !reset && (
            <>
              <button
                className="google-sign-in"
                onClick={googleLogin}
                disabled={busy || googleBusy || !supabase}
              >
                {googleBusy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 48 48"
                  >
                    <path
                      fill="#4285F4"
                      d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.8-3.5 6.1-8.7 6.1-15z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20.4 20.4 0 0 0 24 44z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M12.6 27.5a12.3 12.3 0 0 1 0-7V15H5.8a20.1 20.1 0 0 0 0 18l6.8-5.5z"
                    />
                    <path
                      fill="#EA4335"
                      d="M24 12.1c3 0 5.7 1 7.8 3l5.9-5.9C34.1 5.8 29.5 4 24 4A20.4 20.4 0 0 0 5.8 15l6.8 5.5c1.6-4.8 6.1-8.4 11.4-8.4z"
                    />
                  </svg>
                )}
                {googleBusy ? "Opening Google…" : "Continue with Google"}
              </button>
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            </>
          )}
          <form onSubmit={submit}>
            {signup && (
              <label className="field">
                Your name
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                />
              </label>
            )}
            {!reset && (
              <label className="field">
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                />
              </label>
            )}
            {!forgot && (
              <label className="field">
                Password
                <input
                  type="password"
                  autoComplete={
                    signup || reset ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={signup || reset ? 8 : 1}
                  maxLength={128}
                  placeholder={
                    signup || reset ? "At least 8 characters" : "Your password"
                  }
                />
              </label>
            )}
            {!signup && !forgot && !reset && (
              <a className="forgot-link" href="#forgot">
                Forgot password?
              </a>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="alert success" role="status">
                {message}
              </div>
            )}
            <button
              className="primary-button"
              disabled={busy || googleBusy || !supabase}
            >
              {busy ? <LoaderCircle size={18} className="spin" /> : null}
              {reset
                ? "Update password"
                : forgot
                  ? "Send reset link"
                  : signup
                    ? "Create account"
                    : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to CareerBridge?"}{" "}
            <a href={signup ? "#login" : "#signup"}>
              {signup ? "Sign in" : "Create an account"}
            </a>
          </p>
          <a className="guest-link" href="#explore">
            Continue exploring as a guest <ArrowRight size={15} />
          </a>
        </div>
      </section>
    </main>
  );
}
