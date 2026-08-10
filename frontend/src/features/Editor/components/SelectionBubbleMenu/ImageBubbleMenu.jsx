import React from 'react';
import { BubbleMenu } from '@tiptap/react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Plus,
} from 'lucide-react';

export default function ImageBubbleMenu({ editor }) {
  if (!editor || editor.isDestroyed) return null;

  const isImageGroup = editor.isActive('imageGroup');
  const isImage = editor.isActive('image');

  const columns = isImageGroup ? (editor.getAttributes('imageGroup').columns || 3) : 3;
  const placement = isImageGroup ? (editor.getAttributes('imageGroup').placement || 'none') : 'none';
  const images = isImageGroup ? (editor.getAttributes('imageGroup').images || []) : [];

  const updateGroup = (attrs) => {
    if (!editor || editor.isDestroyed) return;
    editor.chain().focus().updateAttributes('imageGroup', attrs).run();
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif';
    input.onchange = (evt) => {
      const files = Array.from(evt.target?.files || []);
      if (!files.length) return;
      import('@/services/api').then(({ uploadImage }) => {
        Promise.all(files.map((file) => uploadImage(file))).then((urls) => {
          const newItems = urls.map((url, idx) => ({
            id: `img_${Date.now()}_${idx}`,
            src: url,
            title: '',
          }));
          updateGroup({ images: [...images, ...newItems] });
        });
      });
    };
    input.click();
  };

  const getImageAttr = (name, fallback) => {
    return editor.getAttributes('image')[name] || fallback;
  };

  const updateImageAttr = (attrs) => {
    if (!editor || editor.isDestroyed) return;
    editor.chain().focus().updateAttributes('image', attrs).run();
  };

  const currentAlign = isImage ? getImageAttr('align', 'center') : 'center';
  const currentWidth = isImage ? getImageAttr('width', '80%') : '80%';
  const currentFit = isImage ? getImageAttr('fit', 'contain') : 'contain';
  const currentPlacement = isImage ? getImageAttr('placement', 'none') : 'none';

  return (
    <>
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 120,
          placement: 'top',
          offset: [0, 10],
          maxWidth: 'none',
        }}
        shouldShow={({ editor: ed }) => !!(ed && !ed.isDestroyed && ed.isActive('imageGroup'))}
        className="editor-bubble-menu image-bubble-menu"
      >
        <div className="bubble-menu-section">
          <span className="bubble-menu-label">Row Layout</span>
          <select
            className="bubble-menu-select"
            value={columns}
            onChange={(e) => updateGroup({ columns: parseInt(e.target.value, 10) })}
            title="Images per row"
          >
            <option value={2}>2 / Row</option>
            <option value={3}>3 / Row</option>
            <option value={4}>4 / Row</option>
          </select>
        </div>

        <div className="bubble-menu-divider" />

        <div className="bubble-menu-section">
          <span className="bubble-menu-label">PDF Float</span>
          <select
            className="bubble-menu-select"
            value={placement}
            onChange={(e) => updateGroup({ placement: e.target.value })}
            title="PDF Floating position"
          >
            <option value="none">Inline</option>
            <option value="auto">Auto Float (Zero Gaps)</option>
            <option value="top">Top of Page</option>
            <option value="bottom">Bottom of Page</option>
          </select>
        </div>

        <div className="bubble-menu-divider" />

        <div className="bubble-menu-section">
          <div className="bubble-menu-row">
            <button
              type="button"
              className="bubble-menu-btn"
              onClick={handleAddImage}
              title="Add Image to Grid"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="bubble-menu-btn bubble-menu-btn--danger"
              onClick={() => editor.chain().focus().deleteSelection().run()}
              title="Delete Grid"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </BubbleMenu>

      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 120,
          placement: 'top',
          offset: [0, 10],
          maxWidth: 'none',
        }}
        shouldShow={({ editor: ed }) => !!(ed && !ed.isDestroyed && ed.isActive('image'))}
        className="editor-bubble-menu image-bubble-menu"
      >
        <div className="bubble-menu-section">
          <span className="bubble-menu-label">Width</span>
          <select
            className="bubble-menu-select"
            value={currentWidth}
            onChange={(e) => updateImageAttr({ width: e.target.value })}
            title="Image Width"
          >
            <option value="40%">Compact (40%)</option>
            <option value="60%">Medium (60%)</option>
            <option value="80%">Standard (80%)</option>
            <option value="100%">Full Width (100%)</option>
          </select>
        </div>

        <div className="bubble-menu-divider" />

        <div className="bubble-menu-section">
          <span className="bubble-menu-label">Align</span>
          <div className="bubble-menu-row">
            <button
              type="button"
              className={`bubble-menu-btn ${currentAlign === 'left' ? 'bubble-menu-btn--active' : ''}`}
              onClick={() => updateImageAttr({ align: 'left' })}
              title="Align Left"
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              className={`bubble-menu-btn ${currentAlign === 'center' ? 'bubble-menu-btn--active' : ''}`}
              onClick={() => updateImageAttr({ align: 'center' })}
              title="Align Center"
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              className={`bubble-menu-btn ${currentAlign === 'right' ? 'bubble-menu-btn--active' : ''}`}
              onClick={() => updateImageAttr({ align: 'right' })}
              title="Align Right"
            >
              <AlignRight size={14} />
            </button>
          </div>
        </div>

        <div className="bubble-menu-divider" />

        <div className="bubble-menu-section">
          <span className="bubble-menu-label">Fit</span>
          <select
            className="bubble-menu-select"
            value={currentFit}
            onChange={(e) => updateImageAttr({ fit: e.target.value })}
            title="Object Fit"
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="stretch">Stretch</option>
          </select>
        </div>

        <div className="bubble-menu-divider" />

        <div className="bubble-menu-section">
          <span className="bubble-menu-label">PDF Float</span>
          <select
            className="bubble-menu-select"
            value={currentPlacement}
            onChange={(e) => updateImageAttr({ placement: e.target.value })}
            title="PDF Floating position"
          >
            <option value="none">Inline</option>
            <option value="auto">Auto Float (Zero Gaps)</option>
            <option value="top">Top of Page</option>
            <option value="bottom">Bottom of Page</option>
            <option value="wrap-left">Wrap Left</option>
            <option value="wrap-right">Wrap Right</option>
          </select>
        </div>

        <div className="bubble-menu-divider" />

        <div className="bubble-menu-section">
          <div className="bubble-menu-row">
            <button
              type="button"
              className="bubble-menu-btn bubble-menu-btn--danger"
              onClick={() => editor.chain().focus().deleteSelection().run()}
              title="Delete Image"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </BubbleMenu>
    </>
  );
}
