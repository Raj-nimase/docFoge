import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Brand, Space, FontSize, Radius } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const login = useAuthStore(s => s.login);

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [fieldErr, setFieldErr]   = useState<{ email?: string; password?: string }>({});

  function validate() {
    const errs: typeof fieldErr = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Root layout will redirect to (tabs) on auth state change
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Space['2xl'], paddingBottom: insets.bottom + Space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={[styles.logoIcon, { backgroundColor: Brand.accentLight }]}>
            <Text style={styles.logoEmoji}>⬡</Text>
          </View>
          <Text style={[styles.logoName, { color: C.text }]}>AcaDoc</Text>
        </View>

        <Text style={[styles.heading, { color: C.text }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: C.textMuted }]}>Sign in to your account</Text>

        {/* Error banner */}
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: Colors[scheme].errorLight }]}>
            <Ionicons name="alert-circle-outline" size={16} color={Brand.error} />
            <Text style={[styles.errorText, { color: Brand.error }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={v => { setEmail(v); setFieldErr(e => ({ ...e, email: undefined })); }}
            keyboardType="email-address"
            error={fieldErr.email}
            autoComplete="email"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={v => { setPassword(v); setFieldErr(e => ({ ...e, password: undefined })); }}
            secureTextEntry={!showPwd}
            error={fieldErr.password}
            autoComplete="password"
            rightIcon={
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textMuted} />
            }
            onRightIconPress={() => setShowPwd(v => !v)}
          />

          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotWrap}>
            <Text style={[styles.forgot, { color: Brand.accent }]}>Forgot password?</Text>
          </TouchableOpacity>

          <Button label="Sign in" onPress={handleLogin} loading={loading} size="lg" />
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: C.textMuted }]}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.bottomLink, { color: Brand.accent }]}> Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: Space.xl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space['2xl'] },
  logoIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 22 },
  logoName: { fontSize: FontSize.xl, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: FontSize['2xl'], fontWeight: '800', marginBottom: Space.xs },
  sub: { fontSize: FontSize.base, marginBottom: Space.xl },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Space.xs,
    padding: Space.md, borderRadius: Radius.md, marginBottom: Space.md,
  },
  errorText: { fontSize: FontSize.sm, flex: 1 },
  form: { gap: Space.lg },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -Space.xs },
  forgot: { fontSize: FontSize.sm, fontWeight: '500' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Space.xl },
  bottomText: { fontSize: FontSize.base },
  bottomLink: { fontSize: FontSize.base, fontWeight: '600' },
});
