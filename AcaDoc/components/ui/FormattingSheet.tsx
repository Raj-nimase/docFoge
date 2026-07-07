/**
 * FormattingSheet — Bottom sheet for text formatting & content insertion.
 * Matches the mockup: TEXT, HEADINGS, LISTS, INSERT sections with icon grid.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, Easing, ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, S, R, shadows } from '@/constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────

export type FormatAction =
  | 'bold' | 'italic' | 'underline' | 'strike'
  | 'h1' | 'h2' | 'h3'
  | 'bulletList' | 'orderedList'
  | 'image' | 'table' | 'codeBlock' | 'blockquote'
  | 'formula' | 'code' | 'divider' | 'link' | 'imageCaption';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAction: (action: FormatAction) => void;
  activeFormats?: FormatAction[];
}

// ── Section data ───────────────────────────────────────────────────────────────

const TEXT_ACTIONS: Array<{ id: FormatAction; label: string; iconName: string; bold?: boolean }> = [
  { id: 'bold',      label: 'Bold',      iconName: 'text',           bold: true },
  { id: 'italic',    label: 'Italic',    iconName: 'text' },
  { id: 'underline', label: 'Underline', iconName: 'remove-outline' },
  { id: 'strike',    label: 'Strike',    iconName: 'cut-outline' },
];

const HEADING_ACTIONS = [
  { id: 'h1' as FormatAction, label: 'H₁', sub: 'Section' },
  { id: 'h2' as FormatAction, label: 'H₂', sub: 'Subsection' },
  { id: 'h3' as FormatAction, label: 'H₃', sub: 'Sub-subsection' },
];

const LIST_ACTIONS = [
  { id: 'bulletList' as FormatAction,  label: 'Bullet List',   icon: 'list-outline' },
  { id: 'orderedList' as FormatAction, label: 'Numbered List', icon: 'list-circle-outline' },
];

const INSERT_ACTIONS: Array<{ id: FormatAction; label: string; icon: string }> = [
  { id: 'image',      label: 'Image',      icon: 'image-outline' },
  { id: 'table',      label: 'Table',      icon: 'grid-outline' },
  { id: 'codeBlock',  label: 'Code Block', icon: 'code-slash-outline' },
  { id: 'blockquote', label: 'Quote',      icon: 'chatbox-outline' },
  { id: 'formula',    label: 'Formula',    icon: 'calculator-outline' },
  { id: 'code',       label: 'Code',       icon: 'terminal-outline' },
  { id: 'divider',    label: 'Divider',    icon: 'remove-outline' },
  { id: 'link',       label: 'Link',       icon: 'link-outline' },
];

// ── Sheet component ────────────────────────────────────────────────────────────

export function FormattingSheet({ visible, onClose, onAction, activeFormats = [] }: Props) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: SCREEN_H,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const isActive = (id: FormatAction) => activeFormats.includes(id);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Insert / Format</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── TEXT ── */}
          <SectionLabel label="TEXT" />
          <View style={styles.rowGrid}>
            <TextFormatBtn
              label="B" sublabel="Bold"
              active={isActive('bold')}
              onPress={() => onAction('bold')}
              bold
            />
            <TextFormatBtn
              label="I" sublabel="Italic"
              active={isActive('italic')}
              onPress={() => onAction('italic')}
              italic
            />
            <TextFormatBtn
              label="U̲" sublabel="Underline"
              active={isActive('underline')}
              onPress={() => onAction('underline')}
            />
            <TextFormatBtn
              label="S̶" sublabel="Strike"
              active={isActive('strike')}
              onPress={() => onAction('strike')}
            />
          </View>

          {/* ── HEADINGS ── */}
          <SectionLabel label="HEADINGS" />
          <View style={styles.rowGrid}>
            {HEADING_ACTIONS.map(h => (
              <HeadingBtn
                key={h.id}
                label={h.label}
                sub={h.sub}
                active={isActive(h.id)}
                onPress={() => onAction(h.id)}
              />
            ))}
          </View>

          {/* ── LISTS ── */}
          <SectionLabel label="LISTS" />
          <View style={styles.rowGrid}>
            {LIST_ACTIONS.map(l => (
              <ListBtn
                key={l.id}
                label={l.label}
                icon={l.icon}
                active={isActive(l.id)}
                onPress={() => onAction(l.id)}
              />
            ))}
          </View>

          {/* ── INSERT ── */}
          <SectionLabel label="INSERT" />
          <View style={styles.insertGrid}>
            {INSERT_ACTIONS.map(a => (
              <InsertBtn
                key={a.id}
                label={a.label}
                icon={a.icon}
                onPress={() => onAction(a.id)}
              />
            ))}
          </View>

          <View style={{ height: S.xl }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={styles.sectionLabel}>{label}</Text>
  );
}

