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
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  extractLatex,
  isSingleFormula,
  handleRichPaste,
  transformMathHtml,
} from "@/hooks/useMathPaste/useMathPaste";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useAcaStore from "@/contexts/projectStore/projectStore";
import SelectionBubbleMenu from "@/features/Editor/components/SelectionBubbleMenu/SelectionBubbleMenu";
import TableBubbleMenu from "@/features/Editor/components/SelectionBubbleMenu/TableBubbleMenu";
import ImageBubbleMenu from "@/features/Editor/components/SelectionBubbleMenu/ImageBubbleMenu";
import SlashCommandMenu from "@/features/Editor/components/SlashCommandMenu/SlashCommandMenu";
import { mergeChaptersToSingleDoc, splitSingleDocToChapters, splitSingleDocToProject } from "./docUtils";
import useScrollSyncStore from "@/features/Editor/scrollSync/scrollSyncStore";
import CertificateCanvasEditor from "./CertificateCanvasEditor";
import { MathView, ImageView, ImageGroupView, TableView, ReferenceNode } from "./nodes";
import RefGhostExtension from "./nodes/RefGhostDecorationPlugin";
import RefSuggestionMenu from "../RefSuggestionMenu/RefSuggestionMenu";

const ImageGroupExtension = Node.create({
  name: "imageGroup",
  group: "block",
  inline: false,
  selectable: true,
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      title: { default: "" },
      columns: { default: 3 },
      placement: { default: "none" },
      images: { default: [] },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type='image-group']",
        getAttrs: (element) => {
          let imgs = [];
          try {
            imgs = JSON.parse(element.getAttribute("data-images") || "[]");
          } catch {
            imgs = [];
          }
          return {
            title: element.getAttribute("data-title") || "",
            columns: parseInt(element.getAttribute("data-columns") || "3", 10),
            placement: element.getAttribute("data-placement") || "auto",
            images: imgs,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        "data-type": "image-group",
        "data-title": HTMLAttributes.title || "",
        "data-columns": HTMLAttributes.columns || 3,
        "data-placement": HTMLAttributes.placement || "auto",
        "data-images": JSON.stringify(HTMLAttributes.images || []),
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGroupView);
  },
});

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
        find: /\$\$([\s\S]+?)\$\$$/,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1].trim(), display: true }),
      }),
      nodeInputRule({
        find: /\$([\s\S]+?)\$$/,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1].trim(), display: false }),
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-m": () => {
        return this.editor.commands.insertContent({
          type: this.name,
          attrs: { latex: "x", display: false },
        });
      },
    };
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

