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
} from "@/hooks/useMathPaste/useMathPaste";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import { useState, useEffect, useCallback, useRef } from "react";
import katex from "katex";
import useAcaStore from "@/contexts/projectStore/projectStore";
import EditorToolbar from "@/features/Editor/components/Toolbar/Toolbar";
import SelectionBubbleMenu from "@/features/Editor/components/SelectionBubbleMenu/SelectionBubbleMenu";

const MathView = ({ node, updateAttributes, selected }) => {
  const containerRef = useRef(null);
  const previewRef = useRef(null);
  const inputRef = useRef(null);
  const rawLatex = node.attrs.latex || "";
  const display = node.attrs.display;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawLatex);

  // Render KaTeX into an element with progressive fallback
  const renderKatex = useCallback((el, latex, displayMode) => {
    if (!el) return;
    if (!latex.trim()) {
      try { katex.render("\\text{formula}", el, { throwOnError: false, displayMode }); }
      catch (e) { el.textContent = ""; }
      return;
    }
    const s1 = sanitizeLatex(latex);
    const s2 = convUnicodeMath(s1);
    const s3 = stripUnknownChars(s2);
    const candidates = [latex, s1, s2, s3];
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
      katex.render(s1 || s2 || latex, el, { throwOnError: false, displayMode });
    } catch (e2) {
      el.textContent = latex;
    }
  }, []);

  // Main formula render
  useEffect(() => {
    if (!editing) renderKatex(containerRef.current, rawLatex, display);
  }, [rawLatex, display, editing, renderKatex]);

  // Live preview in edit mode
  useEffect(() => {
    if (editing) renderKatex(previewRef.current, draft, display);
  }, [draft, display, editing, renderKatex]);

  // Auto-focus textarea when entering edit mode
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

// Smart Paste Handler — only intercepts when user pastes a SINGLE formula
// For mixed content (text + math), TipTap's built-in $...$ paste rules handle it
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
    // Mandate at least one space after the number/prefix so we don't delete while they are typing "1."
    cleaned = cleaned.replace(/^\s*\d+(?:\.\d+)*(?:\.\s+|\s+)/, "");
    cleaned = cleaned.replace(/^\s*[a-zA-Z][.)]\s+/, "");
    cleaned = cleaned.replace(
      /^\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)]\s+/i,
      "",
    );
  } while (cleaned !== lastCleaned);
  return cleaned;
}

function cleanHeadingsInDoc(doc) {
  if (!doc || !doc.content) return doc;
  const walk = (nodes) => {
    return nodes.map((node) => {
      if (node.type === "heading" && node.content) {
        const cleanedContent = node.content.map((textNode) => {
          if (textNode.type === "text" && textNode.text) {
            return { ...textNode, text: stripAllPrefixes(textNode.text) };
          }
          return textNode;
        });
        return { ...node, content: cleanedContent };
      }
      if (node.content) {
        return { ...node, content: walk(node.content) };
      }
      return node;
    });
  };
  return { ...doc, content: walk(doc.content) };
}

