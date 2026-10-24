// A tab-scoped draft, separate from explicitly saved account data.
const KEY = "careerbridge-workspace-v1";
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v) =>
  Array.isArray(v) && v.every((s) => typeof s === "string");
const career = (v) =>
  object(v) &&
  [v.id, v.title, v.source, v.description].every((s) => typeof s === "string");
const skills = (v) =>
  Array.isArray(v) && v.every((s) => object(s) && typeof s.name === "string");
const stages = ["role", "level", "subject", "detail", "skills", "identity"];
const views = ["identity", "paths", "action", "resume"];

export function clearWorkspaceSession() {
  try {
    sessionStorage.removeItem(KEY);
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
        Object.values(d.action).some((v) => typeof v !== "string"))
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
