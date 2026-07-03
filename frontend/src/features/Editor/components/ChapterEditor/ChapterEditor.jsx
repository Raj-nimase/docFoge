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
} from "@/hooks/useMathPaste/useMathPaste";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import { useEffect, useCallback, useRef } from "react";
import katex from "katex";
import useAcaStore from "@/contexts/projectStore/projectStore";
import EditorToolbar from "@/features/Editor/components/Toolbar/Toolbar";
import SelectionBubbleMenu from "@/features/Editor/components/SelectionBubbleMenu/SelectionBubbleMenu";

const MathView = ({ node, updateAttributes, selected }) => {
  const containerRef = useRef(null);
  const rawLatex = node.attrs.latex || "";

  // Auto-convert common symbols to LaTeX for rendering
  const latex = rawLatex
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/θ/g, "\\theta ")
    .replace(/π/g, "\\pi ")
    .replace(/α/g, "\\alpha ")
    .replace(/β/g, "\\beta ")
    .replace(/γ/g, "\\gamma ")
    .replace(/δ/g, "\\delta ")
    .replace(/λ/g, "\\lambda ");

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(latex || "formula", containerRef.current, {
          throwOnError: false,
          displayMode: node.attrs.display,
        });
      } catch (e) {
        containerRef.current.textContent = latex;
      }
    }
  }, [latex, node.attrs.display]);

  return (
    <NodeViewWrapper
      className={`math-view-wrapper ${selected ? "selected" : ""}`}
      style={{ display: node.attrs.display ? "block" : "inline-block" }}
    >
      <div className="math-container">
        <span ref={containerRef} className="math-render-area" />
      </div>
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
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-latex": HTMLAttributes.latex }),
      0,
    ];
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

const HeadingCleaner = Extension.create({
  name: "headingCleaner",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingCleaner"),
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          let modifications = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name === "heading") {
              if (node.firstChild && node.firstChild.isText) {
                const child = node.firstChild;
                const originalText = child.text;
                const cleanedText = stripAllPrefixes(originalText);
                if (cleanedText !== originalText) {
                  modifications.push({
                    from: pos + 1,
                    to: pos + 1 + originalText.length,
                    text: cleanedText,
                  });
                }
              }
            }
          });

          if (modifications.length > 0) {
            let tr = newState.tr;
            // Apply in reverse to avoid position shifts
            for (let i = modifications.length - 1; i >= 0; i--) {
              const mod = modifications[i];
              tr.insertText(mod.text, mod.from, mod.to);
            }
            return tr;
          }
          return null;
        },
      }),
    ];
  },
});


const HeadingNumbering = (chapterNumber) =>
  Extension.create({
    name: "headingNumbering",

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey(`headingNumbering-${chapterNumber ?? "none"}`),
          props: {
            decorations(state) {
              if (!chapterNumber) return null;

              const decorations = [];
              let sectionNumber = 0;
              let subsectionNumber = 0;
              let subsubsectionNumber = 0;

              state.doc.descendants((node, pos) => {
                if (node.type.name !== "heading") return;

                const level = node.attrs?.level || 1;
                let number = "";

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
                      "data-number": number,
                      "data-heading-level": String(level),
                    }),
                  );
                }
              });

              return DecorationSet.create(state.doc, decorations);
            },
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
    ],
    editorProps: {
      transformPastedText: (text) => {
        return text.replace(/^[-*_]{3,}\s*$/gm, "");
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
        const items = (event.clipboardData || event.originalEvent.clipboardData)
          .items;
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
        return false;
      },
    },
    content: section?.content || "",
    autofocus: "end",
    onUpdate: ({ editor }) => {
      const cleanedDoc = cleanHeadingsInDoc(editor.getJSON());
      onContentChange?.(cleanedDoc);
    },
  });

  // Reload content when active section changes
  useEffect(() => {
    if (!editor) return;
    const newContent = section?.content || "";
    const cleanedContent = cleanHeadingsInDoc(newContent);
    const currentJson = JSON.stringify(editor.getJSON());
    const newJson = JSON.stringify(cleanedContent);
    if (currentJson !== newJson) {
      editor.commands.setContent(cleanedContent || "", false);
    }
  }, [sectionId, editor]);

  return (
    <div className="chapter-editor">
      <EditorToolbar editor={editor} />
      <div id="tour-editor-content" className="chapter-editor-scroll">
        <div className="chapter-paper">
          {editor && <SelectionBubbleMenu editor={editor} />}
          <EditorContent editor={editor} className="tiptap-editor" />
        </div>
      </div>
    </div>
  );
}
