import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { C, R, S, shadows } from '@/constants/theme';

interface CardProps {
  children:  React.ReactNode;
  style?:    ViewStyle;
  padding?:  number;
  onPress?:  () => void;
  elevated?: boolean;
}

export function Card({ children, style, padding = S.lg, onPress, elevated = false }: CardProps) {
  const base = [
    styles.card,
    elevated && shadows.strong,
    !elevated && shadows.card,
    { padding },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={base}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
});
