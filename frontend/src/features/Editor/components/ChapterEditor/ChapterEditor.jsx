import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  NodeViewContent,
} from "@tiptap/react";
import {
  Node,
  Extension,
  mergeAttributes,
  nodeInputRule,
  nodePasteRule,
} from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  extractLatex,
  isSingleFormula,
  handleRichPaste,
  transformMathHtml,
  sanitizeLatex,
  convUnicodeMath,
  stripUnknownChars,
  fixMatrixRowBreaks,
} from "@/hooks/useMathPaste/useMathPaste";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import katex from "katex";
import useAcaStore from "@/contexts/projectStore/projectStore";
import EditorToolbar from "@/features/Editor/components/Toolbar/Toolbar";
import SelectionBubbleMenu from "@/features/Editor/components/SelectionBubbleMenu/SelectionBubbleMenu";
import { mergeChaptersToSingleDoc, splitSingleDocToChapters } from "./docUtils";

const MathView = ({ node, updateAttributes, selected }) => {
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
    const fixed = fixMatrixRowBreaks(sanitizeLatex(latex));
    const s2 = convUnicodeMath(fixed);
    const s3 = stripUnknownChars(s2);
    const candidates = [fixed, s2, s3, latex];
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
          <div className="math-edit-actions">
            <button type="button" className="math-edit-btn math-edit-cancel" onClick={handleCancel}>Cancel</button>
            <button type="button" className="math-edit-btn math-edit-save" onClick={handleSave}>Save</button>
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

const MathExtension = Node.create({
  name: "math",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: "" },
      display: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-latex]",
        getAttrs: (element) => ({
          latex: element.getAttribute("data-latex") || "",
          display: element.getAttribute("data-display") === "true",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const extra = { "data-latex": HTMLAttributes.latex };
    if (HTMLAttributes.display) extra["data-display"] = "true";
    return ["span", mergeAttributes(HTMLAttributes, extra), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\$([\s\S]+?)\$$/,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1].trim() }),
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\$([\s\S]+?)\$/g,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1].trim() }),
      }),
      nodePasteRule({
        find: /\\(?:\[|\()([\s\S]+?)\\(?:\]|\))/g,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1].trim() }),
      }),
    ];
  },
});

const MathPasteHandler = Extension.create({
  name: "mathPasteHandler",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("mathPasteHandler"),
        props: {
          handlePaste(view, event) {
            const result = handleRichPaste(view, event, editor);
            return result;
          },
        },
      }),
    ];
  },
});

function stripAllPrefixes(text) {
  let cleaned = text;
  let lastCleaned;
  do {
    lastCleaned = cleaned;
    cleaned = cleaned.replace(/^\s*\d+(?:\.\d+)*(?:\.\s+|\s+)/, "");
    cleaned = cleaned.replace(/^\s*[a-zA-Z][.)]\s+/, "");
    cleaned = cleaned.replace(
      /^\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)]\s+/i,
      "",
    );
  } while (cleaned !== lastCleaned);
  return cleaned;
}

const INLINE_TYPES = new Set(["math", "text"]);
function normalizeContent(content) {
  if (!content || !content.content || !Array.isArray(content.content)) return content;
  const out = [];
  let pendingInlines = [];
  const flushInlines = () => {
    if (!pendingInlines.length) return;
    for (const node of pendingInlines) {
      out.push({ type: "paragraph", content: [node] });
    }
    pendingInlines = [];
  };
  for (const node of content.content) {
    if (INLINE_TYPES.has(node.type)) {
      pendingInlines.push(node);
    } else {
      flushInlines();
      out.push(node);
    }
  }
  flushInlines();
  return { ...content, content: out };
}

