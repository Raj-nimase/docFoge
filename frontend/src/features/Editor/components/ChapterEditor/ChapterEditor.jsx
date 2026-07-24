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
import { mergeChaptersToSingleDoc, splitSingleDocToChapters, splitSingleDocToProject } from "./docUtils";

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

function findChapterForHeading(headingText, chapters = [], frontMatter = []) {
  if (!headingText) return null;
  const normText = headingText.trim().toLowerCase();

  // 1. Match chapter number from "CHAPTER 3:" or "CHAPTER 3"
  const chNumMatch = normText.match(/^chapter\s+(\d+)/i);
  if (chNumMatch) {
    const chIdx = parseInt(chNumMatch[1], 10) - 1;
    if (chIdx >= 0 && chIdx < chapters.length) {
      return chapters[chIdx].id;
    }
  }

  // 2. Exact match of clean title
  const cleanHead = stripAllPrefixes(normText.replace(/^chapter\s+\d+[:\s\-]*/i, "")).trim().toLowerCase();

  for (const ch of chapters) {
    const chClean = stripAllPrefixes(ch.title || "").trim().toLowerCase();
    if (chClean && (cleanHead === chClean || normText === chClean)) {
      return ch.id;
    }
  }

  for (const fm of frontMatter) {
    const fmLabel = (fm.label || fm.title || "").trim().toLowerCase();
    if (fmLabel && (cleanHead === fmLabel || normText === fmLabel)) {
      return fm.id;
    }
  }

  // 3. Substring match prioritized by longest matching title
  let bestMatchId = null;
  let maxMatchLength = 0;
  for (const ch of chapters) {
    const chClean = stripAllPrefixes(ch.title || "").trim().toLowerCase();
    if (chClean && normText.includes(chClean)) {
      if (chClean.length > maxMatchLength) {
        maxMatchLength = chClean.length;
        bestMatchId = ch.id;
      }
    }
  }

  return bestMatchId;
}

