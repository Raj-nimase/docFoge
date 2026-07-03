import React, { useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  StyleSheet, TextInputProps, ViewStyle,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Brand, Radius, Space, FontSize } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export function Input({
  label, error, containerStyle, rightIcon, onRightIconPress, style, ...props
}: InputProps) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: C.textMuted }]}>{label}</Text>
      )}
      <View style={[
        styles.inputWrap,
        { backgroundColor: C.surface, borderColor: error ? Brand.error : C.border },
      ]}>
        <TextInput
          style={[styles.input, { color: C.text }, style]}
          placeholderTextColor={C.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: '500' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: FontSize.base, paddingVertical: Space.sm },
  rightIcon: { paddingLeft: Space.sm },
  error: { fontSize: FontSize.xs, color: Brand.error },
});
