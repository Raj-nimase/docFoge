import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, FontSize, Space } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack = false, rightElement }: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];

  return (
    <View style={[
      styles.header,
      { paddingTop: insets.top + Space.sm, backgroundColor: C.surface, borderBottomColor: C.border },
    ]}>
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
        )}
        <View style={styles.titles}>
          <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: C.textMuted }]} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
        {rightElement && <View style={styles.right}>{rightElement}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  backBtn: { marginRight: Space.xs },
  titles: { flex: 1 },
  right: { marginLeft: Space.sm },
  title: { fontSize: FontSize.lg, fontWeight: '700' },
  subtitle: { fontSize: FontSize.sm, marginTop: 2 },
});
