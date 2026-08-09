import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";

const TableView = (props) => {
  const { node, updateAttributes, selected, editor, getPos } = props;
  const caption = node.attrs.caption || "";
  const tableStyle = node.attrs.tableStyle || "modern";
  const align = node.attrs.align || "center";
  const inset = node.attrs.inset || "normal";

  const alignItemStyle =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  const focusAfterTable = () => {
    if (editor && typeof getPos === "function") {
      const targetPos = getPos() + node.nodeSize;
      editor.chain().focus().setTextSelection(targetPos).run();
    }
  };

  return (
    <NodeViewWrapper
      className={`table-view-wrapper table-style-${tableStyle} table-align-${align} table-inset-${inset}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: alignItemStyle,
        width: "100%",
        margin: "1.5rem 0",
      }}
    >
      <div
        className="table-inner-container"
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "100%",
        }}
      >
        <div
          className={`table-media-box ${selected ? "selected" : ""}`}
          style={{
            width: "100%",
            borderRadius: "4px",
            outline: selected ? "2px solid #059669" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <NodeViewContent as="table" className="tiptap-table" />
        </div>
        <div
          className="table-caption-input-wrap"
          style={{
            width: "100%",
            textAlign: "center",
            marginTop: "0.5rem",
          }}
        >
          <input
            className="table-caption-input"
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
            placeholder="Set table caption (e.g. Table 1.1)..."
            value={caption}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                focusAfterTable();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export default TableView;
export { TableView };