const TrailingNode = Extension.create({
  name: "trailingNode",

  addOptions() {
    return {
      node: "paragraph",
      notAfter: ["paragraph"],
    };
  },

  addProseMirrorPlugins() {
    const plugin = new PluginKey(this.name);

    return [
      new Plugin({
        key: plugin,
        appendTransaction: (_, __, state) => {
          const { doc, tr, schema } = state;
          const lastChild = doc.lastChild;
          if (lastChild && lastChild.type.name !== "paragraph") {
            const pType = schema.nodes[this.options.node];
            if (pType) {
              return tr.insert(doc.content.size, pType.create());
            }
          }
          return null;
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

const INLINE_TYPES = new Set(["math", "text", "hardBreak"]);
function normalizeContent(content) {
  if (!content || !content.content || !Array.isArray(content.content)) return content;
  const out = [];
  let pendingInlines = [];
  const flushInlines = () => {
    if (!pendingInlines.length) return;
    out.push({ type: "paragraph", content: [...pendingInlines] });
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

          // Check for chapter H1 headings vs front matter H1 headings
          let hasEncounteredChapter = false;
          const levelModifications = [];
          const currentProj = useAcaStore.getState().getCurrentProject();
          const hasFmConfigured = (currentProj?.frontMatter || []).some((fm) => !fm.auto);
          const fmLabels = (currentProj?.frontMatter || []).map((fm) => (fm.label || fm.title || "").toLowerCase()).filter(Boolean);

          const fmKeywords = [
            "abstract", "acknowledgement", "acknowledgments", "declaration", "synopsis",
            "table of contents", "contents", "title page", "certificate", "dedication",
            "abbreviations", "notation", "list of figures", "list of tables", "list of symbols",
            "foreword", "preface"
          ];

          newState.doc.forEach((node, pos) => {
            if (node.type.name === "heading") {
              const currentLevel = node.attrs?.level || 1;
              const text = (node.content?.firstChild?.text || "").trim();
              const lowerText = text.toLowerCase();

              if (currentLevel === 1) {
                const startsWithChapter = /^CHAPTER\b/i.test(text);
                const matchesProjectFm = fmLabels.some((lbl) => lowerText === lbl || lowerText.startsWith(`${lbl}:`) || lowerText.startsWith(`${lbl} /`));
                const matchesFmKeyword = fmKeywords.some((fm) => lowerText === fm || lowerText.startsWith(`${fm}:`) || lowerText.startsWith(`${fm} /`));

                let isFm = false;
                if (startsWithChapter) {
                  isFm = false;
                  hasEncounteredChapter = true;
                } else if (matchesProjectFm || matchesFmKeyword || (hasFmConfigured && !hasEncounteredChapter)) {
                  isFm = true;
                } else {
                  isFm = false;
                  hasEncounteredChapter = true;
                }

                if (isFm) {
                  if (!node.attrs?.isFrontMatter || node.attrs?.isChapter) {
                    levelModifications.push({ pos, attrs: { ...node.attrs, isFrontMatter: true, isChapter: false } });
                  }
                } else {
                  if (!node.attrs?.isChapter || node.attrs?.isFrontMatter) {
                    levelModifications.push({ pos, attrs: { ...node.attrs, isChapter: true, isFrontMatter: false } });
                  }
                }
              }
            }
          });

          if (levelModifications.length > 0) {
            let tr = newState.tr;
            for (const mod of levelModifications) {
              tr.setNodeMarkup(mod.pos, null, mod.attrs);
            }
            return tr;
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
              if (node.type.name !== "heading" && node.type.name !== "paragraph") return true;
              if (!node.firstChild?.isText) return false;

              const child        = node.firstChild;
              const originalText = child.text;
              let cleanedText  = stripAllPrefixes(originalText);

              // If non-H1 heading (H2, H3, H4) or paragraph, strip any "CHAPTER X:" prefix
              if ((node.type.name === "heading" && node.attrs?.level > 1) || node.type.name === "paragraph") {
                cleanedText = cleanedText.replace(/^CHAPTER\s+\d+[:\s\-]*/i, "");
              }

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
      TrailingNode,
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
            caption: {
              default: null,
              parseHTML: element => element.getAttribute('data-caption') || element.getAttribute('caption'),
              renderHTML: attributes => attributes.caption ? { 'data-caption': attributes.caption } : {}
            },
            tableStyle: {
              default: "modern",
              parseHTML: element => element.getAttribute('data-style') || 'modern',
              renderHTML: attributes => attributes.tableStyle ? { 'data-style': attributes.tableStyle } : {}
            },
            align: {
              default: "center",
              parseHTML: element => element.getAttribute('data-align') || element.getAttribute('align') || 'center',
              renderHTML: attributes => {
                const a = attributes.align || 'center';
                const margin = a === 'left' ? '1rem auto 1.5rem 0' : a === 'right' ? '1rem 0 1.5rem auto' : '1rem auto 1.5rem auto';
                return {
                  'data-align': a,
                  style: `margin: ${margin};`
                };
              }
            },
            inset: {
              default: "normal",
              parseHTML: element => element.getAttribute('data-inset') || 'normal',
              renderHTML: attributes => attributes.inset ? { 'data-inset': attributes.inset } : {}
            },
            borderColor: { default: null },
            borderWidth: { default: null },
            headerFill: { default: null },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(TableView);
        },
      }),
      TableRow,
      TableHeader.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fill: { default: null },
            align: { default: null },
          };
        },
      }),
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fill: { default: null },
            align: { default: null },
          };
        },
      }),
      MathExtension,
      MathPasteHandler,
      HeadingCleaner,
      ImageGroupExtension,
      ReferenceNode,
      RefGhostExtension,
      Image.configure({
        inline: false,
        allowBase64: true,
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            title: { default: null },
            align: {
              default: "center",
              parseHTML: element => element.getAttribute('data-align') || element.getAttribute('align') || 'center',
              renderHTML: attributes => ({ 'data-align': attributes.align || 'center' })
            },
            width: {
              default: "80%",
              parseHTML: element => element.getAttribute('data-width') || element.style.width || '80%',
              renderHTML: attributes => ({ 'data-width': attributes.width || '80%' })
            },
            fit: {
              default: "contain",
              parseHTML: element => element.getAttribute('data-fit') || 'contain',
              renderHTML: attributes => ({ 'data-fit': attributes.fit || 'contain' })
            },
            placement: {
              default: "none",
              parseHTML: element => element.getAttribute('data-placement') || 'none',
              renderHTML: attributes => ({ 'data-placement': attributes.placement || 'none' })
            },
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
    useAcaStore.getState().setEditorInstance(editor);
    const handleFocus = () => {
      useAcaStore.getState().setEditorInstance(editor);
    };
    const handleBlur = () => {
      if (onUpdateTimer.current) {
        clearTimeout(onUpdateTimer.current);
        onUpdateTimer.current = null;
        updateSectionContent(section.id, editor.getJSON());
      }
    };
    editor.on("focus", handleFocus);
    editor.on("blur", handleBlur);
    return () => {
      editor.off("focus", handleFocus);
      editor.off("blur", handleBlur);
      if (onUpdateTimer.current) {
        clearTimeout(onUpdateTimer.current);
        onUpdateTimer.current = null;
      }
    };
  }, [editor, section.id, updateSectionContent]);

  return (
    <div className="chapter-editor">
      <div className="chapter-editor-scroll">
        <div className="chapter-paper">
          {editor && <SelectionBubbleMenu editor={editor} />}
          {editor && <TableBubbleMenu editor={editor} />}
          {editor && <RefSuggestionMenu editor={editor} />}
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



const DragOutsideSelectionFix = Extension.create({
  name: "dragOutsideSelectionFix",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("dragOutsideSelectionFix"),
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              if (event.button !== 0) return false;

              let anchorPos = null;

              const onMouseMove = (e) => {
                const rect = view.dom.getBoundingClientRect();
                const isOutside =
                  e.clientX < rect.left ||
                  e.clientX > rect.right ||
                  e.clientY < rect.top ||
                  e.clientY > rect.bottom;

                if (!isOutside) return;

                if (anchorPos === null) {
                  anchorPos = view.state.selection.anchor;
                }

                const clampedX = Math.max(
                  rect.left + 8,
                  Math.min(rect.right - 8, e.clientX)
                );
                const clampedY = Math.max(
                  rect.top + 8,
                  Math.min(rect.bottom - 8, e.clientY)
                );

                const coords = view.posAtCoords({
                  left: clampedX,
                  top: clampedY,
                });

                if (coords && coords.pos !== undefined) {
                  const targetPos = coords.pos;
                  if (view.state.selection.head !== targetPos) {
                    const tr = view.state.tr.setSelection(
                      TextSelection.create(
                        view.state.doc,
                        anchorPos,
                        targetPos
                      )
                    );
                    view.dispatch(tr);
                  }
                }

                const container = view.dom.closest(".chapter-editor-scroll");
                if (container) {
                  const cRect = container.getBoundingClientRect();
                  if (e.clientY < cRect.top + 50) {
                    container.scrollTop -= Math.max(8, (cRect.top + 50 - e.clientY) / 2);
                  } else if (e.clientY > cRect.bottom - 50) {
                    container.scrollTop += Math.max(8, (e.clientY - (cRect.bottom - 50)) / 2);
                  }
                }
              };

              const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
              };

              window.addEventListener("mousemove", onMouseMove);
              window.addEventListener("mouseup", onMouseUp);

              return false;
            },
          },
        },
      }),
    ];
  },
});