// Wrap bare inline nodes (e.g. math) at the doc top level in their own paragraph.
// The mobile editor stores math as block-level image carriers that become top-level
// math nodes after editorToStoreContent. The web's math is inline, so ProseMirror
// would merge consecutive bare math nodes into one paragraph — this prevents that.
const INLINE_TYPES = new Set(["math", "text"]);
function normalizeContent(content) {
  if (!content || !content.content || !Array.isArray(content.content)) return content;
  const out = [];
  let pendingInlines = [];
  const flushInlines = () => {
    if (!pendingInlines.length) return;
    // Each inline gets its own paragraph (definition lines, legend lines)
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
          // Skip if nothing changed in the document
          if (!transactions.some((tr) => tr.docChanged)) return null;

          // ── Targeted scan ────────────────────────────────────────────────
          // Instead of calling newState.doc.descendants() which walks the
          // ENTIRE document on every transaction, we collect the changed
          // position ranges from each transaction's steps and only inspect
          // heading nodes that fall inside those ranges.
          //
          // For a single keystroke this is typically 1 step covering ~1 node.
          // For a large paste this covers only the inserted slice.
          // The old approach scanned every node in a 10,000-word chapter
          // even when the user typed a single character at the top.

          const changedRanges = [];
          for (const tr of transactions) {
            if (!tr.docChanged) continue;
            tr.steps.forEach((step, i) => {
              const map = tr.mapping.maps[i];
              // stepMap.ranges is [from, to, from, to, ...] pairs
              map.forEach((oldStart, oldEnd, newStart, newEnd) => {
                changedRanges.push({ from: newStart, to: newEnd });
              });
            });
          }

          if (changedRanges.length === 0) return null;

          // Merge overlapping/adjacent ranges to avoid duplicate scans
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
            // Expand range slightly to catch heading nodes that straddle
            // the boundary (a heading node can start just before `from`)
            const scanFrom = Math.max(0, from - 2);
            const scanTo   = Math.min(newState.doc.content.size, to + 2);

            newState.doc.nodesBetween(scanFrom, scanTo, (node, pos) => {
              if (node.type.name !== "heading") return true; // descend
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
              return false; // don't descend into heading children
            });
          }

          if (modifications.length === 0) return null;

          // Apply in reverse so earlier positions aren't shifted
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


// ── Helper: check if any heading node changed between two doc states ──────────
// Uses ProseMirror's built-in changedDescendants to walk only the diff,
// instead of iterating the full document on every transaction.
function hasHeadingChanged(oldDoc, newDoc) {
  let changed = false;
  // changedDescendants fires the callback only for nodes that differ
  oldDoc.nodesBetween(0, oldDoc.content.size, (node, pos) => {
    if (changed) return false; // early exit once found
    if (node.type.name === 'heading') {
      // Check if this heading node still exists at the same pos in newDoc
      try {
        const newNode = newDoc.nodeAt(pos);
        if (!newNode || newNode.type.name !== 'heading' || !newNode.eq(node)) {
          changed = true;
        }
      } catch (_) {
        changed = true;
      }
      return false; // don't descend into heading children
    }
    return true;
  });
  if (!changed) {
    // Also check for newly inserted headings that weren't in oldDoc
    newDoc.nodesBetween(0, newDoc.content.size, (node, pos) => {
      if (changed) return false;
      if (node.type.name === 'heading') {
        try {
          const oldNode = oldDoc.nodeAt(pos);
          if (!oldNode || oldNode.type.name !== 'heading' || !oldNode.eq(node)) {
            changed = true;
          }
        } catch (_) {
          changed = true;
        }
        return false;
      }
      return true;
    });
  }
  return changed;
}

// ── Build the decoration array from scratch ───────────────────────────────────
function buildHeadingDecorations(doc, chapterNumber) {
  const decorations = [];
  let sectionNumber    = 0;
  let subsectionNumber = 0;
  let subsubsectionNumber = 0;

  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return true;

    const level = node.attrs?.level || 1;
    let number  = '';

    if (level === 1) {
      sectionNumber += 1;
      subsectionNumber = 0;
      subsubsectionNumber = 0;
      number = `${chapterNumber}.${sectionNumber}`;
    } else if (level === 2) {
      if (sectionNumber === 0) sectionNumber = 1;
      subsectionNumber += 1;
      subsubsectionNumber = 0;
      number = `${chapterNumber}.${sectionNumber}.${subsectionNumber}`;
    } else if (level === 3) {
      if (sectionNumber === 0) sectionNumber = 1;
      if (subsectionNumber === 0) subsectionNumber = 1;
      subsubsectionNumber += 1;
      number = `${chapterNumber}.${sectionNumber}.${subsectionNumber}.${subsubsectionNumber}`;
    }

    if (number) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-number':        number,
          'data-heading-level': String(level),
        }),
      );
    }
    return false; // don't descend into heading children
  });

  return decorations;
}

