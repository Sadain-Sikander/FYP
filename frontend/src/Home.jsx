import React from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Compass,
  FileText,
  Heart,
  Route,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react";

export default function Home({ user, start, signOut }) {
  return (
    <div className="home-page">
      <a className="skip-link" href="#home-content">
        Skip to content
      </a>
      <header className="home-nav">
        <a className="brand" href="#home">
          <span className="brand-icon">
            <Route size={23} />
          </span>
          CareerBridge<span className="brand-beta">BETA</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <button className="nav-text" onClick={() => start("manual")}>
            Explore careers
          </button>
        </nav>
        <div className="home-account">
          {user ? (
            <button className="nav-text" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <a href="#login" className="nav-text">
              Sign in
            </a>
          )}
          <button
            className="primary-button small"
            onClick={() => start("manual")}
          >
            {user ? "Your workspace" : "Get started"}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </header>
      <main id="home-content">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="pill-eyebrow">
              <span className="status-dot" /> A NEW WAY TO FIND YOUR DIRECTION
            </span>
            <h1>
              You’re more than
              <br />a job title.
              <br />
              <span>Discover what’s next.</span>
            </h1>
            <p>
              Turn your experience, skills and curiosity into career
              possibilities—and a plan to get there.
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => start("resume")}
              >
                <Upload size={18} /> Start with your resume
                <ArrowRight size={18} />
              </button>
              <button
                className="secondary-button"
                onClick={() => start("manual")}
              >
                Tell your story
                <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="hero-trust">
              <span>
                <span className="mini-check">✓</span> Free to explore
              </span>
              <span>
                <span className="mini-check">✓</span> No account required
              </span>
            </div>
          </div>
          <div
            className="career-universe"
            aria-label="Your skills can connect to many different career directions"
          >
            <div className="universe-glow" />
            <div className="universe-ring ring-a" />
            <div className="universe-ring ring-b" />
            <svg
              className="universe-lines"
              viewBox="0 0 560 520"
              aria-hidden="true"
            >
              <path d="M280 260 Q100 200 130 105 M280 260 Q370 110 430 135 M280 260 Q470 270 420 380 M280 260 Q210 410 110 350" />
            </svg>
            <div className="you-core">
              <span>
                <Sparkles size={32} />
              </span>
              <strong>Your potential</strong>
              <small>Many ways forward</small>
            </div>
            <div className="orbit-card orbit-card-one">
              <span className="orbit-emoji">
                <Sparkles size={23} />
              </span>
              <small>CREATE & COMMUNICATE</small>
              <strong>Make ideas matter.</strong>
              <span className="orbit-caption">Design · Writing · Strategy</span>
            </div>
            <div className="orbit-card orbit-card-two">
              <span className="orbit-emoji">
                <ChartNoAxesCombined size={23} />
              </span>
              <small>DISCOVER & ANALYSE</small>
              <strong>Follow your curiosity.</strong>
              <span className="orbit-caption">Data · Science · Research</span>
            </div>
            <div className="orbit-card orbit-card-three">
              <span className="orbit-emoji">
                <ArrowUpRight size={23} />
              </span>
              <small>BUILD & SOLVE</small>
              <strong>Bring something to life.</strong>
              <span className="orbit-caption">Engineering · Technology</span>
            </div>
            <div className="orbit-card orbit-card-four">
              <span className="orbit-emoji">
                <Heart size={23} />
              </span>
              <small>SUPPORT & CONNECT</small>
              <strong>Make a difference.</strong>
              <span className="orbit-caption">
                Care · Education · Community
              </span>
            </div>
            <span className="universe-caption">
              A world of possibilities. A starting point that’s yours.
            </span>
          </div>
        </section>
        <div className="data-ribbon">
          <span>YOUR NEXT STEP, GROUNDED IN REAL CAREER DATA</span>
          <strong>
            4,000+ <small>career entries</small>
          </strong>
          <i />
          <strong>
            O*NET <small>+ ESCO</small>
          </strong>
          <i />
          <span>Skills. Interests. Possibilities.</span>
        </div>
        <section className="home-features" id="how-it-works">
          <div className="features-heading">
            <div>
              <span className="eyebrow">FROM “WHAT IF?” TO “WHAT’S NEXT?”</span>
              <h2>A little clarity goes a long way.</h2>
            </div>
            <p>
              Start where you are. Build a path
              <br />
              towards where you want to be.
            </p>
          </div>
          <div className="feature-grid">
            <button
              className="feature-card lavender"
              onClick={() => start("resume")}
            >
              <span className="feature-top">
                <FileText size={24} />
                <span>01</span>
              </span>
              <h3>Your story, connected.</h3>
              <p>
                Upload a resume to fill your profile, or share your skills and
                experience in your own words.
              </p>
              <span className="feature-bottom">
                Build your profile <ArrowUpRight size={20} />
              </span>
            </button>
            <button
              className="feature-card lemon"
              onClick={() => start("manual")}
            >
              <span className="feature-top">
                <Compass size={24} />
                <span>02</span>
              </span>
              <h3>Find your possibilities.</h3>
              <p>
                Explore careers connected to your background. Understand your
                strengths and what to learn next.
              </p>
              <span className="feature-bottom">
                Explore directions <ArrowUpRight size={20} />
              </span>
            </button>
            <button
              className="feature-card peach"
              onClick={() => start("resume")}
            >
              <span className="feature-top">
                <Route size={24} />
                <span>03</span>
              </span>
              <h3>Make your next move.</h3>
              <p>
                Improve your resume, review an explained ATS estimate and build
                a practical learning roadmap.
              </p>
              <span className="feature-bottom">
                Move forward <ArrowUpRight size={20} />
              </span>
            </button>
          </div>
        </section>
        <section className="home-bottom-cta">
          <div>
            <Sparkles size={25} />
            <h2>Your next chapter is still unwritten.</h2>
            <p>Let’s find a few good places to start.</p>
          </div>
          <button className="primary-button" onClick={() => start("manual")}>
            Explore my possibilities
            <ArrowRight size={18} />
          </button>
        </section>
      </main>
      <footer className="home-footer">
        <span className="brand">
          <Route size={20} /> CareerBridge
        </span>
        <span>Built for curiosity. Designed for your next step.</span>
        <a href="#login">
          <UserRound size={15} /> Your account
        </a>
      </footer>
    </div>
  );
}
