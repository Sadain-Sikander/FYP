import React, { useEffect, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import "./writing.css";

const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function writingProfile(form) {
  return {
    education: form.education || "",
    experience: form.experience || "",
    skills: [
      ...new Set(
        (form.skills || "")
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ],
  };
}

export function downloadText(text, filename) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadWord(text, kind) {
  const response = await fetch(`${API}/api/documents/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, kind }),
  });
  if (!response.ok)
    throw new Error(
      "We couldn’t export the Word document. Your draft is still here; try again or download text.",
    );
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download =
    kind === "resume"
      ? "careerbridge-resume.docx"
      : "careerbridge-cover-letter.docx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function WritingAssistant({
  kind,
  form,
  selected,
  state = {},
  onChange,
  onApply,
  sourceReady = true,
}) {
  const profile = writingProfile(form);
  const profileKey = JSON.stringify(profile);
  const jobTitle = state.jobTitle ?? selected?.title ?? "";
  const contextKey = JSON.stringify({
    profile,
    jobTitle,
    company: state.company || "",
    job: state.job || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef({ version: 0, controller: null, contextKey });
  request.current.contextKey = contextKey;
  const proposal =
    state.proposal?.contextKey === contextKey ? state.proposal : null;
  const confirmed = state.reviewedKey === profileKey;
  const hasProfile =
    profile.education.trim() ||
    profile.experience.trim() ||
    profile.skills.length;

  function cancel() {
    request.current.version++;
    request.current.controller?.abort();
    setBusy(false);
  }
  useEffect(() => {
    cancel();
    setError("");
    return () => {
      request.current.version++;
      request.current.controller?.abort();
    };
  }, [contextKey, sourceReady]);

  async function generate() {
    cancel();
    const version = ++request.current.version;
    const controller = new AbortController();
    request.current.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/documents/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          kind,
          profile,
          job_title: jobTitle,
          company: state.company || "",
          job_description: state.job || "",
          profile_reviewed: confirmed && sourceReady,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Check the length of your profile and job description, then try again.",
        );
      if (
        typeof data.draft !== "string" ||
        !Array.isArray(data.evidence) ||
        !Array.isArray(data.questions)
      )
        throw new Error(
          "We couldn’t read this draft. Your edits are unchanged; please try again.",
        );
      if (
        version === request.current.version &&
        contextKey === request.current.contextKey
      )
        onChange({ proposal: { ...data, contextKey } });
    } catch (err) {
      if (version === request.current.version)
        setError(
          err.name === "AbortError"
            ? "Writing took too long. Your edits are unchanged; please try again."
            : err instanceof TypeError
              ? "We couldn’t reach the writing service. Your edits are unchanged."
              : err.message,
        );
    } finally {
      clearTimeout(timeout);
      if (version === request.current.version) setBusy(false);
    }
  }

  return (
    <section
      className="writing-assistant"
      aria-label={
        kind === "resume"
          ? "Resume writing assistant"
          : "Cover letter writing assistant"
      }
    >
      <h3>
        <Sparkles size={18} /> Shape your story for this opportunity.
      </h3>
      <p>
        Use your reviewed experience to prepare an editable draft. Your profile
        details and job description are sent to our AI writing service when you
        generate.
      </p>
      <div className="writing-target">
        <label>
          Target role
          <input
            aria-label="Writing target role"
            value={jobTitle}
            maxLength={160}
            onChange={(e) => onChange({ jobTitle: e.target.value })}
            placeholder="Role you’re applying for"
          />
        </label>
        {kind === "cover_letter" && (
          <label>
            Organisation · optional
            <input
              aria-label="Organisation"
              value={state.company || ""}
              maxLength={160}
              onChange={(e) => onChange({ company: e.target.value })}
              placeholder="Company or organisation"
            />
          </label>
        )}
      </div>
      <label className="writing-job">
        Job description · optional
        <textarea
          aria-label="Writing job description"
          value={state.job || ""}
          onChange={(e) => onChange({ job: e.target.value })}
          maxLength={12000}
          rows={4}
          placeholder="Paste the role’s requirements to tailor the wording."
        />
      </label>
      <details className="writing-sources">
        <summary>Review the profile details used for writing</summary>
        <p>
          <strong>Education</strong>
          <br />
          {profile.education || "Not provided"}
        </p>
        <p>
          <strong>Experience & projects</strong>
          <br />
          {profile.experience || "Not provided"}
        </p>
        <p>
          <strong>Skills</strong>
          <br />
          {profile.skills.join(", ") || "Not provided"}
        </p>
      </details>
      <label className="loom-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!hasProfile || !sourceReady}
          onChange={(e) => {
            cancel();
            onChange({ reviewedKey: e.target.checked ? profileKey : "" });
          }}
        />
        <span>I’ve checked these profile details for this draft.</span>
      </label>
      {!hasProfile && (
        <p>Add education, experience or skills to your profile first.</p>
      )}
      {!sourceReady && (
        <p>
          Review and confirm the extracted profile above before using writing
          assistance.
        </p>
      )}
      <div className="workbench-actions">
        <button
          type="button"
          className="story-small-button"
          disabled={busy || !confirmed || !hasProfile || !sourceReady}
          onClick={generate}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {busy ? "Preparing your draft…" : "Generate AI draft"}
        </button>
        {busy && (
          <button type="button" className="loom-text" onClick={cancel}>
            Cancel writing
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="loom-error">
          {error}
        </p>
      )}
      {state.appliedContext && state.appliedContext !== contextKey && (
        <p role="status">
          Your profile or target changed since the last AI draft. Your edits are
          kept; generate a new suggestion when ready.
        </p>
      )}
      {proposal && (
        <div className="writing-preview">
          <h4>Review the suggested draft</h4>
          <textarea
            aria-label="Suggested document draft"
            value={proposal.draft}
            readOnly
            rows={12}
          />
          <details className="writing-sources">
            <summary>See the source details behind the wording</summary>
            {proposal.evidence.map((item, index) => (
              <blockquote key={index}>
                <p>{item.text}</p>
                <ul>
                  {(item.sources || []).map((source, i) => (
                    <li key={i}>
                      <strong>{source.category}:</strong> {source.text}
                    </li>
                  ))}
                </ul>
              </blockquote>
            ))}
          </details>
          {proposal.questions.length > 0 && (
            <>
              <h4>Details you could add</h4>
              <ul>
                {proposal.questions.map((question, i) => (
                  <li key={i}>{question}</li>
                ))}
              </ul>
            </>
          )}
          <p>{proposal.note}</p>
          <p>
            Use this suggestion to replace the document below, then make it your
            own.
          </p>
          <button
            type="button"
            className="loom-cta"
            disabled={busy || !confirmed || !sourceReady}
            onClick={() => {
              onApply(proposal.draft);
              onChange({ proposal: null, appliedContext: contextKey });
            }}
          >
            Use this draft
          </button>
          <button
            type="button"
            className="loom-text"
            onClick={() => onChange({ proposal: null })}
          >
            Keep my current draft
          </button>
        </div>
      )}
    </section>
  );
}
