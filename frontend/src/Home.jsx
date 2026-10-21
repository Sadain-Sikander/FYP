import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  Code2,
  Compass,
  FileText,
  Fingerprint,
  Layers,
  Route,
  ScanLine,
  Sparkles,
  Upload,
} from "lucide-react";
import NeuralMap from "./NeuralMap";

const previews = {
  Technology: {
    skills: ["Problem solving", "Building things", "Curiosity"],
    roles: ["Software developer", "Data analyst", "Solutions architect"],
    icon: Code2,
  },
  Design: {
    skills: ["Visual thinking", "Empathy", "Making things"],
    roles: ["UX designer", "Creative technologist", "Product designer"],
    icon: Layers,
  },
  People: {
    skills: ["Communication", "Helping others", "Leadership"],
    roles: ["Learning designer", "Community manager", "Career counsellor"],
    icon: Compass,
  },
};
export default function Home({ user, start, signOut }) {
  const [preview, setPreview] = useState("Technology");
  const sample = previews[preview];
  const Icon = sample.icon;
  return (
    <div className="tech-home">
      <a className="skip-link" href="#home-content">
        Skip to content
      </a>
      <header className="tech-nav">
        <a className="tech-brand" href="#home">
          <span className="tech-brand-mark">
            <Route size={21} />
          </span>
          CareerBridge<span className="ai-badge">AI</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <button onClick={() => start("guided")}>Explore careers</button>
        </nav>
        <div className="tech-nav-actions">
          {user ? (
            <button className="tech-text-button" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <a href="#login">Sign in</a>
          )}
          <button
            className="tech-button nav-cta"
            onClick={() => start("guided")}
          >
            Get started <ArrowUpRight size={15} />
          </button>
        </div>
      </header>
      <main id="home-content">
        <section className="tech-hero" aria-labelledby="tech-hero-title">
          <div className="hero-grid-background" />
          <div className="hero-ambient ambient-one" />
          <div className="hero-ambient ambient-two" />
          <div className="tech-hero-copy">
            <span className="tech-pill">
              <span className="live-dot" /> A NEW WAY TO EXPLORE YOUR FUTURE{" "}
              <ChevronRight size={12} />
            </span>
            <h1 id="tech-hero-title">
              You’re more than
              <br />a job title.
              <br />
              <span className="hero-gradient-text">Discover your next.</span>
            </h1>
            <p>
              Your story is full of possibilities. Connect your experience,
              strengths, and curiosity to careers you might never have
              considered.
            </p>
            <div className="tech-hero-actions">
              <button
                className="tech-button hero-cta"
                onClick={() => start("guided")}
              >
                Start my discovery <ArrowRight size={19} />
              </button>
              <button
                className="tech-secondary"
                onClick={() => start("resume")}
              >
                <Upload size={16} />
                Start with your resume
              </button>
            </div>
            <div className="hero-assurances">
              <span>
                <Check size={13} />
                No account needed
              </span>
              <span>
                <Check size={13} />
                Your pace. Your path.
              </span>
            </div>
            <div className="hero-powered">
              <AudioLines size={18} />
              <span>
                Powered by AI embeddings.
                <br />
                <strong>Grounded in real career data.</strong>
              </span>
            </div>
          </div>
          <div className="hero-product">
            <div className="product-toolbar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <span>
                <Sparkles size={12} /> THE POSSIBILITY ENGINE
              </span>
              <span className="product-version">01 / EXPLORE</span>
            </div>
            <div className="product-preview-heading">
              <div>
                <span className="tech-overline">
                  ONE STORY. MANY DIRECTIONS.
                </span>
                <h2>See your potential connect.</h2>
              </div>
              <span className="preview-badge">Interactive preview</span>
            </div>
            <div
              className="preview-tabs"
              role="group"
              aria-label="Preview a career direction"
            >
              {Object.keys(previews).map((item) => (
                <button
                  key={item}
                  aria-pressed={preview === item}
                  onClick={() => setPreview(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <NeuralMap labels={[...sample.skills, "New possibilities"]} />
            <div className="preview-results" key={preview}>
              <div className="preview-result-label">
                <span>PATHS TO IMAGINE</span>
                <span>Illustrative examples</span>
              </div>
              {sample.roles.map((role, index) => (
                <button
                  onClick={() => start("guided")}
                  className="preview-career"
                  key={role}
                  style={{ "--index": index }}
                >
                  <span className="preview-career-icon">
                    <Icon size={16} />
                  </span>
                  <span>{role}</span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          </div>
          <div className="hero-bottom-line">
            <span>
              YOUR FUTURE ISN’T LINEAR. YOUR EXPLORATION SHOULDN’T BE EITHER.
            </span>
            <a href="#how-it-works">
              Explore the experience <span>↓</span>
            </a>
          </div>
        </section>
        <section
          className="tech-proof"
          aria-label="Career exploration resources"
        >
          <span>
            BUILT ON KNOWLEDGE.
            <br />
            <strong>DESIGNED AROUND YOU.</strong>
          </span>
          <div>
            <strong>4,059</strong>
            <span>career entries to explore</span>
          </div>
          <div>
            <strong>
              O*NET <span>+ ESCO</span>
            </strong>
            <span>occupational knowledge</span>
          </div>
          <div>
            <strong>Your story</strong>
            <span>the starting point for every match</span>
          </div>
        </section>
        <section className="tech-how" id="how-it-works">
          <div className="tech-section-heading">
            <span className="tech-overline">
              <span className="live-dot" /> FROM CURIOSITY TO CLARITY
            </span>
            <h2>
              Less filling forms.
              <br />
              <span>More finding yourself.</span>
            </h2>
            <p>
              A guided exploration that connects what you’ve done
              <br />
              with what you could do next.
            </p>
          </div>
          <div className="tech-feature-grid">
            {[
              [
                Fingerprint,
                "01",
                "Your story is the signal.",
                "Share one piece at a time. Work, study, side projects, and everyday experience all count.",
                "YOUR EXPERIENCE",
              ],
              [
                ScanLine,
                "02",
                "Connect the unexpected.",
                "Explore careers ranked by how their descriptions connect with your profile. Find new directions worth a closer look.",
                "YOUR POSSIBILITIES",
              ],
              [
                Route,
                "03",
                "Make your next move.",
                "Compare your skills with a role, see gaps, and build a practical four-week starter roadmap.",
                "YOUR NEXT CHAPTER",
              ],
            ].map(([FeatureIcon, number, title, copy, label]) => (
              <button
                className="tech-feature"
                onClick={() => start("guided")}
                key={number}
              >
                <div className="feature-head">
                  <span>
                    <FeatureIcon size={23} />
                  </span>
                  <small>{number}</small>
                </div>
                <div
                  className={`feature-mini-art mini-art-${number}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span className="feature-end">
                  {label}
                  <ArrowUpRight size={18} />
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="tech-resume">
          <div className="resume-visual" aria-hidden="true">
            <FileText size={50} strokeWidth={1} />
            <span className="resume-scan" />
            <span className="resume-visual-chip">
              <Check size={12} /> Experience connected
            </span>
          </div>
          <div>
            <span className="tech-overline">
              ALREADY HAVE A STARTING POINT?
            </span>
            <h2>Your resume. A new perspective.</h2>
            <p>
              Turn a PDF or DOCX into an editable profile, review an explained
              resume score, and explore where your skills could take you.
            </p>
          </div>
          <button className="tech-secondary" onClick={() => start("resume")}>
            Upload a resume <Upload size={16} />
          </button>
        </section>
        <section className="tech-final">
          <span className="tech-pill">
            <Sparkles size={13} /> YOUR NEXT CHAPTER IS OPEN
          </span>
          <h2>
            You bring the curiosity.
            <br />
            <span>We’ll help connect the dots.</span>
          </h2>
          <button className="tech-button" onClick={() => start("guided")}>
            Find my possibilities <ArrowRight size={18} />
          </button>
          <p>Free to explore. No perfect resume required.</p>
        </section>
      </main>
      <footer className="tech-footer">
        <a className="tech-brand" href="#home">
          <Route size={19} />
          CareerBridge<span className="ai-badge">AI</span>
        </a>
        <span>More than a match. A new direction.</span>
        <span>O*NET + ESCO · Built for exploration</span>
      </footer>
    </div>
  );
}
