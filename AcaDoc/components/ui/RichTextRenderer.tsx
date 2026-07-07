/**
 * RichTextRenderer — Renders Tiptap JSON as styled React Native views.
 *
 * Supported node types:
 *   doc, paragraph, heading (H1–H3), bulletList, orderedList, listItem,
 *   codeBlock, blockquote, horizontalRule, hardBreak, text (with marks),
 *   table, tableRow, tableHeader, tableCell,
 *   image (src + caption),
 *   math (inline $...$ and display \[...\])
 */
import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, ImageErrorEventData, NativeSyntheticEvent } from 'react-native';
import { C, F, S, R } from '@/constants/theme';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Mark {
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | string;
}

interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, any>;
}

interface Props {
  doc: TiptapNode | null;
  textColor?: string;
}

// ── Inline text renderer ──────────────────────────────────────────────────────

function InlineText({ nodes, baseStyle }: { nodes: TiptapNode[]; baseStyle?: object }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === 'hardBreak') return <Text key={i}>{'\n'}</Text>;

        // Math inline: render as styled text showing the LaTeX
        if (node.type === 'math') {
          const latex = node.attrs?.latex ?? '';
          return (
            <Text key={i} style={st.mathInline}>
              {latex ? `$${latex}$` : '$…$'}
            </Text>
          );
        }

        if (node.type !== 'text') return null;

        const isBold      = node.marks?.some(m => m.type === 'bold');
        const isItalic    = node.marks?.some(m => m.type === 'italic');
        const isUnderline = node.marks?.some(m => m.type === 'underline');
        const isStrike    = node.marks?.some(m => m.type === 'strike');
        const isCode      = node.marks?.some(m => m.type === 'code');

        if (isCode) {
          return <Text key={i} style={st.inlineCode}>{node.text}</Text>;
        }

        return (
          <Text
            key={i}
            style={[
              baseStyle,
              isBold      && st.bold,
              isItalic    && st.italic,
              isUnderline && st.underline,
              isStrike    && st.strike,
            ]}
          >
            {node.text}
          </Text>
        );
      })}
    </>
  );
}

// ── Table renderer ────────────────────────────────────────────────────────────
// Renders table → tableRow → (tableHeader | tableCell) hierarchy.
// Wrapped in a horizontal ScrollView so wide tables don't overflow.

