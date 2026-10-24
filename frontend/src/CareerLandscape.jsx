import SkillEvidence from "./SkillEvidence";
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  LoaderCircle,
  X,
} from "lucide-react";

const positions = [
  [16, 16],
  [84, 16],
  [16, 50],
  [84, 50],
  [16, 84],
  [84, 84],
];

export default function CareerLandscape({
  results,
  selected,
  gap,
  roadmap,
  pending,
  error,
  onSelect,
  openSelected,
  onSelectedOpened,
  onReviewSkill,
  onRoadmap,
  onEdit,
  user,
  saving,
  saveMessage,
  onSaveCareer,
  onSaveRoadmap,
  onTakeAction,
}) {
  const dialog = useRef(null);
  const heading = useRef(null);
  const detailHeading = useRef(null);
  const [desktop, setDesktop] = useState(
    () => matchMedia("(min-width: 701px)").matches,
  );
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(results.length / 6));
  const currentPage = Math.min(page, pageCount - 1);
  const start = desktop ? currentPage * 6 : 0;
  const visibleResults = desktop ? results.slice(start, start + 6) : results;
  useEffect(() => {
    const media = matchMedia("(min-width: 701px)");
    const change = () => setDesktop(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => setPage(0), [results]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  useEffect(() => {
    if (openSelected && selected) {
      setDetailOpen(true);
      onSelectedOpened();
    }
  }, [openSelected, selected, onSelectedOpened]);
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
          viewBox="0 0 1000 700"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {visibleResults.map((career, index) => {
            const [x, y] = positions[index % positions.length];
            return (
              <path
                key={career.id}
                d={`M500 350 Q${x * 10} 350 ${x * 10} ${y * 7}`}
              />
            );
          })}
        </svg>
        <button className="constellation-self" onClick={onEdit}>
          <span className="self-threads">
            <i />
            <i />
            <i />
          </span>
          <span>Your identity</span>
          <small>Edit your starting point</small>
        </button>
        {visibleResults.map((career, index) => (
          <button
            className={`career-node career-node-${index} ${career.title.length > 60 ? "career-node-long" : ""}`}
            key={career.id}
            aria-label={`Explore this path: ${career.title}`}
            title={career.title}
            onClick={() => choose(career)}
            disabled={!!pending}
            style={{
              "--node": index,
              "--node-x": positions[index % positions.length][0],
              "--node-y": positions[index % positions.length][1],
            }}
          >
            <span className="career-node-dot" />
            <span className="career-node-type">
              {career.source} · POSSIBILITY{" "}
              {String(start + index + 1).padStart(2, "0")}
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
        {desktop && pageCount > 1 && (
          <nav
            className="landscape-pagination"
            aria-label="Career result pages"
          >
            <button
              className="story-small-button"
              aria-label="Previous career possibilities"
              disabled={currentPage === 0 || !!pending}
              onClick={() => setPage(currentPage - 1)}
            >
              <ArrowLeft size={16} />
            </button>
            <span role="status" aria-live="polite">
              {start + 1}–{start + visibleResults.length}{" "}
              <span>of {results.length} possibilities</span>
            </span>
            <button
              className="story-small-button"
              aria-label="Next career possibilities"
              disabled={currentPage === pageCount - 1 || !!pending}
              onClick={() => setPage(currentPage + 1)}
            >
              <ArrowRight size={16} />
            </button>
          </nav>
        )}
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
                      <SkillEvidence
                        gap={gap}
                        pending={!!pending}
                        onReview={onReviewSkill}
                      />
                      <div className="career-skill-story">
                        <h3>Listed or confirmed skills</h3>
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
                              No listed or confirmed matches yet. Review any
                              suggested evidence above.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="career-skill-story opportunities">
                        <h3>Skills to build or confirm</h3>
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
                      <p className="career-detail-note">{gap.note}</p>
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
