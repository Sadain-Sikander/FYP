// A tab-scoped draft, separate from explicitly saved account data.
const KEY = "careerbridge-workspace-v1";
const LOGIN_INTENT = "careerbridge-login-intent";

export function beginAccountLogin() {
  try {
    sessionStorage.setItem(LOGIN_INTENT, String(Date.now()));
  } catch {
    /* Optional draft handoff. */
  }
}

export function finishAccountLogin(userId) {
  try {
    const started = Number(sessionStorage.getItem(LOGIN_INTENT));
    sessionStorage.removeItem(LOGIN_INTENT);
    if (!userId || !started || Date.now() - started > 30 * 60 * 1000) return;
    const draft = JSON.parse(sessionStorage.getItem(KEY));
    if (draft?.version === 1 && draft.owner === "guest") {
      draft.owner = userId;
      sessionStorage.setItem(KEY, JSON.stringify(draft));
    }
  } catch {
    /* A failed handoff must not block sign-in. */
  }
}
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v) =>
  Array.isArray(v) && v.every((s) => typeof s === "string");
const career = (v) =>
  object(v) &&
  [v.id, v.title, v.source, v.description].every((s) => typeof s === "string");
const skills = (v) =>
  Array.isArray(v) && v.every((s) => object(s) && typeof s.name === "string");
const boundedText = (v, max) => typeof v === "string" && v.length <= max;
function writingDraft(value) {
  if (value === undefined) return true;
  if (!object(value)) return false;
  for (const [key, max] of Object.entries({
    text: 20000,
    jobTitle: 160,
    company: 160,
    job: 12000,
    reviewedKey: 40000,
    appliedContext: 60000,
  })) {
    if (value[key] !== undefined && !boundedText(value[key], max)) return false;
  }
  const p = value.proposal;
  if (p === undefined || p === null) return true;
  return (
    object(p) &&
    boundedText(p.draft, 20000) &&
    boundedText(p.contextKey, 60000) &&
    (p.note === undefined || boundedText(p.note, 1000)) &&
    Array.isArray(p.questions) &&
    p.questions.length <= 5 &&
    p.questions.every((q) => boundedText(q, 300)) &&
    Array.isArray(p.evidence) &&
    p.evidence.length <= 12 &&
    p.evidence.every(
      (item) =>
        object(item) &&
        boundedText(item.text, 1200) &&
        Array.isArray(item.sources) &&
        item.sources.length <= 12 &&
        item.sources.every(
          (source) =>
            object(source) &&
            boundedText(source.category, 40) &&
            boundedText(source.text, 6000),
        ),
    )
  );
}
const stages = ["role", "level", "subject", "detail", "skills", "identity"];
const views = ["identity", "paths", "action", "resume"];

export function clearWorkspaceSession() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(LOGIN_INTENT);
  } catch {
    /* Storage may be unavailable. */
  }
}

export function readWorkspaceSession(user, emptyProfile, emptyDraft) {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY));
    if (!value) return null;
    if (value.version !== 1 || value.owner !== (user?.id || "guest")) {
      clearWorkspaceSession();
      return null;
    }
    const s = value.state;
    if (!object(s) || !object(s.form) || !object(s.discoveryDraft)) return null;
    if (
      !Object.keys(emptyProfile).every(
        (key) => typeof s.form[key] === "string" && s.form[key].length <= 6000,
      )
    )
      return null;
    const d = s.discoveryDraft;
    if (
      !writingDraft(d.resumeWriting) ||
      !writingDraft(d.action?.letterWriting)
    )
      return null;
    if (!stages.includes(d.stage) || !views.includes(d.view)) return null;
    if (
      !["role", "level", "subject", "detail", "identityFingerprint"].every(
        (key) => typeof d[key] === "string",
      )
    )
      return null;
    if (d.identityText !== null && typeof d.identityText !== "string")
      return null;
    if (
      d.action &&
      (!object(d.action) ||
        Object.entries(d.action).some(
          ([key, value]) =>
            key !== "letterWriting" && typeof value !== "string",
        ))
    )
      return null;
    if (
      d.committedEntry &&
      (!object(d.committedEntry) || typeof d.committedEntry.value !== "string")
    )
      return null;
    if (!Array.isArray(s.results) || !s.results.every(career)) return null;
    if (s.selected && !career(s.selected)) return null;
    if (
      s.gap &&
      (!object(s.gap) ||
        !skills(s.gap.matched_skills) ||
        !skills(s.gap.skill_gaps))
    )
      return null;
    if (
      s.roadmap &&
      (!object(s.roadmap) ||
        !object(s.roadmap.career) ||
        !Array.isArray(s.roadmap.milestones) ||
        !s.roadmap.milestones.every(
          (m) => object(m) && typeof m.title === "string" && strings(m.tasks),
        ))
    )
      return null;
    if (
      s.extraction &&
      (!object(s.extraction) ||
        typeof s.extraction.filename !== "string" ||
        typeof s.extraction.extracted_text !== "string" ||
        !strings(s.extraction.warnings) ||
        !object(s.extraction.profile) ||
        !strings(s.extraction.profile.skills))
    )
      return null;
    if (
      s.skillReviews &&
      (!object(s.skillReviews) ||
        !Object.values(s.skillReviews).every(
          (r) => object(r) && strings(r.confirmed) && strings(r.dismissed),
        ))
    )
      return null;
    return {
      ...s,
      form: Object.fromEntries(
        Object.keys(emptyProfile).map((key) => [key, s.form[key]]),
      ),
      discoveryDraft: {
        ...emptyDraft,
        ...d,
        view: d.view === "paths" && !s.results.length ? "identity" : d.view,
      },
      guided: s.guided !== false,
      mode: s.mode === "resume" ? "resume" : "manual",
      resumeName: typeof s.resumeName === "string" ? s.resumeName : "",
      reviewed: s.reviewed === true,
    };
  } catch {
    return null;
  }
}

export function writeWorkspaceSession(user, state) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, owner: user?.id || "guest", state }),
    );
  } catch {
    // Avoid restoring an older draft after a quota failure.
    clearWorkspaceSession();
  }
}
