import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";

const TableView = (props) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.caption || "";
  const tableStyle = node.attrs.tableStyle || "modern";
  const align = node.attrs.align || "center";
  const inset = node.attrs.inset || "normal";

  const alignItemStyle =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  return (
    <NodeViewWrapper
      className={`table-view-wrapper ${selected ? "selected" : ""} table-style-${tableStyle} table-align-${align} table-inset-${inset}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: alignItemStyle,
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
        <table className="tiptap-table">
          <NodeViewContent as="tbody" />
        </table>
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
            }}
            placeholder="Set table caption (e.g. Table 1.1)..."
            value={caption}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export default TableView;
export { TableView };
