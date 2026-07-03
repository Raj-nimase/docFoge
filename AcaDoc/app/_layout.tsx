import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/theme';

function AuthGate() {
  const router   = useRouter();
  const segments = useSegments();
  const status   = useAuthStore(s => s.status);

  useEffect(() => {
    if (status === 'loading') return;

    const inAuth = segments[0] === '(auth)';

    if (status === 'unauthenticated' && !inAuth) {
      router.replace('/(auth)/login');
    } else if (status === 'authenticated' && inAuth) {
      router.replace('/(tabs)');
    }
  }, [status, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const C           = Colors[colorScheme];
  const bootstrap   = useAuthStore(s => s.bootstrap);
  const status      = useAuthStore(s => s.status);

  // Bootstrap on first mount — loads stored JWT and validates it
  useEffect(() => { bootstrap(); }, []);

  // Splash while checking auth
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          {/* Full-screen modal routes */}
          <Stack.Screen name="editor/[projectId]" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="compile/[projectId]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="new-project"         options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
