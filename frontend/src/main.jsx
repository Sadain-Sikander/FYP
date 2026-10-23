import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  Compass,
  FileText,
  Flag,
  Home as HomeIcon,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/outfit";
import Home from "./Home";
import ThemeToggle, { ThemeProvider } from "./Theme";
import DiscoveryFlow from "./DiscoveryFlow";
import { initialDiscovery } from "./discoveryModel";
import {
  readWorkspaceSession,
  writeWorkspaceSession,
  clearWorkspaceSession,
} from "./workspaceSession";
import AuthPage from "./AuthPage";
import ResumeReview from "./ResumeReview";
import SavedSpace from "./SavedSpace";
import { supabase, saveUserData } from "./account";
import "./styles.css";
import "./experience.css";
import "./discovery.css";
import "./themes.css";
import "./story-flow.css";

const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const EMPTY_PROFILE = {
  education: "",
  experience: "",
  skills: "",
  interests: "",
  strengths: "",
  work_preferences: "",
  career_goals: "",
  preferred_industries: "",
};
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const splitSkills = (value) => [
  ...new Map(
    value
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => [s.toLowerCase(), s]),
  ).values(),
];
const meaningfulProfile = (profile) =>
  Object.values(profile).join(" ").trim().length >= 10;
const errorMessage = (data) =>
  typeof data?.detail === "string"
    ? data.detail
    : Array.isArray(data?.detail)
      ? data.detail.map((d) => d.msg).join(". ")
      : "We could not complete that request. Please try again.";

async function responseData(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The service returned an unexpected response. Please try again.",
    );
  }
  if (!response.ok) throw new Error(errorMessage(data));
  return data;
}

