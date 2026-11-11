import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { writingProfile, downloadText } from "./WritingAssistant";
import { validQuestions, validFeedback } from "./interviewModel";
import "./interview.css";

const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export default function InterviewPractice({
  form,
  selected,
  state = {},
  onChange,
  sourceReady = true,
}) {
  const profile = writingProfile(form);
  const profileKey = JSON.stringify(profile);
  const target = state.target ?? selected?.title ?? "";
  const contextKey = JSON.stringify({ profile, target: target.trim() });
  const confirmed = state.reviewedKey === profileKey && sourceReady;
  const session = state.session;
  const stale = session && session.contextKey !== contextKey;
  const index = state.index || 0;
  const question = session?.questions[index];
  const answers = state.answers || {};
  const answer = answers[question?.id] || "";
  const reviewed = state.feedback?.[question?.id];
  const feedback = reviewed?.answer === answer ? reviewed.data : null;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [replace, setReplace] = useState(false);
  const heading = useRef(null);
  const request = useRef({ version: 0, controller: null });
  const answered =
    session?.questions.filter((q) => answers[q.id]?.trim()).length || 0;

  function cancel() {
    request.current.version++;
    request.current.controller?.abort();
    setBusy("");
  }
  useEffect(() => {
    cancel();
    setError("");
    setReplace(false);
    return () => {
      request.current.version++;
      request.current.controller?.abort();
    };
  }, [contextKey, confirmed]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [index, session?.questions]);

  async function run(kind) {
    cancel();
    const version = ++request.current.version;
    const controller = new AbortController();
    request.current.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setBusy(kind);
    setError("");
    setReplace(false);
    try {
      const body = {
        job_title: target.trim(),
        profile,
        profile_reviewed: confirmed,
      };
      if (kind === "feedback") {
        body.question = {
          category: question.category,
          question: question.question,
          hint: question.hint,
        };
        body.answer = answer;
      }
      const response = await fetch(`${API}/api/interview/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Check your profile and answer lengths, then retry.",
        );
      if (
        kind === "questions"
          ? !validQuestions(data.questions) ||
            !["starter", "personalized"].includes(data.generation)
          : !validFeedback(data)
      ) {
        throw new Error(
          "We couldn’t read the practice response. Your answers are unchanged; please retry.",
        );
      }
      if (request.current.version !== version) return;
      if (kind === "questions") {
        onChange({
          session: { ...data, contextKey, role: target.trim() },
          index: 0,
          answers: {},
          feedback: {},
        });
      } else {
        onChange({
          feedback: { ...state.feedback, [question.id]: { answer, data } },
        });
      }
    } catch (err) {
      if (request.current.version === version)
        setError(
          err.name === "AbortError"
            ? "Practice assistance took too long. Your answers are kept; please retry."
            : err instanceof TypeError
              ? "We couldn’t reach the practice service. Your answers are kept."
              : err.message,
        );
    } finally {
      clearTimeout(timeout);
      if (request.current.version === version) setBusy("");
    }
  }

  function move(next) {
    cancel();
    setError("");
    onChange({ index: next });
  }
  function download() {
    const notes = [`CareerBridge interview practice — ${session.role}`];
    for (const q of session.questions) {
      const text = answers[q.id] || "";
      notes.push(
        `${q.category}\n${q.question}\n\nMy answer:\n${text || "Not answered yet."}`,
      );
      const saved = state.feedback?.[q.id];
      if (saved?.answer === text) {
        const f = saved.data;
        notes.push(
          `Feedback:\n${f.summary}\n\nStrengths:\n${f.strengths.map((s) => `“${s.quote}” — ${s.comment}`).join("\n")}\n\nImprove:\n${f.improvements.join("\n")}\n\nTry this structure:\n${f.outline.join("\n")}\n\nFollow-up:\n${f.follow_up}`,
        );
      }
    }
    downloadText(
      notes.join("\n\n---\n\n"),
      "careerbridge-interview-practice.txt",
    );
  }

  return (
    <div className="interview-practice writing-assistant">
      <h2>Find your words. Practise your story.</h2>
      <p>
        Five questions, one at a time. Your role and profile are sent to our AI
        service when you start; your answer is sent when you request feedback.
      </p>
      <div className="writing-target">
        <label>
          Role to practise for
          <input
            aria-label="Interview target role"
            value={target}
            maxLength={160}
            placeholder="For example, Junior Developer"
            onChange={(e) => onChange({ target: e.target.value })}
          />
        </label>
      </div>
      <details className="writing-sources">
        <summary>Review the profile used for practice</summary>
        <p>
          <strong>Education</strong>
          <br />
          {profile.education || "Not provided"}
        </p>
        <p>
          <strong>Experience</strong>
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
          disabled={!sourceReady}
          onChange={(e) => {
            cancel();
            onChange({ reviewedKey: e.target.checked ? profileKey : "" });
          }}
        />
        <span>I’ve reviewed my profile for interview practice.</span>
      </label>
      {!sourceReady && (
        <p>Review your extracted profile before starting practice.</p>
      )}
      {stale && (
        <p role="status">
          Your role or profile changed. Your previous answers are kept below.
          Start a new practice session to use the latest details.
        </p>
      )}
      <div className="workbench-actions">
        <button
          className="story-small-button"
          disabled={!!busy || !confirmed || target.trim().length < 2}
          onClick={() => (answered ? setReplace(true) : run("questions"))}
        >
          {busy === "questions" ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {busy === "questions"
            ? "Preparing questions…"
            : session
              ? "Start new practice"
              : "Start practice"}
        </button>
        {session && (
          <button className="loom-text" onClick={download}>
            <Download size={16} /> Download practice notes
          </button>
        )}
        {busy && (
          <button className="loom-text" onClick={cancel}>
            Cancel request
          </button>
        )}
      </div>
      {replace && (
        <div
          className="interview-replace"
          role="group"
          aria-label="Replace practice session"
        >
          <p>
            A new session replaces these answers and feedback in this tab.
            Download your notes first to keep a copy.
          </p>
          <button
            className="story-small-button"
            onClick={() => run("questions")}
            disabled={!!busy || !confirmed}
          >
            Replace and start
          </button>
          <button className="loom-text" onClick={() => setReplace(false)}>
            Keep this practice
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="loom-error">
          {error}
        </p>
      )}
      {session && (
        <>
          <p className="interview-session-kind">
            {session.generation === "personalized"
              ? "Personalized practice"
              : "Starter practice"}{" "}
            · {session.role}
          </p>
          {session.notice && <p role="status">{session.notice}</p>}
          <nav className="interview-steps" aria-label="Interview questions">
            {session.questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                aria-current={i === index ? "step" : undefined}
                aria-label={`Question ${i + 1}: ${q.category}${answers[q.id]?.trim() ? ", answered" : ""}`}
                onClick={() => move(i)}
                disabled={busy === "questions"}
              >
                {i + 1}
                <span>{q.category}</span>
                {answers[q.id]?.trim() ? " ✓" : ""}
              </button>
            ))}
          </nav>
          <p className="interview-count" aria-live="polite">
            {answered} of 5 answers written
          </p>
          <section
            className="interview-question"
            aria-label="Current practice question"
          >
            <span className="story-overline">
              QUESTION {index + 1} · {question.category}
            </span>
            <h3 ref={heading} tabIndex={-1}>
              {question.question}
            </h3>
            <p>{question.hint}</p>
            <label>
              Your answer
              <textarea
                aria-label="Your interview answer"
                rows={7}
                value={answer}
                maxLength={5000}
                disabled={busy === "questions"}
                placeholder="Use a real example. Explain what you did and what you learned."
                onChange={(e) => {
                  cancel();
                  setError("");
                  onChange({
                    answers: { ...answers, [question.id]: e.target.value },
                  });
                }}
              />
            </label>
            <small>
              {answer.length}/5000 characters · At least 20 characters for
              feedback
            </small>
            <details className="interview-self-review">
              <summary>Self-review prompts</summary>
              <ul>
                <li>Did I answer the question directly?</li>
                <li>
                  Did I give a relevant example and explain my own actions?
                </li>
                <li>
                  Did I describe the outcome or what I learned without inventing
                  details?
                </li>
              </ul>
            </details>
            <button
              className="story-small-button"
              disabled={
                !!busy || !confirmed || !!stale || answer.trim().length < 20
              }
              onClick={() => run("feedback")}
            >
              {busy === "feedback" && (
                <LoaderCircle size={16} className="spin" />
              )}
              {busy === "feedback"
                ? "Reviewing your answer…"
                : "Get answer feedback"}
            </button>
            {reviewed && !feedback && (
              <p role="status">
                You edited this answer. Request feedback again for this version.
              </p>
            )}
            {feedback && (
              <section
                className="interview-feedback"
                aria-label="Answer feedback"
              >
                <h4>A clearer next attempt</h4>
                <p>{feedback.summary}</p>
                {feedback.strengths.length > 0 && (
                  <>
                    <h4>What works</h4>
                    {feedback.strengths.map((s, i) => (
                      <blockquote key={i}>
                        <p>“{s.quote}”</p>
                        <p>{s.comment}</p>
                      </blockquote>
                    ))}
                  </>
                )}
                <h4>What to improve</h4>
                <ul>
                  {feedback.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                <h4>Try this structure</h4>
                <ol>
                  {feedback.outline.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <h4>A follow-up to practise</h4>
                <p>{feedback.follow_up}</p>
                <small>
                  {feedback.note || "AI coaching, not a hiring assessment."}
                </small>
              </section>
            )}
            <div className="workbench-actions interview-navigation">
              <button
                className="loom-text"
                onClick={() => move(index - 1)}
                disabled={index === 0 || busy === "questions"}
              >
                <ArrowLeft size={16} /> Previous question
              </button>
              {index < 4 && (
                <button
                  className="story-small-button"
                  onClick={() => move(index + 1)}
                  disabled={busy === "questions"}
                >
                  Next question <ArrowRight size={16} />
                </button>
              )}
            </div>
            {answered === 5 && (
              <p className="interview-complete">
                You’ve written all five answers. Review your feedback, refine
                your examples, and download your notes.
              </p>
            )}
          </section>
        </>
      )}
      <p className="writing-note">
        Practice answers stay in this browser tab and survive refresh. They are
        not saved to your account. Download your notes before signing out or
        closing the tab.
      </p>
    </div>
  );
}
