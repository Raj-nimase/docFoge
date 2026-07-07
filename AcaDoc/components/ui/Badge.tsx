import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { C, R, F, S } from '@/constants/theme';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'accent' | 'warm';

const BG: Record<BadgeVariant, string>   = {
  default: C.surface,
  success: C.successBg,
  error:   C.errorBg,
  warning: C.warningBg,
  accent:  C.accentGlow,
  warm:    'rgba(154,123,95,0.12)',
};
const TC: Record<BadgeVariant, string>   = {
  default: C.textMuted,
  success: C.success,
  error:   C.error,
  warning: C.warning,
  accent:  C.accent,
  warm:    C.accentWarm,
};

interface BadgeProps {
  label:    string;
  variant?: BadgeVariant;
  style?:   ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: BG[variant] }, style]}>
      <Text style={[styles.label, { color: TC[variant] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: S.sm,
    paddingVertical: 3,
    borderRadius: R.full,
  },
  label: {
    fontSize: F.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
