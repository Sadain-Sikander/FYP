import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, FileCheck2, LoaderCircle, Sparkles } from "lucide-react";

const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export default function ResumeReview({ extraction }) {
  const [job, setJob] = useState("");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef({ version: 0, controller: null });

  async function review(description) {
    request.current.controller?.abort();
    const version = ++request.current.version;
    const controller = new AbortController();
    request.current.controller = controller;
    setBusy(true);
    setError("");
    setReport(null);
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API}/api/resume/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extraction.extracted_text,
          job_description: description,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "We couldn’t review this resume. Please try again.",
        );
      if (version === request.current.version) setReport(data);
    } catch (err) {
      if (version === request.current.version)
        setError(
          err.name === "AbortError"
            ? "The review timed out. Please try again."
            : err.message,
        );
    } finally {
      clearTimeout(timeout);
      if (version === request.current.version) setBusy(false);
    }
  }
  useEffect(() => {
    setJob("");
    review("");
    return () => {
      request.current.version++;
      request.current.controller?.abort();
    };
  }, [extraction]);

  function editJob(value) {
    request.current.version++;
    request.current.controller?.abort();
    setBusy(false);
    setReport(null);
    setError("");
    setJob(value);
  }
  return (
    <section
      className="resume-review"
      id="resume-review"
      aria-labelledby="review-title"
    >
      <div className="review-heading">
        <span className="review-icon">
          <FileCheck2 size={23} />
        </span>
        <div>
          <span className="eyebrow">
            YOUR RESUME, WITH A LITTLE MORE CLARITY
          </span>
          <h3 id="review-title">Make your experience stand out.</h3>
        </div>
      </div>
      <p className="review-context">
        Reviewing <strong>{extraction.filename}</strong>. Profile edits do not
        change the uploaded document; upload a revised resume to assess it
        again.
      </p>
      <form
        className="job-form"
        onSubmit={(e) => {
          e.preventDefault();
          review(job);
        }}
      >
        <label className="field" htmlFor="job-description">
          <span>
            Target job description <small>Optional</small>
          </span>
          <textarea
            id="job-description"
            value={job}
            onChange={(e) => editJob(e.target.value)}
            maxLength={20000}
            rows={3}
            placeholder="Paste the actual job description to compare relevant skills and get a tailored estimate…"
          />
        </label>
        <button
          className="outline-button"
          disabled={busy || (!!job.trim() && job.trim().length < 30)}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Sparkles size={16} />
          )}
          {job.trim() ? "Compare with this job" : "Review my resume"}
          <ArrowRight size={16} />
        </button>
        {!!job.trim() && job.trim().length < 30 && (
          <small>Add at least 30 characters for a meaningful comparison.</small>
        )}
      </form>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <p className="review-loading" role="status">
          <LoaderCircle size={18} className="spin" /> Checking your resume…
        </p>
      )}
      {report && (
        <div aria-live="polite">
          <div className="score-overview">
            <div
              className="score-ring"
              style={{ "--score": `${report.ats_score}%` }}
            >
              <div>
                <strong>{report.ats_score}</strong>
                <span>/ 100</span>
              </div>
            </div>
            <div>
              <span className="eyebrow">{report.score_label}</span>
              <h4>
                {report.ats_score >= 80
                  ? "A strong starting point."
                  : report.ats_score >= 50
                    ? "Good foundations. Room to grow."
                    : "Let’s strengthen the essentials."}
              </h4>
              <p>{report.method}</p>
              <small>{report.limitations}</small>
            </div>
          </div>
          <details className="score-details">
            <summary>How your score was calculated</summary>
            <div className="score-checks">
              {report.checks.map((check) => (
                <div key={check.id}>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.evidence}</p>
                  </div>
                  <span>
                    {check.points} / {check.maximum}
                  </span>
                </div>
              ))}
            </div>
            <p>
              Readiness total: {report.readiness_score}/100
              {report.job_match?.score != null
                ? ` · Job-skill coverage: ${report.job_match.score}/100`
                : ""}
            </p>
          </details>
          {report.job_match && (
            <div className="keyword-review">
              <h4>Job-description comparison</h4>
              <p>{report.job_match.note}</p>
              {report.job_match.recognized_keywords > 0 && (
                <div className="keyword-columns">
                  <div>
                    <span>FOUND IN YOUR RESUME</span>
                    <div className="chips">
                      {report.job_match.matched_keywords.length ? (
                        report.job_match.matched_keywords.map((term) => (
                          <span className="chip matched" key={term}>
                            {term}
                          </span>
                        ))
                      ) : (
                        <p>No recognised matches.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <span>NOT DETECTED</span>
                    <div className="chips">
                      {report.job_match.missing_keywords.length ? (
                        report.job_match.missing_keywords.map((term) => (
                          <span className="chip" key={term}>
                            {term}
                          </span>
                        ))
                      ) : (
                        <p>All recognised terms were found.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="improvements">
            <h4>Your next improvements</h4>
            {report.suggestions.length ? (
              report.suggestions.map((item, index) => (
                <article key={item.id}>
                  <span className="improvement-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h5>
                      {item.title}
                      <span>{item.priority} priority</span>
                    </h5>
                    <p>{item.suggestion}</p>
                  </div>
                </article>
              ))
            ) : (
              <p>
                These checks found no gaps. Review the content for accuracy and
                tailor your examples to the role.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
