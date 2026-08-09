import { NodeViewWrapper } from "@tiptap/react";

const ImageView = (props) => {
  const { node, updateAttributes, selected } = props;
  const caption = node.attrs.title || "";

  return (
    <NodeViewWrapper className={`image-view-wrapper ${selected ? "selected" : ""}`}>
      <div className="image-container">
        <img src={node.attrs.src} alt={caption} />
        <div className="image-caption-input-wrap">
          <input
            className="image-caption-input"
            placeholder="Set figure caption (e.g. Figure 1.1)..."
            value={caption}
            onChange={(e) => updateAttributes({ title: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export default ImageView;
export { ImageView };
