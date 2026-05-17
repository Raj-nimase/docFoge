import { useState } from "react";
import { formatSection } from "../api";
import "./SectionCard.css";

const SECTION_LABELS = {
  acknowledgement: "Acknowledgement",
  abstract:        "Abstract",
  introduction:    "Introduction",
  conclusion:      "Conclusion",
  custom:          "Custom Section",
};

const SECTION_ICONS = {
  acknowledgement: "🙏",
  abstract:        "📋",
  introduction:    "🔍",
  conclusion:      "✅",
  custom:          "📝",
};

const PLACEHOLDERS = {
  acknowledgement: "e.g. We thank our guide Prof. Sharma and our institution for their continuous support and guidance throughout this project...",
  abstract:        "e.g. This project presents a smart irrigation system using IoT sensors and NodeMCU to automate water supply based on real-time soil moisture data...",
  introduction:    "e.g. The rapid growth of IoT technology has opened new possibilities in agricultural automation. This project addresses water scarcity by...",
  conclusion:      "e.g. We successfully implemented and tested the smart irrigation prototype. The system achieved 40% reduction in water usage. Future work includes...",
  custom:          "Paste or type your raw content here...",
};

export default function SectionCard({
  id,
  sectionType,
  title,
  rawText,
  latexBody,
  status,          // 'idle' | 'loading' | 'done' | 'error'
  error,
  onUpdate,
  onRemove,
  isCustom,
}) {
  const [expanded, setExpanded] = useState(true);
  const [showLatex, setShowLatex] = useState(false);

  async function handleFormat() {
    if (!rawText.trim()) return;
    onUpdate(id, { status: "loading", error: null });
    try {
      const data = await formatSection(sectionType, rawText, title);
      onUpdate(id, { latexBody: data.latexBody, status: "done" });
    } catch (err) {
      onUpdate(id, { status: "error", error: err.message });
    }
  }

  const label = isCustom ? (title || "Custom Section") : SECTION_LABELS[sectionType];
  const icon  = SECTION_ICONS[sectionType] || "📝";

  return (
    <div className={`section-card ${status === "done" ? "section-card--done" : ""}`}>
      {/* ── Header ── */}
      <div className="section-card__header" onClick={() => setExpanded((v) => !v)}>
        <div className="section-card__meta">
          <span className="section-card__icon">{icon}</span>
          <span className="section-card__label">{label}</span>
          {status === "done" && <span className="badge badge--success">✓ Formatted</span>}
          {status === "loading" && <span className="badge badge--loading">⏳ Formatting…</span>}
          {status === "error" && <span className="badge badge--error">✗ Error</span>}
        </div>
        <div className="section-card__actions" onClick={(e) => e.stopPropagation()}>
          {onRemove && (
            <button className="icon-btn icon-btn--danger" onClick={() => onRemove(id)} title="Remove section">✕</button>
          )}
          <button className="icon-btn" onClick={() => setExpanded((v) => !v)} title={expanded ? "Collapse" : "Expand"}>
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {expanded && (
        <div className="section-card__body">
          {/* Custom title input */}
          {isCustom && (
            <input
              className="section-card__title-input"
              value={title || ""}
              onChange={(e) => onUpdate(id, { title: e.target.value })}
              placeholder="Section title (e.g. System Architecture)"
            />
          )}

          {/* Raw text area */}
          <textarea
            className="section-card__textarea"
            value={rawText}
            onChange={(e) => onUpdate(id, { rawText: e.target.value })}
            placeholder={PLACEHOLDERS[sectionType]}
            rows={6}
          />

          {/* Error */}
          {status === "error" && (
            <div className="section-card__error">⚠ {error}</div>
          )}

          {/* Format button */}
          <div className="section-card__footer">
            <button
              className="btn btn--primary"
              onClick={handleFormat}
              disabled={status === "loading" || !rawText.trim()}
            >
              {status === "loading" ? (
                <><span className="spinner" /> Formatting with AI…</>
              ) : (
                <> ✨ Format with AI</>
              )}
            </button>

            {/* Toggle LaTeX preview */}
            {latexBody && (
              <button
                className="btn btn--ghost"
                onClick={() => setShowLatex((v) => !v)}
              >
                {showLatex ? "Hide LaTeX" : "View LaTeX"}
              </button>
            )}
          </div>

          {/* LaTeX output */}
          {showLatex && latexBody && (
            <div className="section-card__latex">
              <div className="section-card__latex-header">
                <span>Generated LaTeX</span>
                <button
                  className="btn btn--ghost btn--xs"
                  onClick={() => navigator.clipboard.writeText(latexBody)}
                >
                  Copy
                </button>
              </div>
              <pre className="section-card__latex-code">{latexBody}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