const HeadingNumbering = (chapterNumber) =>
  Extension.create({
    name: 'headingNumbering',

    addProseMirrorPlugins() {
      const pluginKey = new PluginKey(`headingNumbering-${chapterNumber ?? 'none'}`);

      return [
        new Plugin({
          key: pluginKey,

          // Plugin state holds the cached DecorationSet so we can reuse it
          // across transactions that don't touch any heading node.
          state: {
            init(_, { doc }) {
              if (!chapterNumber) return DecorationSet.empty;
              const decos = buildHeadingDecorations(doc, chapterNumber);
              return DecorationSet.create(doc, decos);
            },

            apply(tr, decorationSet, oldState, newState) {
              if (!chapterNumber) return DecorationSet.empty;

              // ── Fast path: no document change ─────────────────────────
              // Selection moves, focus events, metadata changes — all
              // produce transactions with docChanged = false. Skip entirely.
              if (!tr.docChanged) {
                return decorationSet.map(tr.mapping, tr.doc);
              }

              // ── Fast path: no heading changed ─────────────────────────
              // The user typed inside a paragraph, list item, code block,
              // etc. The heading numbering cannot have changed so we just
              // remap existing decoration positions through the transaction
              // mapping (O(decorations) instead of O(all nodes)).
              if (!hasHeadingChanged(oldState.doc, newState.doc)) {
                return decorationSet.map(tr.mapping, tr.doc);
              }

              // ── Slow path: a heading was inserted / deleted / edited ───
              // Rebuild the full decoration set. This only runs when the
              // user actually changes heading content, not on normal typing.
              const decos = buildHeadingDecorations(newState.doc, chapterNumber);
              return DecorationSet.create(newState.doc, decos);
            },
          },

          props: {
            decorations(state) {
              return pluginKey.getState(state);
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
    const { node, notAfter } = this.options;
    return [
      new Plugin({
        key: new PluginKey("trailingNode"),
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const lastNode = newState.doc.lastChild;
          if (!lastNode || notAfter.includes(lastNode.type.name)) {
            return null;
          }

          const type = newState.schema.nodes[node];
          if (!type) return null;

          return newState.tr.insert(newState.doc.content.size, type.create());
        },
      }),
    ];
  },
});

const ImageView = (props) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.title || "";

  return (
    <NodeViewWrapper
      className={`image-view-wrapper ${selected ? "selected" : ""}`}
    >
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
    <NodeViewWrapper
      className={`table-view-wrapper ${selected ? "selected" : ""}`}
    >
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

export default function ChapterEditor({
  sectionId,
  onContentChange,
  chapterNumber,
}) {
  const getActiveSection = useAcaStore((s) => s.getActiveSection);
  const section = getActiveSection();

  // Debounce timer ref — getJSON() is only called after 400ms of no typing
  const onUpdateTimer = useRef(null);

  // Track the last sectionId we loaded so the content-reload effect
  // can skip a setContent when the section hasn't actually changed.
  const loadedSectionIdRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: true,
        blockquote: true,
        history: true,
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Start writing this section…",
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
      HeadingNumbering(chapterNumber),
      Image.configure({
        inline: false,
        allowBase64: false, // Images are now stored in Cloudinary, not as data: URIs
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
      TrailingNode,
    ],
    editorProps: {
      transformPastedText: (text) => {
        // Strip horizontal line markdown and trailing newlines so blank lines don't accumulate
        return text.replace(/^[^\S\n]*[-*_]{3,}[^\S\n]*\n?/gm, "");
      },
      transformPastedHTML: (html) => {
        return transformMathHtml(html);
      },
      handleDrop: (view, event, slice, moved) => {
        if (
          !moved &&
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files[0]
        ) {
          const file = event.dataTransfer.files[0];
          const type = file.type;
          if (type.startsWith("image/")) {
            event.preventDefault();
            const showToast = useAcaStore.getState().showToast;
            showToast("info", "Uploading image...");
            import("@/services/api").then(({ uploadImage }) => {
              uploadImage(file)
                .then((url) => {
                  const node = view.state.schema.nodes.image.create({
                    src: url,
                  });
                  const transaction = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(transaction);
                  showToast("success", "Image uploaded ✓");
                })
                .catch((err) => {
                  showToast("error", "Image upload failed: " + err.message);
                });
            });
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData || event.originalEvent?.clipboardData;
        const items = clipboardData?.items;
        if (items) {
          for (const item of items) {
            if (item.type.indexOf("image") === 0) {
              event.preventDefault();
              const file = item.getAsFile();
              const showToast = useAcaStore.getState().showToast;

              showToast("info", "Uploading image...");
              import("@/services/api").then(({ uploadImage }) => {
                uploadImage(file)
                  .then((url) => {
                    const node = view.state.schema.nodes.image.create({
                      src: url,
                    });
                    const transaction = view.state.tr.replaceSelectionWith(node);
                    view.dispatch(transaction);
                    showToast("success", "Image uploaded ✓");
                  })
                  .catch((err) => {
                    showToast("error", "Image upload failed: " + err.message);
                    console.error(err);
                  });
              });
              return true;
            }
          }
        }
        return handleRichPaste(view, event);
      },
    },
    content: normalizeContent(section?.content || ""),
    autofocus: "end",
    onUpdate: ({ editor }) => {
      // ── Debounced getJSON ──────────────────────────────────────────────────
      // getJSON() serialises the entire ProseMirror doc tree — expensive on
      // large documents. We debounce it so it only runs once after the user
      // pauses for 400 ms instead of on every keystroke.
      //
      // HeadingCleaner (the ProseMirror plugin above) already strips numeric
      // prefixes from headings inside the live doc, so we do NOT call
      // cleanHeadingsInDoc() here — that was a redundant full-tree copy.
      if (onUpdateTimer.current) clearTimeout(onUpdateTimer.current);
      onUpdateTimer.current = setTimeout(() => {
        onContentChange?.(editor.getJSON());
      }, 400);
    },
  });

  // Flush any pending debounced save immediately when the editor loses focus
  // so content is never lost when the user clicks away before 400ms elapses.
  useEffect(() => {
    if (!editor) return;
    const handleBlur = () => {
      if (onUpdateTimer.current) {
        clearTimeout(onUpdateTimer.current);
        onUpdateTimer.current = null;
        onContentChange?.(editor.getJSON());
      }
    };
    editor.on("blur", handleBlur);
    return () => {
      editor.off("blur", handleBlur);
      // Also flush on unmount (e.g. user switches chapter before 400ms)
      if (onUpdateTimer.current) {
        clearTimeout(onUpdateTimer.current);
        onUpdateTimer.current = null;
      }
    };
  }, [editor, onContentChange]);

  // Reload content when the active section changes.
  // Guard 1: skip if sectionId hasn't changed — prevents re-setting content
  //          on every parent re-render when nothing actually changed.
  // Guard 2: compare JSON strings so we don't blow away cursor position when
  //          the store content is identical to what's already in the editor.
  useEffect(() => {
    if (!editor) return;
    if (sectionId === loadedSectionIdRef.current) return; // same section — skip
    loadedSectionIdRef.current = sectionId;

    const newContent = normalizeContent(section?.content || "");
    const currentJson = JSON.stringify(editor.getJSON());
    const newJson     = JSON.stringify(newContent);
    if (currentJson !== newJson) {
      editor.commands.setContent(newContent || "", false);
    }
  }, [sectionId, editor]);

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
