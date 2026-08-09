import { useState, useEffect } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { ImageOff, RefreshCw, Plus, Trash2, LayoutGrid, Upload, ArrowUpDown } from "lucide-react";

const ImageGroupView = (props) => {
  const { node, updateAttributes, selected, editor, getPos } = props;
  const caption = node.attrs.title || "";
  const columns = parseInt(node.attrs.columns || 3, 10);
  const placement = node.attrs.placement || "auto";
  const images = Array.isArray(node.attrs.images) ? node.attrs.images : [];

  const focusAfterGroup = () => {
    if (editor && typeof getPos === "function") {
      const targetPos = getPos() + node.nodeSize;
      editor.chain().focus().setTextSelection(targetPos).run();
    }
  };

  const selectGroupNode = (e) => {
    e.stopPropagation();
    if (editor && typeof getPos === "function") {
      editor.chain().focus().setNodeSelection(getPos()).run();
    }
  };

  const handleSubCaptionChange = (index, value) => {
    const updated = [...images];
    if (updated[index]) {
      updated[index] = { ...updated[index], title: value };
      updateAttributes({ images: updated });
    }
  };

  const handleRemoveImage = (index, e) => {
    e.stopPropagation();
    const updated = images.filter((_, i) => i !== index);
    updateAttributes({ images: updated });
  };

  const handleAddImage = (e) => {
    e.stopPropagation();
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif";
    input.onchange = (evt) => {
      const files = Array.from(evt.target?.files || []);
      if (!files.length) return;
      import("@/services/api").then(({ uploadImage }) => {
        Promise.all(files.map((file) => uploadImage(file))).then((urls) => {
          const newItems = urls.map((url, idx) => ({
            id: `img_${Date.now()}_${idx}`,
            src: url,
            title: "",
          }));
          updateAttributes({ images: [...images, ...newItems] });
        });
      });
    };
    input.click();
  };

  const getSubLabel = (idx) => `(${String.fromCharCode(97 + idx)})`;
  const gridColumnsCount = Math.min(Math.max(1, columns), 4);

  return (
    <NodeViewWrapper
      className="image-view-wrapper image-align-center"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        margin: "1.5rem 0",
      }}
    >
      <div
        className="image-align-container"
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <div
          className={`image-media-box ${selected ? "selected" : ""}`}
          onClick={selectGroupNode}
          style={{
            width: "100%",
            borderRadius: "6px",
            border: selected ? "2px solid #059669" : "1px solid #e2e8f0",
            boxShadow: selected ? "0 0 0 3px rgba(5, 150, 105, 0.15)" : "none",
            transition: "all 0.15s ease",
            overflow: "hidden",
            cursor: "pointer",
            position: "relative",
            backgroundColor: "#f8fafc",
            padding: "12px",
          }}
        >
          {/* Header Controls Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "12px",
              paddingBottom: "8px",
              borderBottom: "1px dashed #cbd5e1",
              fontSize: "11px",
              color: "#64748b",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "#334155" }}>
              <LayoutGrid size={14} style={{ color: "#059669" }} />
              <span>Subfigure Grid ({images.length} images)</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* Row Layout Pill */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 6px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              >
                <span>Row:</span>
                <select
                  value={gridColumnsCount}
                  onChange={(e) => updateAttributes({ columns: parseInt(e.target.value, 10) })}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#334155",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value={2}>2 Max</option>
                  <option value={3}>3 Max</option>
                  <option value={4}>4 Max</option>
                </select>
              </div>

              {/* PDF Float Pill */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 6px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              >
                <ArrowUpDown size={11} style={{ color: "#059669" }} />
                <span>Float:</span>
                <select
                  value={placement}
                  onChange={(e) => updateAttributes({ placement: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#334155",
                    outline: "none",
                    cursor: "pointer",
                  }}
                  title="Paper Floating: Auto rearranges surrounding text into empty space"
                >
                  <option value="auto">Auto Float</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="none">Inline</option>
                </select>
              </div>

              {/* Add Image Button */}
              <button
                type="button"
                onClick={handleAddImage}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: 500,
                  backgroundColor: "#059669",
                  color: "#ffffff",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Plus size={12} />
                Add Image
              </button>
            </div>
          </div>

          {/* Subfigure Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridColumnsCount}, minmax(0, 1fr))`,
              gap: "10px",
              width: "100%",
            }}
          >
            {images.map((imgObj, idx) => (
              <SubImageCard
                key={imgObj.id || idx}
                src={imgObj.src}
                title={imgObj.title}
                label={getSubLabel(idx)}
                onTitleChange={(val) => handleSubCaptionChange(idx, val)}
                onRemove={(e) => handleRemoveImage(idx, e)}
              />
            ))}

            {images.length === 0 && (
              <div
                onClick={handleAddImage}
                style={{
                  gridColumn: "1 / -1",
                  padding: "2rem 1rem",
                  textAlign: "center",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "4px",
                  color: "#64748b",
                  cursor: "pointer",
                  backgroundColor: "#ffffff",
                }}
              >
                <Upload size={20} style={{ margin: "0 auto 6px", color: "#059669" }} />
                <div style={{ fontWeight: 500, fontSize: "12px", color: "#334155" }}>No images in grid</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>Click to select and upload images</div>
              </div>
            )}
          </div>
        </div>

        {/* Main Figure Caption (Matches ImageView.jsx exactly) */}
        <div
          className="image-caption-container"
          style={{
            width: "100%",
            textAlign: "center",
            marginTop: "0.5rem",
          }}
        >
          <input
            className="image-caption-input"
            style={{
              textAlign: "center",
              width: "100%",
              background: "rgba(241, 245, 249, 0.6)",
              border: "1px dashed #cbd5e1",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "10pt",
              fontStyle: "italic",
              color: "#334155",
              outline: "none",
            }}
            placeholder="Set figure caption (e.g. Figure 2.1)..."
            value={caption}
            onChange={(e) => updateAttributes({ title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                focusAfterGroup();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div
        className="image-trailing-click-area"
        title="Click to write text below image group"
        onClick={focusAfterGroup}
        style={{ height: "16px", cursor: "text", width: "100%" }}
      />
    </NodeViewWrapper>
  );
};

const SubImageCard = ({ src, title, label, onTitleChange, onRemove }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    if (!src) {
      setIsLoading(false);
      setHasError(true);
      return;
    }
    let active = true;
    setIsLoading(true);
    setHasError(false);

    const img = new Image();
    img.onload = () => {
      if (active) {
        setImgSrc(src);
        setIsLoading(false);
        setHasError(false);
      }
    };
    img.onerror = () => {
      if (active) {
        setIsLoading(false);
        setHasError(true);
      }
    };
    img.src = src;

    return () => {
      active = false;
    };
  }, [src]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: "4px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Sublabel Badge */}
      <div
        style={{
          position: "absolute",
          top: "6px",
          left: "6px",
          backgroundColor: "#059669",
          color: "#ffffff",
          fontSize: "10px",
          fontWeight: 700,
          padding: "1px 5px",
          borderRadius: "3px",
          zIndex: 2,
        }}
      >
        {label}
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        title="Remove sub-image"
        style={{
          position: "absolute",
          top: "6px",
          right: "6px",
          backgroundColor: "rgba(239, 68, 68, 0.85)",
          color: "#ffffff",
          border: "none",
          borderRadius: "3px",
          width: "20px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        <Trash2 size={11} />
      </button>

      {/* Image Viewport */}
      <div
        style={{
          width: "100%",
          height: "160px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: "#f8fafc",
          padding: "4px",
        }}
      >
        {isLoading && !hasError && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#64748b" }}>
            <RefreshCw size={13} className="animate-spin text-emerald-600" />
            Loading...
          </div>
        )}

        {hasError ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#ef4444", fontSize: "11px" }}>
            <ImageOff size={18} />
            <span>Image Error</span>
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={title || label}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        )}
      </div>

      {/* Subcaption Input (Matches theme exactly) */}
      <div style={{ width: "100%", padding: "4px 6px", backgroundColor: "#ffffff" }}>
        <input
          className="image-caption-input"
          style={{
            width: "100%",
            textAlign: "center",
            background: "rgba(241, 245, 249, 0.6)",
            border: "1px dashed #cbd5e1",
            borderRadius: "4px",
            padding: "2px 4px",
            fontSize: "9pt",
            fontStyle: "italic",
            color: "#334155",
            outline: "none",
          }}
          placeholder={`${label} Subcaption...`}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};

export default ImageGroupView;
export { ImageGroupView };
