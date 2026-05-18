import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, NodeViewContent } from '@tiptap/react';
import { Node, Extension, mergeAttributes, nodeInputRule, nodePasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { extractLatex, isSingleFormula, handleRichPaste, transformMathHtml } from './useMathPaste';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import { useEffect, useCallback, useRef } from 'react';
import katex from 'katex';
import useAcaStore from '../../store';
import EditorToolbar from './Toolbar';
import SelectionBubbleMenu from './SelectionBubbleMenu';

const MathView = ({ node, updateAttributes, selected }) => {
  const containerRef = useRef(null);
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
        getAttrs: (element) => ({
          latex: element.getAttribute('data-latex') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-latex': HTMLAttributes.latex }), 0];
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
  name: 'mathPasteHandler',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('mathPasteHandler'),
        props: {
          handlePaste(view, event) {
            const result = handleRichPaste(view, event, editor);
            return result;
          }
        }
      })
    ];
  }
});

const ImageView = (props) => {
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

const TableView = (props) => {
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

export default function ChapterEditor({ sectionId, onContentChange }) {
  const getActiveSection  = useAcaStore(s => s.getActiveSection);
  const section           = getActiveSection();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:    { levels: [1, 2, 3] },
        codeBlock:  true,
        blockquote: true,
        history:    true,
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
      transformPastedHTML: (html) => {
        return transformMathHtml(html);
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          const type = file.type;
          if (type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
              const node = view.state.schema.nodes.image.create({
                src: readerEvent.target.result,
              });
              const transaction = view.state.tr.replaceSelectionWith(node);
              view.dispatch(transaction);
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (const item of items) {
          if (item.type.indexOf('image') === 0) {
            event.preventDefault();
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = async (readerEvent) => {
              const base64Full = readerEvent.target.result;
              const base64Data = base64Full.split(',')[1];
              
              const showToast = useAcaStore.getState().showToast;
              showToast('info', 'Scanning image with Vision AI...');
              
              try {
                const { extractMathFromImage } = await import('../../api');
                const result = await extractMathFromImage(base64Data);
                
                if (result.type === 'math') {
                  const node = view.state.schema.nodes.math.create({ latex: result.content });
                  const transaction = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(transaction);
                  showToast('success', 'Formula extracted ✓');
                } else if (result.type === 'html' || result.type === 'text') {
                  const cleanedContent = transformMathHtml(result.content);
                  editor.commands.insertContent(cleanedContent);
                  showToast('success', 'Content extracted ✓');
                }
              } catch (err) {
                showToast('error', 'Could not read image: ' + err.message);
                console.error(err);
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    content: section?.content || '',
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      onContentChange?.(editor.getJSON());
    },
  });

  // Reload content when active section changes
  useEffect(() => {
    if (!editor) return;
    const newContent = section?.content || '';
    // Only set if actually different to avoid cursor reset on keypress
    const currentJson = JSON.stringify(editor.getJSON());
    const newJson     = JSON.stringify(newContent);
    if (currentJson !== newJson) {
      editor.commands.setContent(newContent || '', false);
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
