import { useState, useEffect } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { ImageOff, RefreshCw, Upload } from "lucide-react";

const ImageView = (props) => {
  const { node, updateAttributes, selected, editor, getPos } = props;
  const caption = node.attrs.title || "";
  const align = node.attrs.align || "center";
  const width = node.attrs.width || "80%";
  const fit = node.attrs.fit || "contain";
  const src = node.attrs.src || "";

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

  const alignItemStyle =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  const objectFitStyle =
    fit === "cover" ? "cover" : fit === "stretch" ? "fill" : "contain";

  const focusAfterImage = () => {
    if (editor && typeof getPos === "function") {
      const targetPos = getPos() + node.nodeSize;
      editor.chain().focus().setTextSelection(targetPos).run();
    }
  };

  const selectImageNode = (e) => {
    e.stopPropagation();
    if (editor && typeof getPos === "function") {
      editor.chain().focus().setNodeSelection(getPos()).run();
    }
  };

  const handleRetry = (e) => {
    e.stopPropagation();
    setIsLoading(true);
    setHasError(false);
    // Force reload image by appending cache-busting param if http(s)
    if (src.startsWith("http")) {
      const separator = src.includes("?") ? "&" : "?";
      setImgSrc(`${src}${separator}t=${Date.now()}`);
    } else {
      setImgSrc(src);
    }
  };

  const handleReplaceClick = (e) => {
    e.stopPropagation();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif";
    input.onchange = (evt) => {
      const file = evt.target?.files?.[0];
      if (!file) return;
      import("@/services/api").then(({ uploadImage }) => {
        uploadImage(file).then((newUrl) => {
          updateAttributes({ src: newUrl });
        });
      });
    };
    input.click();
  };

  return (
    <NodeViewWrapper
      className={`image-view-wrapper image-align-${align}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: alignItemStyle,
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
          width: width,
          maxWidth: "100%",
        }}
      >
        <div
          className={`image-media-box ${selected ? "selected" : ""}`}
          onClick={selectImageNode}
          style={{
            width: "100%",
            borderRadius: "6px",
            border: selected ? "2px solid #059669" : "1px solid #e2e8f0",
            boxShadow: selected ? "0 0 0 3px rgba(5, 150, 105, 0.15)" : "none",
            transition: "all 0.15s ease",
            overflow: "hidden",
            cursor: "pointer",
            position: "relative",
            minHeight: hasError ? "140px" : "auto",
            backgroundColor: "#f8fafc",
          }}
        >
          {isLoading && !hasError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "160px",
                backgroundColor: "#f1f5f9",
                color: "#64748b",
                fontSize: "13px",
                gap: "8px",
              }}
            >
              <RefreshCw size={18} className="animate-spin" />
              Loading image...
            </div>
          )}

          {hasError ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "1.5rem",
                textAlign: "center",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                border: "1px dashed #fca5a5",
                borderRadius: "6px",
                gap: "8px",
              }}
            >
              <ImageOff size={28} />
              <div style={{ fontWeight: 600, fontSize: "14px" }}>
                Image failed to display
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#7f1d1d",
                  maxWidth: "90%",
                  wordBreak: "break-all",
                  opacity: 0.8,
                }}
              >
                {src || "No source URL provided"}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={handleRetry}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 500,
                    backgroundColor: "#ffffff",
                    border: "1px solid #fca5a5",
                    borderRadius: "4px",
                    color: "#991b1b",
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleReplaceClick}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 500,
                    backgroundColor: "#059669",
                    border: "none",
                    borderRadius: "4px",
                    color: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <Upload size={12} />
                  Re-upload
                </button>
              </div>
            </div>
          ) : (
            <img
              src={imgSrc}
              alt={caption}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              style={{
                width: "100%",
                maxHeight: "550px",
                objectFit: objectFitStyle,
                display: "block",
              }}
            />
          )}
        </div>

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
            placeholder="Set figure caption (e.g. Figure 1.1)..."
            value={caption}
            onChange={(e) => updateAttributes({ title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                focusAfterImage();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div
        className="image-trailing-click-area"
        title="Click to write text below image"
        onClick={focusAfterImage}
        style={{ height: "16px", cursor: "text", width: "100%" }}
      />
    </NodeViewWrapper>
  );
};

export default ImageView;
export { ImageView };