function computeSectionsSignature(frontMatter = [], chapters = []) {
  const fmSig = (frontMatter || []).map((fm) => `${fm.id}:${fm.label}`);
  const chSig = (chapters || []).map((c) => `${c.id}:${c.title}`);
  return [...fmSig, ...chSig].join("|");
}

function MultiChapterEditor() {
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const activeChapterId = useAcaStore((s) => s.activeChapterId);
  const setActiveChapter = useAcaStore((s) => s.setActiveChapter);
  const updateProjectDocument = useAcaStore((s) => s.updateProjectDocument);

  const scrollContainerRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const onUpdateTimer = useRef(null);
  const lastSectionsSignatureRef = useRef("");
  const workerRef = useRef(null);
  const isPasteEventRef = useRef(false);
  const editorRef = useRef(null);

  // Background Web Worker for parsing document structure off the main UI thread
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL("./docParserWorker.js", import.meta.url), {
        type: "module",
      });
      workerRef.current.onmessage = (e) => {
        const { frontMatter, chapters } = e.data;
        if (!frontMatter || !chapters) return;

        const isPaste = isPasteEventRef.current;
        if (isPaste) {
          isPasteEventRef.current = false;
        }

        // Keep lastSectionsSignatureRef in sync with editor changes so external setContent is not triggered
        const newSig = computeSectionsSignature(frontMatter, chapters);
        lastSectionsSignatureRef.current = newSig;

        // Always keep project store updated with latest frontMatter and chapter text content
        useAcaStore.getState().updateProjectDocument(frontMatter, chapters);

        if (isPaste) {
          const targetEditor = editorRef.current;
          if (targetEditor) {
            const cleanMergedDoc = normalizeContent(
              mergeChaptersToSingleDoc(frontMatter, chapters)
            );
            targetEditor.commands.setContent(cleanMergedDoc, false);
          }
        }
      };
    } catch (err) {
      console.warn("Web Worker setup fallback to sync processing:", err);
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

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
      TrailingNode,
      StarterKit.configure({
        heading: false,
        codeBlock: true,
        blockquote: true,
        history: true,
      }),
      Heading.configure({ levels: [1, 2, 3, 4] }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            isChapter: {
              default: false,
              parseHTML: (element) => element.getAttribute("data-chapter") === "true",
              renderHTML: (attributes) => (attributes.isChapter ? { "data-chapter": "true" } : {}),
            },
            isFrontMatter: {
              default: false,
              parseHTML: (element) => element.getAttribute("data-frontmatter") === "true",
              renderHTML: (attributes) => (attributes.isFrontMatter ? { "data-frontmatter": "true" } : {}),
            },
          };
        },
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
            caption: {
              default: null,
              parseHTML: element => element.getAttribute('data-caption') || element.getAttribute('caption'),
              renderHTML: attributes => attributes.caption ? { 'data-caption': attributes.caption } : {}
            },
            tableStyle: {
              default: "modern",
              parseHTML: element => element.getAttribute('data-style') || 'modern',
              renderHTML: attributes => attributes.tableStyle ? { 'data-style': attributes.tableStyle } : {}
            },
            align: {
              default: "center",
              parseHTML: element => element.getAttribute('data-align') || element.getAttribute('align') || 'center',
              renderHTML: attributes => {
                const a = attributes.align || 'center';
                const margin = a === 'left' ? '1rem auto 1.5rem 0' : a === 'right' ? '1rem 0 1.5rem auto' : '1rem auto 1.5rem auto';
                return {
                  'data-align': a,
                  style: `margin: ${margin};`
                };
              }
            },
            inset: {
              default: "normal",
              parseHTML: element => element.getAttribute('data-inset') || 'normal',
              renderHTML: attributes => attributes.inset ? { 'data-inset': attributes.inset } : {}
            },
            borderColor: { default: null },
            borderWidth: { default: null },
            headerFill: { default: null },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(TableView);
        },
      }),
      TableRow,
      TableHeader.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fill: { default: null },
            align: { default: null },
          };
        },
      }),
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fill: { default: null },
            align: { default: null },
          };
        },
      }),
      MathExtension,
      MathPasteHandler,
      HeadingCleaner,
      ImageGroupExtension,
      DragOutsideSelectionFix,
      Image.configure({
        inline: false,
        allowBase64: true,
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            title: { default: null },
            align: {
              default: "center",
              parseHTML: element => element.getAttribute('data-align') || element.getAttribute('align') || 'center',
              renderHTML: attributes => ({ 'data-align': attributes.align || 'center' })
            },
            width: {
              default: "80%",
              parseHTML: element => element.getAttribute('data-width') || element.style.width || '80%',
              renderHTML: attributes => ({ 'data-width': attributes.width || '80%' })
            },
            fit: {
              default: "contain",
              parseHTML: element => element.getAttribute('data-fit') || 'contain',
              renderHTML: attributes => ({ 'data-fit': attributes.fit || 'contain' })
            },
            placement: {
              default: "none",
              parseHTML: element => element.getAttribute('data-placement') || 'none',
              renderHTML: attributes => ({ 'data-placement': attributes.placement || 'none' })
            },
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
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const files = Array.from(event.dataTransfer.files).filter(f => f && f.type && f.type.startsWith("image/"));
          if (files.length > 0) {
            event.preventDefault();
            const showToast = useAcaStore.getState().showToast;

            if (files.length === 1) {
              showToast("info", "Uploading dropped image...");
              import("@/services/api").then(({ uploadImage }) => {
                uploadImage(files[0])
                  .then((url) => {
                    if (editorRef.current && !editorRef.current.isDestroyed) {
                      editorRef.current.chain().focus().setImage({ src: url }).run();
                    }
                    showToast("success", "Image uploaded ✓");
                  })
                  .catch((err) => showToast("error", "Image upload failed: " + err.message));
              });
            } else {
              showToast("info", `Uploading ${files.length} dropped images as grid...`);
              import("@/services/api").then(({ uploadImage }) => {
                Promise.all(files.map(f => uploadImage(f)))
                  .then((urls) => {
                    const imgObjects = urls.map((url, idx) => ({
                      id: `img_${Date.now()}_${idx}`,
                      src: url,
                      title: "",
                    }));
                    if (editorRef.current && !editorRef.current.isDestroyed) {
                      editorRef.current.chain().focus().insertContent({
                        type: "imageGroup",
                        attrs: {
                          title: "Figure: Multi-image subfigure grid",
                          columns: 3,
                          placement: "none",
                          images: imgObjects,
                        },
                      }).run();
                    }
                    showToast("success", `${files.length} images added to grid ✓`);
                  })
                  .catch((err) => showToast("error", "Grid upload failed: " + err.message));
              });
            }
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItems = items.filter((item) => item.type.startsWith("image/"));
        if (imageItems.length > 0) {
          event.preventDefault();
          const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
          const showToast = useAcaStore.getState().showToast;

          if (files.length === 1) {
            showToast("info", "Uploading pasted image...");
            import("@/services/api").then(({ uploadImage }) => {
              uploadImage(files[0])
                .then((url) => {
                  if (editorRef.current && !editorRef.current.isDestroyed) {
                    editorRef.current.chain().focus().setImage({ src: url }).run();
                  }
                  showToast("success", "Image uploaded ✓");
                })
                .catch((err) => showToast("error", "Image upload failed: " + err.message));
            });
          } else if (files.length > 1) {
            showToast("info", `Uploading ${files.length} pasted images as grid...`);
            import("@/services/api").then(({ uploadImage }) => {
              Promise.all(files.map(f => uploadImage(f)))
                .then((urls) => {
                  const imgObjects = urls.map((url, idx) => ({
                    id: `img_${Date.now()}_${idx}`,
                    src: url,
                    title: "",
                  }));
                  if (editorRef.current && !editorRef.current.isDestroyed) {
                    editorRef.current.chain().focus().insertContent({
                      type: "imageGroup",
                      attrs: {
                        title: "Figure: Multi-image subfigure grid",
                        columns: 3,
                        placement: "none",
                        images: imgObjects,
                      },
                    }).run();
                  }
                  showToast("success", `${files.length} images added to grid ✓`);
                })
                .catch((err) => showToast("error", "Grid upload failed: " + err.message));
            });
          }
          return true;
        } else {
          isPasteEventRef.current = true;
        }
        return false;
      },
    },
    content: initialContent,
    autofocus: false,
    onUpdate: ({ editor }) => {
      editorRef.current = editor;
      if (onUpdateTimer.current) clearTimeout(onUpdateTimer.current);
      onUpdateTimer.current = setTimeout(() => {
        const fullJson = editor.getJSON();
        const live = useAcaStore.getState().getCurrentProject();
        if (workerRef.current) {
          workerRef.current.postMessage({
            singleDoc: fullJson,
            existingFrontMatter: live?.frontMatter || [],
            existingChapters: live?.chapters || [],
          });
        } else {
          const res = splitSingleDocToProject(
            fullJson,
            live?.frontMatter || [],
            live?.chapters || []
          );
          const isPaste = isPasteEventRef.current;
          if (isPaste) {
            isPasteEventRef.current = false;
          }
          // Always update project store with latest frontMatter and chapter text
          updateProjectDocument(res.frontMatter, res.chapters);

          const newSig = computeSectionsSignature(res.frontMatter, res.chapters);
          if (newSig !== lastSectionsSignatureRef.current || isPaste) {
            lastSectionsSignatureRef.current = newSig;
            if (isPaste && editor) {
              const cleanMergedDoc = normalizeContent(
                mergeChaptersToSingleDoc(res.frontMatter, res.chapters)
              );
              editor.commands.setContent(cleanMergedDoc, false);
            }
          }
        }
      }, 100);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Publish the editor instance so the Ribbon / CommandPalette (mounted at
  // EditorPage level) can drive formatting commands.
  useEffect(() => {
    useAcaStore.getState().setEditorInstance(editor || null);
    return () => {
      // Guard against races when a new MultiChapterEditor mounts before the old unmounts
      if (useAcaStore.getState().editorInstance === editor) {
        useAcaStore.getState().setEditorInstance(null);
      }
    };
  }, [editor]);

  // Register this pane's scroll container + editor DOM with the scroll-sync store
  // so the useScrollSync controller (mounted in EditorPage) can mirror scrolling
  // between the editor and the PDF preview.
  useEffect(() => {
    const sync = useScrollSyncStore.getState();
    sync.setEditorScroller(scrollContainerRef.current || null);
    sync.setEditorDom(editor?.view?.dom || null);
    return () => {
      const s = useScrollSyncStore.getState();
      if (s.editorScroller === scrollContainerRef.current) s.setEditorScroller(null);
      if (s.editorDom === editor?.view?.dom) s.setEditorDom(null);
    };
  }, [editor]);

  // Flush pending save on unmount or blur
  useEffect(() => {
    if (!editor) return;
    const handleBlur = () => {
      if (onUpdateTimer.current) {
        clearTimeout(onUpdateTimer.current);
        onUpdateTimer.current = null;
        const fullJson = editor.getJSON();
        const live = useAcaStore.getState().getCurrentProject();
        if (workerRef.current) {
          workerRef.current.postMessage({
            singleDoc: fullJson,
            existingFrontMatter: live?.frontMatter || [],
            existingChapters: live?.chapters || [],
          });
        } else {
          const res = splitSingleDocToProject(
            fullJson,
            live?.frontMatter || [],
            live?.chapters || []
          );
          const newSig = [
            ...(res.frontMatter || []).map((fm) => `${fm.id}:${fm.label}`),
            ...(res.chapters || []).map((c) => `${c.id}:${c.title}`),
          ].join("|");
          lastSectionsSignatureRef.current = newSig;
          updateProjectDocument(res.frontMatter, res.chapters);
        }
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

  useEffect(() => {
    if (!lastSectionsSignatureRef.current) {
      lastSectionsSignatureRef.current = sectionsSignature;
    }
  }, [sectionsSignature]);

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

  const isInitialMountRef = useRef(true);
  const prevProjectIdRef = useRef(currentProject?.id);

  // Reset scroll container to top whenever a project opens, creates, or reloads
  useEffect(() => {
    if (prevProjectIdRef.current !== currentProject?.id) {
      prevProjectIdRef.current = currentProject?.id;
      isInitialMountRef.current = true;
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentProject?.id]);

  const isScrollSpyUpdateRef = useRef(false);

  // Smooth scroll to Chapter/Section H1 ONLY when user clicks an item in left sidebar
  useEffect(() => {
    if (!activeChapterId || !editor || !scrollContainerRef.current) return;

    // Skip auto-scrolling down on initial project load/open/reload so document stays at top (scrollTop: 0)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      return;
    }

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

    if (targetHeading && scrollContainerRef.current) {
      isProgrammaticScrollRef.current = true;
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const headingRect = targetHeading.getBoundingClientRect();
      // Calculate top position with 24px margin buffer from container top so paper header stays clean
      const targetTop = container.scrollTop + (headingRect.top - containerRect.top) - 24;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [activeChapterId, editor]);

  const scrollRafRef = useRef(null);
  const scrollSpyDebounceTimer = useRef(null);

  // Scroll-Spy: Update sidebar active chapter smoothly as user scrolls manually
  const handleScroll = () => {
    if (isProgrammaticScrollRef.current || !editor || !scrollContainerRef.current) return;
    if (scrollRafRef.current) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;

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
        if (scrollSpyDebounceTimer.current) clearTimeout(scrollSpyDebounceTimer.current);
        scrollSpyDebounceTimer.current = setTimeout(() => {
          scrollSpyDebounceTimer.current = null;
          isScrollSpyUpdateRef.current = true;
          setActiveChapter(currentActiveId);
        }, 120);
      }
    });
  };

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      if (editor && !editor.state.selection.empty) {
        return; // Preserve active selection when releasing drag outside paper
      }
      editor?.commands.focus("end");
    }
  };

  return (
    <div className="chapter-editor">
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
          style={{
            cursor: "text",
            fontFamily: currentProject?.metadata?.fontFamily
              ? (currentProject.metadata.fontFamily === 'Arial'
                  ? "'Arial', sans-serif"
                  : currentProject.metadata.fontFamily === 'Courier New'
                  ? "'Courier New', monospace"
                  : currentProject.metadata.fontFamily === 'New Computer Modern'
                  ? "'New Computer Modern', serif"
                  : currentProject.metadata.fontFamily === 'Libertinus Serif'
                  ? "'Libertinus Serif', serif"
                  : "'Times New Roman', Times, serif")
              : undefined,
          }}
        >
          {editor && !editor.isDestroyed && <SelectionBubbleMenu editor={editor} />}
          {editor && !editor.isDestroyed && <TableBubbleMenu editor={editor} />}
          {editor && !editor.isDestroyed && <ImageBubbleMenu editor={editor} />}
          {editor && !editor.isDestroyed && <SlashCommandMenu editor={editor} />}
          {editor && !editor.isDestroyed && <RefSuggestionMenu editor={editor} />}
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
      return <CertificateCanvasEditor section={activeFm} key={activeFm.id} />;
    }
  }

  return <MultiChapterEditor key={currentProject?.id || 'multi'} />;
}