function TableRenderer({ node }: { node: TiptapNode }) {
  const rows = node.content ?? [];
  if (!rows.length) return null;

  // Count columns from first row for equal-width columns
  const colCount = rows[0]?.content?.length ?? 1;

  return (
    <View style={st.tableWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={st.table}>
          {rows.map((row, ri) => {
            const cells = row.content ?? [];
            const isHeaderRow = ri === 0;
            return (
              <View key={ri} style={[st.tableRow, isHeaderRow && st.tableHeaderRow]}>
                {cells.map((cell, ci) => {
                  const isHeader = cell.type === 'tableHeader';
                  // Cell content is usually paragraph nodes
                  const cellText = (cell.content ?? [])
                    .flatMap(p => p.content ?? [])
                    .map(n => n.text ?? '')
                    .join('');
                  return (
                    <View
                      key={ci}
                      style={[
                        st.tableCell,
                        isHeader && st.tableCellHeader,
                        ci < cells.length - 1 && st.tableCellBorderRight,
                      ]}
                    >
                      {/* Render inline content for marks support */}
                      <Text style={[
                        st.tableCellText,
                        isHeader && st.tableCellHeaderText,
                      ]}>
                        <InlineText
                          nodes={(cell.content ?? []).flatMap(p => p.content ?? [])}
                          baseStyle={isHeader ? st.tableCellHeaderText : st.tableCellText}
                        />
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {/* Table caption from attrs */}
      {node.attrs?.caption ? (
        <Text style={st.tableCaption}>{node.attrs.caption}</Text>
      ) : null}
    </View>
  );
}

// ── Image renderer ────────────────────────────────────────────────────────────

function ImageRenderer({ node }: { node: TiptapNode }) {
  const src     = node.attrs?.src ?? '';
  const caption = node.attrs?.title ?? node.attrs?.alt ?? '';
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return (
      <View style={st.imageFallback}>
        <Text style={st.imageFallbackText}>📷 {caption || 'Image'}</Text>
      </View>
    );
  }

  return (
    <View style={st.imageWrap}>
      <Image
        source={{ uri: src }}
        style={st.image}
        resizeMode="contain"
        onError={() => setError(true)}
      />
      {caption ? <Text style={st.imageCaption}>{caption}</Text> : null}
    </View>
  );
}

// ── Math display renderer ─────────────────────────────────────────────────────
// We can't run KaTeX in React Native without a WebView.
// Show the raw LaTeX in a styled code-like box so it's readable and
// the user understands what will render in the final PDF.

function MathDisplay({ node }: { node: TiptapNode }) {
  const latex   = node.attrs?.latex ?? '';
  const display = node.attrs?.display === true;

  if (display) {
    return (
      <View style={st.mathDisplayWrap}>
        <View style={st.mathDisplayInner}>
          <Text style={st.mathDisplayLabel}>∑ LaTeX formula</Text>
          <Text style={st.mathDisplayCode}>{latex || '…'}</Text>
        </View>
      </View>
    );
  }

  // Inline math — handled in InlineText above, but kept here as fallback
  return <Text style={st.mathInline}>${latex}$</Text>;
}

// ── Block node renderer ────────────────────────────────────────────────────────

function renderNode(node: TiptapNode, index: number): React.ReactNode {
  const children = node.content ?? [];

  switch (node.type) {

    case 'heading': {
      const level = node.attrs?.level ?? 1;
      const hStyle = level === 1 ? st.h1 : level === 2 ? st.h2 : st.h3;
      return (
        <Text key={index} style={hStyle}>
          <InlineText nodes={children} baseStyle={hStyle} />
        </Text>
      );
    }

    case 'paragraph': {
      if (!children.length) return <View key={index} style={st.emptyParagraph} />;
      return (
        <Text key={index} style={st.paragraph}>
          <InlineText nodes={children} baseStyle={st.paragraph} />
        </Text>
      );
    }

    case 'bulletList':
      return (
        <View key={index} style={st.listContainer}>
          {children.map((item, j) => (
            <View key={j} style={st.bulletItem}>
              <Text style={st.bullet}>•</Text>
              <Text style={st.listText}>
                <InlineText
                  nodes={item.content?.[0]?.content ?? []}
                  baseStyle={st.listText}
                />
              </Text>
            </View>
          ))}
        </View>
      );

    case 'orderedList':
      return (
        <View key={index} style={st.listContainer}>
          {children.map((item, j) => (
            <View key={j} style={st.bulletItem}>
              <Text style={st.orderedNum}>{j + 1}.</Text>
              <Text style={st.listText}>
                <InlineText
                  nodes={item.content?.[0]?.content ?? []}
                  baseStyle={st.listText}
                />
              </Text>
            </View>
          ))}
        </View>
      );

    case 'codeBlock': {
      const code = children.map(n => n.text ?? '').join('');
      const isLatex = node.attrs?.language === 'latex';
      // latex codeBlocks (inserted via formula toolbar action) get a styled
      // formula preview box so the user clearly sees their formula.
      // All other codeBlocks stay as generic monospace code.
      if (isLatex) {
        return (
          <View key={index} style={st.mathDisplayWrap}>
            <View style={st.mathDisplayInner}>
              <Text style={st.mathDisplayLabel}>∑ LaTeX formula</Text>
              <Text style={st.mathDisplayCode}>{code || '…'}</Text>
            </View>
          </View>
        );
      }
      return (
        <View key={index} style={st.codeBlock}>
          <Text style={st.codeText}>{code}</Text>
        </View>
      );
    }


    case 'blockquote':
      return (
        <View key={index} style={st.blockquote}>
          {children.map((child, j) => renderNode(child, j))}
        </View>
      );

    case 'horizontalRule':
      return <View key={index} style={st.rule} />;

    // ── Table ──────────────────────────────────────────────────────────────
    case 'table':
      return <TableRenderer key={index} node={node} />;

    // ── Image ──────────────────────────────────────────────────────────────
    case 'image':
      return <ImageRenderer key={index} node={node} />;

    // ── Math (display) ─────────────────────────────────────────────────────
    case 'math':
      return <MathDisplay key={index} node={node} />;

    default:
      return null;
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RichTextRenderer({ doc, textColor }: Props) {
  if (!doc?.content?.length) {
    return (
      <Text style={[st.emptyHint, textColor ? { color: textColor } : null]}>
        Start writing…
      </Text>
    );
  }

  return (
    <View style={st.container}>
      {doc.content.map((node, i) => renderNode(node, i))}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container:      { paddingBottom: S.lg },
  emptyHint:      { fontSize: F.base, color: C.textFaint, fontStyle: 'italic', lineHeight: 26 },

  // Headings
  h1: { fontSize: F['2xl'], fontWeight: '800', color: C.text, marginTop: S.xl, marginBottom: S.sm, letterSpacing: -0.5, lineHeight: 36 },
  h2: { fontSize: F.xl,    fontWeight: '700', color: C.text, marginTop: S.lg, marginBottom: S.xs, lineHeight: 30 },
  h3: { fontSize: F.lg,    fontWeight: '700', color: C.textMuted, marginTop: S.md, marginBottom: S.xs, lineHeight: 26 },

  // Paragraph
  paragraph:      { fontSize: F.base, color: C.text, lineHeight: 26, marginBottom: S.sm },
  emptyParagraph: { height: S.md },

  // Inline marks
  bold:      { fontWeight: '700' },
  italic:    { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  strike:    { textDecorationLine: 'line-through' },
  inlineCode: {
    fontFamily: 'monospace', fontSize: F.sm,
    backgroundColor: C.cardAlt, color: C.accentWarm,
    borderRadius: R.sm, paddingHorizontal: 4,
  },

  // Lists
  listContainer: { marginBottom: S.md, gap: S.xs },
  bulletItem:    { flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' },
  bullet:        { fontSize: F.base, color: C.accent, lineHeight: 26, width: 14 },
  orderedNum:    { fontSize: F.base, color: C.accent, lineHeight: 26, width: 20, fontWeight: '600' },
  listText:      { fontSize: F.base, color: C.text, lineHeight: 26, flex: 1 },

  // Code block
  codeBlock: { backgroundColor: '#1e1e1e', borderRadius: R.lg, padding: S.md, marginVertical: S.sm },
  codeText:  { fontFamily: 'monospace', fontSize: F.sm, color: '#d4d4d4', lineHeight: 20 },

  // Blockquote
  blockquote: {
    borderLeftWidth: 3, borderLeftColor: C.accentLight,
    paddingLeft: S.md, marginVertical: S.sm,
    backgroundColor: C.accentGlow, borderRadius: R.sm, paddingVertical: S.xs,
  },

  // Rule
  rule: { height: 1, backgroundColor: C.border, marginVertical: S.lg },

  // ── Table ──────────────────────────────────────────────────────────────────
  tableWrap:    { marginVertical: S.md },
  table:        { borderWidth: 1, borderColor: C.border, borderRadius: R.md, overflow: 'hidden' },
  tableRow:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tableHeaderRow: { backgroundColor: C.surfaceAlt },
  tableCell:    { flex: 1, padding: S.sm, minWidth: 80 },
  tableCellHeader: { backgroundColor: C.accentGlow },
  tableCellBorderRight: { borderRightWidth: 1, borderRightColor: C.border },
  tableCellText:       { fontSize: F.sm, color: C.text, lineHeight: 20 },
  tableCellHeaderText: { fontSize: F.sm, color: C.text, fontWeight: '700', lineHeight: 20 },
  tableCaption: { fontSize: F.xs, color: C.textMuted, textAlign: 'center', marginTop: S.xs, fontStyle: 'italic' },

  // ── Image ──────────────────────────────────────────────────────────────────
  imageWrap:     { alignItems: 'center', marginVertical: S.md },
  image:         { width: '100%', height: 220, borderRadius: R.md },
  imageCaption:  { fontSize: F.xs, color: C.textMuted, marginTop: S.xs, fontStyle: 'italic', textAlign: 'center' },
  imageFallback: {
    width: '100%', height: 80, borderRadius: R.md,
    backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    marginVertical: S.md,
  },
  imageFallbackText: { fontSize: F.sm, color: C.textMuted },

  // ── Math ───────────────────────────────────────────────────────────────────
  // Display math — shown as a labelled code block since KaTeX can't run natively
  mathDisplayWrap:  { marginVertical: S.md },
  mathDisplayInner: {
    backgroundColor: '#1e1e1e', borderRadius: R.lg,
    padding: S.md, borderLeftWidth: 3, borderLeftColor: C.accentLight,
  },
  mathDisplayLabel: { fontSize: F.xs, color: C.accentLight, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  mathDisplayCode:  { fontFamily: 'monospace', fontSize: F.sm, color: '#d4d4d4', lineHeight: 20 },
  // Inline math — rendered inline as styled monospace text
  mathInline: {
    fontFamily: 'monospace', fontSize: F.sm,
    color: C.accentWarm, backgroundColor: C.cardAlt,
    borderRadius: R.sm, paddingHorizontal: 3,
  },
});
