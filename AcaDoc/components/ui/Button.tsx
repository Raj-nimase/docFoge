import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { Brand, Radius, FontSize, Space } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, style, textStyle, fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#fff' : Brand.accent}
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`], textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  fullWidth: { width: '100%' },

  // Sizes
  size_sm: { paddingHorizontal: Space.md, paddingVertical: Space.sm - 2, minHeight: 36 },
  size_md: { paddingHorizontal: Space.lg, paddingVertical: Space.md - 2, minHeight: 48 },
  size_lg: { paddingHorizontal: Space.xl, paddingVertical: Space.lg - 2, minHeight: 56 },

  // Variants
  variant_primary: { backgroundColor: Brand.accent },
  variant_secondary: { backgroundColor: Brand.accentLight, borderWidth: 1, borderColor: Brand.accent + '40' },
  variant_ghost: { backgroundColor: 'transparent' },
  variant_danger: { backgroundColor: Brand.error },

  disabled: { opacity: 0.5 },

  // Labels
  label: { fontWeight: '600' },
  label_primary: { color: '#fff' },
  label_secondary: { color: Brand.accent },
  label_ghost: { color: Brand.accent },
  label_danger: { color: '#fff' },

  labelSize_sm: { fontSize: FontSize.sm },
  labelSize_md: { fontSize: FontSize.base },
  labelSize_lg: { fontSize: FontSize.md },
});
