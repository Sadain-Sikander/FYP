import React from "react";
import { RotateCcw, Target } from "lucide-react";
import RoleSkillGroups from "./RoleSkillGroups";
import "./skill-evidence.css";

export default function SkillEvidence({
  gap,
  pending,
  onReview,
  learningSkills,
  onToggleLearning,
}) {
  const missing = gap.skill_gaps || [];
  const added = (gap.essential_skills || []).filter(
    (skill) => skill.method === "user_confirmed",
  );
  return (
    <section
      className="skill-evidence missing-skills"
      aria-label="Missing skills"
      aria-busy={pending}
    >
      <h3>
        <Target size={18} /> Skills to build <span>{missing.length}</span>
      </h3>
      <p>
        Not found in your profile. Choose what to include in your learning plan,
        or let us know if you already have a skill.
      </p>
      {gap.engine === "rules_fallback" && (
        <p role="status">{gap.analysis_notice}</p>
      )}
      {missing.length ? (
        <RoleSkillGroups
          skills={missing}
          pending={pending}
          onReview={onReview}
          onToggleLearning={onToggleLearning}
          learningSkills={learningSkills}
        />
      ) : (
        <p>
          Your profile covers the selected learning priorities. Check the job
          description for any additional requirements.
        </p>
      )}
      {!!added.length && (
        <details className="skill-evidence-answers">
          <summary>Skills you added ({added.length})</summary>
          {added.map((skill) => (
            <div key={skill.name}>
              <span>{skill.name}</span>
              <button
                className="story-small-button"
                disabled={pending}
                aria-label={`Move ${skill.name} back to missing skills`}
                onClick={() => onReview(skill.name, null)}
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
