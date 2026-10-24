import React, { useEffect, useRef } from "react";
import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import "./skill-evidence.css";

export default function SkillEvidence({ gap, pending, onReview }) {
  const heading = useRef(null);
  const lastAnswer = useRef(false);
  const suggestions = gap.suggested_matches || [];
  const answers = (gap.essential_skills || []).filter((s) =>
    ["user_confirmed", "user_dismissed"].includes(s.method),
  );
  useEffect(() => {
    if (lastAnswer.current && !pending) {
      heading.current?.focus({ preventScroll: true });
      lastAnswer.current = false;
    }
  }, [gap, pending]);
  function answer(name, decision) {
    lastAnswer.current = true;
    onReview(name, decision);
  }
  if (!suggestions.length && !answers.length && gap.engine !== "rules_fallback")
    return null;
  return (
    <section
      className="skill-evidence"
      aria-label="Review related skill evidence"
      aria-busy={pending}
    >
      <h3 ref={heading} tabIndex={-1}>
        <Sparkles size={18} /> Connections in your story
      </h3>
      {gap.engine === "rules_fallback" && (
        <p role="status">{gap.analysis_notice}</p>
      )}
      <p>
        {suggestions.length
          ? "Your words may describe these skills. Confirm only what you can demonstrate; the rest stays in your learning plan."
          : "Your answers are reflected in the skills below and your next learning plan."}
      </p>
      <div className="skill-evidence-list">
        {suggestions.map((skill) => (
          <article key={skill.name} aria-label={`Evidence for ${skill.name}`}>
            <div className="skill-evidence-label">
              <strong>{skill.name}</strong>
              <span>NEEDS YOUR CONFIRMATION</span>
            </div>
            {skill.evidence && (
              <>
                <small>From your {skill.evidence.source}</small>
                <blockquote>{skill.evidence.text}</blockquote>
              </>
            )}
            <div className="skill-evidence-actions">
              <button
                className="story-small-button"
                disabled={pending}
                aria-label={`Confirm ${skill.name}`}
                onClick={() => answer(skill.name, true)}
              >
                <Check size={14} /> Yes, I have this skill
              </button>
              <button
                className="story-small-button"
                disabled={pending}
                aria-label={`Not yet: ${skill.name}`}
                onClick={() => answer(skill.name, false)}
              >
                <X size={14} /> Not yet
              </button>
            </div>
          </article>
        ))}
      </div>
      {!!answers.length && (
        <details className="skill-evidence-answers">
          <summary>Review your answers ({answers.length})</summary>
          {answers.map((skill) => (
            <div key={skill.name}>
              <span>
                {skill.name}
                <small>
                  {skill.method === "user_confirmed"
                    ? "Confirmed by you"
                    : "Kept in your learning plan"}
                </small>
              </span>
              <button
                className="story-small-button"
                disabled={pending}
                aria-label={`Reconsider ${skill.name}`}
                onClick={() => answer(skill.name, null)}
              >
                <RotateCcw size={13} /> Undo
              </button>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
