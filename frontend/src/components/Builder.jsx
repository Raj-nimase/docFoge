import { useState, useEffect } from "react";
import { compileDocument, previewLatex, healthCheck } from "../api";
import MetaPanel from "./MetaPanel";
import SectionCard from "./SectionCard";
import "./Builder.css";

const DEFAULT_META = {
  projectTitle: "",
  collegeName: "",
  department: "Department of Computer Engineering",
  authors: [],
  guide: "",
  year: new Date().getFullYear(),
};

const FIXED_SECTIONS = [
  { id: "acknowledgement", sectionType: "acknowledgement", isCustom: false },
  { id: "abstract",        sectionType: "abstract",        isCustom: false },
  { id: "introduction",    sectionType: "introduction",    isCustom: false },
  { id: "conclusion",      sectionType: "conclusion",      isCustom: false },
];

function makeCustomSection() {
  return {
    id: `custom-${Date.now()}`,
    sectionType: "custom",
    isCustom: true,
    title: "",
    rawText: "",
    latexBody: "",
    status: "idle",
    error: null,
  };
}

function initSections() {
  return FIXED_SECTIONS.map((s) => ({
    ...s,
    title: "",
    rawText: "",
    latexBody: "",
    status: "idle",
    error: null,
  }));
}

export default function Builder() {
  const [meta, setMeta]             = useState(DEFAULT_META);
  const [sections, setSections]     = useState(initSections);
  const [serverOk, setServerOk]     = useState(null); // null=checking, true=ok, false=down
  const [compiling, setCompiling]   = useState(false);
  const [compileError, setCompileError] = useState(null);
  const [pdfUrl, setPdfUrl]         = useState(null);
  const [activeTab, setActiveTab]   = useState("build"); // 'build' | 'preview'
  const [latexSource, setLatexSource] = useState("");

  // ── Health check on mount ────────────────────────────────────
  useEffect(() => {
    healthCheck()
      .then(() => setServerOk(true))
      .catch(() => setServerOk(false));
  }, []);

  // ── Section update handler ───────────────────────────────────
  function handleSectionUpdate(id, patch) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function handleAddCustom() {
    setSections((prev) => [...prev, makeCustomSection()]);
  }

  function handleRemoveCustom(id) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Compile ──────────────────────────────────────────────────
  async function handleCompile() {
    const formatted = sections.filter((s) => s.latexBody);
    if (formatted.length === 0) {
      setCompileError("Format at least one section with AI before compiling.");
      return;
    }

    setCompiling(true);
    setCompileError(null);
    setPdfUrl(null);

    try {
      const blob = await compileDocument(
        meta,
        formatted.map((s) => ({ latexBody: s.latexBody }))
      );
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setActiveTab("build"); // stay on build, pdf appears in panel
    } catch (err) {
      setCompileError(err.message);
    } finally {
      setCompiling(false);
    }
  }

  // ── Preview LaTeX ────────────────────────────────────────────
  async function handlePreview() {
    const formatted = sections.filter((s) => s.latexBody);
    if (formatted.length === 0) {
      setCompileError("Format at least one section first.");
      return;
    }
    try {
      const data = await previewLatex(
        meta,
        formatted.map((s) => ({ latexBody: s.latexBody }))
      );
      setLatexSource(data.latexSource);
      setActiveTab("preview");
    } catch (err) {
      setCompileError(err.message);
    }
  }

  const formattedCount = sections.filter((s) => s.status === "done").length;

  return (
    <div className="builder">
      {/* ── Navbar ── */}
      <header className="navbar">
        <div className="navbar__brand">
          <span className="navbar__logo">⚡</span>
          <span className="navbar__title">DocForge <span className="navbar__ai">AI</span></span>
        </div>
        <div className="navbar__status">
          {serverOk === null && <span className="status-dot status-dot--pending" />}
          {serverOk === true  && <><span className="status-dot status-dot--ok" /><span className="status-label">Backend connected</span></>}
          {serverOk === false && <><span className="status-dot status-dot--err" /><span className="status-label status-label--err">Backend offline — start npm run dev</span></>}
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="builder__layout">
        {/* ── Left: Meta ── */}
        <aside className="builder__sidebar">
          <MetaPanel meta={meta} onChange={setMeta} />

          {/* Stats */}
          <div className="stat-bar">
            <div className="stat-item">
              <span className="stat-value">{sections.length}</span>
              <span className="stat-label">Sections</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: "var(--success)" }}>{formattedCount}</span>
              <span className="stat-label">Formatted</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: pdfUrl ? "var(--success)" : "var(--text-muted)" }}>
                {pdfUrl ? "Ready" : "—"}
              </span>
              <span className="stat-label">PDF</span>
            </div>
          </div>

          {/* Compile actions */}
          <div className="compile-panel">
            <button
              className="btn btn--primary btn--full"
              onClick={handleCompile}
              disabled={compiling || formattedCount === 0}
            >
              {compiling
                ? <><span className="spinner" /> Compiling PDF…</>
                : "🖨 Compile to PDF"}
            </button>

            <button
              className="btn btn--ghost btn--full"
              onClick={handlePreview}
              disabled={formattedCount === 0}
            >
              👁 Preview LaTeX Source
            </button>

            {pdfUrl && (
              <a
                className="btn btn--success btn--full"
                href={pdfUrl}
                download="document.pdf"
                target="_blank"
                rel="noreferrer"
              >
                ⬇ Download PDF
              </a>
            )}

            {compileError && (
              <div className="compile-error">⚠ {compileError}</div>
            )}
          </div>
        </aside>

        {/* ── Right: Sections + PDF ── */}
        <main className="builder__main">
          {/* Tab switcher */}
          <div className="tab-bar">
            <button
              className={`tab ${activeTab === "build" ? "tab--active" : ""}`}
              onClick={() => setActiveTab("build")}
            >
              ✏️ Build Sections
            </button>
            <button
              className={`tab ${activeTab === "preview" ? "tab--active" : ""}`}
              onClick={() => setActiveTab("preview")}
              disabled={!latexSource}
            >
              📄 LaTeX Source
            </button>
          </div>

          {activeTab === "build" && (
            <div className="sections-area">
              {sections.map((s) => (
                <SectionCard
                  key={s.id}
                  {...s}
                  onUpdate={handleSectionUpdate}
                  onRemove={s.isCustom ? handleRemoveCustom : null}
                />
              ))}

              {/* Add custom section */}
              <button className="add-section-btn" onClick={handleAddCustom}>
                <span className="add-section-btn__icon">＋</span>
                Add Custom Section
              </button>

              {/* PDF embed */}
              {pdfUrl && (
                <div className="pdf-panel">
                  <div className="pdf-panel__header">
                    <span>📄 PDF Preview</span>
                    <a href={pdfUrl} download="document.pdf" className="btn btn--ghost btn--xs">⬇ Download</a>
                  </div>
                  <iframe
                    className="pdf-panel__iframe"
                    src={pdfUrl}
                    title="Generated PDF"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "preview" && latexSource && (
            <div className="latex-source-panel">
              <div className="latex-source-panel__header">
                <span>Full LaTeX Source</span>
                <button
                  className="btn btn--ghost btn--xs"
                  onClick={() => navigator.clipboard.writeText(latexSource)}
                >
                  Copy All
                </button>
              </div>
              <pre className="latex-source-panel__code">{latexSource}</pre>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
