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

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const register = useAuthStore(s => s.register);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: 'Student', institution: '', department: '',
  });
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setFieldErr(e => ({ ...e, [field]: '' }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim())    errs.name = 'Name is required';
    if (!form.email.trim())   errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password)       errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'At least 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setError('');
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role.trim() || 'Student',
        institution: form.institution.trim(),
        department: form.department.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Space.lg, paddingBottom: insets.bottom + Space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>

        <Text style={[styles.heading, { color: C.text }]}>Create account</Text>
        <Text style={[styles.sub, { color: C.textMuted }]}>Start generating professional PDFs</Text>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: Colors[scheme].errorLight }]}>
            <Ionicons name="alert-circle-outline" size={16} color={Brand.error} />
            <Text style={[styles.errorText, { color: Brand.error }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Input label="Full name" placeholder="Your name" value={form.name}
            onChangeText={v => set('name', v)} error={fieldErr.name} autoComplete="name" />
          <Input label="Email" placeholder="you@example.com" value={form.email}
            onChangeText={v => set('email', v)} keyboardType="email-address"
            error={fieldErr.email} autoComplete="email" />
          <Input label="Password" placeholder="Min 8 characters" value={form.password}
            onChangeText={v => set('password', v)} secureTextEntry={!showPwd}
            error={fieldErr.password}
            rightIcon={<Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textMuted} />}
            onRightIconPress={() => setShowPwd(v => !v)} />
          <Input label="Confirm password" placeholder="Repeat password" value={form.confirmPassword}
            onChangeText={v => set('confirmPassword', v)} secureTextEntry={!showPwd}
            error={fieldErr.confirmPassword} />

          {/* Optional fields */}
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>Optional details</Text>
          <Input label="Role" placeholder="e.g. Student, Researcher" value={form.role}
            onChangeText={v => set('role', v)} />
          <Input label="Institution" placeholder="College / University" value={form.institution}
            onChangeText={v => set('institution', v)} autoCapitalize="words" />
          <Input label="Department" placeholder="e.g. Computer Engineering" value={form.department}
            onChangeText={v => set('department', v)} autoCapitalize="words" />

          <Button label="Create account" onPress={handleRegister} loading={loading} size="lg" />
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: C.textMuted }]}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={[styles.bottomLink, { color: Brand.accent }]}> Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: Space.xl },
  backBtn: { marginBottom: Space.lg },
  heading: { fontSize: FontSize['2xl'], fontWeight: '800', marginBottom: Space.xs },
  sub: { fontSize: FontSize.base, marginBottom: Space.xl },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Space.xs,
    padding: Space.md, borderRadius: Radius.md, marginBottom: Space.md,
  },
  errorText: { fontSize: FontSize.sm, flex: 1 },
  form: { gap: Space.md },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Space.sm },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Space.xl },
  bottomText: { fontSize: FontSize.base },
  bottomLink: { fontSize: FontSize.base, fontWeight: '600' },
});
