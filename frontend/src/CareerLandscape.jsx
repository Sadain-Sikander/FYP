import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  LoaderCircle,
  X,
} from "lucide-react";

export default function CareerLandscape({
  results,
  selected,
  gap,
  roadmap,
  pending,
  error,
  onSelect,
  onRoadmap,
  onEdit,
  user,
  saving,
  saveMessage,
  onSaveCareer,
  onSaveRoadmap,
}) {
  const dialog = useRef(null);
  const heading = useRef(null);
  const detailHeading = useRef(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  useEffect(() => {
    if (detailOpen && !dialog.current.open) dialog.current.showModal();
  }, [detailOpen]);
  useEffect(() => {
    if (roadmap) setShowRoadmap(true);
  }, [roadmap]);
  useEffect(() => {
    if (detailOpen) {
      dialog.current?.scrollTo({ top: 0, behavior: "instant" });
      if (showRoadmap) detailHeading.current?.focus({ preventScroll: true });
    }
  }, [showRoadmap, detailOpen]);
  function choose(career) {
    setShowRoadmap(false);
    onSelect(career);
    setDetailOpen(true);
  }
  return (
    <main className="career-landscape" id="discovery-content">
      <div className="landscape-heading">
        <span className="loom-eyebrow">THE WORLD GETS A LITTLE BIGGER</span>
        <h1 ref={heading} tabIndex={-1}>
          Look where your story could go.
        </h1>
        <p>Follow a connection. See what feels like you.</p>
      </div>
      <div className="career-constellation" aria-label="Career possibilities">
        <svg
          className="career-connections"
          viewBox="0 0 1000 550"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M500 275 Q280 260 190 80 M500 275 Q730 260 810 80 M500 275 Q260 230 150 285 M500 275 Q750 240 850 285 M500 275 Q300 310 220 475 M500 275 Q700 330 780 475" />
        </svg>
        <button className="constellation-self" onClick={onEdit}>
          <span className="self-threads">
            <i />
            <i />
            <i />
          </span>
          <span>Your story</span>
          <small>Edit your starting point</small>
        </button>
        {results.map((career, index) => (
          <button
            className={`career-node career-node-${index}`}
            key={career.id}
            onClick={() => choose(career)}
            disabled={!!pending}
            style={{ "--node": index }}
          >
            <span className="career-node-dot" />
            <span className="career-node-type">
              {career.source} · POSSIBILITY 0{index + 1}
            </span>
            <strong>{career.title}</strong>
            <span className="career-node-link">
              Explore this path <ArrowUpRight size={14} />
            </span>
          </button>
        ))}
      </div>
      <div className="landscape-footer">
        <button className="loom-text" onClick={onEdit}>
          <ArrowLeft size={15} />
          Back to my story
        </button>
        <p>
          Connections reflect similarities in career descriptions.
          <br />
          They’re possibilities to explore, not predictions of success.
        </p>
      </div>
      <dialog
        className="career-dialog"
        ref={dialog}
        onClose={() => setDetailOpen(false)}
        onCancel={() => setDetailOpen(false)}
        aria-labelledby="career-detail-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current.close();
        }}
      >
        <div className="career-detail-content">
          <button
            className="close-career"
            aria-label="Close career details"
            onClick={() => dialog.current.close()}
          >
            <X size={20} />
          </button>
          {selected && (
            <>
              <span className="loom-eyebrow">
                {showRoadmap
                  ? "A POSSIBLE WAY FORWARD"
                  : "TRY ON A NEW DIRECTION"}
              </span>
              <h2 id="career-detail-title" ref={detailHeading} tabIndex={-1}>
                {selected.title}
              </h2>
              {error && (
                <p className="loom-error" role="alert">
                  {error}
                </p>
              )}
              {pending && (
                <p className="detail-loading" role="status">
                  <LoaderCircle className="spin" size={18} />
                  {pending === "roadmap"
                    ? "Building your next steps…"
                    : "Looking closer at this career…"}
                </p>
              )}
              {!showRoadmap && (
                <>
                  <p className="career-detail-description">
                    {selected.description}
                  </p>
                  {gap && (
                    <>
                      <div className="career-skill-story">
                        <h3>You already bring</h3>
                        <div>
                          {gap.matched_skills.length ? (
                            gap.matched_skills.map((skill) => (
                              <span key={skill.name}>
                                <Check size={12} />
                                {skill.name}
                              </span>
                            ))
                          ) : (
                            <p>
                              No close label matches found. Your related
                              experience may still be relevant.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="career-skill-story opportunities">
                        <h3>Room to grow</h3>
                        <div>
                          {gap.skill_gaps.length ? (
                            gap.skill_gaps.map((skill) => (
                              <span key={skill.name}>{skill.name}</span>
                            ))
                          ) : (
                            <p>
                              No gaps found in the available essential-skill
                              list.
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="career-detail-note">
                        Skill comparisons use occupational labels. Review these
                        alongside the role’s requirements.
                      </p>
                      <button
                        className="loom-cta"
                        disabled={!!pending}
                        onClick={onRoadmap}
                      >
                        Build my roadmap <ArrowRight size={17} />
                      </button>
                    </>
                  )}
                </>
              )}
              {showRoadmap && roadmap && (
                <>
                  <p className="career-detail-description">
                    A four-week starting point. Make the pace your own.
                  </p>
                  <ol className="loom-roadmap">
                    {roadmap.milestones.map((milestone) => (
                      <li className="milestone" key={milestone.week}>
                        <span>
                          WEEK {String(milestone.week).padStart(2, "0")}
                        </span>
                        <h3>{milestone.title}</h3>
                        <ul>
                          {(milestone.tasks || []).map((task, i) => (
                            <li key={i}>{task}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                  <button
                    className="loom-text"
                    onClick={() => setShowRoadmap(false)}
                  >
                    <ArrowLeft size={15} />
                    Back to skills
                  </button>
                </>
              )}
              <div className="career-save-actions">
                <button
                  className="loom-text"
                  disabled={saving || !!pending}
                  onClick={() => {
                    if (!user) dialog.current.close();
                    if (showRoadmap) onSaveRoadmap();
                    else onSaveCareer();
                  }}
                >
                  {saving
                    ? "Saving…"
                    : user
                      ? showRoadmap
                        ? "Save roadmap"
                        : "Save career"
                      : "Sign in to save"}
                </button>
                {saveMessage && <p role="status">{saveMessage}</p>}
              </div>
            </>
          )}
        </div>
      </dialog>
    </main>
  );
}
