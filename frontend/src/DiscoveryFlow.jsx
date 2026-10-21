import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Fingerprint,
  LoaderCircle,
  Plus,
  Route,
  Sparkles,
} from "lucide-react";
import NeuralMap from "./NeuralMap";

const chapters = [
  {
    name: "Experience",
    label: "Your story",
    title: "What have you\nput your energy into?",
    description:
      "A job. A side project. Something you helped make happen. Start with an experience that feels like you.",
    key: "experience",
    fieldLabel: "Experience & projects",
    placeholder:
      "I helped build a website for a local business, organised events at university…",
    optional: [
      [
        "education",
        "Education & courses",
        "A degree, a course, or something you taught yourself…",
      ],
    ],
    help: "Work, study, volunteering, or life experience — it all counts.",
  },
  {
    name: "Strengths",
    label: "Your strengths",
    title: "What are you\ngreat at?",
    description:
      "Think about the things you enjoy doing well. Add your own skills, or choose a few starting points.",
    key: "skills",
    fieldLabel: "Skills",
    placeholder: "Python, storytelling, research, bringing people together…",
    suggestions: [
      "Problem solving",
      "Communication",
      "Research",
      "Design",
      "Organisation",
      "Teamwork",
      "Python",
      "Writing",
    ],
    optional: [
      ["strengths", "Your strengths", "People come to me when they need…"],
    ],
    help: "Separate skills with commas. Choose only what reflects your experience.",
  },
  {
    name: "Interests",
    label: "Your curiosity",
    title: "What pulls\nyour curiosity?",
    description:
      "Forget job titles for a moment. What would you love to spend more time learning, making, or changing?",
    key: "interests",
    fieldLabel: "What interests you?",
    placeholder: "I’m curious about how technology can help people…",
    suggestions: [
      "Creating things",
      "Helping people",
      "Understanding data",
      "Working outdoors",
      "Building technology",
      "Solving complex problems",
    ],
    optional: [
      [
        "preferred_industries",
        "Industries of interest",
        "Technology, healthcare, education…",
      ],
    ],
    help: "There’s no right answer. Follow what interests you.",
  },
  {
    name: "Direction",
    label: "Your direction",
    title: "What would a\ngreat next chapter look like?",
    description:
      "A first role, a fresh start, or room to grow. Tell us what you’d like your work to make possible.",
    key: "career_goals",
    fieldLabel: "Career goals",
    placeholder:
      "I’d like to find a creative role where I can solve real problems…",
    suggestions: [
      "Find my first role",
      "Explore a career change",
      "Grow my current skills",
      "Work on meaningful projects",
    ],
    optional: [
      [
        "work_preferences",
        "Work preferences",
        "Collaborative, independent, remote, hands-on…",
      ],
    ],
    help: "Still figuring it out? You can skip this and keep exploring.",
  },
  {
    name: "Discover",
    label: "Your possibilities",
    title: "This is your\nstarting point.",
    description:
      "Your experiences don’t have to fit a single box. Review your story, then discover the careers it connects to.",
  },
];
export default function DiscoveryFlow({
  form,
  update,
  onEditor,
  onExplore,
  canExplore,
  pending,
  error,
  onHome,
  resumeName,
  reviewed,
  setReviewed,
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState("forward");
  const [leaving, setLeaving] = useState(false);
  const titleRef = useRef(null);
  const timerRef = useRef(null);
  const firstRender = useRef(true);
  const chapter = chapters[step];
  useEffect(() => () => clearTimeout(timerRef.current), []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);
  function move(next) {
    if (leaving || pending || next === step) return;
    setDirection(next < step ? "backward" : "forward");
    const change = () => {
      setStep(next);
      setLeaving(false);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) change();
    else {
      setLeaving(true);
      timerRef.current = setTimeout(change, 170);
    }
  }
  function toggle(value) {
    const values = form[chapter.key]
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = values.some((s) => s.toLowerCase() === value.toLowerCase());
    const next = (
      exists
        ? values.filter((s) => s.toLowerCase() !== value.toLowerCase())
        : [...values, value]
    ).join(", ");
    if (next.length <= 6000) update(chapter.key, next);
  }
  const selected = (value) =>
    form[chapter.key]
      ?.split(/[,;\n]/)
      .some((s) => s.trim().toLowerCase() === value.toLowerCase());
  const signalFields = [
    ["experience", "Experience"],
    ["skills", "Skills"],
    ["interests", "Curiosity"],
    ["career_goals", "Direction"],
  ];
  const signalCount = signalFields.filter(([key]) => form[key].trim()).length;
  const labels = signalFields.map(([key, fallback]) =>
    form[key].trim()
      ? key === "skills" || key === "interests"
        ? form[key].split(/[,;\n]/)[0]
        : `${fallback} added`
      : fallback,
  );
  const summaryFields = (item) => [
    [item.key, item.fieldLabel],
    ...(item.optional || []),
  ];
  return (
    <div className="discovery-shell tech-discovery">
      <a className="skip-link" href="#discovery-content">
        Skip to content
      </a>
      <header className="tech-nav">
        <a className="tech-brand" href="#home" onClick={onHome}>
          <span className="tech-brand-mark">
            <Route size={21} />
          </span>
          CareerBridge<span className="ai-badge">AI</span>
        </a>
        <span className="flow-nav-caption">
          <span className="live-dot" /> YOUR DISCOVERY SESSION
        </span>
        <button type="button" className="tech-text-button" onClick={onEditor}>
          Use full profile editor <ArrowUpRightIcon />
        </button>
      </header>
      <nav className="discovery-progress" aria-label="Profile chapters">
        {chapters.map((item, i) => (
          <button
            type="button"
            key={item.name}
            onClick={() => move(i)}
            aria-current={i === step ? "step" : undefined}
            disabled={!!pending || leaving}
          >
            <span className="progress-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{item.name}</span>
            {i < 4 && <i />}
          </button>
        ))}
      </nav>
      <main className="discovery-main" id="discovery-content">
        <section
          className={`discovery-chapter chapter-${direction} ${leaving ? "chapter-leaving" : ""}`}
          key={step}
          aria-labelledby="chapter-title"
          aria-busy={!!pending}
        >
          <span className="tech-overline">
            <Sparkles size={13} />
            {step === 4
              ? "YOUR STORY, CONNECTED"
              : `LET’S START WITH ${chapter.name.toUpperCase()}`}
            <span className="question-count">0{step + 1} / 05</span>
          </span>
          <h1 id="chapter-title" tabIndex={-1} ref={titleRef}>
            {chapter.title}
          </h1>
          <p className="chapter-description">{chapter.description}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (leaving || pending) return;
              if (step < 4) move(step + 1);
              else if (canExplore) onExplore(event);
            }}
          >
            {chapter.key ? (
              <div className="chapter-fields">
                <label className="discovery-field">
                  <span>
                    {chapter.fieldLabel}
                    <small>In your own words</small>
                  </span>
                  <textarea
                    aria-label={chapter.fieldLabel}
                    value={form[chapter.key]}
                    onChange={(event) =>
                      update(chapter.key, event.target.value)
                    }
                    placeholder={chapter.placeholder}
                    maxLength={6000}
                    rows={4}
                  />
                  <span className="field-meta">
                    <span>{chapter.help}</span>
                    <span>{form[chapter.key].length}/6000</span>
                  </span>
                </label>
                {chapter.suggestions && (
                  <div className="discovery-suggestions">
                    <p>
                      MAKE IT YOURS <span>Pick what resonates</span>
                    </p>
                    <div>
                      {chapter.suggestions.map((value) => (
                        <button
                          type="button"
                          aria-pressed={selected(value)}
                          onClick={() => toggle(value)}
                          key={value}
                        >
                          {selected(value) ? (
                            <Check size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <details className="discovery-extra">
                  <summary>
                    Add a little more context <span>Optional</span>
                    <ChevronDown size={15} />
                  </summary>
                  {chapter.optional.map(([key, label, placeholder]) => (
                    <label key={key} className="discovery-field">
                      <span>{label}</span>
                      <textarea
                        aria-label={label}
                        value={form[key]}
                        onChange={(event) => update(key, event.target.value)}
                        placeholder={placeholder}
                        maxLength={6000}
                        rows={2}
                      />
                    </label>
                  ))}
                </details>
              </div>
            ) : (
              <div className="discovery-review">
                {chapters.slice(0, 4).map((item, i) => (
                  <div className="story-summary" key={item.label}>
                    <div>
                      <h2>
                        <span>0{i + 1}</span>
                        {item.label}
                      </h2>
                      <button
                        type="button"
                        className="tech-text-button"
                        onClick={() => move(i)}
                        disabled={!!pending}
                      >
                        Edit
                        <span className="sr-only">
                          {" "}
                          {item.label.toLowerCase()}
                        </span>
                      </button>
                    </div>
                    {summaryFields(item).some(([key]) => form[key].trim()) ? (
                      summaryFields(item)
                        .filter(([key]) => form[key].trim())
                        .map(([key, label]) => (
                          <p key={key}>
                            <strong>{label}</strong>
                            {form[key]}
                          </p>
                        ))
                    ) : (
                      <p className="summary-empty">
                        Open to discovery. You can add more whenever you’re
                        ready.
                      </p>
                    )}
                  </div>
                ))}
                {Object.values(form).join(" ").trim().length < 10 && (
                  <p className="discovery-hint">
                    Add at least 10 characters about yourself in any chapter to
                    find career connections.
                  </p>
                )}
              </div>
            )}
            {step === 4 && resumeName && (
              <label className="review-checkbox">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                  disabled={!!pending}
                />
                <span>
                  I've reviewed these details from {resumeName} and removed
                  anything that doesn't reflect my experience.
                </span>
              </label>
            )}
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            {pending && (
              <div className="discovery-loading" role="status">
                <div className="loading-scan" />
                <Sparkles size={20} />
                <div>
                  <strong>Connecting your story to possibilities</strong>
                  <span>
                    Comparing your profile with career descriptions. This may
                    take a moment.
                  </span>
                </div>
              </div>
            )}
            <div className="chapter-actions">
              <button
                type="button"
                className="discovery-back"
                onClick={() => (step ? move(step - 1) : onHome())}
                disabled={!!pending || leaving}
              >
                <ArrowLeft size={16} />
                {step ? "Back" : "Home"}
              </button>
              <div>
                {step < 4 && (
                  <button
                    type="button"
                    className="discovery-skip"
                    onClick={() => move(step + 1)}
                    disabled={leaving}
                  >
                    Skip for now
                  </button>
                )}
                <button
                  className="tech-button"
                  type="submit"
                  disabled={!!pending || leaving || (step === 4 && !canExplore)}
                >
                  {pending ? (
                    <>
                      <LoaderCircle size={16} className="spin" />
                      Finding your connections…
                    </>
                  ) : (
                    <>
                      {step === 4 ? "Explore my careers" : "Continue"}
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="discovery-footnote">
              <span className="live-dot" />
              Your answers stay editable. This is exploration, not a test.
            </p>
          </form>
        </section>
        <aside className="discovery-art">
          <div className="profile-map-heading">
            <span className="tech-overline">YOUR POSSIBILITY MAP</span>
            <span className="profile-live">
              <span className="live-dot" />
              LIVE
            </span>
          </div>
          <NeuralMap labels={labels} active={step} />
          <div className="map-story">
            <Fingerprint size={21} />
            <div>
              <h2>
                {signalCount
                  ? "Your story is taking shape."
                  : "It all starts with you."}
              </h2>
              <p>
                {signalCount
                  ? "Every detail brings a new perspective to your exploration."
                  : "Add a little about yourself. Watch the connections grow."}
              </p>
            </div>
          </div>
          <div className="profile-signals">
            <div>
              <span>YOUR PROFILE</span>
              <span>{signalCount} / 4 perspectives</span>
            </div>
            <div className="signal-bars">
              {signalFields.map(([key]) => (
                <span className={form[key].trim() ? "filled" : ""} key={key} />
              ))}
            </div>
          </div>
          <p className="map-disclaimer">
            A map of what you’ve shared.
            <br />
            Your career connections arrive after review.
          </p>
        </aside>
      </main>
      <footer className="flow-footer">
        <span>POWERED BY CURIOSITY. SUPPORTED BY AI.</span>
        <span>No one path defines you.</span>
      </footer>
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={14} className="editor-arrow" />;
}