function FrontMatterSectionEditor({ section }) {
  const updateSectionContent = useAcaStore((s) => s.updateSectionContent);
  const onUpdateTimer = useRef(null);

  const initialContent = useMemo(() => {
    if (section.content && section.content.content && Array.isArray(section.content.content)) {
      return normalizeContent(section.content);
    }
    return {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: section.label || "Section" }],
        },
        {
          type: "paragraph",
          content: [],
        },
      ],
    };
  }, [section.id]);

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
        placeholder: `Write your ${section.label} content here…`,
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
    content: initialContent,
    autofocus: false,
    onUpdate: ({ editor }) => {
      if (onUpdateTimer.current) clearTimeout(onUpdateTimer.current);
      onUpdateTimer.current = setTimeout(() => {
        updateSectionContent(section.id, editor.getJSON());
      }, 500);
    },
  }, [section.id]);

  useEffect(() => {
    if (!editor) return;
    const handleBlur = () => {
      if (onUpdateTimer.current) {
        clearTimeout(onUpdateTimer.current);
        onUpdateTimer.current = null;
        updateSectionContent(section.id, editor.getJSON());
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
  }, [editor, section.id, updateSectionContent]);

  return (
    <div className="chapter-editor">
      <EditorToolbar editor={editor} />
      <div className="chapter-editor-scroll">
        <div className="chapter-paper">
          {editor && <SelectionBubbleMenu editor={editor} />}
          <EditorContent editor={editor} className="tiptap-editor" />
        </div>
      </div>
    </div>
  );
}

function FrontMatterAutoCard({ section }) {
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const metadata = currentProject?.metadata || {};

  return (
    <div className="chapter-editor">
      <div className="chapter-editor-scroll" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
        <div style={{
          maxWidth: '600px',
          width: '100%',
          backgroundColor: 'var(--color-bg-card, #ffffff)',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {section.id === 'toc' ? '📋' : '🎓'}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: 'var(--color-text, #111827)' }}>
            {section.label} (Auto-Generated Page)
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted, #6b7280)', lineHeight: '1.6', marginBottom: '24px' }}>
            {section.id === 'toc'
              ? 'The Table of Contents, List of Figures, and List of Tables are automatically compiled into the PDF based on your document chapters and settings.'
              : 'The Title Page is automatically generated during PDF compilation using your document settings.'}
          </p>
          {section.id === 'title_page' && (
            <div style={{ textAlign: 'left', backgroundColor: 'var(--color-bg-subtle, #f9fafb)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border, #e5e7eb)' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--color-text, #374151)' }}>Title Page Summary:</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted, #4b5563)', display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px' }}>
                <strong>Title:</strong> <span>{metadata.title || 'Untitled Document'}</span>
                <strong>Author(s):</strong> <span>{metadata.authors || 'Not specified'}</span>
                <strong>Guide:</strong> <span>{metadata.guide || 'Not specified'}</span>
                <strong>Department:</strong> <span>{metadata.department || 'Not specified'}</span>
                <strong>Institution:</strong> <span>{metadata.institution || 'Not specified'}</span>
                <strong>Year:</strong> <span>{metadata.year || new Date().getFullYear()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MultiChapterEditor() {
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const activeChapterId = useAcaStore((s) => s.activeChapterId);
  const setActiveChapter = useAcaStore((s) => s.setActiveChapter);
  const updateProjectDocument = useAcaStore((s) => s.updateProjectDocument);

  const scrollContainerRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const onUpdateTimer = useRef(null);

  // Initial combined document tree for chapters & frontmatter (except Certificate)
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
        const res = splitSingleDocToProject(
          fullJson,
          currentProject?.frontMatter || [],
          currentProject?.chapters || []
        );
        updateProjectDocument(res.frontMatter, res.chapters);
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
        const res = splitSingleDocToProject(
          fullJson,
          currentProject?.frontMatter || [],
          currentProject?.chapters || []
        );
        updateProjectDocument(res.frontMatter, res.chapters);
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
  }, [editor, currentProject, updateProjectDocument]);

  // Unique signature of current sections structure (frontMatter & chapters)
  const sectionsSignature = [
    ...(currentProject?.frontMatter || []).map((fm) => `${fm.id}:${fm.label}`),
    ...(currentProject?.chapters || []).map((c) => `${c.id}:${c.title}`),
  ].join("|");

  const lastSectionsSignatureRef = useRef(sectionsSignature);

  // Sync editor content whenever sections are deleted, added, renamed, or reordered from sidebar
  useEffect(() => {
    if (!editor) return;
    if (sectionsSignature === lastSectionsSignatureRef.current) return;

    lastSectionsSignatureRef.current = sectionsSignature;

    const currentProj = useAcaStore.getState().getCurrentProject();
    const mergedDoc = normalizeContent(
      mergeChaptersToSingleDoc(
        currentProj?.frontMatter || [],
        currentProj?.chapters || []
      )
    );

    editor.commands.setContent(mergedDoc, false);
  }, [sectionsSignature, editor]);

  const isScrollSpyUpdateRef = useRef(false);

  // Smooth scroll to Chapter/Section H1 ONLY when user clicks an item in left sidebar
  useEffect(() => {
    if (!activeChapterId || !editor || !scrollContainerRef.current) return;

    if (isScrollSpyUpdateRef.current) {
      isScrollSpyUpdateRef.current = false;
      return;
    }

    const currentProj = useAcaStore.getState().getCurrentProject();
    const headings = Array.from(editor.view.dom.querySelectorAll("h1"));

    const targetHeading = headings.find((h) => {
      const matchedId = findChapterForHeading(
        h.textContent || "",
        currentProj?.chapters || [],
        currentProj?.frontMatter || []
      );
      return matchedId === activeChapterId;
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
        const matchedId = findChapterForHeading(
          h.textContent || "",
          currentProj?.chapters || [],
          currentProj?.frontMatter || []
        );
        if (matchedId) {
          currentActiveId = matchedId;
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

export default function ChapterEditor() {
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const activeChapterId = useAcaStore((s) => s.activeChapterId);

  const activeFm = useMemo(() => {
    return currentProject?.frontMatter?.find((fm) => fm.id === activeChapterId) || null;
  }, [currentProject?.frontMatter, activeChapterId]);

  if (activeFm) {
    if (activeFm.auto) {
      return <FrontMatterAutoCard section={activeFm} key={activeFm.id} />;
    }
    if (activeFm.id === "certificate" || activeFm.label?.toLowerCase() === "certificate") {
      return <FrontMatterSectionEditor section={activeFm} key={activeFm.id} />;
    }
  }

  return <MultiChapterEditor key={currentProject?.id || 'multi'} />;
}
