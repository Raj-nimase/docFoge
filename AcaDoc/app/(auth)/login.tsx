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
import { C, S, R, F, shadows } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login  = useAuthStore(s => s.login);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const e: typeof fieldErr = {};
    if (!email.trim())                    e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email    = 'Enter a valid email';
    if (!password)                         e.password = 'Password is required';
    setFieldErr(e);
    return !Object.keys(e).length;
  }

  async function handleLogin() {
    if (!validate()) return;
    setError(''); setLoading(true);
    try { await login(email.trim(), password); }
    catch (err: any) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView
      style={[st.screen, { backgroundColor: C.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingTop: insets.top + S['3xl'], paddingBottom: insets.bottom + S['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={st.brand}>
          <View style={st.brandMark}>
            <Text style={st.brandHex}>⬡</Text>
          </View>
          <View>
            <Text style={st.brandName}>AcaDoc</Text>
            <Text style={st.brandTagline}>Academic Document Platform</Text>
          </View>
        </View>

        <Text style={st.heading}>Welcome back</Text>
        <Text style={st.sub}>Sign in to your workspace</Text>

        {!!error && (
          <View style={st.errBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={C.error} />
            <Text style={st.errText}>{error}</Text>
          </View>
        )}

        <View style={st.form}>
          <Input
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={v => { setEmail(v); setFieldErr(p => ({ ...p, email: undefined })); }}
            keyboardType="email-address"
            error={fieldErr.email}
            autoComplete="email"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={v => { setPassword(v); setFieldErr(p => ({ ...p, password: undefined })); }}
            secureTextEntry={!showPwd}
            error={fieldErr.password}
            rightIcon={<Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textFaint} />}
            onRightIconPress={() => setShowPwd(v => !v)}
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={st.forgotRow}>
            <Text style={st.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
          <Button label="Sign in" onPress={handleLogin} loading={loading} size="lg" />
        </View>

        <View style={st.dividerRow}>
          <View style={st.dividerLine} /><Text style={st.dividerText}>or</Text><View style={st.dividerLine} />
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={st.signupBtn}>
          <Text style={st.signupText}>
            Don't have an account? <Text style={st.signupLink}>Create one free</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: S.xl },

  brand:       { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S['3xl'] },
  brandMark:   { width: 48, height: 48, borderRadius: R.lg, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  brandHex:    { fontSize: 24, color: C.white },
  brandName:   { fontSize: F.xl, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  brandTagline:{ fontSize: F.xs, color: C.textFaint, marginTop: 1 },

  heading: { fontSize: F['2xl'], fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: S.xs },
  sub:     { fontSize: F.base, color: C.textMuted, marginBottom: S['2xl'], lineHeight: 22 },

  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.errorBg, borderRadius: R.md,
    padding: S.md, marginBottom: S.md,
    borderLeftWidth: 3, borderLeftColor: C.error,
  },
  errText: { fontSize: F.sm, color: C.error, flex: 1, fontWeight: '500' },

  form:       { gap: S.lg },
  forgotRow:  { alignSelf: 'flex-end', marginTop: -S.xs },
  forgotText: { fontSize: F.sm, color: C.accentLight, fontWeight: '600' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: S.md, marginVertical: S.xl },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  dividerText: { fontSize: F.sm, color: C.textFaint, fontWeight: '500' },

  signupBtn:  { alignItems: 'center', paddingVertical: S.sm },
  signupText: { fontSize: F.base, color: C.textMuted },
  signupLink: { color: C.accent, fontWeight: '700' },
});