function Step({ number, title, description, active, complete }) {
  return (
    <div
      className={`journey-step ${active ? "active" : ""} ${complete ? "complete" : ""}`}
    >
      <span className="step-circle">
        {complete ? <Check size={17} /> : number}
      </span>
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}

function Explorer({ user, initialMode, entryVersion, navigate, signOut }) {
  const [restored] = useState(() =>
    readWorkspaceSession(user, EMPTY_PROFILE, initialDiscovery()),
  );
  const [form, setForm] = useState(() => restored?.form || EMPTY_PROFILE);
  const [guided, setGuided] = useState(() => restored?.guided ?? true);
  const [discoveryDraft, setDiscoveryDraft] = useState(
    () => restored?.discoveryDraft || initialDiscovery(),
  );
  const [mode, setMode] = useState(() => restored?.mode || "manual");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [extraction, setExtraction] = useState(
    () => restored?.extraction ?? null,
  );
  const [applied, setApplied] = useState(() => !!restored?.extraction);
  const [resumeName, setResumeName] = useState(
    () => restored?.resumeName ?? "",
  );
  const [reviewed, setReviewed] = useState(() => restored?.reviewed ?? false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState(() => restored?.results ?? []);
  const [selected, setSelected] = useState(() => restored?.selected ?? null);
  const [gap, setGap] = useState(() => restored?.gap ?? null);
  const [roadmap, setRoadmap] = useState(() => restored?.roadmap ?? null);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedVersion, setSavedVersion] = useState(0);
  const analysisRequest = useRef({ version: 0, controller: null });
  const uploadRequest = useRef({ version: 0, controller: null });
  const profileRef = useRef(null);
  const resultsRef = useRef(null);
  const detailsRef = useRef(null);
  const roadmapRef = useRef(null);
  const fileInput = useRef(null);
  const saveRequest = useRef(0);

  const firstEntry = useRef(true);
  useEffect(() => {
    if (firstEntry.current) {
      firstEntry.current = false;
      if (restored && entryVersion === 0) return;
    }
    setMode(initialMode === "guided" ? "manual" : initialMode);
    setGuided(initialMode === "guided" || initialMode === "resume");
    if (initialMode === "resume") {
      setDiscoveryDraft((old) => ({
        ...old,
        view: "resume",
        resumeReturn: null,
      }));
    } else if (initialMode === "guided") {
      setDiscoveryDraft((old) =>
        old.view === "resume"
          ? {
              ...old,
              view: "identity",
              stage: Object.values(form).some((value) => value.trim())
                ? "identity"
                : old.stage,
            }
          : old,
      );
    }
  }, [initialMode, entryVersion]);

  useEffect(() => {
    writeWorkspaceSession(user, {
      form,
      guided,
      discoveryDraft,
      mode,
      extraction,
      resumeName,
      reviewed,
      results,
      selected,
      gap,
      roadmap,
    });
  }, [
    user?.id,
    form,
    guided,
    discoveryDraft,
    mode,
    extraction,
    resumeName,
    reviewed,
    results,
    selected,
    gap,
    roadmap,
  ]);

  useEffect(
    () => () => {
      analysisRequest.current.controller?.abort();
      uploadRequest.current.controller?.abort();
      saveRequest.current++;
    },
    [],
  );

  function clearAnalysis() {
    analysisRequest.current.controller?.abort();
    analysisRequest.current.version += 1;
    setPending("");
    setResults([]);
    setSelected(null);
    setGap(null);
    setRoadmap(null);
    setError("");
  }

  function update(key, value) {
    clearAnalysis();
    setForm((old) => ({ ...old, [key]: value }));
    setReviewed(false);
    setNotice("");
  }

  function changeMode(next) {
    if (next !== mode && uploading) {
      uploadRequest.current.controller?.abort();
      uploadRequest.current.version += 1;
      setUploading(false);
    }
    setMode(next);
  }

  async function upload(file) {
    uploadRequest.current.controller?.abort();
    const version = ++uploadRequest.current.version;
    setUploading(false);
    setUploadError("");
    setExtraction(null);
    setApplied(false);
    setNotice("");
    setDragging(false);
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setUploadError(
        "Choose a PDF or DOCX resume. You can also enter your profile manually.",
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(
        "This file is larger than 5 MiB. Choose a smaller PDF or DOCX resume.",
      );
      return;
    }
    if (!file.size) {
      setUploadError("This file is empty. Choose a resume with readable text.");
      return;
    }
    const controller = new AbortController();
    uploadRequest.current.controller = controller;
    setUploading(true);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60000);
    try {
      const body = new FormData();
      body.append("file", file);
      const data = await responseData(
        await fetch(`${API}/api/resume/extract`, {
          method: "POST",
          body,
          signal: controller.signal,
        }),
      );
      if (version === uploadRequest.current.version) {
        setExtraction(data);
        applyExtraction(data);
      }
    } catch (err) {
      if (
        version === uploadRequest.current.version &&
        (err.name !== "AbortError" || timedOut)
      ) {
        setUploadError(
          timedOut
            ? "Reading this resume took too long. Try a simpler document or continue manually."
            : err instanceof TypeError
              ? "We could not reach the resume service. Please try again."
              : err.message,
        );
      }
    } finally {
      clearTimeout(timeout);
      if (version === uploadRequest.current.version) setUploading(false);
    }
  }

  function clearUpload() {
    uploadRequest.current.controller?.abort();
    uploadRequest.current.version += 1;
    setUploading(false);
    setExtraction(null);
    setApplied(false);
    setUploadError("");
    if (fileInput.current) fileInput.current.value = "";
    setNotice("Upload cleared. Your editable profile has been kept.");
  }

  function applyExtraction(data) {
    clearAnalysis();
    setForm((current) => {
      const next = { ...current };
      Object.keys(EMPTY_PROFILE).forEach((key) => {
        const incoming = data.profile[key];
        if (key === "skills") {
          next.skills = splitSkills(
            [current.skills, ...(incoming || [])].join(", "),
          ).join(", ");
        } else if (incoming?.trim()) {
          const existing = current[key].trim();
          next[key] = !existing
            ? incoming
            : existing.toLowerCase().includes(incoming.trim().toLowerCase())
              ? current[key]
              : `${existing}\n${incoming}`;
        }
      });
      return next;
    });
    setResumeName(data.filename);
    setApplied(true);
    setReviewed(false);
    setNotice(
      "Your resume has automatically filled the profile below. Existing answers were kept. Review the details and add anything missing.",
    );
  }

  async function save(table, data, careerId) {
    if (!user) {
      navigate("login");
      return;
    }
    const version = ++saveRequest.current;
    setSaving(true);
    setSaveMessage("");
    try {
      await saveUserData(table, user.id, data, careerId);
      if (version === saveRequest.current) {
        setSaveMessage("Saved to your account.");
        setSavedVersion((v) => v + 1);
      }
    } catch (err) {
      if (version === saveRequest.current) setSaveMessage(err.message);
    } finally {
      if (version === saveRequest.current) setSaving(false);
    }
  }

  function loadProfile(data) {
    setDiscoveryDraft({
      ...initialDiscovery(),
      stage: "identity",
      started: true,
      identityText:
        typeof data.identity_statement === "string"
          ? data.identity_statement
          : null,
    });
    clearUpload();
    clearAnalysis();
    setForm(
      Object.fromEntries(
        Object.keys(EMPTY_PROFILE).map((key) => [
          key,
          key === "skills"
            ? Array.isArray(data[key])
              ? data[key].join(", ")
              : ""
            : typeof data[key] === "string"
              ? data[key]
              : "",
        ]),
      ),
    );
    setResumeName("");
    setReviewed(false);
    setNotice("Your saved profile is ready to edit.");
    profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function analyze(kind, path, payload, onSuccess) {
    analysisRequest.current.controller?.abort();
    const version = ++analysisRequest.current.version;
    const controller = new AbortController();
    analysisRequest.current.controller = controller;
    setPending(kind);
    setError("");
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 180000);
    try {
      const data = await responseData(
        await fetch(`${API}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }),
      );
      if (version === analysisRequest.current.version) onSuccess(data);
    } catch (err) {
      if (
        version === analysisRequest.current.version &&
        (err.name !== "AbortError" || timedOut)
      ) {
        setError(
          timedOut
            ? "This request took longer than expected. Please try again."
            : err instanceof TypeError
              ? "We could not reach the career service. Please try again."
              : err.message,
        );
      }
    } finally {
      clearTimeout(timeout);
      if (version === analysisRequest.current.version) setPending("");
    }
  }

  function recommend(event, identity = "") {
    event.preventDefault();
    if (!meaningfulProfile(form) || (resumeName && !reviewed) || uploading)
      return;
    clearAnalysis();
    analyze(
      "recommend",
      "/api/careers/recommend",
      {
        ...form,
        skills: splitSkills(form.skills),
        identity_statement: identity,
        top_k: guided ? 12 : 6,
      },
      (data) => {
        setResults(data.results || []);
        if (!data.results?.length)
          setError(
            "No careers were returned. Add more detail to your profile and try again.",
          );
        else
          setTimeout(
            () =>
              resultsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              }),
            50,
          );
      },
    );
  }

  function selectCareer(career) {
    setSelected(career);
    setGap(null);
    setRoadmap(null);
    analyze(
      "gap",
      "/api/skill-gap",
      { career_id: career.id, user_skills: splitSkills(form.skills) },
      (data) => {
        setGap(data);
        setTimeout(
          () =>
            detailsRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          50,
        );
      },
    );
  }

  function makeRoadmap() {
    if (!selected) return;
    analyze(
      "roadmap",
      "/api/roadmap",
      {
        career_id: selected.id,
        user_skills: splitSkills(form.skills),
        weeks: 4,
      },
      (data) => {
        setRoadmap(data);
        setTimeout(
          () =>
            roadmapRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          50,
        );
      },
    );
  }

  const completed = Object.values(form).filter((value) => value.trim()).length;
  const skillCount = splitSkills(form.skills).length;
  const field = (key, label, placeholder, rows = 2, hint) => (
    <label
      className={`field field-${key}`}
      key={key}
      htmlFor={`profile-${key}`}
    >
      <span id={`label-${key}`}>{label}</span>
      <textarea
        id={`profile-${key}`}
        aria-labelledby={`label-${key}`}
        aria-describedby={hint ? `hint-${key}` : undefined}
        value={form[key]}
        onChange={(event) => update(key, event.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={6000}
      />
      {hint && <small id={`hint-${key}`}>{hint}</small>}
    </label>
  );

  if (guided) {
    return (
      <DiscoveryFlow
        form={form}
        draft={discoveryDraft}
        setDraft={setDiscoveryDraft}
        update={update}
        resume={{ extraction, uploading, uploadError, upload, clearUpload }}
        onSaveProfile={(identity) =>
          save("profiles", {
            ...form,
            skills: splitSkills(form.skills),
            identity_statement: identity,
          })
        }
        pending={pending}
        error={error}
        canExplore={
          meaningfulProfile(form) && !uploading && (!resumeName || reviewed)
        }
        resumeName={resumeName}
        reviewed={reviewed}
        setReviewed={setReviewed}
        onExplore={recommend}
        results={results}
        selected={selected}
        gap={gap}
        roadmap={roadmap}
        onSelect={selectCareer}
        onRoadmap={makeRoadmap}
        onEditResults={clearAnalysis}
        user={user}
        saving={saving}
        saveMessage={saveMessage}
        onSaveCareer={() =>
          selected && save("saved_careers", selected, selected.id)
        }
        onSaveRoadmap={() =>
          roadmap && save("saved_roadmaps", roadmap, roadmap.career.id)
        }
        onEditor={() => setGuided(false)}
        onHome={() => navigate("home")}
      />
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="CareerBridge home">
          <span className="brand-icon">
            <Route size={23} />
          </span>
          <span>
            CareerBridge
            <span className="brand-sub">FIND YOUR NEXT CHAPTER</span>
          </span>
        </a>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav aria-label="Workspace">
          <a href="#home" className="nav-item">
            <HomeIcon size={18} /> Home
          </a>
          <a href="#profile" className="nav-item current">
            <UserRound size={18} /> Your profile <span>01</span>
          </a>
          <a
            href={results.length ? "#matches" : "#profile"}
            className="nav-item"
          >
            <Compass size={18} /> Career explorer <span>02</span>
          </a>
          {extraction && (
            <a href="#resume-review" className="nav-item">
              <FileText size={18} /> Resume review
            </a>
          )}
          {user && (
            <a href="#saved" className="nav-item">
              <Bookmark size={18} /> Saved space
            </a>
          )}
          <a
            href={roadmap ? "#roadmap" : gap ? "#skills" : "#profile"}
            className="nav-item"
          >
            <MapIcon size={18} /> Your roadmap <span>03</span>
          </a>
        </nav>
        <div className="sidebar-note">
          <div className="note-spark">
            <Sparkles size={20} />
          </div>
          <h3>
            A starting point.
            <br />
            Not a final answer.
          </h3>
          <p>
            Your career can grow in more than one direction. Let your curiosity
            lead.
          </p>
          <div className="note-line" />
        </div>
        <div className="sidebar-bottom">
          <Layers size={17} />
          <span>
            Grounded in occupational data<strong>O*NET + ESCO</strong>
          </span>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <span>
            <span className="status-dot" /> A little direction. A lot of
            possibility.
          </span>
          <ThemeToggle />
          <div className="workspace-label">
            <UserRound size={15} />
            {user ? (
              <>
                <span>{user.user_metadata?.display_name || user.email}</span>
                <button className="nav-text" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <a href="#login">
                Sign in to save your progress <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </header>
        <main id="main">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="tiny-line" /> YOUR NEXT CHAPTER
              </span>
              <h1 id="hero-title">
                Your experience.
                <br />
                <em>A world of possibilities.</em>
              </h1>
              <p>
                Connect what you know with what you could become.
                <br className="desktop-break" /> Explore career paths and take
                your next step with purpose.
              </p>
              <a className="text-link" href="#profile">
                Start with your story <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="orbit-dot dot-one" />
              <span className="orbit-dot dot-two" />
              <div className="possibility-card">
                <span className="mini-eyebrow">EVERY EXPERIENCE COUNTS</span>
                <div className="visual-symbol">
                  <Compass size={36} strokeWidth={1.3} />
                </div>
                <h2>
                  There is more than
                  <br />
                  one way forward.
                </h2>
                <div className="visual-tags">
                  <span>Experience</span>
                  <Plus size={11} />
                  <span>Curiosity</span>
                </div>
              </div>
              <div className="floating-note">
                <Sparkles size={15} /> Find the connections
              </div>
            </div>
          </section>

          <div className="journey" aria-label="Your career exploration steps">
            <Step
              number="01"
              title="Build your profile"
              description="Start with your story"
              active={!results.length}
              complete={!!results.length}
            />
            <span className="journey-line" />
            <Step
              number="02"
              title="Explore possibilities"
              description="Find paths that connect"
              active={!!results.length && !roadmap}
              complete={!!roadmap}
            />
            <span className="journey-line" />
            <Step
              number="03"
              title="Make your next move"
              description="Turn discovery into action"
              active={!!roadmap}
            />
          </div>
          {saveMessage && (
            <div className="alert info" role="status">
              {saveMessage}
            </div>
          )}
          {user && (
            <SavedSpace
              key={user.id}
              user={user}
              refresh={savedVersion}
              onProfile={loadProfile}
              onCareer={selectCareer}
              onRoadmap={(data) => {
                clearAnalysis();
                setRoadmap(data);
                setTimeout(
                  () =>
                    roadmapRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    }),
                  50,
                );
              }}
            />
          )}

          <section className="profile-section" id="profile">
            <div className="section-heading">
              <div>
                <span className="eyebrow">01 / THE STARTING POINT</span>
                <h2>Let's get to know you.</h2>
                <p>
                  A resume is one way to start. Your own words work just as
                  well.
                </p>
              </div>
              <span className="small-tag">
                <ShieldCheck size={14} /> You're in control
              </span>
            </div>
            <div className="profile-layout">
              <div className="profile-card">
                <div
                  className="entry-tabs"
                  role="group"
                  aria-label="How would you like to build your profile?"
                >
                  <button
                    type="button"
                    className={mode === "manual" ? "active" : ""}
                    aria-pressed={mode === "manual"}
                    onClick={() => changeMode("manual")}
                  >
                    <UserRound size={17} /> Enter manually
                  </button>
                  <button
                    type="button"
                    className={mode === "resume" ? "active" : ""}
                    aria-pressed={mode === "resume"}
                    onClick={() => changeMode("resume")}
                  >
                    <Upload size={17} /> Upload a resume
                    <span className="tab-badge">PDF / DOCX</span>
                  </button>
                </div>
                {mode === "resume" && (
                  <div className="upload-section">
                    <div
                      className={`dropzone ${dragging ? "dragging" : ""} ${uploading ? "loading" : ""}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        if (event.dataTransfer.files.length !== 1) {
                          setUploadError("Choose one resume at a time.");
                          return;
                        }
                        upload(event.dataTransfer.files[0]);
                      }}
                    >
                      <input
                        ref={fileInput}
                        type="file"
                        accept=".pdf,.docx"
                        aria-label="Upload your resume"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) upload(file);
                        }}
                      />
                      <span className="upload-icon">
                        {uploading ? (
                          <LoaderCircle className="spin" size={25} />
                        ) : (
                          <Upload size={25} />
                        )}
                      </span>
                      <strong>
                        {uploading
                          ? "Reading your story…"
                          : "Drop your resume here, or browse files"}
                      </strong>
                      <span>Text-based PDF or DOCX · Up to 5 MiB</span>
                    </div>
                    <p className="upload-help">
                      Your profile fills automatically after upload. Review and
                      edit it below. Scanned PDFs need OCR and aren’t supported
                      yet.
                    </p>
                    {uploading && (
                      <button
                        type="button"
                        className="quiet-button"
                        onClick={clearUpload}
                      >
                        Cancel upload
                      </button>
                    )}
                    {uploadError && (
                      <div className="alert error" role="alert">
                        {uploadError}
                      </div>
                    )}
                    {extraction && (
                      <div className="extraction-preview">
                        <div className="file-heading">
                          <span className="file-icon">
                            <FileText size={21} />
                          </span>
                          <div>
                            <strong>{extraction.filename}</strong>
                            <span>
                              Ready for your review ·{" "}
                              {extraction.profile.skills.length} suggested
                              skills
                            </span>
                          </div>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Clear uploaded resume"
                            onClick={clearUpload}
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="extracted-summary">
                          {extraction.profile.education && (
                            <div>
                              <span>EDUCATION</span>
                              <p>{extraction.profile.education}</p>
                            </div>
                          )}
                          {extraction.profile.experience && (
                            <div>
                              <span>EXPERIENCE & PROJECTS</span>
                              <p>{extraction.profile.experience}</p>
                            </div>
                          )}
                          {extraction.profile.skills.length > 0 && (
                            <div>
                              <span>SUGGESTED SKILLS</span>
                              <div className="chips">
                                {extraction.profile.skills.map((skill) => (
                                  <span className="chip" key={skill}>
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <details className="review-details">
                          <summary>
                            Extraction notes <ChevronDown size={15} />
                          </summary>
                          <ul>
                            {extraction.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </details>
                        <details className="review-details">
                          <summary>
                            Read extracted text <ChevronDown size={15} />
                          </summary>
                          <pre>{extraction.extracted_text}</pre>
                        </details>
                        <div className="merge-footer">
                          <p>
                            Your profile was filled automatically.
                            <br />
                            New details are added for you to edit.
                          </p>
                          {applied && (
                            <span className="autofill-badge">
                              <CheckCheck size={16} /> Profile filled
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <form
                  onSubmit={recommend}
                  className="profile-form"
                  ref={profileRef}
                >
                  <div className="form-heading">
                    <h3>
                      {resumeName
                        ? "Make this profile yours."
                        : "Your story, in your words."}
                    </h3>
                    <span>{completed} of 8 fields</span>
                  </div>
                  <p className="form-intro">
                    Start with what feels relevant. Every field is optional.
                  </p>
                  {notice && (
                    <div className="alert success" role="status">
                      {notice}
                    </div>
                  )}
                  {resumeName && (
                    <div className="import-note">
                      <FileText size={15} />
                      <span>
                        Includes details from <strong>{resumeName}</strong>
                      </span>
                    </div>
                  )}
                  <div className="form-grid">
                    {field(
                      "education",
                      "Education & courses",
                      "Your degree, certifications, or something you’re learning",
                      2,
                    )}
                    {field(
                      "experience",
                      "Experience & projects",
                      "Work, personal projects, volunteering — what have you done?",
                      3,
                    )}
                    {field(
                      "skills",
                      "Skills",
                      "Python, Excel, communication, research…",
                      2,
                      "Separate skills with commas. Keep only skills you can explain or demonstrate.",
                    )}
                    {field(
                      "interests",
                      "What interests you?",
                      "Solving problems, creating things, helping people…",
                      2,
                    )}
                    {field(
                      "strengths",
                      "Your strengths",
                      "Explaining ideas, organizing details, thinking creatively…",
                      2,
                    )}
                  </div>
                  <details className="more-profile">
                    <summary>
                      A little more direction <span>Goals & preferences</span>
                      <ChevronDown size={16} />
                    </summary>
                    <div className="form-grid preferences">
                      {field(
                        "career_goals",
                        "Career goals",
                        "Your first role, a career change, or a new challenge",
                        2,
                      )}
                      {field(
                        "work_preferences",
                        "Work preferences",
                        "Collaborative, independent, remote, hands-on…",
                        2,
                      )}
                      {field(
                        "preferred_industries",
                        "Industries of interest",
                        "Technology, healthcare, education…",
                        2,
                      )}
                    </div>
                  </details>
                  {resumeName && (
                    <label className="review-checkbox">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(event) => setReviewed(event.target.checked)}
                      />
                      <span>
                        I've reviewed these details and removed anything that
                        doesn't reflect my experience.
                      </span>
                    </label>
                  )}
                  <div className="form-footer">
                    <p>
                      <ShieldCheck size={15} /> Your profile stays editable.
                      <br />
                      <span>No account needed to explore.</span>
                    </p>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="outline-button"
                        disabled={
                          saving ||
                          uploading ||
                          !meaningfulProfile(form) ||
                          (!!resumeName && !reviewed)
                        }
                        onClick={() =>
                          save("profiles", {
                            ...form,
                            skills: splitSkills(form.skills),
                          })
                        }
                      >
                        <Bookmark size={16} />
                        {saving
                          ? "Saving…"
                          : user
                            ? "Save profile"
                            : "Sign in to save"}
                      </button>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={
                          !!pending ||
                          uploading ||
                          !meaningfulProfile(form) ||
                          (!!resumeName && !reviewed)
                        }
                      >
                        {pending === "recommend" ? (
                          <>
                            <LoaderCircle className="spin" size={18} /> Finding
                            your connections…
                          </>
                        ) : (
                          <>
                            Explore my careers <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {!!resumeName && !reviewed && (
                    <p className="review-reminder">
                      Review your profile and check the confirmation above to
                      continue.
                    </p>
                  )}
                </form>
              </div>
              <aside className="profile-guide">
                <div className="guide-icon">
                  <Sparkles size={21} />
                </div>
                <span className="eyebrow">MORE THAN A JOB TITLE</span>
                <h3>
                  Small details.
                  <br />
                  Meaningful connections.
                </h3>
                <p>
                  You don’t need a perfect resume or a clear destination. Start
                  with the experiences that make you, you.
                </p>
                <ul>
                  <li>
                    <Check size={16} />
                    <span>Class projects and everyday experience count.</span>
                  </li>
                  <li>
                    <Check size={16} />
                    <span>
                      Include skills from work, study, or volunteering.
                    </span>
                  </li>
                  <li>
                    <Check size={16} />
                    <span>
                      Share what you want to explore, not just what you’ve done.
                    </span>
                  </li>
                </ul>
                <div className="profile-meter">
                  <div>
                    <strong>{skillCount}</strong>
                    <span>
                      {skillCount === 1 ? "skill" : "skills"} in your profile
                    </span>
                  </div>
                  <span className="meter-bar">
                    <span
                      style={{
                        width: `${Math.min((completed / 8) * 100, 100)}%`,
                      }}
                    />
                  </span>
                  <small>More context helps us find better connections.</small>
                </div>
              </aside>
            </div>
          </section>

          {extraction && <ResumeReview extraction={extraction} />}

          {error && (
            <div className="alert error global-error" role="alert">
              <div>
                <strong>We couldn’t finish that step.</strong>
                <p>{error}</p>
              </div>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="sr-only" role="status" aria-live="polite">
            {pending === "recommend"
              ? "Finding career matches."
              : pending === "gap"
                ? "Comparing skills."
                : pending === "roadmap"
                  ? "Building your roadmap."
                  : results.length
                    ? `${results.length} career matches available.`
                    : ""}
          </div>

          {results.length > 0 && (
            <section id="matches" className="results-section" ref={resultsRef}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">02 / THE POSSIBILITIES</span>
                  <h2>New directions to explore.</h2>
                  <p>
                    Connections between your profile and career descriptions. A
                    starting point for your curiosity.
                  </p>
                </div>
                <span className="small-tag">
                  {results.length} paths to consider
                </span>
              </div>
              <div className="career-grid">
                {results.map((career, index) => (
                  <article
                    className={`career-card ${selected?.id === career.id ? "selected" : ""}`}
                    key={career.id}
                  >
                    <div className="career-card-top">
                      <span className="career-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="source-tag">{career.source}</span>
                    </div>
                    <h3>{career.title}</h3>
                    <p className="career-description">
                      {career.description ||
                        "Explore the skills associated with this career."}
                    </p>
                    <div className="career-score">
                      <span>Semantic similarity</span>
                      <strong>{career.semantic_similarity.toFixed(3)}</strong>
                    </div>
                    <button
                      className="outline-button"
                      disabled={!!pending}
                      onClick={() => selectCareer(career)}
                    >
                      {pending === "gap" && selected?.id === career.id ? (
                        <>
                          <LoaderCircle size={16} className="spin" /> Comparing
                          skills…
                        </>
                      ) : (
                        <>
                          Explore this path <ArrowUpRight size={17} />
                        </>
                      )}
                    </button>
                    <button
                      className="quiet-button save-career"
                      disabled={saving}
                      onClick={() => save("saved_careers", career, career.id)}
                    >
                      <Bookmark size={15} />
                      {user ? "Save career" : "Sign in to save"}
                    </button>
                  </article>
                ))}
              </div>
              <p className="section-footnote">
                Similarity describes how closely the text connects. It is not a
                probability of employment or a measure of your potential.
              </p>
            </section>
          )}

          {gap && (
            <section id="skills" className="detail-section" ref={detailsRef}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    A CLOSER LOOK / {gap.career.source}
                  </span>
                  <h2>{gap.career.title}</h2>
                  <p>
                    See where your listed skills connect, and what you could
                    learn next.
                  </p>
                </div>
                <span className="coverage-tag">
                  <strong>
                    {gap.coverage_percent === null
                      ? "—"
                      : `${gap.coverage_percent}%`}
                  </strong>{" "}
                  of listed essential skills matched
                </span>
              </div>
              <div className="skill-columns">
                <div className="skill-panel">
                  <h3>
                    <CheckCheck size={19} /> A foundation to build on{" "}
                    <span>{gap.matched_skills.length}</span>
                  </h3>
                  {gap.matched_skills.length ? (
                    <div className="chips">
                      {gap.matched_skills.map((skill) => (
                        <span className="chip matched" key={skill.name}>
                          <Check size={13} />
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">
                      No exact or close matches found in this essential-skill
                      list. You may have related experience — review the terms
                      and update your profile.
                    </p>
                  )}
                </div>
                <div className="skill-panel">
                  <h3>
                    <Target size={19} /> Opportunities to grow{" "}
                    <span>{gap.skill_gaps.length}</span>
                  </h3>
                  {gap.skill_gaps.length ? (
                    <div className="chips">
                      {gap.skill_gaps.map((skill) => (
                        <span className="chip" key={skill.name}>
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">
                      No gaps were found in the available essential-skill list.
                      Explore the role further to confirm your readiness.
                    </p>
                  )}
                </div>
              </div>
              <p className="section-footnote">
                Occupational labels can differ from the words in your profile.
                Review these comparisons; unlisted skills may still be relevant.
              </p>
              <div className="roadmap-cta">
                <div className="cta-icon">
                  <Route size={25} />
                </div>
                <div>
                  <span className="eyebrow">ONE STEP AT A TIME</span>
                  <h3>Turn possibility into a plan.</h3>
                  <p>
                    Start with a four-week outline based on this role and your
                    skill gaps.
                  </p>
                </div>
                <button
                  className="primary-button"
                  disabled={!!pending}
                  onClick={makeRoadmap}
                >
                  {pending === "roadmap" ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> Building your
                      plan…
                    </>
                  ) : (
                    <>
                      Build my roadmap <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
            </section>
          )}

          {roadmap && (
            <section className="roadmap-section" id="roadmap" ref={roadmapRef}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">03 / YOUR NEXT MOVE</span>
                  <h2>A little progress, every week.</h2>
                  <p>
                    Your starter plan for {roadmap.career.title}. Adjust the
                    pace to fit your life.
                  </p>
                </div>
                <span className="small-tag">
                  <Flag size={14} /> {roadmap.duration_weeks}-week outline
                </span>
                <button
                  className="outline-button"
                  disabled={saving}
                  onClick={() =>
                    save("saved_roadmaps", roadmap, roadmap.career.id)
                  }
                >
                  <Bookmark size={16} />
                  {user ? "Save roadmap" : "Sign in to save"}
                </button>
              </div>
              {roadmap.priority_skill_gaps.length > 0 && (
                <div className="priority-skills">
                  <strong>Start with these skills</strong>
                  <div className="chips">
                    {roadmap.priority_skill_gaps.map((skill) => (
                      <span className="chip" key={skill.name}>
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="milestone-grid">
                {roadmap.milestones.map((milestone) => (
                  <article className="milestone" key={milestone.week}>
                    <span className="week-label">
                      WEEK {String(milestone.week).padStart(2, "0")}
                    </span>
                    <h3>{milestone.title}</h3>
                    <ul>
                      {milestone.tasks.map((task, index) => (
                        <li key={index}>{task}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
              <p className="section-footnote">
                This starter outline uses fixed learning stages with your role
                and gaps. Reviewed courses, resource links, and progress
                tracking are planned for a later milestone.
              </p>
            </section>
          )}

          <footer>
            <a href="#main">
              CareerBridge <span>Built for your next chapter.</span>
            </a>
            <span>Explore with curiosity. Decide with context.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

const AUTH_PAGES = ["login", "signup", "forgot", "reset"];
function pageFromHash() {
  const hash = window.location.hash.slice(1);
  if (AUTH_PAGES.includes(hash)) return hash;
  if (
    [
      "explore",
      "profile",
      "matches",
      "skills",
      "roadmap",
      "saved",
      "resume-review",
      "main",
      "discovery-content",
    ].includes(hash)
  )
    return "explore";
  return "home";
}

function App() {
  const [page, setPage] = useState(pageFromHash);
  const [mode, setMode] = useState("guided");
  const [entryVersion, setEntryVersion] = useState(0);
  const [user, setUser] = useState(null);
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [authLoading, setAuthLoading] = useState(!!supabase);
  const [accountError, setAccountError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const lastUser = useRef(null);

  function navigate(next) {
    window.location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const listener = () => {
      const next = pageFromHash();
      setPage(next);
      if (next !== "reset") setRecovery(false);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEvent = false;
    function accept(session) {
      if (!active) return;
      const nextUser = session?.user || null;
      if (lastUser.current && lastUser.current !== nextUser?.id) {
        clearWorkspaceSession();
        setWorkspaceKey((v) => v + 1);
      }
      lastUser.current = nextUser?.id || null;
      setUser(nextUser);
      setAuthLoading(false);
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      authEvent = true;
      accept(session);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        navigate("reset");
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authEvent) return;
        if (error)
          setAccountError(
            "Your account session could not be restored. Please sign in again.",
          );
        accept(data.session);
      })
      .catch(() => {
        if (active) {
          setAuthLoading(false);
          setAccountError(
            "Accounts are temporarily unavailable. You can still explore as a guest.",
          );
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    setAccountError("");
    const { error } = await supabase.auth.signOut();
    if (error) setAccountError("Sign-out failed. Please try again.");
    else {
      setRecovery(false);
      navigate("home");
    }
  }
  function start(nextMode) {
    setMode(nextMode);
    setEntryVersion((value) => value + 1);
    navigate("explore");
  }
  const visiblePage = recovery ? "reset" : page;
  return (
    <>
      {accountError && (
        <div className="account-error alert error" role="alert">
          {accountError}
          <button
            className="icon-button"
            aria-label="Dismiss account message"
            onClick={() => setAccountError("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {visiblePage === "home" && (
        <Home user={user} start={start} signOut={signOut} />
      )}
      {AUTH_PAGES.includes(visiblePage) && (
        <AuthPage
          key={visiblePage}
          mode={visiblePage}
          navigate={navigate}
          onPasswordUpdated={() => setRecovery(false)}
        />
      )}
      <div hidden={visiblePage !== "explore"}>
        {authLoading ? (
          <main className="account-loading" role="status">
            <LoaderCircle size={22} className="spin" /> Opening your workspace…
          </main>
        ) : (
          <Explorer
            key={workspaceKey}
            user={user}
            initialMode={mode}
            entryVersion={entryVersion}
            navigate={navigate}
            signOut={signOut}
          />
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
