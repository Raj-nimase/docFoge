import { useState } from "react";
import "./MetaPanel.css";

const CURRENT_YEAR = new Date().getFullYear();

export default function MetaPanel({ meta, onChange }) {
  const [authorInput, setAuthorInput] = useState("");

  function update(key, value) {
    onChange({ ...meta, [key]: value });
  }

  function addAuthor() {
    const name = authorInput.trim();
    if (!name) return;
    update("authors", [...(meta.authors || []), name]);
    setAuthorInput("");
  }

  function removeAuthor(i) {
    const authors = [...(meta.authors || [])];
    authors.splice(i, 1);
    update("authors", authors);
  }

  return (
    <div className="meta-panel">
      <h2 className="meta-panel__title">
        <span className="meta-panel__icon">📄</span> Document Details
      </h2>

      <div className="meta-form">
        <label className="meta-form__label">
          Project Title
          <input
            className="meta-form__input"
            value={meta.projectTitle || ""}
            onChange={(e) => update("projectTitle", e.target.value)}
            placeholder="e.g. Smart Irrigation System Using IoT"
          />
        </label>

        <label className="meta-form__label">
          College / Institute Name
          <input
            className="meta-form__input"
            value={meta.collegeName || ""}
            onChange={(e) => update("collegeName", e.target.value)}
            placeholder="e.g. XYZ College of Engineering"
          />
        </label>

        <label className="meta-form__label">
          Department
          <input
            className="meta-form__input"
            value={meta.department || ""}
            onChange={(e) => update("department", e.target.value)}
            placeholder="e.g. Department of Computer Engineering"
          />
        </label>

        <label className="meta-form__label">
          Guide / Supervisor
          <input
            className="meta-form__input"
            value={meta.guide || ""}
            onChange={(e) => update("guide", e.target.value)}
            placeholder="e.g. Prof. A. Sharma"
          />
        </label>

        <label className="meta-form__label">
          Academic Year
          <input
            className="meta-form__input meta-form__input--short"
            type="number"
            value={meta.year || CURRENT_YEAR}
            onChange={(e) => update("year", parseInt(e.target.value))}
            min="2000"
            max="2100"
          />
        </label>

        <div className="meta-form__label">
          Authors
          <div className="author-row">
            <input
              className="meta-form__input"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAuthor()}
              placeholder="Type a name and press Enter or +"
            />
            <button className="author-add-btn" onClick={addAuthor} type="button">+</button>
          </div>
          <div className="author-tags">
            {(meta.authors || []).map((a, i) => (
              <span className="author-tag" key={i}>
                {a}
                <button onClick={() => removeAuthor(i)} className="author-tag__remove">×</button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
