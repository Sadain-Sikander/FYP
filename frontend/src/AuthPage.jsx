import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  Route,
  Sparkles,
} from "lucide-react";
import { supabase } from "./account";

export default function AuthPage({ mode, navigate, onPasswordUpdated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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

  async function submit(event) {
    event.preventDefault();
    if (!supabase || busy) return;
    setError("");
    setMessage("");
    setBusy(true);
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
        <a href="#home" className="text-link">
          <ArrowLeft size={16} /> Back to home
        </a>
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
            <button className="primary-button" disabled={busy || !supabase}>
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
