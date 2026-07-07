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
import { C, S, R, F } from '@/constants/theme';

export default function RegisterScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const register = useAuthStore(s => s.register);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '',
    role: 'Student', institution: '', department: '',
  });
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  function upd(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setFieldErr(e => ({ ...e, [k]: '' }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())                       e.name    = 'Name is required';
    if (!form.email.trim())                       e.email   = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email))   e.email   = 'Enter a valid email';
    if (!form.password)                           e.password = 'Password is required';
    else if (form.password.length < 8)            e.password = 'At least 8 characters';
    if (form.password !== form.confirm)            e.confirm = 'Passwords do not match';
    setFieldErr(e);
    return !Object.keys(e).length;
  }

  async function handleRegister() {
    if (!validate()) return;
    setError(''); setLoading(true);
    try {
      await register({
        name: form.name.trim(), email: form.email.trim(),
        password: form.password,
        role: form.role.trim() || 'Student',
        institution: form.institution.trim(),
        department: form.department.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={[st.screen, { backgroundColor: C.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={Platform.OS === 'ios'}>
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingTop: insets.top + S.lg, paddingBottom: insets.bottom + S['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={st.back}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>

        <Text style={st.heading}>Create account</Text>
        <Text style={st.sub}>Join thousands of students and researchers</Text>

        {!!error && (
          <View style={st.errBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={C.error} />
            <Text style={st.errText}>{error}</Text>
          </View>
        )}

        <View style={st.form}>
          <Input label="Full name" placeholder="Your name" value={form.name}
            onChangeText={v => upd('name', v)} error={fieldErr.name} autoCapitalize="words" autoComplete="name" />
          <Input label="Email" placeholder="you@example.com" value={form.email}
            onChangeText={v => upd('email', v)} keyboardType="email-address" error={fieldErr.email} autoComplete="email" />
          <Input label="Password" placeholder="Min 8 characters" value={form.password}
            onChangeText={v => upd('password', v)} secureTextEntry={!showPwd} error={fieldErr.password}
            rightIcon={<Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textFaint} />}
            onRightIconPress={() => setShowPwd(v => !v)} />
          <Input label="Confirm password" placeholder="Repeat password" value={form.confirm}
            onChangeText={v => upd('confirm', v)} secureTextEntry={!showPwd} error={fieldErr.confirm} />

          <View style={st.divider}><View style={st.dividerLine} /><Text style={st.dividerText}>Optional details</Text><View style={st.dividerLine} /></View>

          <Input label="Role" placeholder="Student / Researcher / Faculty" value={form.role}
            onChangeText={v => upd('role', v)} autoCapitalize="words" />
          <Input label="Institution" placeholder="College / University" value={form.institution}
            onChangeText={v => upd('institution', v)} autoCapitalize="words" />
          <Input label="Department" placeholder="e.g. Computer Engineering" value={form.department}
            onChangeText={v => upd('department', v)} autoCapitalize="words" />

          <Button label="Create account" onPress={handleRegister} loading={loading} size="lg" style={{ marginTop: S.sm }} />
        </View>

        <TouchableOpacity onPress={() => router.back()} style={st.signinBtn}>
          <Text style={st.signinText}>Already have an account? <Text style={st.signinLink}>Sign in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  screen:      { flex: 1 },
  scroll:      { flexGrow: 1, paddingHorizontal: S.xl },
  back:        { marginBottom: S.xl },
  heading:     { fontSize: F['2xl'], fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: S.xs },
  sub:         { fontSize: F.base, color: C.textMuted, marginBottom: S['2xl'], lineHeight: 22 },
  errBanner:   { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.errorBg, borderRadius: R.md, padding: S.md, marginBottom: S.md, borderLeftWidth: 3, borderLeftColor: C.error },
  errText:     { fontSize: F.sm, color: C.error, flex: 1, fontWeight: '500' },
  form:        { gap: S.md },
  divider:     { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginVertical: S.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  dividerText: { fontSize: F.xs, color: C.textFaint, fontWeight: '600', letterSpacing: 0.5 },
  signinBtn:   { alignItems: 'center', paddingVertical: S.md, marginTop: S.lg },
  signinText:  { fontSize: F.base, color: C.textMuted },
  signinLink:  { color: C.accent, fontWeight: '700' },
});