function TextFormatBtn({ label, sublabel, active, onPress, bold, italic }: {
  label: string; sublabel: string; active: boolean;
  onPress: () => void; bold?: boolean; italic?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.fmtBtn, active && styles.fmtBtnActive]}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.fmtBtnLabel,
        bold && { fontWeight: '800' },
        italic && { fontStyle: 'italic' },
        active && styles.fmtBtnLabelActive,
      ]}>
        {label}
      </Text>
      <Text style={[styles.fmtBtnSub, active && { color: C.accent }]}>{sublabel}</Text>
    </TouchableOpacity>
  );
}

function HeadingBtn({ label, sub, active, onPress }: {
  label: string; sub: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.fmtBtn, active && styles.fmtBtnActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.headingLabel, active && styles.fmtBtnLabelActive]}>{label}</Text>
      <Text style={[styles.fmtBtnSub, active && { color: C.accent }]}>{sub}</Text>
    </TouchableOpacity>
  );
}

function ListBtn({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.listBtn, active && styles.fmtBtnActive]}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={22} color={active ? C.accent : C.text} />
      <Text style={[styles.fmtBtnSub, active && { color: C.accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InsertBtn({ label, icon, onPress }: {
  label: string; icon: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.insertBtn} activeOpacity={0.7}>
      <View style={styles.insertIconWrap}>
        <Ionicons name={icon as any} size={22} color={C.accent} />
      </View>
      <Text style={styles.insertLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,42,38,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: R['2xl'],
    borderTopRightRadius: R['2xl'],
    maxHeight: SCREEN_H * 0.85,
    ...shadows.sheet,
  },
  handleWrap: { alignItems: 'center', paddingTop: S.md, paddingBottom: S.xs },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.xl,
    paddingBottom: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: S.sm,
  },
  headerTitle: { fontSize: F.md, fontWeight: '700', color: C.text },

  sectionLabel: {
    fontSize: F.xs,
    fontWeight: '700',
    letterSpacing: 1,
    color: C.textFaint,
    paddingHorizontal: S.xl,
    marginTop: S.lg,
    marginBottom: S.sm,
  },

  rowGrid: {
    flexDirection: 'row',
    paddingHorizontal: S.lg,
    gap: S.sm,
  },
  fmtBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.sm,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    gap: 2,
    minHeight: 58,
  },
  fmtBtnActive: {
    backgroundColor: C.accentGlow,
    borderColor: C.accent,
  },
  fmtBtnLabel: {
    fontSize: F.lg,
    fontWeight: '600',
    color: C.text,
  },
  fmtBtnLabelActive: { color: C.accent },
  fmtBtnSub:  { fontSize: F.xs, color: C.textFaint },
  headingLabel: { fontSize: F.lg, fontWeight: '800', color: C.text },

  listBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.sm,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
    minHeight: 66,
  },

  insertGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: S.lg,
    gap: S.sm,
  },
  insertBtn: {
    width: '22%',
    alignItems: 'center',
    gap: S.xs,
    paddingVertical: S.sm,
  },
  insertIconWrap: {
    width: 52,
    height: 52,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  insertLabel: { fontSize: F.xs, color: C.textMuted, textAlign: 'center' },
});
