import { useState, useEffect, useCallback, useRef } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import katex from "katex";
import {
  fixMatrixRowBreaks,
  convUnicodeMath,
  sanitizeLatex,
  stripUnknownChars,
} from "@/hooks/useMathPaste/useMathPaste";

export const cleanLatexForKatex = (latex) => {
  if (!latex) return { fixed: "", s2: "", s3: "", candidates: [""] };
  const fixed = fixMatrixRowBreaks(sanitizeLatex(latex));
  const s2 = convUnicodeMath(fixed);
  const s3 = stripUnknownChars(s2);
  const candidates = [fixed, s2, s3, latex];
  return { fixed, s2, s3, candidates };
};

const MathView = (props) => {
  const { node, updateAttributes, selected, deleteNode, editor, getPos } = props;
  const containerRef = useRef(null);
  const previewRef = useRef(null);
  const inputRef = useRef(null);
  const rawLatex = node.attrs.latex || "";
  const display = node.attrs.display;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawLatex);

  const renderKatex = useCallback((el, latex, displayMode) => {
    if (!el) return;
    if (!latex.trim()) {
      try { katex.render("\\text{formula}", el, { throwOnError: false, displayMode }); }
      catch (e) { el.textContent = ""; }
      return;
    }
    const { fixed, s2, candidates } = cleanLatexForKatex(latex);
    let prev = null;
    for (const cand of candidates) {
      if (!cand || cand === prev) continue;
      prev = cand;
      try {
        katex.render(cand, el, { throwOnError: true, displayMode });
        return;
      } catch (e) {
        console.warn("KaTeX candidate failed:", cand, e);
      }
    }
    try {
      katex.render(fixed || s2 || latex, el, { throwOnError: false, displayMode });
    } catch (e2) {
      el.textContent = latex;
    }
  }, []);

  useEffect(() => {
    if (!editing) renderKatex(containerRef.current, rawLatex, display);
  }, [rawLatex, display, editing, renderKatex]);

  useEffect(() => {
    if (editing) renderKatex(previewRef.current, draft, display);
  }, [draft, display, editing, renderKatex]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleClick = () => {
    if (!editing) {
      setDraft(rawLatex);
      setEditing(true);
    }
  };

  const handleSave = () => {
    updateAttributes({ latex: draft });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(rawLatex);
    setEditing(false);
  };

  const handleConvertToText = () => {
    const textToInsert = draft || rawLatex || "";
    setEditing(false);
    if (typeof deleteNode === "function") {
      deleteNode();
      if (editor) {
        editor.chain().focus().insertContent(textToInsert).run();
      }
    } else if (typeof getPos === "function" && editor) {
      const pos = getPos();
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + (node.nodeSize || 1) })
        .insertContentAt(pos, textToInsert)
        .run();
    }
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <NodeViewWrapper
      className={`math-view-wrapper ${node.attrs.display ? "math-display" : "math-inline"} ${selected ? "selected" : ""} ${editing ? "math-editing" : ""}`}
      style={{ display: node.attrs.display ? "block" : "inline-block" }}
    >
      {editing ? (
        <div className="math-edit-panel" onClick={(e) => e.stopPropagation()}>
          <div className="math-edit-preview">
            <span ref={previewRef} />
          </div>
          <textarea
            ref={inputRef}
            className="math-edit-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={Math.min(draft.split("\n").length + 1, 6)}
            spellCheck={false}
          />
          <div className="math-edit-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="math-edit-btn"
                style={{ fontSize: '12px', padding: '2px 8px', background: 'var(--color-bg-subtle, #f3f4f6)' }}
                onClick={() => updateAttributes({ display: !display })}
                title="Toggle inline or block display mode"
              >
                Mode: {display ? "Display" : "Inline"}
              </button>
              <button
                type="button"
                className="math-edit-btn"
                style={{ fontSize: '12px', padding: '2px 8px', background: 'var(--color-bg-subtle, #f3f4f6)', color: 'var(--color-text, #374151)' }}
                onClick={handleConvertToText}
                title="Convert this math equation back into plain text"
              >
                Convert to Text
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="math-edit-btn math-edit-cancel" onClick={handleCancel}>Cancel</button>
              <button type="button" className="math-edit-btn math-edit-save" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="math-container" onClick={handleClick} title="Click to edit formula">
          <span ref={containerRef} className="math-render-area" />
        </div>
      )}
    </NodeViewWrapper>
  );
};

export default MathView;
export { MathView };
