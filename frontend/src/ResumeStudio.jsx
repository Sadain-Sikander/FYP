import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import ResumeReview from "./ResumeReview";
import { uniqueWords } from "./discoveryModel";
import "./resume-studio.css";

export default function ResumeStudio({
  extraction,
  uploading,
  uploadError,
  upload,
  clearUpload,
  form,
  update,
  reviewed,
  setReviewed,
  onBack,
  backLabel,
  onContinue,
}) {
  const input = useRef(null);
  const heading = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState("");
  const skills = uniqueWords(form.skills);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [extraction]);

  function receive(files) {
    setDragging(false);
    if (!files.length) return;
    if (files.length !== 1) {
      setDropError("Choose one resume at a time.");
      return;
    }
    setDropError("");
    upload(files[0]);
  }

  return (
    <main
      id="discovery-content"
      className={`resume-studio ${extraction ? "has-resume" : ""}`}
    >
      <button className="loom-text resume-back" onClick={onBack}>
        <ArrowLeft size={16} /> {backLabel}
      </button>
      <div className="resume-intro" key={extraction ? "review" : "upload"}>
        <span className="story-overline">YOUR NEXT CHAPTER STARTS HERE</span>
        <h1 ref={heading} tabIndex={-1}>
          {extraction ? (
            <>
              Your experience.
              <br />
              <em>A clearer story.</em>
            </>
          ) : (
            <>
              There’s a story
              <br />
              in your <em>resume.</em>
            </>
          )}
        </h1>
        <p>
          {extraction
            ? "We’ve brought your experience into the picture. Make it yours, then discover where it could take you."
            : "Bring what you’ve already done. We’ll help you see what comes next."}
        </p>
      </div>

      <input
        ref={input}
        className="sr-only"
        type="file"
        accept=".pdf,.docx"
        aria-label="Upload your resume"
        disabled={uploading}
        tabIndex={-1}
        onChange={(e) => {
          receive(e.target.files);
          e.target.value = "";
        }}
      />

      {!extraction && (
        <section
          className={`resume-invitation ${dragging ? "is-dragging" : ""}`}
          aria-label="Resume upload"
          aria-busy={uploading}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading) receive(e.dataTransfer.files);
          }}
        >
          <div
            className={`resume-orbit ${uploading ? "is-reading" : ""}`}
            aria-hidden="true"
          >
            <span />
            <span />
            <FileText size={48} strokeWidth={1} />
            <Sparkles className="resume-orbit-spark" size={20} />
          </div>
          <button
            className="loom-cta"
            disabled={uploading}
            onClick={() => input.current?.click()}
          >
            {uploading ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Upload size={18} />
            )}
            {uploading ? "Reading your story…" : "Choose your resume"}
          </button>
          <p role="status">
            {uploading
              ? "Finding your education, experience, and skills."
              : "or drop it anywhere in this space"}
          </p>
          <small>Text-based PDF or DOCX · Up to 5 MiB</small>
          {uploading && (
            <button className="loom-text" onClick={clearUpload}>
              Cancel upload
            </button>
          )}
        </section>
      )}
      {(dropError || uploadError) && (
        <p className="loom-error" role="alert">
          {dropError || uploadError}
        </p>
      )}

      {extraction && (
        <div className="resume-content" key={extraction.filename}>
          <div className="resume-file-strip">
            <FileText size={21} />
            <div>
              <strong>{extraction.filename}</strong>
              <span>
                <Check size={12} /> Added to your story · Existing answers kept
              </span>
            </div>
            <button
              className="story-small-button"
              onClick={() => input.current?.click()}
            >
              Replace resume
            </button>
            <button
              className="story-small-button"
              aria-label="Clear uploaded resume"
              onClick={clearUpload}
            >
              <X size={16} />
            </button>
          </div>
          <div className="resume-workspace">
            <section
              className="resume-story"
              aria-labelledby="resume-story-heading"
            >
              <span className="story-overline">01 / MAKE IT YOURS</span>
              <h2 id="resume-story-heading">The story so far.</h2>
              <p>
                Check these details and edit anything that doesn’t sound like
                you.
              </p>
              {[
                ["education", "Education & courses", "What have you studied?"],
                [
                  "experience",
                  "Experience & projects",
                  "What have you worked on?",
                ],
              ].map(([key, label, placeholder]) => (
                <label className="resume-line-field" key={key}>
                  <span>{label}</span>
                  <textarea
                    aria-label={label}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                    placeholder={placeholder}
                    maxLength={6000}
                    rows={4}
                  />
                </label>
              ))}
              <label className="resume-line-field">
                <span>Skills</span>
                <textarea
                  aria-label="Skills"
                  value={form.skills}
                  onChange={(e) => update("skills", e.target.value)}
                  placeholder="Add skills, separated by commas"
                  maxLength={6000}
                  rows={3}
                />
              </label>
              <p className="resume-skill-count">
                {skills.length} skills in your story
              </p>
              <details className="resume-source">
                <summary>View extraction notes and original text</summary>
                <ul>
                  {extraction.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
                <pre>{extraction.extracted_text}</pre>
              </details>
              <label className="loom-confirm">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                <span>
                  I’ve reviewed these details. They reflect my experience.
                </span>
              </label>
              <button
                className="loom-cta resume-continue"
                disabled={!reviewed}
                onClick={onContinue}
              >
                Continue to my identity <ArrowRight size={18} />
              </button>
            </section>
            <div className="resume-insights">
              <span className="story-overline">
                02 / FIND YOUR NEXT IMPROVEMENT
              </span>
              <ResumeReview extraction={extraction} />
            </div>
          </div>
        </div>
      )}
      {!extraction && !uploading && (
        <button className="loom-text resume-alternative" onClick={onBack}>
          I’ll tell my story instead <ArrowRight size={15} />
        </button>
      )}
    </main>
  );
}