const HeadingCleaner = Extension.create({
  name: "headingCleaner",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingCleaner"),
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const changedRanges = [];
          for (const tr of transactions) {
            if (!tr.docChanged) continue;
            tr.steps.forEach((step, i) => {
              const map = tr.mapping.maps[i];
              map.forEach((oldStart, oldEnd, newStart, newEnd) => {
                changedRanges.push({ from: newStart, to: newEnd });
              });
            });
          }

          if (changedRanges.length === 0) return null;

          changedRanges.sort((a, b) => a.from - b.from);
          const merged = [changedRanges[0]];
          for (let i = 1; i < changedRanges.length; i++) {
            const last = merged[merged.length - 1];
            const cur  = changedRanges[i];
            if (cur.from <= last.to + 1) {
              last.to = Math.max(last.to, cur.to);
            } else {
              merged.push({ ...cur });
            }
          }

          const modifications = [];
          for (const { from, to } of merged) {
            const scanFrom = Math.max(0, from - 2);
            const scanTo   = Math.min(newState.doc.content.size, to + 2);

            newState.doc.nodesBetween(scanFrom, scanTo, (node, pos) => {
              if (node.type.name !== "heading") return true;
              if (!node.firstChild?.isText) return false;

              const child        = node.firstChild;
              const originalText = child.text;
              const cleanedText  = stripAllPrefixes(originalText);

              if (cleanedText !== originalText) {
                modifications.push({
                  from: pos + 1,
                  to:   pos + 1 + originalText.length,
                  text: cleanedText,
                });
              }
              return false;
            });
          }

          if (modifications.length === 0) return null;

          let tr = newState.tr;
          for (let i = modifications.length - 1; i >= 0; i--) {
            const mod = modifications[i];
            tr.insertText(mod.text, mod.from, mod.to);
          }
          return tr;
        },
      }),
    ];
  },
});

