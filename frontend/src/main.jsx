import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, BriefcaseBusiness, BrainCircuit, CheckCircle2, ChevronDown, Compass, GraduationCap, LoaderCircle, Route, Sparkles, Target, Upload, Wrench } from "lucide-react";
import "./styles.css";

const API = "http://127.0.0.1:8000";

function splitSkills(value) {
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

function App() {
  const [form, setForm] = useState({
    education: "",
    experience: "",
    skills: "",
    interests: "",
    strengths: "",
    work_preferences: "",
    career_goals: "",
    preferred_industries: "",
  });
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [gap, setGap] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);

  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));

  async function checkApi() {
    try {
      const res = await fetch(`${API}/api/data-status`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setError("Backend not found. Start the Python FastAPI server first.");
    }
  }

  async function recommend(event) {
    event.preventDefault();
    setLoading("recommend");
    setError("");
    setResults([]);
    setSelected(null);
    setGap(null);
    setRoadmap(null);
    try {
      const payload = { ...form, skills: splitSkills(form.skills), top_k: 10 };
      const res = await fetch(`${API}/api/careers/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not recommend careers.");
      setResults(data.results || []);
      if (!data.results?.length) setError("No career matches returned. Add more profile information and retry.");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading("");
    }
  }

  async function analyzeGap(career) {
    setLoading(`gap-${career.id}`);
    setError("");
    setSelected(career);
    setGap(null);
    setRoadmap(null);
    try {
      const res = await fetch(`${API}/api/skill-gap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career_id: career.id, user_skills: splitSkills(form.skills) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not analyze skill gaps.");
      setGap(data);
    } catch (err) {
      setError(err.message || "Skill-gap analysis failed.");
    } finally {
      setLoading("");
    }
  }

  async function makeRoadmap() {
    if (!selected) return;
    setLoading("roadmap");
    setError("");
    try {
      const res = await fetch(`${API}/api/roadmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career_id: selected.id, user_skills: splitSkills(form.skills), weeks: 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not generate roadmap.");
      setRoadmap(data);
    } catch (err) {
      setError(err.message || "Roadmap generation failed.");
    } finally {
      setLoading("");
    }
  }

  const input = (key, label, placeholder, multiline = false) => (
    <label className={`field ${multiline ? "wide" : ""}`} key={key}>
      <span>{label}</span>
      {multiline
        ? <textarea value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} rows="3" />
        : <input value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} />}
    </label>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><BrainCircuit size={22}/></span><span>CareerBridge<span className="brand-ai"> AI</span></span></a>
        <div className="top-actions">
          <span className="prototype-label"><span className="pulse-dot"></span> FYP prototype</span>
          <button className="quiet-button" onClick={checkApi}>Check data</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={15}/> CAREER DISCOVERY, MADE PERSONAL</div>
            <h1>Your next career move<br/><span>starts with you.</span></h1>
            <p>Discover roles that connect your experience, skills and interests. Then turn your skill gaps into a practical learning plan.</p>
            <div className="hero-points">
              <span><CheckCircle2 size={16}/> Career recommendations</span>
              <span><CheckCircle2 size={16}/> Skill-gap analysis</span>
              <span><CheckCircle2 size={16}/> Learning roadmap</span>
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit orbit-one"></div><div className="orbit orbit-two"></div>
            <div className="art-card card-top"><Compass size={18}/><span>Explore possibilities</span></div>
            <div className="art-center"><BrainCircuit size={46}/><span>YOUR<br/>POTENTIAL</span></div>
            <div className="art-card card-bottom"><Route size={18}/><span>Build your roadmap</span></div>
            <div className="spark spark-a">✦</div><div className="spark spark-b">✧</div>
          </div>
        </section>

        {status && <div className="status-strip"><CheckCircle2 size={17}/> Connected to API · {status.career_records.toLocaleString()} careers · {status.embedding_dimensions}D embeddings · Model {status.model_loaded ? "loaded" : "loads on first recommendation"}</div>}
        {error && <div className="error-banner">{error}</div>}

        <section className="workspace">
          <div className="section-heading">
            <div><div className="eyebrow dark"><span className="step-number">01</span> YOUR PROFILE</div><h2>Tell us about yourself</h2><p>Fill in what you know. Leave any field blank if it doesn't apply.</p></div>
            <span className="optional-tag">No perfect resume required</span>
          </div>

          <form className="profile-form" onSubmit={recommend}>
            <div className="form-grid">
              {input("education", "Education & courses", "e.g. BS Computer Science, online courses")}
              {input("experience", "Work, projects & volunteering", "What have you done? Include projects or everyday experience.", true)}
              {input("skills", "Skills (comma-separated)", "e.g. Python, Excel, communication", true)}
              {input("interests", "Interests", "e.g. solving problems, design, helping people")}
              {input("strengths", "Strengths & transferable abilities", "e.g. organizing, explaining ideas, analytical thinking")}
              {input("work_preferences", "Preferred work environment", "e.g. remote, collaborative, independent")}
              {input("career_goals", "Career goals", "e.g. entry-level data role, career change")}
              {input("preferred_industries", "Industries of interest", "e.g. technology, education, healthcare")}
            </div>
            <div className="form-footer">
              <p><span className="privacy-dot"></span> Use information you are comfortable sharing. This local prototype does not have user accounts.</p>
              <button className="primary-button" type="submit" disabled={loading === "recommend"}>{loading === "recommend" ? <><LoaderCircle className="spin" size={18}/> Finding matches...</> : <>Discover careers <ArrowRight size={18}/></>}</button>
            </div>
          </form>
        </section>

        {results.length > 0 && <section className="results-section">
          <div className="section-heading">
            <div><div className="eyebrow dark"><span className="step-number">02</span> YOUR CAREER MATCHES</div><h2>Paths worth exploring</h2><p>Ranked by semantic similarity between your profile and occupation descriptions—not a probability of job success.</p></div>
            <span className="count-tag">{results.length} suggestions</span>
          </div>
          <div className="career-grid">
            {results.map((career, index) => (
              <article className={`career-card ${selected?.id === career.id ? "selected" : ""}`} key={`${career.source}-${career.id}`}>
                <div className="career-card-top"><span className="career-rank">0{index + 1}</span><span className="source-tag">{career.source}</span></div>
                <h3>{career.title}</h3>
                <p>{career.description || "No occupation description available."}</p>
                <div className="similarity"><span>Semantic similarity</span><strong>{career.semantic_similarity.toFixed(3)}</strong></div>
                <button className="outline-button" onClick={() => analyzeGap(career)} disabled={loading === `gap-${career.id}`}>{loading === `gap-${career.id}` ? <LoaderCircle className="spin" size={16}/> : <>Explore skill gaps <ArrowRight size={16}/></>}</button>
              </article>
            ))}
          </div>
        </section>}

        {gap && <section className="detail-section">
          <div className="section-heading">
            <div><div className="eyebrow dark"><span className="step-number">03</span> ROLE READINESS</div><h2>{gap.career.title}: your skill picture</h2><p>Compare your entered skills with the occupational data. Confirm similar terms manually.</p></div>
            <span className="count-tag">{gap.coverage_percent === null ? "No skill data" : `${gap.coverage_percent}% listed skills matched`}</span>
          </div>
          <div className="skill-columns">
            <div className="skill-panel">
              <h3><CheckCircle2 size={18}/> Matched skills <span>{gap.matched_skills.length}</span></h3>
              {gap.matched_skills.length ? gap.matched_skills.map(s => <div className="skill-row matched" key={s.name}><CheckCircle2 size={15}/>{s.name}</div>) : <p className="empty-state">No essential skills matched yet. Add skills to your profile and analyze again.</p>}
            </div>
            <div className="skill-panel">
              <h3><Target size={18}/> Potential gaps <span>{gap.skill_gaps.length}</span></h3>
              {gap.skill_gaps.slice(0, 15).map(s => <div className="skill-row gap" key={s.name}><span className="gap-dot"></span><span>{s.name}</span>{s.importance != null && <small>Importance {s.importance}</small>}</div>)}
              {!gap.skill_gaps.length && <p className="empty-state">No gaps found in the selected essential-skill list.</p>}
            </div>
          </div>
          <div className="roadmap-cta"><div><div className="eyebrow dark">NEXT STEP</div><h3>Turn gaps into a learning plan</h3><p>Generate a starter 4-week roadmap based on the selected role and the gaps identified.</p></div><button className="primary-button" onClick={makeRoadmap} disabled={loading === "roadmap"}>{loading === "roadmap" ? <LoaderCircle className="spin" size={18}/> : <>Build my roadmap <ArrowRight size={18}/></>}</button></div>
          {roadmap && <div className="roadmap-panel">
            <div className="roadmap-title"><div><div className="eyebrow dark"><Route size={14}/> PERSONALIZED ROADMAP</div><h3>{roadmap.duration_weeks}-week starter plan for {roadmap.career.title}</h3></div><span className="optional-tag">Rule-based MVP</span></div>
            <div className="milestone-grid">{roadmap.milestones.map(m => <article className="milestone" key={m.week}><span className="milestone-week">WEEK {m.week}</span><h4>{m.title}</h4><ul>{m.tasks.map((t, i) => <li key={i}>{t}</li>)}</ul></article>)}</div>
            <p className="footnote">{roadmap.note}</p>
          </div>}
        </section>}

        <section className="next-phase">
          <div className="next-icon"><Upload size={22}/></div>
          <div><h3>Next development stage: Resume intelligence</h3><p>Resume upload and extraction, editable extracted profile, resume improvement suggestions, and job-description-based ATS estimate will be added after the manual-profile workflow is tested.</p></div>
          <span className="coming-tag">Planned</span>
        </section>

        <footer><span>CareerBridge AI · FYP Prototype</span><span>O*NET + ESCO · Review all AI-assisted suggestions</span></footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
