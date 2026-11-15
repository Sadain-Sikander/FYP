import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "./account";
import ThemeToggle from "./Theme";
import "./account-flow.css";

export default function AccountSetup({ onComplete, signOut }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { display_name: name.trim() },
      });
      if (error || !data.user) throw error || new Error();
      onComplete(data.user);
    } catch {
      setError("Your name could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-setup">
      <div className="auth-toolbar">
        <span>CareerBridge</span>
        <ThemeToggle />
      </div>
      <span className="eyebrow">MAKE YOURSELF AT HOME</span>
      <h1>What should we call you?</h1>
      <p>Add your name to finish setting up your account.</p>
      <form onSubmit={submit}>
        <label>
          Your name
          <input
            autoFocus
            autoComplete="name"
            value={name}
            maxLength={80}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <button className="loom-cta" disabled={busy}>
          {busy ? "Saving your name…" : "Continue"}
          <ArrowRight size={16} />
        </button>
      </form>
      <button
        className="loom-text"
        disabled={busy}
        onClick={async () => {
          if ((await signOut()) === false)
            setError("Sign-out failed. Please try again.");
        }}
      >
        Sign out
      </button>
    </main>
  );
}
