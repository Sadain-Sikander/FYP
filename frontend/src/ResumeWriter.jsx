import React, { useState } from "react";
import { Copy, Download } from "lucide-react";
import WritingAssistant, {
  downloadText,
  downloadWord,
} from "./WritingAssistant";

export default function ResumeWriter({
  form,
  selected,
  state = {},
  onChange,
  sourceReady,
}) {
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const text = state.text || "";
  function starter() {
    onChange({
      text: `[Your name]\n[Email] · [Phone] · [Portfolio or LinkedIn]\n\nSUMMARY\n[Write a short introduction based on your experience.]\n\nEXPERIENCE & PROJECTS\n${form.experience || "[Add your experience or projects.]"}\n\nEDUCATION\n${form.education || "[Add your education.]"}\n\nSKILLS\n${form.skills || "[List skills you can demonstrate.]"}`,
      appliedContext: "",
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Resume copied.");
    } catch {
      setMessage("Select the resume text to copy it manually.");
    }
  }
  async function word() {
    setExporting(true);
    try {
      await downloadWord(text, "resume");
      setMessage("Word document downloaded.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <section
      className="resume-writer action-workbench"
      aria-label="Resume builder"
      id="resume-builder"
    >
      <h2>Build a resume from your story.</h2>
      <p>
        Start from the profile you’ve reviewed. Add contact details and verify
        the final wording before applying.
      </p>
      <WritingAssistant
        kind="resume"
        form={form}
        selected={selected}
        state={state}
        onChange={onChange}
        sourceReady={sourceReady}
        onApply={(text) => onChange({ text })}
      />
      {!text && (
        <button type="button" className="story-small-button" onClick={starter}>
          Create a starter resume
        </button>
      )}
      <label className="writing-editor-label">
        Your editable resume
        <textarea
          aria-label="Resume draft"
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          maxLength={20000}
          rows={18}
          placeholder="Write here, create a starter, or review an AI suggestion above."
        />
      </label>
      <div className="workbench-actions">
        <button
          type="button"
          className="story-small-button"
          disabled={!text.trim()}
          onClick={copy}
        >
          <Copy size={16} />
          Copy resume
        </button>
        <button
          type="button"
          className="story-small-button"
          disabled={!text.trim()}
          onClick={() => downloadText(text, "careerbridge-resume.txt")}
        >
          <Download size={16} />
          Download text
        </button>
        <button
          type="button"
          className="loom-cta"
          disabled={!text.trim() || exporting}
          onClick={word}
        >
          <Download size={16} />
          {exporting ? "Exporting…" : "Download Word"}
        </button>
      </div>
      <p role="status">{message}</p>
      <p className="writing-note">
        This draft stays in this browser tab. It does not change your uploaded
        file or its ATS review.
      </p>
    </section>
  );
}
