import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  List,
  LoaderCircle,
  Map,
  Pencil,
  X,
} from "lucide-react";

const positions = [
  [15, 17],
  [39, 10],
  [63, 18],
  [86, 11],
  [12, 41],
  [85, 38],
  [16, 65],
  [88, 65],
  [13, 89],
  [37, 81],
  [62, 90],
  [85, 88],
];

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
  onTakeAction,
  skills = [],
}) {
  const dialog = useRef(null);
  const heading = useRef(null);
  const detailHeading = useRef(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const [detailOpen, setDetailOpen] = useState(false);
  const [view, setView] = useState("map");
  const [activeId, setActiveId] = useState(null);
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
    <main className={`career-landscape atlas-${view}`} id="discovery-content">
      <div className="landscape-heading">
        <div className="atlas-intro">
          <span className="atlas-eyebrow">YOUR CAREER ATLAS</span>
          <h1 ref={heading} tabIndex={-1}>
            There’s more than one way forward.
          </h1>
          <p>A few familiar directions. A few you might not have imagined.</p>
        </div>
        <div className="atlas-tools">
          <span className="atlas-count">{results.length} possibilities</span>
          <div className="atlas-view-toggle" role="group" aria-label="Career view">
            <button aria-pressed={view === "map"} onClick={() => setView("map")}><Map size={15} /> Map</button>
            <button aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} /> List</button>
          </div>
        </div>
      </div>
      <div className="career-constellation" aria-label="Career possibilities">
        <div className="atlas-orbit atlas-orbit-inner" aria-hidden="true" />
        <div className="atlas-orbit atlas-orbit-outer" aria-hidden="true" />
        <svg
          className="career-connections"
          viewBox="0 0 1000 700"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {results.map((career, index) => {
            const [x, y] = positions[index % positions.length];
            return (
              <path
                key={career.id}
                className={activeId === career.id ? "is-active" : ""}
                d={`M500 350 Q${x * 10} 350 ${x * 10} ${y * 7}`}
              />
            );
          })}
        </svg>
        <button className="constellation-self" onClick={onEdit}>
          <Compass className="atlas-compass" size={22} strokeWidth={1.3} />
          <small>IT STARTS WITH YOU</small>
          <span>Your next<br />chapter</span>
          <span className="atlas-edit"><Pencil size={11} /> Edit your story</span>
        </button>
        <div className="atlas-ingredients" aria-label="Skills in your profile">
          {skills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}
        </div>
        {results.map((career, index) => (
          <button
            className={`career-node career-node-${index} ${selected?.id === career.id ? "is-selected" : ""}`}
            key={career.id}
            aria-label={`Explore this path: ${career.title}`}
            title={career.title}
            onClick={() => choose(career)}
            onMouseEnter={() => setActiveId(career.id)}
            onMouseLeave={() => setActiveId(null)}
            onFocus={() => setActiveId(career.id)}
            onBlur={() => setActiveId(null)}
            aria-haspopup="dialog"
            data-source={career.source}
            disabled={!!pending}
            style={{
              "--node": index,
              "--node-x": positions[index % positions.length][0],
              "--node-y": positions[index % positions.length][1],
            }}
          >
            <span className="career-node-dot" />
            <span className="career-node-type">
              {career.source}
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
        <div className="atlas-legend" aria-label="Occupational data sources">
          <span><i /> O*NET</span><span><i /> ESCO</span>
        </div>
        <p>Connected by your story. Possibilities, not predictions.</p>
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
              {onTakeAction && (
                <button
                  className="loom-text career-action-link"
                  disabled={!!pending}
                  onClick={() => {
                    dialog.current.close();
                    onTakeAction();
                  }}
                >
                  Take the next step <ArrowRight size={16} />
                </button>
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
