import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import { Node, Extension, mergeAttributes, nodeInputRule, nodePasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import katex from 'katex';
import { handleRichPaste, transformMathHtml } from './useMathPaste';

// ── 1. Math View React Component ─────────────────────────────────────────────
const MathView = ({ node, selected }: any) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const rawLatex = node.attrs.latex || '';

  // Auto-convert common symbols to LaTeX for rendering
  const latex = rawLatex
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/θ/g, '\\theta ')
    .replace(/π/g, '\\pi ')
    .replace(/α/g, '\\alpha ')
    .replace(/β/g, '\\beta ')
    .replace(/γ/g, '\\gamma ')
    .replace(/δ/g, '\\delta ')
    .replace(/λ/g, '\\lambda ');

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(latex || 'formula', containerRef.current, {
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
      className={`math-view-wrapper ${selected ? 'selected' : ''}`}
      style={{ display: node.attrs.display ? 'block' : 'inline-block' }}
    >
      <div className="math-container">
        <span ref={containerRef} className="math-render-area" />
      </div>
    </NodeViewWrapper>
  );
};

// ── 2. Math Extension Node ───────────────────────────────────────────────────
const MathExtension = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: '' },
      display: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-latex]',
        getAttrs: (element: any) => ({
          latex: element.getAttribute('data-latex') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-latex': HTMLAttributes.latex }),
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

// ── 3. Math Paste Handler ────────────────────────────────────────────────────
const MathPasteHandler = Extension.create({
  name: 'mathPasteHandler',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('mathPasteHandler'),
        props: {
          handlePaste(view, event) {
            return handleRichPaste(view, event, editor);
          },
        },
      }),
    ];
  },
});

// ── 4. Heading Cleaner Prefix Logic ──────────────────────────────────────────
function stripAllPrefixes(text: string) {
  let cleaned = text;
  let lastCleaned;
  do {
    lastCleaned = cleaned;
    cleaned = cleaned.replace(/^\s*\d+(?:\.\d+)*(?:\.\s+|\s+)/, '');
    cleaned = cleaned.replace(/^\s*[a-zA-Z][.)]\s+/, '');
    cleaned = cleaned.replace(/^\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)]\s+/i, '');
  } while (cleaned !== lastCleaned);
  return cleaned;
}

