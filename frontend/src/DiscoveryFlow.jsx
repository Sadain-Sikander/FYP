import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Route,
  Sparkles,
} from "lucide-react";

const chapters = [
  {
    name: "Your story",
    title: "Every experience\nis a starting point.",
    description:
      "A job, a class project, caring for someone. It all belongs in your story.",
    fields: [
      [
        "experience",
        "Experience & projects",
        "I’ve helped, built, organised, or worked on…",
      ],
      [
        "education",
        "Education & courses",
        "A degree, a course, or something I taught myself…",
      ],
    ],
  },
  {
    name: "Your strengths",
    title: "What comes\nnaturally to you?",
    description:
      "Think about what people turn to you for. Small talents can open big doors.",
    fields: [
      ["skills", "Skills", "Writing, Python, listening, planning…"],
      ["strengths", "Your strengths", "People come to me when they need…"],
    ],
    suggestions: [
      "Problem solving",
      "Communication",
      "Research",
      "Design",
      "Organisation",
      "Teamwork",
    ],
    target: "skills",
  },
  {
    name: "Your curiosity",
    title: "Follow a little\n‘what if?’",
    description:
      "You don’t need a destination yet. Just a sense of what you’d like more of.",
    fields: [
      ["interests", "What interests you?", "I lose track of time when I’m…"],
      ["career_goals", "Career goals", "In my next chapter, I’d like to…"],
      [
        "work_preferences",
        "Work preferences",
        "Hands-on work, collaboration, independence…",
      ],
      [
        "preferred_industries",
        "Industries of interest",
        "Education, technology, healthcare…",
      ],
    ],
    suggestions: [
      "Creating things",
      "Helping people",
      "Understanding data",
      "Working outdoors",
      "Building technology",
    ],
    target: "interests",
  },
  {
    name: "Your possibilities",
    title: "A story only\nyou could tell.",
    description:
      "These are your starting points. Make any changes, then see where they could take you.",
  },
];

