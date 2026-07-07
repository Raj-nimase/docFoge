import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '@/constants/theme';

export function Divider({ indent = 0 }: { indent?: number }) {
  return <View style={[styles.line, { marginLeft: indent }]} />;
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
});
