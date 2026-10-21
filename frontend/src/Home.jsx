import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  MoveUpRight,
  Pause,
  Play,
  Route,
  Sparkles,
  Upload,
} from "lucide-react";
import AmbientField from "./AmbientField";
import ThemeToggle from "./Theme";

export default function Home({ user, start, signOut }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="loom-home">
      <AmbientField paused={paused} />
      <a className="skip-link" href="#home-content">
        Skip to content
      </a>
      <header className="loom-nav">
        <a className="loom-brand" href="#home">
          <Route size={24} />
          CareerBridge<span>EXPERIMENT</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">The experience</a>
          <ThemeToggle />
          {user ? (
            <button onClick={signOut}>Sign out</button>
          ) : (
            <a href="#login">
              Sign in <ArrowUpRight size={13} />
            </a>
          )}
        </nav>
      </header>
      <main id="home-content">
        <section className="loom-hero" aria-labelledby="home-title">
          <div className="loom-hero-label">
            <span className="living-mark">
              <i />
              <i />
              <i />
              <i />
            </span>
            YOUR FUTURE IS A WORK IN PROGRESS
          </div>
          <h1 id="home-title">
            You’re more than
            <br />a job title.<span>Let’s see what’s next.</span>
          </h1>
          <p>
            A few things about you.
            <br />A world of things you could become.
          </p>
          <button className="loom-cta" onClick={() => start("guided")}>
            Start my discovery <ArrowRight size={19} />
          </button>
          <button className="loom-upload" onClick={() => start("resume")}>
            <Upload size={14} /> Start with your resume
          </button>
          <span className="loom-reassurance">
            No account. No perfect answers. Just curiosity.
          </span>
          <div className="hero-word-orbit" aria-hidden="true">
            <span>the things you’ve tried</span>
            <span>the way you think</span>
            <span>the things you care about</span>
          </div>
          <div className="loom-scroll-cue">
            <span>A LITTLE EXPLORATION GOES A LONG WAY</span>
            <span>↓</span>
          </div>
        </section>
        <section className="loom-introduction" id="how-it-works">
          <span className="loom-eyebrow">
            A DIFFERENT KIND OF CAREER EXPLORATION
          </span>
          <h2>
            Your story doesn’t fit in a box.
            <br />
            <em>Neither should your future.</em>
          </h2>
          <div className="loom-chapters">
            {[
              [
                "01",
                "Start with a little of you.",
                "Your experiences, your strengths, the things that make you curious. One thought at a time.",
              ],
              [
                "02",
                "Make unexpected connections.",
                "Explore how your story connects to over 4,000 career entries, with AI-powered matching.",
              ],
              [
                "03",
                "Try on a new direction.",
                "Look closer at a role, discover skills to build, and find a practical place to start.",
              ],
            ].map(([number, title, copy]) => (
              <button key={number} onClick={() => start("guided")}>
                <span>
                  {number}
                  <MoveUpRight size={19} />
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </button>
            ))}
          </div>
        </section>
        <section className="loom-invitation">
          <Sparkles size={30} strokeWidth={1} />
          <h2>
            There’s more than
            <br />
            <em>one way to be you.</em>
          </h2>
          <button className="loom-cta" onClick={() => start("guided")}>
            Explore my possibilities <ArrowRight size={18} />
          </button>
          <span>Grounded in O*NET + ESCO occupational data.</span>
        </section>
      </main>
      <footer className="loom-footer">
        <span>CareerBridge · Made for the possibilities.</span>
        <button
          className="motion-toggle"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "Resume background motion" : "Pause background motion"}
        </button>
      </footer>
    </div>
  );
}
