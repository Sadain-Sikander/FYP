import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Route,
} from "lucide-react";
import AmbientField from "./AmbientField";
import CareerLandscape from "./CareerLandscape";
import ThemeToggle from "./Theme";

const scenes = [
  {
    name: "Your story",
    title: "Every experience counts.",
    subtitle: "What’s something you’ve spent your time doing?",
    key: "experience",
    label: "Experience & projects",
    lead: "My story includes",
    placeholder: "something I’ve worked on, learned, or helped with…",
    optional: ["education", "Education & courses", "I’ve learned about…"],
    suggestions: [],
  },
  {
    name: "Your strengths",
    title: "You have a way with…",
    subtitle:
      "Choose the things that feel like you. There’s room for your own, too.",
    key: "skills",
    label: "Skills",
    customLabel: "Add a skill",
    optional: ["strengths", "Your strengths", "People turn to me for…"],
    suggestions: [
      "Problem solving",
      "Communication",
      "Research",
      "Design",
      "Organisation",
      "Teamwork",
      "Python",
      "Writing",
      "Listening",
      "Planning",
    ],
  },
  {
    name: "Your curiosity",
    title: "What lights you up?",
    subtitle: "Think less about a job title. More about what you’d love to do.",
    key: "interests",
    label: "What interests you?",
    customLabel: "Add an interest",
    optional: [
      "preferred_industries",
      "Industries of interest",
      "I’m curious about the world of…",
    ],
    suggestions: [
      "Creating things",
      "Helping people",
      "Understanding data",
      "Working outdoors",
      "Building technology",
      "Solving complex problems",
      "Teaching others",
      "Telling stories",
    ],
  },
  {
    name: "Your direction",
    title: "Make a little room for…",
    subtitle: "What would you like your next chapter to bring?",
    key: "career_goals",
    label: "Career goals",
    customLabel: "Add a career goal",
    optional: [
      "work_preferences",
      "Work preferences",
      "I do my best work when…",
    ],
    suggestions: [
      "Find my first role",
      "Explore a career change",
      "Grow my current skills",
      "Work on meaningful projects",
    ],
  },
  {
    name: "Your possibilities",
    title: "A story only you could tell.",
    subtitle:
      "A starting point, written from what you shared. Change anything that doesn’t feel right.",
  },
];
const extraTitles = {
  education: "What have you learned along the way?",
  strengths: "What do people turn to you for?",
  preferred_industries: "Which worlds are you curious about?",
  work_preferences: "What helps you do your best work?",
};
function split(value) {
  const words = new Map();
  value
    .split(/[,;\n]/)
    .map((word) => word.trim())
    .filter(Boolean)
    .forEach((word) => {
      const key = word.toLowerCase();
      if (!words.has(key)) words.set(key, word);
    });
  return [...words.values()];
}
function SentenceInput({ label, value, onChange, placeholder, small = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.style.height = "0px";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={`sentence-input ${small ? "small-sentence" : ""}`}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      maxLength={6000}
      rows={1}
    />
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
  results,
  selected,
  gap,
  roadmap,
  onSelect,
  onRoadmap,
  onEditResults,
  user,
  saving,
  saveMessage,
  onSaveCareer,
  onSaveRoadmap,
}) {
  const [step, setStep] = useState(0),
    [leaving, setLeaving] = useState(false),
    [direction, setDirection] = useState("forward");
  const [extra, setExtra] = useState(false),
    [custom, setCustom] = useState(false),
    [draft, setDraft] = useState(""),
    [paused, setPaused] = useState(false);
  const [entryError, setEntryError] = useState("");
  const heading = useRef(null),
    timer = useRef(null),
    input = useRef(null),
    mounted = useRef(false);
  const scene = scenes[step];
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (mounted.current) {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    mounted.current = true;
  }, [step, extra, results?.length]);
  useEffect(() => {
    if (custom) input.current?.focus();
  }, [custom]);
  function addDraft() {
    if (!draft.trim()) return true;
    const next = split(`${form[scene.key]},${draft}`).join(", ");
    if (next.length > 6000) {
      setEntryError(
        "That’s a little too long. Shorten your answer before continuing.",
      );
      return false;
    }
    update(scene.key, next);
    setDraft("");
    setEntryError("");
    return true;
  }
  function change(next, showExtra = false) {
    if (leaving || pending || !addDraft()) return;
    setDirection(next < step ? "backward" : "forward");
    const finish = () => {
      setStep(next);
      setExtra(showExtra);
      setCustom(false);
      setLeaving(false);
      setEntryError("");
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else {
      setLeaving(true);
      timer.current = setTimeout(finish, 260);
    }
  }
  function toggle(value) {
    const list = split(form[scene.key]);
    const next = (
      list.some((s) => s.toLowerCase() === value.toLowerCase())
        ? list.filter((s) => s.toLowerCase() !== value.toLowerCase())
        : [...list, value]
    ).join(", ");
    if (next.length <= 6000) update(scene.key, next);
  }
  const chosen = scene.key ? split(form[scene.key]) : [];
  const words = scene.suggestions
    ? split([...scene.suggestions, ...chosen].join(","))
    : [];
  const summary = scenes.slice(0, 4).map((item, i) => ({
    item,
    i,
    fields: [[item.key, item.label], item.optional].filter(([key]) =>
      form[key].trim(),
    ),
  }));
  const hasWords = Object.values(form).join(" ").trim().length >= 10;
  return (
    <div className="loom-flow discovery-shell">
      <AmbientField phase={results?.length ? 5 : step} paused={paused} />
      <a className="skip-link" href="#discovery-content">
        Skip to content
      </a>
      <header className="loom-nav">
        <a className="loom-brand" href="#home" onClick={onHome}>
          <Route size={24} />
          CareerBridge<span>EXPERIMENT</span>
        </a>
        <div className="loom-nav-actions">
          <ThemeToggle />
          <button
            className="loom-text"
            onClick={() => {
              if (addDraft()) onEditor();
            }}
          >
            Use full profile editor <ArrowRight size={14} />
          </button>
        </div>
      </header>
      {results?.length ? (
        <CareerLandscape
          results={results}
          selected={selected}
          gap={gap}
          roadmap={roadmap}
          pending={pending}
          error={error}
          onSelect={onSelect}
          onRoadmap={onRoadmap}
          onEdit={onEditResults}
          user={user}
          saving={saving}
          saveMessage={saveMessage}
          onSaveCareer={onSaveCareer}
          onSaveRoadmap={onSaveRoadmap}
        />
      ) : (
        <>
          <nav className="scene-trail" aria-label="Profile chapters">
            {scenes.map((s, i) => (
              <button
                key={s.name}
                onClick={() => change(i)}
                disabled={leaving || !!pending}
                aria-current={step === i ? "step" : undefined}
                aria-label={`${String(i + 1).padStart(2, "0")} ${s.name}`}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <span>{s.name}</span>
                <i />
              </button>
            ))}
          </nav>
          <main id="discovery-content" className="scene-stage">
            <section
              className={`conversation-scene discovery-chapter scene-${step} scene-${direction} ${leaving ? "scene-leaving" : ""}`}
              key={`${step}-${extra}`}
              aria-labelledby="scene-title"
              aria-busy={!!pending}
            >
              <span className="scene-counter">
                {extra
                  ? "A LITTLE MORE OF YOUR STORY"
                  : `0${step + 1} / 05 — ${scene.name.toUpperCase()}`}
              </span>
              <h1 id="scene-title" tabIndex={-1} ref={heading}>
                {extra ? extraTitles[scene.optional[0]] : scene.title}
              </h1>
              <p className="scene-subtitle">
                {extra
                  ? "Add a little context, in your own words. This part is optional."
                  : scene.subtitle}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (leaving || pending) return;
                  if (extra) {
                    change(step);
                    return;
                  }
                  if (step < 4) change(step + 1);
                  else if (canExplore) onExplore(event);
                }}
              >
                {step < 4 &&
                  (extra ? (
                    <div className="sentence-stage">
                      <SentenceInput
                        label={scene.optional[1]}
                        value={form[scene.optional[0]]}
                        onChange={(v) => update(scene.optional[0], v)}
                        placeholder={scene.optional[2]}
                      />
                    </div>
                  ) : step === 0 ? (
                    <div className="sentence-stage">
                      <span className="sentence-lead">{scene.lead}</span>
                      <SentenceInput
                        label={scene.label}
                        value={form[scene.key]}
                        onChange={(v) => update(scene.key, v)}
                        placeholder={scene.placeholder}
                      />
                      <span className="sentence-hint">
                        Work, learning, volunteering, everyday life. It all
                        belongs here.
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`word-stage ${step === 3 ? "direction-stage" : ""}`}
                    >
                      <div
                        className="word-cloud"
                        role="group"
                        aria-label={scene.label}
                      >
                        {words.map((word, i) => {
                          const isChosen = chosen.some(
                            (s) => s.toLowerCase() === word.toLowerCase(),
                          );
                          return (
                            <button
                              className={`floating-word ${isChosen ? "word-selected" : ""}`}
                              type="button"
                              aria-pressed={isChosen}
                              onClick={() => toggle(word)}
                              style={{ "--word-index": i }}
                              key={word}
                            >
                              {isChosen ? (
                                <Check size={16} />
                              ) : (
                                <Plus size={16} />
                              )}
                              <span>{word}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="custom-word-area">
                        {custom ? (
                          <div className="custom-word-entry">
                            <input
                              ref={input}
                              aria-label={scene.customLabel}
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              placeholder="Something that feels like you…"
                              maxLength={6000}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addDraft();
                                }
                                if (e.key === "Escape") {
                                  setDraft("");
                                  setCustom(false);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={addDraft}
                              aria-label="Add your words"
                              disabled={!draft.trim()}
                            >
                              <ArrowRight size={19} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="loom-text"
                            onClick={() => setCustom(true)}
                          >
                            <Plus size={14} />
                            Add your own
                          </button>
                        )}
                      </div>
                      <span className="selection-caption" role="status">
                        {chosen.length
                          ? `${chosen.length} things that feel like you`
                          : "Choose as many as you like."}
                      </span>
                    </div>
                  ))}
                {step === 4 && (
                  <div className="narrative-review discovery-review">
                    {summary.map(({ item, i, fields }) => (
                      <div className="narrative-line" key={item.key}>
                        <span>
                          {
                            [
                              "Your story began with",
                              "You bring a way with",
                              "You’re drawn to",
                              "You’re making room for",
                            ][i]
                          }
                        </span>
                        <button
                          type="button"
                          aria-label={`Edit ${item.name.toLowerCase()}`}
                          onClick={() => change(i)}
                          disabled={!!pending}
                        >
                          {fields.length
                            ? fields.map(([key]) => form[key]).join(" · ")
                            : "a little room for discovery"}
                          <span className="narrative-edit">
                            Edit <ArrowRight size={13} />
                          </span>
                        </button>
                      </div>
                    ))}
                    {!hasWords && (
                      <p className="discovery-hint">
                        Add at least 10 characters about yourself in any chapter
                        to find career connections.
                      </p>
                    )}
                  </div>
                )}
                {step === 4 && resumeName && (
                  <label className="loom-confirm">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                      disabled={!!pending}
                    />
                    <span>
                      I've reviewed the details from {resumeName} and removed
                      anything that doesn't reflect my experience.
                    </span>
                  </label>
                )}
                {(error || entryError) && (
                  <p className="loom-error" role="alert">
                    {error || entryError}
                  </p>
                )}
                {pending && (
                  <div className="thinking-state" role="status">
                    <span className="thinking-orbit">
                      <i />
                      <i />
                      <i />
                    </span>
                    <strong>Finding the threads that connect.</strong>
                    <p>
                      Exploring career descriptions with your story in mind…
                    </p>
                  </div>
                )}
                <div className="scene-actions">
                  <button
                    type="button"
                    className="loom-back"
                    disabled={leaving || !!pending}
                    onClick={() =>
                      extra ? change(step) : step ? change(step - 1) : onHome()
                    }
                  >
                    <ArrowLeft size={16} />
                    {extra || step ? "Back" : "Home"}
                  </button>
                  <div>
                    {step < 4 && !extra && (
                      <button
                        type="button"
                        className="loom-text skip-scene"
                        onClick={() => change(step + 1)}
                        disabled={leaving || !!pending}
                      >
                        Skip for now
                      </button>
                    )}
                    <button
                      className="loom-cta"
                      type="submit"
                      disabled={
                        leaving || !!pending || (step === 4 && !canExplore)
                      }
                    >
                      {pending ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : null}
                      {pending
                        ? "Finding connections…"
                        : extra
                          ? "Save this thought"
                          : step === 4
                            ? "Explore my careers"
                            : "Continue"}
                      {!pending && <ArrowRight size={18} />}
                    </button>
                  </div>
                </div>
                {step < 4 && !extra && (
                  <button
                    className="more-context-link"
                    type="button"
                    onClick={() => change(step, true)}
                  >
                    Add {scene.optional[1].toLowerCase()} <Plus size={12} />
                  </button>
                )}
              </form>
            </section>
          </main>
        </>
      )}
      <footer className="loom-flow-footer">
        <span>THERE’S MORE THAN ONE WAY TO BE YOU.</span>
        <button
          className="motion-toggle"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          <span>
            {paused ? "Resume background motion" : "Pause background motion"}
          </span>
        </button>
      </footer>
    </div>
  );
}
