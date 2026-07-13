import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { useAuthStore } from '@/stores/authStore';
import { C } from '@/constants/theme';
import { GlobalEditor } from '@/components/GlobalEditor';
import { GlobalDrawer } from '@/components/GlobalDrawer';

// Prevent splash screen auto hide to allow fonts to load
SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGate() {
  const router   = useRouter();
  const segments = useSegments();
  const status   = useAuthStore(s => s.status);

  // Derive a stable primitive from segments so the effect only re-runs
  // when the auth-relevant part of the route actually changes,
  // not on every navigation (segments is a new array ref each time).
  const inAuth = segments[0] === '(auth)';

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' && !inAuth) router.replace('/(auth)/login');
    else if (status === 'authenticated' && inAuth) router.replace('/(tabs)');
  }, [status, inAuth]);

  return null;
}

export default function RootLayout() {
  const bootstrap = useAuthStore(s => s.bootstrap);
  const status    = useAuthStore(s => s.status);

  const [fontsLoaded] = useFonts({
    'PlayfairDisplay-Bold': require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
    'HankenGrotesk-Regular': require('../assets/fonts/HankenGrotesk-Regular.ttf'),
    'HankenGrotesk-Medium': require('../assets/fonts/HankenGrotesk-Medium.ttf'),
    'HankenGrotesk-SemiBold': require('../assets/fonts/HankenGrotesk-SemiBold.ttf'),
    'HankenGrotesk-Bold': require('../assets/fonts/HankenGrotesk-Bold.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'JetBrainsMono-Medium': require('../assets/fonts/JetBrainsMono-Medium.ttf'),
    'Merriweather-Bold': require('../assets/fonts/Merriweather-Bold.ttf'),
  });

  useEffect(() => { bootstrap(); }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (status === 'loading' || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="editor/[projectId]" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="compile/[projectId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="pdf-preview/[projectId]" options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="new-project" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      </Stack>
      <GlobalEditor />
      <GlobalDrawer />
      <StatusBar style="dark" backgroundColor={C.surface} />
    </SafeAreaProvider>
  );
}
