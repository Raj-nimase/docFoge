import React, { useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  StyleSheet, TextInputProps, ViewStyle,
} from 'react-native';
import { C, R, F, S } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?:          string;
  error?:          string;
  hint?:           string;
  containerStyle?: ViewStyle;
  rightIcon?:      React.ReactNode;
  onRightIconPress?: () => void;
}

export function Input({
  label, error, hint, containerStyle,
  rightIcon, onRightIconPress,
  style, ...props
}: InputProps) {
  const borderColor = error ? C.error : C.border;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      <View style={[
        styles.field,
        { borderColor }
      ]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={C.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            hitSlop={8}
            onPressIn={e => e.stopPropagation()}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { gap: 6 },
  label:  { fontSize: F.sm, fontWeight: '600', color: C.textMuted, letterSpacing: 0.1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: R.md,
    backgroundColor: C.card,
    paddingHorizontal: S.md,
    minHeight: 48,
  },
  fieldFocused: {
    backgroundColor: C.white,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  input: {
    flex: 1,
    fontSize: F.base,
    color: C.text,
    paddingVertical: S.sm,
  },
  rightIcon: { paddingLeft: S.sm },
  error: { fontSize: F.xs, color: C.error, fontWeight: '500' },
  hint:  { fontSize: F.xs, color: C.textFaint },
});