export function PotentialFlower({ stage = 0, labels = [] }) {
  return (
    <div
      className={`potential-flower flower-stage-${stage}`}
      aria-hidden="true"
    >
      <div className="flower-orbit" />
      <div className="flower-orbit second" />
      <div className="flower-petals">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ "--petal": i }} />
        ))}
      </div>
      <div className="flower-heart">
        <Sparkles size={30} strokeWidth={1.3} />
      </div>
      {labels.slice(0, 3).map((label, i) => (
        <span className={`flower-label flower-label-${i}`} key={i}>
          {label}
        </span>
      ))}
      <span className="flower-speck speck-one" />
      <span className="flower-speck speck-two" />
    </div>
  );
}

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
  const titleRef = useRef(null);
  const firstRender = useRef(true);
  const chapter = chapters[step];
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);
  function move(next) {
    setDirection(next < step ? "backward" : "forward");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function toggle(value) {
    const values = form[chapter.target]
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = values.some((s) => s.toLowerCase() === value.toLowerCase());
    update(
      chapter.target,
      (exists
        ? values.filter((s) => s.toLowerCase() !== value.toLowerCase())
        : [...values, value]
      ).join(", "),
    );
  }
  const selected = (value) =>
    form[chapter.target]
      ?.split(/[,;\n]/)
      .some((s) => s.trim().toLowerCase() === value.toLowerCase());
  const labels = [
    form.experience || form.education
      ? "Experience worth exploring"
      : "A fresh perspective",
    form.skills.split(/[,;\n]/).find((s) => s.trim()) ||
      "Strengths to discover",
    form.interests.split(/[,;\n]/).find((s) => s.trim()) ||
      "Room for curiosity",
  ];
  return (
    <div className="discovery-shell">
      <a className="skip-link" href="#discovery-content">
        Skip to content
      </a>
      <header className="discovery-nav">
        <a className="brand" href="#home" onClick={onHome}>
          <Route size={23} />
          CareerBridge<span className="brand-beta">EXPERIMENT</span>
        </a>
        <button type="button" className="nav-text" onClick={onEditor}>
          Use full profile editor <ArrowRight size={15} />
        </button>
      </header>
      <nav className="discovery-progress" aria-label="Profile chapters">
        {chapters.map((item, i) => (
          <button
            type="button"
            key={item.name}
            onClick={() => move(i)}
            aria-current={i === step ? "step" : undefined}
            disabled={!!pending}
          >
            <span>{i < step ? <Check size={14} /> : `0${i + 1}`}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
      <main className="discovery-main" id="discovery-content">
        <aside className="discovery-art">
          <span className="discovery-kicker">
            A LITTLE MORE YOU, WITH EVERY STEP
          </span>
          <PotentialFlower stage={step} labels={labels} />
          <p>
            No single path. <em>So many possibilities.</em>
          </p>
          <span className="discovery-art-note">
            Your experiences connect in unexpected ways.
          </span>
        </aside>
        <section
          className={`discovery-chapter chapter-${direction}`}
          key={step}
          aria-labelledby="chapter-title"
        >
          <span className="discovery-kicker">CHAPTER 0{step + 1} / 04</span>
          <h1 id="chapter-title" tabIndex={-1} ref={titleRef}>
            {chapter.title}
          </h1>
          <p className="chapter-description">{chapter.description}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (step < 3) move(step + 1);
              else if (canExplore && !pending) onExplore(event);
            }}
          >
            {chapter.fields ? (
              <div className="chapter-fields">
                {chapter.fields.map(([key, label, placeholder]) => (
                  <label key={key} className="discovery-field">
                    <span>
                      {label}
                      <small aria-hidden="true">Optional</small>
                    </span>
                    <textarea
                      aria-label={label}
                      value={form[key]}
                      onChange={(event) => update(key, event.target.value)}
                      placeholder={placeholder}
                      maxLength={6000}
                      rows={key === "experience" ? 3 : 2}
                    />
                  </label>
                ))}
                {chapter.suggestions && (
                  <div className="discovery-suggestions">
                    <p>A few ideas to get you thinking</p>
                    <div>
                      {chapter.suggestions.map((value) => (
                        <button
                          type="button"
                          aria-pressed={selected(value)}
                          onClick={() => toggle(value)}
                          key={value}
                        >
                          {selected(value) ? (
                            <Check size={13} />
                          ) : (
                            <Plus size={13} />
                          )}
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="discovery-review">
                {chapters.slice(0, 3).map((item, i) => (
                  <div className="story-summary" key={item.name}>
                    <div>
                      <h2>{item.name}</h2>
                      <button
                        type="button"
                        className="nav-text"
                        onClick={() => move(i)}
                      >
                        Edit
                        <span className="sr-only">
                          {" "}
                          {item.name.toLowerCase()}
                        </span>
                      </button>
                    </div>
                    {item.fields.filter(([key]) => form[key].trim()).length ? (
                      item.fields
                        .filter(([key]) => form[key].trim())
                        .map(([key, label]) => (
                          <p key={key}>
                            <strong>{label}</strong>
                            {form[key]}
                          </p>
                        ))
                    ) : (
                      <p className="summary-empty">
                        An open page. Add a little whenever you’re ready.
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
            {step === 3 && resumeName && (
              <label className="review-checkbox">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
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
            <div className="chapter-actions">
              <button
                type="button"
                className="discovery-back"
                onClick={() => (step ? move(step - 1) : onHome())}
                disabled={!!pending}
              >
                <ArrowLeft size={17} />
                {step ? "Back" : "Home"}
              </button>
              <button
                className="dream-button"
                type="submit"
                disabled={!!pending || (step === 3 && !canExplore)}
              >
                {pending
                  ? "Finding your connections…"
                  : step === 3
                    ? "Explore my careers"
                    : "Continue"}
                <ArrowRight size={18} />
              </button>
            </div>
            <p className="discovery-footnote" role="status">
              {pending
                ? "Connecting your story with career descriptions. This can take a moment."
                : "Go at your own pace. You can change your answers anytime."}
            </p>
          </form>
        </section>
      </main>
      <footer className="discovery-footer">
        <span>YOUR FUTURE ISN’T A STRAIGHT LINE.</span>
        <span>Let’s explore a few possibilities.</span>
      </footer>
    </div>
  );
}
