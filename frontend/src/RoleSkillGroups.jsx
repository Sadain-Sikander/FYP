import React from "react";
import { ExternalLink } from "lucide-react";
import "./role-skills.css";

export default function RoleSkillGroups({
  skills = [],
  pending,
  onReview,
  onToggleLearning,
  learningSkills,
}) {
  const categories = [
    ["role", "Practical skills & knowledge"],
    ["tools", "Tools used in this occupation"],
    ["foundation", "Transferable foundations"],
  ];
  return (
    <div className="role-skill-groups">
      {categories.map(([key, title]) => {
        const items = skills.filter((s) => (s.category || "role") === key);
        if (!items.length) return null;
        return (
          <section key={key} className="role-skill-group">
            <h4>{title}</h4>
            {key === "tools" && (
              <p>
                Choose tools that fit your target job. You don’t need to learn
                every alternative.
              </p>
            )}
            <div className="role-skill-items">
              {items.map((skill) => (
                <div key={skill.name} className="learning-skill">
                  <details className="role-skill-item">
                    <summary>{skill.name}</summary>
                    <div>
                      {skill.description && <p>{skill.description}</p>}
                      <p>
                        Occupational research
                        {skill.source_occupation
                          ? ` · ${skill.source_occupation}`
                          : ""}
                      </p>
                      {skill.basis === "matching ESCO title or alias" && (
                        <p>
                          Related through a matching occupation title or
                          published alias. Requirements can vary by employer and
                          country.
                        </p>
                      )}
                      {skill.in_demand === true && (
                        <p>Frequently requested in this occupation.</p>
                      )}
                      {skill.source_url &&
                        /^https?:\/\//.test(skill.source_url) && (
                          <a
                            href={skill.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View source{" "}
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        )}
                    </div>
                  </details>
                  {onToggleLearning && (
                    <div className="missing-skill-actions">
                      <label>
                        <input
                          type="checkbox"
                          checked={
                            !learningSkills ||
                            learningSkills.includes(skill.name)
                          }
                          disabled={pending}
                          onChange={(event) =>
                            onToggleLearning(skill.name, event.target.checked)
                          }
                          aria-label={`Include ${skill.name} in learning plan`}
                        />
                        Include in learning plan
                      </label>
                      <button
                        className="loom-text"
                        disabled={pending}
                        aria-label={`I already have ${skill.name}`}
                        onClick={() => onReview(skill.name, true)}
                      >
                        I already have this skill
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function AdditionalRoleSkills({ gap }) {
  if (!gap.optional_skills?.length) return null;
  return (
    <details className="additional-role-skills">
      <summary>
        Supporting skills and other tools ({gap.optional_skills.length})
      </summary>
      <p>
        Additional catalogue entries to review against the job you want. These
        are outside the selected-priority coverage figure.
      </p>
      <RoleSkillGroups skills={gap.optional_skills} />
    </details>
  );
}
