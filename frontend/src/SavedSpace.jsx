import React, { useEffect, useState } from "react";
import { ArrowRight, Bookmark, LoaderCircle, Trash2 } from "lucide-react";
import { loadUserData, supabase } from "./account";

export default function SavedSpace({
  user,
  refresh,
  onProfile,
  onCareer,
  onRoadmap,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all(
      ["profiles", "saved_careers", "saved_roadmaps"].map((table) =>
        loadUserData(table, user.id),
      ),
    )
      .then(([profiles, careers, roadmaps]) => {
        if (active) setData({ profile: profiles[0], careers, roadmaps });
      })
      .catch((err) => {
        if (active) {
          setData(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.id, refresh, version]);

  async function remove(table, careerId) {
    setError("");
    setRemoving(`${table}:${careerId || "profile"}`);
    try {
      let query = supabase.from(table).delete().eq("user_id", user.id);
      if (careerId) query = query.eq("career_id", careerId);
      const { error } = await query;
      if (error) throw error;
      setVersion((v) => v + 1);
    } catch {
      setError("This item could not be removed. Please try again.");
    } finally {
      setRemoving("");
    }
  }
  return (
    <section className="saved-space" id="saved">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
          <h2>
            <Bookmark size={24} /> Your saved space.
          </h2>
        </div>
        <button
          className="quiet-button"
          onClick={() => setVersion((v) => v + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p role="status">
          <LoaderCircle size={18} className="spin" /> Loading your saved work…
        </p>
      ) : (
        data && (
          <div className="saved-grid">
            <article>
              <h3>Your profile</h3>
              {data.profile ? (
                <>
                  <p>
                    Last saved{" "}
                    {new Date(data.profile.updated_at).toLocaleDateString()}.
                    Loading replaces your current editable profile.
                  </p>
                  <button
                    className="outline-button"
                    onClick={() => onProfile(data.profile.data)}
                  >
                    Load saved profile
                    <ArrowRight size={15} />
                  </button>
                  <button
                    className="quiet-button"
                    disabled={!!removing}
                    onClick={() => remove("profiles")}
                  >
                    Delete saved profile
                  </button>
                </>
              ) : (
                <p>Save your profile after reviewing your details.</p>
              )}
            </article>
            <article>
              <h3>Saved careers</h3>
              {data.careers.length ? (
                data.careers.map((row) => (
                  <div className="saved-item" key={row.career_id}>
                    <button
                      className="nav-text"
                      onClick={() => onCareer(row.data)}
                    >
                      {row.data.title}
                      <ArrowRight size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove saved career ${row.data.title}`}
                      disabled={!!removing}
                      onClick={() => remove("saved_careers", row.career_id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <p>Bookmark careers that spark your curiosity.</p>
              )}
            </article>
            <article>
              <h3>Your roadmaps</h3>
              {data.roadmaps.length ? (
                data.roadmaps.map((row) => (
                  <div className="saved-item" key={row.career_id}>
                    <button
                      className="nav-text"
                      onClick={() => onRoadmap(row.data)}
                    >
                      {row.data.career.title}
                      <ArrowRight size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove roadmap ${row.data.career.title}`}
                      disabled={!!removing}
                      onClick={() => remove("saved_roadmaps", row.career_id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <p>Save a learning roadmap to return to it later.</p>
              )}
            </article>
          </div>
        )
      )}
    </section>
  );
}
