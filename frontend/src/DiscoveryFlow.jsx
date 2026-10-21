import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  GraduationCap,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Route,
  Sparkles,
  Sprout,
  X,
} from "lucide-react";
import AmbientField from "./AmbientField";
import CareerLandscape from "./CareerLandscape";
import TakeAction from "./TakeAction";
import ResumeStudio from "./ResumeStudio";
import ThemeToggle from "./Theme";
import {
  entries,
  fingerprint,
  identityStatement,
  levels,
  uniqueWords,
} from "./discoveryModel";

const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export default function DiscoveryFlow({
  form,
  draft,
  setDraft,
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
  user,
  saving,
  saveMessage,
  onSaveCareer,
  onSaveRoadmap,
  onSaveProfile,
  resume,
}) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [customSkill, setCustomSkill] = useState("");
  const [skillState, setSkillState] = useState({
    status: "idle",
    items: [],
    nextOffset: 0,
    error: "",
  });
  const [message, setMessage] = useState("");
  const timer = useRef(null),
    heading = useRef(null),
    request = useRef({ version: 0, controller: null });
  const patch = (values) =>
    setDraft((old) => ({ ...old, ...values, started: true }));
  const skills = uniqueWords(form.skills);
  const prospectiveSkills = uniqueWords([...skills, customSkill].join(", "));
  const student =
    draft.entryType === "education" ||
    (draft.entryType === "auto" &&
      /\b(student|learner|graduate)\b/i.test(draft.role));
  const identity = draft.identityText ?? identityStatement(form, draft.wording);
  const needsRefresh =
    draft.identityText !== null &&
    draft.identityFingerprint !== fingerprint(form);
  const completed = draft.stage === "identity";
  const view =
    draft.view === "resume" ? "resume" : completed ? draft.view : "entry";
  const roleWords = draft.role.trim().split(/\s+/).filter(Boolean).length;
  const roleValid = draft.role.trim().length > 0 && roleWords <= 5;
  const busy = !!pending || skillState.status === "loading" || leaving;

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      request.current.controller?.abort();
    },
    [],
  );
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [draft.stage, draft.view]);
  useEffect(() => {
    if (results.length && draft.view !== "resume")
      patch({ stage: "identity", view: "paths" });
  }, [results]);
  useEffect(() => {
    if (
      draft.view !== "resume" &&
      !draft.started &&
      Object.values(form).some((value) => value.trim())
    ) {
      patch({ stage: "identity", view: "identity" });
    }
  }, [form, draft.started]);

  function cancelRequest() {
    request.current.version++;
    request.current.controller?.abort();
    setSkillState((old) => ({ ...old, status: "idle" }));
  }
  function transition(values) {
    if (leaving) return;
    setMessage("");
    const finish = () => {
      patch(values);
      setLeaving(false);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else {
      setLeaving(true);
      timer.current = setTimeout(finish, 220);
    }
  }
  function addEntry(type) {
    cancelRequest();
    transition({
      stage: type === "education" ? "level" : "role",
      entryType: type,
      role: type === "education" ? "Student" : "",
      level: "",
      subject: "",
      detail: "",
      committedEntry: null,
    });
  }
  async function suggest(context = form, offset = 0) {
    request.current.controller?.abort();
    const controller = new AbortController();
    const version = ++request.current.version;
    request.current.controller = controller;
    setSkillState((old) => ({ ...old, status: "loading", error: "" }));
    let timeoutReached = false;
    const timeout = setTimeout(() => {
      timeoutReached = true;
      controller.abort();
    }, 90000);
    try {
      const response = await fetch(`${API}/api/discovery/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: draft.role,
          education: context.education,
          experience: context.experience,
          offset,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Skills could not be loaded. Please retry.",
        );
      if (version === request.current.version) {
        setSkillState({
          status: "ready",
          items: data.skills || [],
          nextOffset: data.next_offset || 0,
          error: "",
        });
      }
    } catch (err) {
      if (
        version === request.current.version &&
        (err.name !== "AbortError" || timeoutReached)
      ) {
        setSkillState((old) => ({
          ...old,
          status: "error",
          error: timeoutReached
            ? "This is taking longer than expected. Retry or add your own skills."
            : "We couldn’t load suggestions. Retry or add your own skills.",
        }));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  function commitEntry() {
    const field = student ? "education" : "experience";
    const value = student
      ? `${draft.level} · ${draft.subject.trim()}`
      : [draft.role.trim(), draft.detail.trim()].filter(Boolean).join(" — ");
    const list = entries(form[field]);
    const previous = draft.committedEntry;
    const index = previous?.field === field ? list.indexOf(previous.value) : -1;
    if (index >= 0) list[index] = value;
    else if (!list.includes(value)) list.push(value);
    const combined = list.join("\n");
    if (combined.length > 6000) {
      setMessage(
        "Your profile is full. Shorten an existing entry in the full editor before adding another.",
      );
      return;
    }
    const next = { ...form, [field]: combined };
    update(field, combined);
    transition({ stage: "skills", committedEntry: { field, value } });
    suggest(next);
  }
  function addWords() {
    if (
      prospectiveSkills.some((word) => word.length > 100) ||
      prospectiveSkills.join(", ").length > 6000
    ) {
      setMessage(
        "Keep each skill under 100 characters and your list under 6,000 characters.",
      );
      return false;
    }
    if (customSkill.trim()) update("skills", prospectiveSkills.join(", "));
    setCustomSkill("");
    setMessage("");
    return true;
  }
  function toggleSkill(word) {
    const next = skills.some((s) => s.toLowerCase() === word.toLowerCase())
      ? skills.filter((s) => s.toLowerCase() !== word.toLowerCase())
      : [...skills, word];
    update("skills", next.join(", "));
  }
  function back() {
    cancelRequest();
    if (draft.stage === "skills")
      transition({
        stage: draft.committedEntry
          ? student
            ? "subject"
            : "detail"
          : "identity",
        view: "identity",
      });
    else if (draft.stage === "subject") transition({ stage: "level" });
    else if (draft.stage === "level" || draft.stage === "detail")
      transition({ stage: "role" });
    else onHome();
  }
  function next(event) {
    event.preventDefault();
    if (busy) return;
    if (draft.stage === "role" && roleValid)
      transition({ stage: student ? "level" : "detail" });
    if (draft.stage === "level" && draft.level)
      transition({ stage: "subject" });
    if (
      (draft.stage === "subject" && draft.subject.trim()) ||
      draft.stage === "detail"
    )
      commitEntry();
    if (draft.stage === "skills" && prospectiveSkills.length >= 3 && addWords())
      transition({ stage: "identity", view: "identity" });
  }
  const nextDisabled =
    busy ||
    (draft.stage === "role" && !roleValid) ||
    (draft.stage === "level" && !draft.level) ||
    (draft.stage === "subject" && !draft.subject.trim()) ||
    (draft.stage === "skills" && prospectiveSkills.length < 3);
  function refreshIdentity() {
    const variant = draft.wording + 1;
    patch({
      wording: variant,
      identityText: identityStatement(form, variant),
      identityFingerprint: fingerprint(form),
    });
    setMessage("Draft refreshed from your current profile.");
  }
  async function copyIdentity() {
    try {
      await navigator.clipboard.writeText(identity);
      setMessage("Career identity copied.");
    } catch {
      setMessage(
        "Copy is unavailable here. Select the statement text to copy it.",
      );
    }
  }
  function editSkills() {
    transition({ stage: "skills", committedEntry: null });
    suggest();
  }
  function explore(event) {
    if (skills.length >= 3 && identity.trim()) onExplore(event, identity);
  }
  const words = uniqueWords(
    [...skillState.items.map((s) => s.name), ...skills].join(", "),
  );
  const activeContext = draft.stage === "skills" ? draft.committedEntry : null;

  return (
    <div className="loom-flow discovery-shell dreamer-flow">
      <AmbientField
        phase={
          view === "paths"
            ? 5
            : view === "action"
              ? 6
              : [
                  "role",
                  "level",
                  "subject",
                  "detail",
                  "skills",
                  "identity",
                ].indexOf(draft.stage)
        }
        paused={paused}
      />
      <a className="skip-link" href="#discovery-content">
        Skip to content
      </a>
      <header className="loom-nav">
        <div className="story-brand-group">
          <button
            className="story-cancel"
            onClick={() => {
              cancelRequest();
              onHome();
            }}
            aria-label="Cancel discovery"
          >
            <ArrowLeft size={18} />
            <span>Cancel</span>
          </button>
          <a className="loom-brand" href="#home" onClick={cancelRequest}>
            <Route size={24} />
            CareerBridge<span>EXPERIMENT</span>
          </a>
        </div>
        <div className="loom-nav-actions">
          <ThemeToggle />
          <button className="loom-text" onClick={onEditor}>
            Use full profile editor <ArrowRight size={14} />
          </button>
        </div>
      </header>
      {completed && view !== "resume" && (
        <nav className="identity-tabs" aria-label="Discovery journey">
          {[
            ["identity", "Career identity", Sprout],
            ["paths", "Explore paths", Route],
            ["action", "Take action", Sparkles],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              aria-label={label + " tab"}
              aria-current={draft.view === key ? "page" : undefined}
              disabled={!!pending || (key === "paths" && !results.length)}
              onClick={() => transition({ view: key })}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      )}

      {view === "resume" && (
        <ResumeStudio
          {...resume}
          form={form}
          update={update}
          reviewed={reviewed}
          setReviewed={setReviewed}
          onBack={() =>
            transition({
              view: draft.resumeReturn || "identity",
              stage: Object.values(form).some((value) => value.trim())
                ? "identity"
                : draft.stage,
            })
          }
          backLabel={
            draft.resumeReturn === "action"
              ? "Back to take action"
              : "Back to my story"
          }
          onContinue={() => transition({ stage: "identity", view: "identity" })}
        />
      )}
      {!completed && view !== "resume" && (
        <main id="discovery-content" className="story-entry">
          <section
            className={`story-scene ${leaving ? "story-leaving" : ""}`}
            key={draft.stage}
          >
            <span className="story-overline">
              {draft.stage === "skills"
                ? "CONNECT THE DOTS"
                : "A LITTLE OF YOUR STORY"}
            </span>
            {draft.stage === "role" ? (
              <>
                <h1 ref={heading} tabIndex={-1}>
                  To start, share a current or previous role.
                </h1>
                <p className="story-instruction">
                  A job, studying, caring for someone, volunteering. It all
                  counts.
                </p>
              </>
            ) : (
              <div className="answer-stack" aria-label="Your answers so far">
                <span>{draft.role || "Your story"}</span>
                {(draft.stage === "subject" ||
                  (draft.stage === "skills" && student)) && (
                  <span>{draft.level}</span>
                )}
                {draft.stage === "skills" && (
                  <span>
                    {activeContext?.field === "education"
                      ? draft.subject
                      : draft.detail}
                  </span>
                )}
              </div>
            )}
            <form onSubmit={next}>
              {draft.stage === "role" && (
                <>
                  <input
                    className="story-input"
                    aria-label="Current or previous role"
                    value={draft.role}
                    onChange={(e) => patch({ role: e.target.value })}
                    placeholder="For example, Student"
                    maxLength={50}
                    autoComplete="off"
                  />
                  <span
                    className={`story-counter ${roleWords > 5 ? "invalid" : ""}`}
                    aria-live="polite"
                  >
                    {roleWords}/5 words · {draft.role.length}/50 characters
                  </span>
                  <div className="role-examples">
                    {["Student", "Software developer", "Volunteer"].map(
                      (role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => patch({ role })}
                        >
                          {role}
                          <Plus size={12} />
                        </button>
                      ),
                    )}
                  </div>
                </>
              )}
              {draft.stage === "level" && (
                <>
                  <h1 className="sr-only" ref={heading} tabIndex={-1}>
                    Choose your education level
                  </h1>
                  <div className="story-select">
                    <select
                      aria-label="Education level"
                      value={draft.level}
                      onChange={(e) => patch({ level: e.target.value })}
                    >
                      <option value="" disabled>
                        Level
                      </option>
                      {levels.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                    <span aria-hidden="true">⌄</span>
                  </div>
                  <p className="story-instruction">
                    Choose the level you’re working toward or have completed.
                  </p>
                </>
              )}
              {draft.stage === "subject" && (
                <>
                  <h1 className="sr-only" ref={heading} tabIndex={-1}>
                    What is your subject area?
                  </h1>
                  <input
                    className="story-input"
                    aria-label="Subject area"
                    placeholder="Subject area"
                    value={draft.subject}
                    onChange={(e) => patch({ subject: e.target.value })}
                    maxLength={60}
                  />
                  <span className="story-counter">
                    {draft.subject.length}/60 characters
                  </span>
                </>
              )}
              {draft.stage === "detail" && (
                <>
                  <h1 className="sr-only" ref={heading} tabIndex={-1}>
                    Tell us a little more about this role
                  </h1>
                  <textarea
                    className="story-input story-detail"
                    aria-label="Role details"
                    placeholder="What did you work on or help with?"
                    value={draft.detail}
                    onChange={(e) => patch({ detail: e.target.value })}
                    maxLength={500}
                    rows={2}
                  />
                  <p className="story-instruction">
                    A project, a workplace, or an everyday responsibility. This
                    part is optional.
                  </p>
                </>
              )}
              {draft.stage === "skills" && (
                <>
                  <h1 className="skill-prompt" ref={heading} tabIndex={-1}>
                    Select at least 3 skills that apply to you.
                  </h1>
                  <p className="story-instruction">
                    These are suggestions. Choose what you recognise in
                    yourself.
                  </p>
                  <div className="skill-tools">
                    <button
                      type="button"
                      className="story-small-button"
                      disabled={skillState.status === "loading"}
                      onClick={() => suggest(form, skillState.nextOffset)}
                    >
                      <RefreshCw size={14} />
                      {skillState.status === "error"
                        ? "Retry suggestions"
                        : "Re-generate"}
                    </button>
                    <button
                      type="button"
                      className="story-small-button"
                      disabled={
                        !words.length || skillState.status === "loading"
                      }
                      onClick={() =>
                        update(
                          "skills",
                          (words.every((word) =>
                            skills.some(
                              (skill) =>
                                skill.toLowerCase() === word.toLowerCase(),
                            ),
                          )
                            ? []
                            : words
                          ).join(", "),
                        )
                      }
                    >
                      <Check size={14} />
                      {words.length &&
                      words.every((word) =>
                        skills.some(
                          (skill) => skill.toLowerCase() === word.toLowerCase(),
                        ),
                      )
                        ? "Clear selection"
                        : "Select all"}
                    </button>
                  </div>
                  {skillState.status === "loading" ? (
                    <div className="skill-insights" role="status">
                      <Sparkles size={26} />
                      <span>Finding skills that connect to your story…</span>
                      <i />
                      <i />
                      <i />
                    </div>
                  ) : (
                    <div
                      className="story-skill-cloud"
                      role="group"
                      aria-label="Suggested skills"
                    >
                      {words.map((word, index) => (
                        <button
                          type="button"
                          className={`floating-word ${skills.some((s) => s.toLowerCase() === word.toLowerCase()) ? "word-selected" : ""}`}
                          aria-pressed={skills.some(
                            (s) => s.toLowerCase() === word.toLowerCase(),
                          )}
                          key={word.toLowerCase()}
                          style={{ "--word-index": index }}
                          onClick={() => toggleSkill(word)}
                        >
                          {word}
                          {skills.some(
                            (s) => s.toLowerCase() === word.toLowerCase(),
                          ) ? (
                            <Check size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="story-custom-skill">
                    <input
                      aria-label="Add a skill"
                      value={customSkill}
                      onChange={(e) => setCustomSkill(e.target.value)}
                      placeholder="Add your own skill…"
                      maxLength={300}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addWords();
                        }
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Add your skill"
                      disabled={!customSkill.trim()}
                      onClick={addWords}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="skill-provenance">
                    <span role="status">
                      {skills.length} selected ·{" "}
                      {skills.length >= 3
                        ? "Ready to continue"
                        : `Choose ${3 - skills.length} more`}
                    </span>
                    <span>Suggestions from O*NET + ESCO</span>
                  </div>
                  {skillState.error && (
                    <p className="loom-error" role="alert">
                      {skillState.error}
                    </p>
                  )}
                </>
              )}
              {message && (
                <p className="loom-error" role="alert">
                  {message}
                </p>
              )}
              <div className="story-actions">
                <button
                  className="loom-back"
                  type="button"
                  onClick={back}
                  disabled={leaving}
                >
                  <ArrowLeft size={17} />
                  {draft.stage === "role" ? "Home" : "Back"}
                </button>
                <button className="loom-cta" disabled={nextDisabled}>
                  Next <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </section>
        </main>
      )}

      {completed && view === "identity" && (
        <main
          id="discovery-content"
          className={`identity-workspace ${leaving ? "story-leaving" : ""}`}
        >
          <div className="identity-heading">
            <span className="story-overline">
              THE THREADS THAT MAKE YOU, YOU
            </span>
            <h1 ref={heading} tabIndex={-1}>
              Your career identity.
            </h1>
            <p>
              A starting point for what comes next. Keep making it your own.
            </p>
          </div>
          <div className="identity-layout">
            <div className="identity-ingredients">
              {[
                ["experience", "Experiences", Sprout],
                ["education", "Education", GraduationCap],
              ].map(([field, title, Icon]) => (
                <section className="identity-group" key={field}>
                  <h2>
                    <Icon size={22} />
                    {title}
                  </h2>
                  <div className="identity-chips">
                    {entries(form[field]).map((entry, index) => (
                      <span
                        className={`identity-chip ${field}`}
                        key={`${index}-${entry}`}
                      >
                        {entry}
                        <button
                          aria-label={`Remove ${entry}`}
                          onClick={() =>
                            update(
                              field,
                              entries(form[field])
                                .filter((_, i) => index !== i)
                                .join("\n"),
                            )
                          }
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                    <button
                      className="identity-add"
                      onClick={() => addEntry(field)}
                    >
                      Add {field}
                      <Plus size={15} />
                    </button>
                  </div>
                </section>
              ))}
              <section className="identity-group">
                <h2>
                  <Sparkles size={22} />
                  Skills
                </h2>
                <div className="identity-chips">
                  {skills.map((skill) => (
                    <span className="identity-chip skill" key={skill}>
                      <span>{skill}</span>
                      <button
                        aria-label={`Remove skill ${skill}`}
                        onClick={() => toggleSkill(skill)}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  <button className="identity-add" onClick={editSkills}>
                    Add skills
                    <Plus size={15} />
                  </button>
                </div>
              </section>
              {(form.interests ||
                form.career_goals ||
                form.strengths ||
                form.work_preferences ||
                form.preferred_industries) && (
                <section className="identity-group">
                  <h2>Your direction</h2>
                  <p>
                    {[
                      form.interests,
                      form.career_goals,
                      form.strengths,
                      form.work_preferences,
                      form.preferred_industries,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <button className="loom-text" onClick={onEditor}>
                    Edit your direction <ArrowRight size={14} />
                  </button>
                </section>
              )}
            </div>
            <section className="identity-statement">
              <div className="statement-label">
                <span>
                  <Sparkles size={17} />
                  Career identity statement
                </span>
                <small>STARTER DRAFT</small>
              </div>
              <textarea
                aria-label="Career identity statement"
                value={identity}
                maxLength={6000}
                onChange={(e) =>
                  patch({
                    identityText: e.target.value,
                    identityFingerprint: fingerprint(form),
                  })
                }
                spellCheck
                rows={7}
              />
              <p className="statement-note">
                {needsRefresh
                  ? "Your profile changed. Refresh this draft to include your latest edits."
                  : "Built from the details you shared. Edit the words until they sound like you."}
              </p>
              {skills.length < 3 && (
                <p className="loom-error">
                  Choose at least 3 skills before exploring paths.
                </p>
              )}
              {resumeName && (
                <label className="loom-confirm">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  <span>
                    I've reviewed the details from {resumeName} and removed
                    anything that doesn't reflect my experience.
                  </span>
                </label>
              )}
              {error && (
                <p className="loom-error" role="alert">
                  {error}
                </p>
              )}
              {pending === "recommend" && (
                <p className="identity-loading" role="status">
                  <LoaderCircle size={18} className="spin" />
                  Finding paths from your career identity…
                </p>
              )}
              <div className="statement-controls">
                <button
                  className="story-small-button"
                  onClick={refreshIdentity}
                  disabled={!!pending}
                >
                  <RefreshCw size={14} />
                  Re-generate
                </button>
                <button
                  className="story-small-button"
                  aria-label="Copy career identity"
                  onClick={copyIdentity}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="loom-cta"
                  onClick={explore}
                  disabled={
                    !canExplore ||
                    skills.length < 3 ||
                    !identity.trim() ||
                    !!pending
                  }
                >
                  Explore paths <ArrowRight size={18} />
                </button>
              </div>
              <div className="identity-save">
                <button
                  className="loom-text"
                  disabled={saving}
                  onClick={() => onSaveProfile(identity)}
                >
                  {user ? "Save profile" : "Sign in to save"}
                </button>
                <span role="status">{message || saveMessage}</span>
              </div>
            </section>
          </div>
        </main>
      )}
      {completed && view === "paths" && (
        <CareerLandscape
          results={results}
          selected={selected}
          gap={gap}
          roadmap={roadmap}
          pending={pending}
          error={error}
          onSelect={onSelect}
          onRoadmap={onRoadmap}
          onEdit={() => transition({ view: "identity" })}
          user={user}
          saving={saving}
          saveMessage={saveMessage}
          onSaveCareer={onSaveCareer}
          onSaveRoadmap={onSaveRoadmap}
          onTakeAction={() => transition({ view: "action" })}
        />
      )}
      {completed && view === "action" && (
        <TakeAction
          actionDraft={draft.action || {}}
          setActionDraft={(values) =>
            setDraft((old) => ({
              ...old,
              action: { ...old.action, ...values },
            }))
          }
          identity={identity}
          selected={selected}
          roadmap={roadmap}
          pending={pending}
          error={error}
          onRoadmap={onRoadmap}
          onResume={() =>
            transition({ view: "resume", resumeReturn: "action" })
          }
          onPaths={() =>
            transition({ view: results.length ? "paths" : "identity" })
          }
          saving={saving}
          onSaveRoadmap={onSaveRoadmap}
          user={user}
          saveMessage={saveMessage}
        />
      )}
      <footer className="loom-flow-footer">
        <span>THERE’S MORE THAN ONE WAY TO BE YOU.</span>
        <button
          className="motion-toggle"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "Resume background motion" : "Pause background motion"}
        </button>
      </footer>
    </div>
  );
}