const ImageView = (props) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.title || "";

  return (
    <NodeViewWrapper className={`image-view-wrapper ${selected ? "selected" : ""}`}>
      <div className="image-container">
        <img src={node.attrs.src} alt={caption} />
        <div className="image-caption-input-wrap">
          <input
            className="image-caption-input"
            placeholder="Click to set figure name..."
            value={caption}
            onChange={(e) => updateAttributes({ title: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
};

const TableView = (props) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.caption || "";

  return (
    <NodeViewWrapper className={`table-view-wrapper ${selected ? "selected" : ""}`}>
      <NodeViewContent className="table-content-area" />
      <div className="table-caption-input-wrap">
        <input
          className="table-caption-input"
          placeholder="Set Table Name (Caption)..."
          value={caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </NodeViewWrapper>
  );
};

export default function ChapterEditor() {
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const activeChapterId = useAcaStore((s) => s.activeChapterId);
  const setActiveChapter = useAcaStore((s) => s.setActiveChapter);
  const updateProjectChapters = useAcaStore((s) => s.updateProjectChapters);

  const scrollContainerRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const onUpdateTimer = useRef(null);

  // Initial combined document tree
  const initialContent = useMemo(() => {
    return normalizeContent(
      mergeChaptersToSingleDoc(
        currentProject?.frontMatter || [],
        currentProject?.chapters || []
      )
    );
  }, [currentProject?.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: true,
        blockquote: true,
        history: true,
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Start writing your document…",
        emptyNodeClass: "tiptap-placeholder",
      }),
      Table.configure({ resizable: true }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            caption: { default: null },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(TableView);
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      MathExtension,
      MathPasteHandler,
      HeadingCleaner,
      Image.configure({
        inline: false,
        allowBase64: true,
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            title: { default: null },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(ImageView);
        },
      }),
    ],
    editorProps: {
      transformPastedText: (text) => text.replace(/^[^\S\n]*[-*_]{3,}[^\S\n]*\n?/gm, ""),
      transformPastedHTML: (html) => transformMathHtml(html),
    },
    content: initialContent,
    autofocus: false,
    onUpdate: ({ editor }) => {
      if (onUpdateTimer.current) clearTimeout(onUpdateTimer.current);
      onUpdateTimer.current = setTimeout(() => {
        const fullJson = editor.getJSON();
        const updatedChapters = splitSingleDocToChapters(
          fullJson,
          currentProject?.chapters || []
        );
        updateProjectChapters(updatedChapters);
      }, 500);
    },
  });

  // Flush pending save on unmount or blur
  useEffect(() => {
    if (!editor) return;
    const handleBlur = () => {
      if (onUpdateTimer.current) {
        clearTimeout(onUpdateTimer.current);
        onUpdateTimer.current = null;
        const fullJson = editor.getJSON();
        const updatedChapters = splitSingleDocToChapters(
          fullJson,
          currentProject?.chapters || []
        );
        updateProjectChapters(updatedChapters);
      }
    };
    editor.on("blur", handleBlur);
    return () => {
      editor.off("blur", handleBlur);
      if (onUpdateTimer.current) {
        clearTimeout(onUpdateTimer.current);
        onUpdateTimer.current = null;
      }
    };
  }, [editor, currentProject, updateProjectChapters]);

  // Unique signature of current chapter structure (IDs, titles, count)
  const chaptersSignature = (currentProject?.chapters || [])
    .map((c) => `${c.id}:${c.title}`)
    .join("|");

  const lastChaptersSignatureRef = useRef(chaptersSignature);

  // Sync editor content whenever chapters are deleted, added, renamed, or reordered from sidebar
  useEffect(() => {
    if (!editor) return;
    if (chaptersSignature === lastChaptersSignatureRef.current) return;

    lastChaptersSignatureRef.current = chaptersSignature;

    const currentProj = useAcaStore.getState().getCurrentProject();
    const mergedDoc = normalizeContent(
      mergeChaptersToSingleDoc(
        currentProj?.frontMatter || [],
        currentProj?.chapters || []
      )
    );

    editor.commands.setContent(mergedDoc, false);
  }, [chaptersSignature, editor]);

  const isScrollSpyUpdateRef = useRef(false);

  // Smooth scroll to Chapter H1 ONLY when user clicks a chapter in left sidebar
  useEffect(() => {
    if (!activeChapterId || !editor || !scrollContainerRef.current) return;

    // Skip smooth-scroll if activeChapterId change was triggered by manual scrolling (Scroll-Spy)
    if (isScrollSpyUpdateRef.current) {
      isScrollSpyUpdateRef.current = false;
      return;
    }

    const currentProj = useAcaStore.getState().getCurrentProject();
    const ch = currentProj?.chapters.find((c) => c.id === activeChapterId);
    const fm = currentProj?.frontMatter.find((f) => f.id === activeChapterId);
    const targetTitle = (ch?.title || fm?.label || "").toLowerCase();
    if (!targetTitle) return;

    const headings = Array.from(editor.view.dom.querySelectorAll("h1"));
    const targetHeading = headings.find((h) => {
      const text = (h.textContent || "").toLowerCase();
      return text.includes(targetTitle);
    });

    if (targetHeading) {
      isProgrammaticScrollRef.current = true;
      targetHeading.scrollIntoView({ behavior: "smooth", block: "start" });
      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [activeChapterId, editor]);

  // Scroll-Spy: Update sidebar active chapter smoothly as user scrolls manually
  const handleScroll = () => {
    if (isProgrammaticScrollRef.current || !editor || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const headings = Array.from(editor.view.dom.querySelectorAll("h1"));
    if (headings.length === 0) return;

    const containerTop = container.getBoundingClientRect().top;
    const currentProj = useAcaStore.getState().getCurrentProject();
    let currentActiveId = null;

    for (const h of headings) {
      const rect = h.getBoundingClientRect();
      if (rect.top - containerTop <= 150) {
        const text = h.textContent || "";
        const matchedCh = currentProj?.chapters.find((c) =>
          text.toLowerCase().includes((c.title || "").toLowerCase())
        );
        if (matchedCh) {
          currentActiveId = matchedCh.id;
        }
      }
    }

    if (currentActiveId && currentActiveId !== useAcaStore.getState().activeChapterId) {
      isScrollSpyUpdateRef.current = true;
      setActiveChapter(currentActiveId);
    }
  };

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      editor?.commands.focus("end");
    }
  };

  return (
    <div className="chapter-editor">
      <EditorToolbar editor={editor} />
      <div
        id="tour-editor-content"
        className="chapter-editor-scroll"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onClick={handleBackgroundClick}
        style={{ cursor: "text" }}
      >
        <div
          className="chapter-paper"
          onClick={handleBackgroundClick}
          style={{ cursor: "text" }}
        >
          {editor && <SelectionBubbleMenu editor={editor} />}
          <EditorContent editor={editor} className="tiptap-editor" />
        </div>
      </div>
    </div>
  );
}
