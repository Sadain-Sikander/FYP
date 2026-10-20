import React from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Route,
  Sparkles,
  Upload,
} from "lucide-react";
import { PotentialFlower } from "./DiscoveryFlow";

export default function Home({ user, start, signOut }) {
  return (
    <div className="dream-home">
      <a className="skip-link" href="#home-content">
        Skip to content
      </a>
      <header className="discovery-nav">
        <a className="brand" href="#home">
          <Route size={24} />
          CareerBridge<span className="brand-beta">EXPERIMENT</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          {user ? (
            <button className="nav-text" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <a href="#login">
              Sign in <ArrowUpRight size={14} />
            </a>
          )}
        </nav>
      </header>
      <main id="home-content">
        <section className="dream-hero">
          <div className="dream-hero-copy">
            <span className="discovery-kicker">
              <span className="dream-dot" /> YOUR NEXT CHAPTER STARTS WITH YOU
            </span>
            <h1>
              You’re more than
              <br />a job title.
              <br />
              <em>What could be next?</em>
            </h1>
            <p>
              Your experiences. Your unexpected talents. The things that spark
              your curiosity. Let’s see where they could take you.
            </p>
            <div className="dream-hero-actions">
              <button className="dream-button" onClick={() => start("guided")}>
                Tell your story <ArrowRight size={19} />
              </button>
              <button className="dream-upload" onClick={() => start("resume")}>
                <Upload size={16} />
                Start with your resume
              </button>
            </div>
            <span className="dream-reassurance">
              A little curiosity is all you need. No account required.
            </span>
          </div>
          <div className="dream-art">
            <span className="dream-art-caption">
              THERE’S MORE THAN ONE WAY TO BLOOM
            </span>
            <PotentialFlower
              labels={[
                "What you’ve done",
                "What makes you, you",
                "What you could become",
              ]}
            />
            <div className="dream-art-footer">
              <span>YOU ARE THE STARTING POINT</span>
              <Sparkles size={18} />
            </div>
          </div>
          <div className="dream-scroll-note">
            <span>SCROLL TO SEE HOW IT WORKS</span>
            <span>↓</span>
          </div>
        </section>
        <section className="dream-how" id="how-it-works">
          <div className="dream-how-heading">
            <span className="discovery-kicker">CONNECT THE DOTS</span>
            <h2>
              A few small steps.
              <br />
              <em>A whole new perspective.</em>
            </h2>
            <p>
              Careers aren’t always a straight line.
              <br />
              Make space for the possibilities you haven’t considered.
            </p>
          </div>
          <div className="dream-step-grid">
            {[
              [
                "01",
                "Start with your story.",
                "Bring your experience from work, life, or learning. Every starting point counts.",
                "Your story",
              ],
              [
                "02",
                "Follow your curiosity.",
                "Connect your strengths and interests with over 4,000 career entries.",
                "Your possibilities",
              ],
              [
                "03",
                "Find a way forward.",
                "Explore the skills behind a role and build a starter learning roadmap.",
                "Your next chapter",
              ],
            ].map(([number, title, copy, label]) => (
              <button
                key={number}
                className="dream-step-card"
                onClick={() => start("guided")}
              >
                <span className="dream-step-top">
                  {number}
                  <ArrowUpRight size={20} />
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span className="dream-step-label">{label}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="dream-invitation">
          <Sparkles size={28} />
          <h2>You don’t need to have it all figured out.</h2>
          <p>You just need somewhere to start.</p>
          <button className="dream-button" onClick={() => start("guided")}>
            Explore my possibilities <ArrowRight size={18} />
          </button>
        </section>
      </main>
      <footer className="discovery-footer">
        <span>CAREERBRIDGE · BUILT FOR POSSIBILITY</span>
        <span>Grounded in O*NET + ESCO career data</span>
      </footer>
    </div>
  );
}
