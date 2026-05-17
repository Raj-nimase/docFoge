import useDocStore from '../../store';

/**
 * Confidence Banner — shown for blocks with confidence < 0.85.
 * Lets the user accept or reject the parser's suggested type.
 */
export default function ConfidenceBanner({ block }) {
  const acceptBlock = useDocStore(s => s.acceptBlock);
  const rejectBlockSuggestion = useDocStore(s => s.rejectBlockSuggestion);

  if (!block || (block.confidence ?? 1) >= 0.85) return null;

  const pct = Math.round((block.confidence ?? 0) * 100);
  const suggestedLabel = block.type === 'heading'
    ? `Heading ${block.level}`
    : block.type.replace('_', ' ');

  return (
    <div className="confidence-banner" role="status">
      <div className="confidence-banner-left">
        <span className="confidence-icon">💡</span>
        <span className="confidence-text">
          We think this is a <strong>{suggestedLabel}</strong>
          <span className="confidence-pct">({pct}% confident)</span>
        </span>
      </div>
      <div className="confidence-banner-actions">
        <button
          className="btn-confidence-accept"
          onClick={() => acceptBlock(block.id)}
          title="Accept this block type"
        >
          ✓ Accept
        </button>
        <button
          className="btn-confidence-reject"
          onClick={() => rejectBlockSuggestion(block.id)}
          title="Convert to paragraph"
        >
          ✕ Use Paragraph
        </button>
      </div>
    </div>
  );
}
