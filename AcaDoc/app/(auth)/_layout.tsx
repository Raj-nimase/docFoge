import { Stack } from 'expo-router';
import { C } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: C.bg },
    }} />
  );
}
