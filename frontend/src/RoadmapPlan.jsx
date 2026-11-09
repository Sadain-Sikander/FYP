import React, { useState } from "react";
import { ArrowUpRight, Play, X } from "lucide-react";
import "./roadmap.css";

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
  return (
    <div className="roadmap-content">
      <p className="roadmap-kind">
        {roadmap.generation === "personalized"
          ? "Your personalized learning plan"
          : "Your starter learning plan"}
      </p>
      {roadmap.notice && <p role="status">{roadmap.notice}</p>}
      {roadmap.summary && <p>{roadmap.summary}</p>}
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
            <h3>{week.title}</h3>
            {week.skills?.length > 0 && (
              <p className="roadmap-topics">Focus: {week.skills.join(" · ")}</p>
            )}
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
            {week.lessons?.length > 0 && (
              <h4 className="roadmap-watch-title">Watch and learn</h4>
            )}
            {(week.lessons || [])
              .filter((video) => /^[A-Za-z0-9_-]{11}$/.test(video.id))
              .map((video) => {
                const videoKey = `${week.week}-${video.id}`;
                return (
                  <div className="roadmap-lesson" key={video.id}>
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
                <span>Explore lessons for this topic.</span>
                <a
                  href={searchLink(week.lesson_search_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Search YouTube <ArrowUpRight size={14} />
                </a>
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="roadmap-note">
        {roadmap.note || "A starting plan. Adjust the pace to fit your life."}
      </p>
      {roadmap.lesson_status === "available" && (
        <p className="roadmap-note">
          Lessons are suggested from YouTube search results. Check the
          instructor, date and fit for your goals. Availability can change.
        </p>
      )}
    </div>
  );
}