const HeadingCleaner = Extension.create({
  name: 'headingCleaner',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('headingCleaner'),
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const changedRanges: { from: number; to: number }[] = [];
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

          const modifications: { from: number; to: number; text: string }[] = [];

          for (const { from, to } of merged) {
            const scanFrom = Math.max(0, from - 2);
            const scanTo   = Math.min(newState.doc.content.size, to + 2);

            newState.doc.nodesBetween(scanFrom, scanTo, (node, pos) => {
              if (node.type.name !== 'heading') return true;
              if (!node.firstChild?.isText) return false;

              const child        = node.firstChild;
              const originalText = child.text || '';
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

          const tr = newState.tr;
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

// ── 5. Heading Numbering Decoration Plugin ────────────────────────────────────
function hasHeadingChanged(oldDoc: any, newDoc: any) {
  let changed = false;
  oldDoc.nodesBetween(0, oldDoc.content.size, (node: any, pos: number) => {
    if (changed) return false;
    if (node.type.name === 'heading') {
      try {
        const newNode = newDoc.nodeAt(pos);
        if (!newNode || newNode.type.name !== 'heading' || !newNode.eq(node)) {
          changed = true;
        }
      } catch (_) {
        changed = true;
      }
      return false;
    }
    return true;
  });
  if (!changed) {
    newDoc.nodesBetween(0, newDoc.content.size, (node: any, pos: number) => {
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

function buildHeadingDecorations(doc: any, chapterNumber: number) {
  const decorations: Decoration[] = [];
  let sectionNumber    = 0;
  let subsectionNumber = 0;
  let subsubsectionNumber = 0;

  doc.descendants((node: any, pos: number) => {
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
    return false;
  });

  return decorations;
}

const HeadingNumbering = (chapterNumber: number) =>
  Extension.create({
    name: 'headingNumbering',

    addProseMirrorPlugins() {
      const pluginKey = new PluginKey(`headingNumbering-${chapterNumber || 'none'}`);

      return [
        new Plugin({
          key: pluginKey,
          state: {
            init(_, { doc }) {
              if (!chapterNumber) return DecorationSet.empty;
              const decos = buildHeadingDecorations(doc, chapterNumber);
              return DecorationSet.create(doc, decos);
            },
            apply(tr, decorationSet, oldState, newState) {
              if (!chapterNumber) return DecorationSet.empty;
              if (!tr.docChanged) {
                return decorationSet.map(tr.mapping, tr.doc);
              }
              if (!hasHeadingChanged(oldState.doc, newState.doc)) {
                return decorationSet.map(tr.mapping, tr.doc);
              }
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

// ── 6. Trailing Node Extension ───────────────────────────────────────────────
const TrailingNode = Extension.create({
  name: 'trailingNode',
  addOptions() {
    return {
      node: 'paragraph',
      notAfter: ['paragraph'],
    };
  },
  addProseMirrorPlugins() {
    const { node, notAfter } = this.options;
    return [
      new Plugin({
        key: new PluginKey('trailingNode'),
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

// ── 7. Image View React Component ────────────────────────────────────────────
const ImageView = (props: any) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.title || '';

  return (
    <NodeViewWrapper className={`image-view-wrapper ${selected ? 'selected' : ''}`}>
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

// ── 8. Table View React Component ────────────────────────────────────────────
const TableView = (props: any) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.caption || '';

  return (
    <NodeViewWrapper className={`table-view-wrapper ${selected ? 'selected' : ''}`}>
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

// ── 9. Main App Component ────────────────────────────────────────────────────
export default function App() {
  const chapterNumber = (window as any).chapterNumber || 1;

  const editor = useEditor({
    content: (window as any).initialContent || '',
    editable: (window as any).editable !== false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {},
        blockquote: {},
        history: {},
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start writing this section…',
        emptyNodeClass: 'tiptap-placeholder',
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
        allowBase64: false,
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
      transformPastedText(text) {
        return text.replace(/^[-*_]{3,}\s*$/gm, '');
      },
      transformPastedHTML(html) {
        return transformMathHtml(html);
      },
    },
    onCreate: () => {
      (window as any).ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'editor-ready',
        payload: undefined,
      }));
    },
    onUpdate: ({ editor }) => {
      sendStateUpdate(editor);
      (window as any).ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'content-update',
        payload: undefined,
      }));
      sendHeightUpdate();
    },
    onSelectionUpdate: ({ editor }) => {
      sendStateUpdate(editor);
    },
  });

  // Expose the editor instance globally so injectJS commands from React Native can access it
  if (editor) {
    (window as any).__tiptapEditorRef = editor;
  }

  function sendStateUpdate(editor: any) {
    const payload = {
      isBoldActive: editor.isActive('bold'),
      isItalicActive: editor.isActive('italic'),
      isUnderlineActive: editor.isActive('underline'),
      isStrikeActive: editor.isActive('strike'),
      isCodeActive: editor.isActive('code'),
      isBulletListActive: editor.isActive('bulletList'),
      isOrderedListActive: editor.isActive('orderedList'),
      isBlockquoteActive: editor.isActive('blockquote'),
      headingLevel: editor.isActive('heading', { level: 1 })
        ? 1
        : editor.isActive('heading', { level: 2 })
        ? 2
        : editor.isActive('heading', { level: 3 })
        ? 3
        : null,
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
      // Add custom state fields if TenTap requires them
    };

    (window as any).ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'state-update',
      payload: payload,
    }));
  }

  function sendHeightUpdate() {
    if ((window as any).dynamicHeight) {
      const height = document.querySelector('.ProseMirror')?.getBoundingClientRect().height || 0;
      (window as any).ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'document-height',
        payload: height,
      }));
    }
  }

  // Handle messages from React Native
  useEffect(() => {
    if (!editor) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'action') {
          const action = message.payload;
          const { type: actionType, payload: actionPayload } = action;

          switch (actionType) {
            case 'bold':
              editor.chain().focus().toggleBold().run();
              break;
            case 'italic':
              editor.chain().focus().toggleItalic().run();
              break;
            case 'underline':
              editor.chain().focus().toggleUnderline().run();
              break;
            case 'strike':
              editor.chain().focus().toggleStrike().run();
              break;
            case 'code':
              editor.chain().focus().toggleCode().run();
              break;
            case 'bulletList':
              editor.chain().focus().toggleBulletList().run();
              break;
            case 'orderedList':
              editor.chain().focus().toggleOrderedList().run();
              break;
            case 'blockquote':
              editor.chain().focus().toggleBlockquote().run();
              break;
            case 'codeBlock':
              editor.chain().focus().toggleCodeBlock().run();
              break;
            case 'h1':
              editor.chain().focus().toggleHeading({ level: 1 }).run();
              break;
            case 'h2':
              editor.chain().focus().toggleHeading({ level: 2 }).run();
              break;
            case 'h3':
              editor.chain().focus().toggleHeading({ level: 3 }).run();
              break;
            case 'undo':
              editor.chain().focus().undo().run();
              break;
            case 'redo':
              editor.chain().focus().redo().run();
              break;
            case 'clear':
            case 'unsetAllMarks':
              editor.chain().focus().unsetAllMarks().clearNodes().run();
              break;
            case 'set-content':
              editor.commands.setContent(actionPayload.content);
              break;
            case 'set-editable':
              editor.setEditable(actionPayload.editable);
              break;
            // Native inserts
            case 'insert-image':
              editor.chain().focus().setImage({ src: actionPayload.src, title: actionPayload.title }).run();
              break;
            case 'insert-table':
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
              break;
            default:
              break;
          }
        }
      } catch (e) {
        console.error('Error handling WebView message:', e);
      }
    };

    window.addEventListener('message', handleMessage as any);
    document.addEventListener('message', handleMessage as any);

    return () => {
      window.removeEventListener('message', handleMessage as any);
      document.removeEventListener('message', handleMessage as any);
    };
  }, [editor]);

  // Adjust container height dynamically if needed
  useEffect(() => {
    if (editor) {
      sendHeightUpdate();
      // Periodically update height during edits to avoid text clipping
      const interval = setInterval(sendHeightUpdate, 300);
      return () => clearInterval(interval);
    }
  }, [editor]);

  return (
    <div className="tiptap-editor">
      <EditorContent editor={editor} />
    </div>
  );
}
