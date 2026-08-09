import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";

const TableView = (props) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.caption || "";
  const tableStyle = node.attrs.tableStyle || "modern";
  const align = node.attrs.align || "center";
  const inset = node.attrs.inset || "normal";

  return (
    <NodeViewWrapper
      className={`table-view-wrapper ${selected ? "selected" : ""} table-style-${tableStyle} table-align-${align} table-inset-${inset}`}
    >
      <NodeViewContent className="table-content-area" />
      <div className="table-caption-input-wrap">
        <input
          className="table-caption-input"
          placeholder="Set table caption (e.g. Table 1.1)..."
          value={caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </NodeViewWrapper>
  );
};

export default TableView;
export { TableView };
