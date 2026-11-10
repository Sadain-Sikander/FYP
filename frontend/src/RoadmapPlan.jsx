import React, { useState } from "react";
import { ArrowUpRight, Play, X } from "lucide-react";
import "./roadmap.css";

const lessonMessages = {
  not_configured:
    "Video lessons are not connected yet. Use the topic search below for now.",
  provider_unavailable:
    "Video lessons could not be retrieved right now. Rebuild the plan to retry, or search this topic.",
  no_results:
    "No playable lesson was found for this topic. Try the topic search below.",
  no_distinct_result:
    "No new playable lesson was found for this stage. Earlier videos are not repeated here.",
};

function searchLink(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://www.youtube.com" &&
      url.pathname === "/results"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export default function RoadmapPlan({
  roadmap,
  grid = false,
  onRebuild,
  pending,
}) {
  const [playing, setPlaying] = useState("");
  const stages = [
    ...new Set(
      roadmap.milestones.map((week) => week.learning_stage).filter(Boolean),
    ),
  ];
  return (
    <div className="roadmap-content">
      <p className="roadmap-kind">
        {roadmap.generation === "personalized"
          ? "Your personalized learning plan"
          : "Your starter learning plan"}
      </p>
      {roadmap.notice && <p role="status">{roadmap.notice}</p>}
      {roadmap.summary && <p>{roadmap.summary}</p>}
      {stages.length > 0 && (
        <ol className="roadmap-progression" aria-label="Learning progression">
          {stages.map((stage, index) => (
            <li key={stage}>
              <span>{index + 1}</span>
              {stage}
            </li>
          ))}
        </ol>
      )}
      {onRebuild && (
        <button
          type="button"
          className="loom-text"
          onClick={onRebuild}
          disabled={!!pending}
        >
          {pending === "roadmap" ? "Building your plan…" : "Rebuild plan"}
        </button>
      )}
      <ol className={grid ? "milestone-grid roadmap-grid" : "loom-roadmap"}>
        {roadmap.milestones.map((week) => (
          <li className="milestone" key={week.week}>
            <span className="week-label">
              WEEK {String(week.week).padStart(2, "0")}
            </span>
            {week.learning_stage && (
              <p className="roadmap-stage">{week.learning_stage}</p>
            )}
            {week.builds_on_week && (
              <p className="roadmap-continuation">
                Continue from week{" "}
                {String(week.builds_on_week).padStart(2, "0")}
              </p>
            )}
            <h3>{week.title}</h3>
            {week.skills?.length > 0 && (
              <p className="roadmap-topics">Focus: {week.skills.join(" · ")}</p>
            )}
            <h4 className="roadmap-watch-title">Watch and learn</h4>
            {week.lesson_topic && (
              <p className="roadmap-topics">This lesson: {week.lesson_topic}</p>
            )}
            {(week.lessons || [])
              .filter((video) => /^[A-Za-z0-9_-]{11}$/.test(video.id))
              .map((video, index) => {
                const videoKey = `${week.week}-${video.id}`;
                return (
                  <div className="roadmap-lesson" key={video.id}>
                    <p className="roadmap-lesson-order">
                      {index === 0
                        ? "Start here"
                        : "Optional · another explanation"}
                    </p>
                    <p>
                      <strong>{video.title}</strong>
                      <small>{video.channel} · YouTube</small>
                    </p>
                    <div className="roadmap-lesson-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setPlaying(playing === videoKey ? "" : videoKey)
                        }
                        aria-expanded={playing === videoKey}
                      >
                        {playing === videoKey ? (
                          <X size={16} />
                        ) : (
                          <Play size={16} />
                        )}
                        {playing === videoKey ? "Close video" : "Watch lesson"}
                      </button>
                      <a
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open on YouTube <ArrowUpRight size={14} />
                      </a>
                    </div>
                    {playing === videoKey && (
                      <iframe
                        className="roadmap-player"
                        src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                        title={`Watch ${video.title}`}
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    )}
                  </div>
                );
              })}
            {!week.lessons?.length && searchLink(week.lesson_search_url) && (
              <p className="roadmap-search">
                <span>
                  {lessonMessages[week.lesson_status] ||
                    "No playable lesson is attached to this week. Explore lessons for this topic."}
                </span>
                <a
                  href={searchLink(week.lesson_search_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Search YouTube <ArrowUpRight size={14} />
                </a>
              </p>
            )}
            <h4 className="roadmap-watch-title">Try it yourself</h4>
            <ul>
              {(week.tasks || []).map((task, i) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
            {week.project && (
              <div className="roadmap-project">
                <strong>Put it into practice</strong>
                <p>{week.project}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="roadmap-note">
        {roadmap.note || "A starting plan. Adjust the pace to fit your life."}
      </p>
      {["available", "partial"].includes(roadmap.lesson_status) && (
        <p className="roadmap-note">
          Lessons are suggested from YouTube search results. Check the
          instructor, date and fit for your goals. Availability can change. If a
          player is unavailable in your region, use Open on YouTube.
        </p>
      )}
    </div>
  );
}
