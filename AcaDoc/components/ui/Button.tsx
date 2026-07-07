import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, View,
} from 'react-native';
import { C, R, F, S } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warm';
type Size    = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?:   Variant;
  size?:      Size;
  loading?:   boolean;
  disabled?:  boolean;
  style?:     ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  icon?:      React.ReactNode;
}

const BG: Record<Variant, string>          = {
  primary:   C.accent,
  secondary: C.card,
  ghost:     'transparent',
  danger:    C.error,
  warm:      C.accentWarm,
};
const BORDER_COL: Record<Variant, string>  = {
  primary:   C.accent,
  secondary: C.border,
  ghost:     C.border,
  danger:    C.error,
  warm:      C.accentWarm,
};
const TEXT_COL: Record<Variant, string>    = {
  primary:   C.white,
  secondary: C.text,
  ghost:     C.textMuted,
  danger:    C.white,
  warm:      C.white,
};

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false,
  style, textStyle, fullWidth = true, icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.78}
      style={[
        styles.base,
        { backgroundColor: BG[variant], borderColor: BORDER_COL[variant] },
        size === 'xs' && styles.sizeXs,
        size === 'sm' && styles.sizeSm,
        size === 'md' && styles.sizeMd,
        size === 'lg' && styles.sizeLg,
        fullWidth  && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={TEXT_COL[variant]} />
      ) : (
        <View style={styles.inner}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[
            styles.label,
            { color: TEXT_COL[variant] },
            size === 'xs' && styles.labelXs,
            size === 'sm' && styles.labelSm,
            size === 'md' && styles.labelMd,
            size === 'lg' && styles.labelLg,
            textStyle,
          ]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth:  { width: '100%' },
  disabled:   { opacity: 0.45 },
  inner:      { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  iconWrap:   { alignItems: 'center', justifyContent: 'center' },

  // Sizes
  sizeXs:  { paddingHorizontal: S.sm,    paddingVertical: 4,  minHeight: 28, borderRadius: R.sm },
  sizeSm:  { paddingHorizontal: S.md,    paddingVertical: 7,  minHeight: 36 },
  sizeMd:  { paddingHorizontal: S.lg,    paddingVertical: 11, minHeight: 46 },
  sizeLg:  { paddingHorizontal: S.xl,    paddingVertical: 14, minHeight: 52, borderRadius: R.lg },

  // Labels
  label:    { fontWeight: '600', letterSpacing: 0.1 },
  labelXs:  { fontSize: F.xs },
  labelSm:  { fontSize: F.sm },
  labelMd:  { fontSize: F.base },
  labelLg:  { fontSize: F.md },
});
