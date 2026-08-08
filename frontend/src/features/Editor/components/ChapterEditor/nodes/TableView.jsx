import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";

const TableView = (props) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.caption || "";

  return (
    <NodeViewWrapper className={`table-view-wrapper ${selected ? "selected" : ""}`}>
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

export default TableView;
export { TableView };
