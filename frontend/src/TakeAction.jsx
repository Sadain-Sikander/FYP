import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Copy,
  Download,
  FileText,
  LoaderCircle,
  Mail,
  Route,
} from "lucide-react";

export default function TakeAction({
  identity,
  selected,
  roadmap,
  pending,
  error,
  onRoadmap,
  onResume,
  onPaths,
  saving,
  onSaveRoadmap,
  user,
  saveMessage,
  actionDraft = {},
  setActionDraft,
}) {
  const heading = useRef(null);
  const { tool = "", letter = "", letterKey = "" } = actionDraft;
  const setTool = (tool) => setActionDraft({ tool });
  const setLetter = (letter) => setActionDraft({ letter });
  const setLetterKey = (letterKey) => setActionDraft({ letterKey });
  const workbench = useRef(null);
  const [message, setMessage] = useState("");
  const draftKey = `${selected?.id || ""}|${identity}`;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    if (tool) {
      workbench.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      workbench.current?.focus({ preventScroll: true });
    }
  }, [tool]);
  function createLetter() {
    setLetter(
      `Dear Hiring Team,\n\nI’m interested in ${selected ? `the ${selected.title} role` : "opportunities with your team"}.\n\n${identity}\n\n[Add one specific project or experience that demonstrates your relevant skills.]\n\n[Explain why this organisation and role interest you.]\n\nThank you for considering my application. I would welcome the opportunity to discuss how I could contribute.\n\nBest regards,\n[Your name]`,
    );
    setLetterKey(draftKey);
    setMessage("");
  }
  function openLetter() {
    if (!letter) createLetter();
    setTool("letter");
  }
  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      setMessage("Cover letter copied.");
    } catch {
      setMessage("Select the letter text to copy it manually.");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([letter], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "careerbridge-cover-letter.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main id="discovery-content" className="take-action">
      <div className="identity-heading">
        <span className="story-overline">TURN POSSIBILITY INTO PROGRESS</span>
        <h1 ref={heading} tabIndex={-1}>
          Make your next move.
        </h1>
        <p>
          {selected
            ? `A few practical steps toward ${selected.title}.`
            : "Bring your career identity into the real world."}
        </p>
      </div>
      <div className="action-options">
        <button className="action-option" onClick={onResume}>
          <span className="action-illustration">
            <FileText size={54} strokeWidth={1} />
          </span>
          <h2>Workshop your resume</h2>
          <p>
            Upload your resume, review your profile, and check it against a job
            description.
          </p>
          <span>
            Open resume review <ArrowRight size={16} />
          </span>
        </button>
        <button className="action-option" onClick={openLetter}>
          <span className="action-illustration">
            <Mail size={54} strokeWidth={1} />
          </span>
          <h2>Start a cover letter</h2>
          <p>
            Turn your identity into an editable starting point. Add examples in
            your own words.
          </p>
          <span>
            Create a draft <ArrowRight size={16} />
          </span>
        </button>
        <button
          className="action-option"
          onClick={() => {
            if (!selected) onPaths();
            else {
              setTool("roadmap");
              if (!roadmap) onRoadmap();
            }
          }}
        >
          <span className="action-illustration">
            <Route size={54} strokeWidth={1} />
          </span>
          <h2>Build your next steps</h2>
          <p>
            A four-week learning outline based on a career’s skills and your
            current profile.
          </p>
          <span>
            {selected ? "Open your roadmap" : "Choose a career first"}{" "}
            <ArrowRight size={16} />
          </span>
        </button>
      </div>
      {tool === "letter" && (
        <section
          className="action-workbench"
          aria-label="Cover letter workspace"
          ref={workbench}
          tabIndex={-1}
        >
          <div className="workbench-heading">
            <h2>Your cover letter, in progress.</h2>
            <span>EDITABLE STARTER</span>
          </div>
          <p>
            {letterKey !== draftKey
              ? "Your profile or chosen career changed. Refresh the draft to use your latest details."
              : "Replace the bracketed prompts and check every detail before using this letter."}
          </p>
          <textarea
            aria-label="Cover letter draft"
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={14}
            maxLength={15000}
          />
          <div className="workbench-actions">
            <button className="story-small-button" onClick={createLetter}>
              Refresh draft
            </button>
            <button className="story-small-button" onClick={copyLetter}>
              <Copy size={16} />
              Copy letter
            </button>
            <button className="loom-cta" onClick={download}>
              <Download size={16} />
              Download text
            </button>
          </div>
          <p role="status">{message}</p>
        </section>
      )}
      {tool === "roadmap" && (
        <section
          className="action-workbench"
          aria-label="Learning roadmap"
          ref={workbench}
          tabIndex={-1}
        >
          <h2>{selected?.title}: your starting plan.</h2>
          {pending && (
            <p role="status">
              <LoaderCircle size={18} className="spin" />
              Building your next steps…
            </p>
          )}
          {error && (
            <p className="loom-error" role="alert">
              {error}
              <button className="loom-text" onClick={onRoadmap}>
                Try again
              </button>
            </p>
          )}
          {roadmap && (
            <>
              <ol className="loom-roadmap">
                {roadmap.milestones.map((m) => (
                  <li className="milestone" key={m.week}>
                    <span>WEEK {String(m.week).padStart(2, "0")}</span>
                    <h3>{m.title}</h3>
                    <ul>
                      {m.tasks.map((task) => (
                        <li key={task}>{task}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <button
                className="loom-cta"
                disabled={saving}
                onClick={onSaveRoadmap}
              >
                {user ? "Save roadmap" : "Sign in to save"}
              </button>
              <p role="status">{saveMessage}</p>
            </>
          )}
        </section>
      )}
      <button className="loom-text action-more" onClick={onPaths}>
        Explore more career ideas <ArrowRight size={16} />
      </button>
    </main>
  );
}
