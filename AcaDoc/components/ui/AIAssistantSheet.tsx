/**
 * AIAssistantSheet — Bottom sheet with AI writing actions.
 * Matches the mockup: Improve Writing, Convert to Bullet List,
 * Generate Section, Continue Writing, Fix Grammar, Summarize, Expand, Translate.
 */
import React, { useRef, useEffect, memo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, Easing, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, S, R, shadows } from '@/constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────

export type AIAction =
  | 'improve'   | 'bulletList' | 'generate' | 'continue'
  | 'grammar'   | 'summarize'  | 'expand'   | 'translate';

interface AIActionItem {
  id: AIAction;
  label: string;
  sub: string;
  icon: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAction: (action: AIAction) => void;
  loading?: AIAction | null;
}

// ── Action definitions ─────────────────────────────────────────────────────────

const AI_ACTIONS: AIActionItem[] = [
  { id: 'improve',    label: 'Improve Writing',       sub: 'Enhance clarity and readability',      icon: 'sparkles-outline' },
  { id: 'bulletList', label: 'Convert to Bullet List', sub: 'Make this into bullet points',         icon: 'list-outline' },
  { id: 'generate',   label: 'Generate Section',       sub: 'AI will generate content for this section', icon: 'document-text-outline' },
  { id: 'continue',   label: 'Continue Writing',       sub: 'AI will continue this paragraph',     icon: 'pencil-outline' },
  { id: 'grammar',    label: 'Fix Grammar',            sub: 'Correct grammar and spelling',         icon: 'checkmark-circle-outline' },
  { id: 'summarize',  label: 'Summarize',              sub: 'Summarize this content',               icon: 'contract-outline' },
  { id: 'expand',     label: 'Expand',                 sub: 'Add more details',                     icon: 'expand-outline' },
  { id: 'translate',  label: 'Translate',              sub: 'Translate to another language',        icon: 'language-outline' },
];

// ── Sheet component ────────────────────────────────────────────────────────────

export function AIAssistantSheet({ visible, onClose, onAction, loading }: Props) {
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

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.aiChip}>
              <Ionicons name="sparkles" size={14} color={C.accent} />
              <Text style={styles.aiChipText}>AI</Text>
            </View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actionList}>
          {AI_ACTIONS.map((item, i) => (
            <AIActionRow
              key={item.id}
              item={item}
              onPress={() => onAction(item.id)}
              isLoading={loading === item.id}
              isLast={i === AI_ACTIONS.length - 1}
            />
          ))}
        </View>

        <View style={{ height: S.xl }} />
      </Animated.View>
    </Modal>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

const AIActionRow = memo(function AIActionRow({ item, onPress, isLoading, isLast }: {
  item: AIActionItem;
  onPress: () => void;
  isLoading: boolean;
  isLast: boolean;
}) {
  const spinVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(spinVal, { toValue: 1, duration: 800, useNativeDriver: true })
      ).start();
    } else {
      spinVal.setValue(0);
    }
  }, [isLoading]);

  const spin = spinVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        style={styles.actionRow}
        activeOpacity={0.7}
        disabled={isLoading}
      >
        <View style={styles.iconWrap}>
          {isLoading ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="sync-outline" size={20} color={C.accent} />
            </Animated.View>
          ) : (
            <Ionicons name={item.icon as any} size={20} color={C.accent} />
          )}
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionLabel}>{item.label}</Text>
          <Text style={styles.actionSub}>{item.sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </>
  );
});

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
    marginBottom: S.xs,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  headerTitle: { fontSize: F.md, fontWeight: '700', color: C.text },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.accentGlow,
    borderWidth: 1,
    borderColor: C.accentMid,
    borderRadius: R.full,
    paddingHorizontal: S.sm,
    paddingVertical: 3,
  },
  aiChipText: { fontSize: F.xs, fontWeight: '700', color: C.accent },

  actionList: { paddingHorizontal: S.lg },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S.md,
    gap: S.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: { flex: 1 },
  actionLabel:   { fontSize: F.base, fontWeight: '600', color: C.text },
  actionSub:     { fontSize: F.xs, color: C.textMuted, marginTop: 1 },
  divider:       { height: 1, backgroundColor: C.border, marginLeft: 38 + S.md },
});
