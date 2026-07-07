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

export default function ForgotPasswordScreen() {
  const router        = useRouter();
  const insets        = useSafeAreaInsets();
  const resetPassword = useAuthStore(s => s.resetPassword);

  const [email, setEmail]     = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!email.trim())                    e.email  = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email  = 'Enter a valid email';
    if (!newPwd)                           e.newPwd = 'Password is required';
    else if (newPwd.length < 8)            e.newPwd = 'At least 8 characters';
    if (newPwd !== confirm)                e.confirm = 'Passwords do not match';
    setFieldErr(e);
    return !Object.keys(e).length;
  }

  async function handleReset() {
    if (!validate()) return;
    setError(''); setLoading(true);
    try { await resetPassword(email.trim(), newPwd); setDone(true); }
    catch (err: any) { setError(err.message || 'Reset failed. Check your email.'); }
    finally { setLoading(false); }
  }

  if (done) {
    return (
      <View style={[st.successScreen, { paddingTop: insets.top, backgroundColor: C.bg }]}>
        <View style={st.successIconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={C.success} />
        </View>
        <Text style={st.successTitle}>Password reset!</Text>
        <Text style={st.successSub}>You're now signed in with your new password.</Text>
        <Button label="Go to projects" onPress={() => router.replace('/(tabs)')} style={{ marginTop: S.xl }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[st.screen, { backgroundColor: C.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={Platform.OS === 'ios'}>
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingTop: insets.top + S.lg, paddingBottom: insets.bottom + S['2xl'] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={st.back}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>

        <View style={st.iconHeader}>
          <View style={st.iconCircle}>
            <Ionicons name="lock-closed-outline" size={28} color={C.accent} />
          </View>
        </View>

        <Text style={st.heading}>Reset password</Text>
        <Text style={st.sub}>Enter your registered email and set a new password.</Text>

        {!!error && (
          <View style={st.errBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={C.error} />
            <Text style={st.errText}>{error}</Text>
          </View>
        )}

        <View style={st.form}>
          <Input label="Email" placeholder="you@example.com" value={email}
            onChangeText={v => { setEmail(v); setFieldErr(e => ({ ...e, email: '' })); }}
            keyboardType="email-address" error={fieldErr.email} />
          <Input label="New password" placeholder="Min 8 characters" value={newPwd}
            onChangeText={v => { setNewPwd(v); setFieldErr(e => ({ ...e, newPwd: '' })); }}
            secureTextEntry={!showPwd} error={fieldErr.newPwd}
            rightIcon={<Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textFaint} />}
            onRightIconPress={() => setShowPwd(v => !v)} />
          <Input label="Confirm new password" placeholder="Repeat password" value={confirm}
            onChangeText={v => { setConfirm(v); setFieldErr(e => ({ ...e, confirm: '' })); }}
            secureTextEntry={!showPwd} error={fieldErr.confirm} />
          <Button label="Reset password" onPress={handleReset} loading={loading} size="lg" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  screen:         { flex: 1 },
  scroll:         { flexGrow: 1, paddingHorizontal: S.xl },
  back:           { marginBottom: S.lg },
  iconHeader:     { marginBottom: S.xl },
  iconCircle:     { width: 60, height: 60, borderRadius: R.xl, backgroundColor: C.accentGlow, alignItems: 'center', justifyContent: 'center' },
  heading:        { fontSize: F['2xl'], fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: S.xs },
  sub:            { fontSize: F.base, color: C.textMuted, marginBottom: S['2xl'], lineHeight: 22 },
  errBanner:      { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.errorBg, borderRadius: R.md, padding: S.md, marginBottom: S.md, borderLeftWidth: 3, borderLeftColor: C.error },
  errText:        { fontSize: F.sm, color: C.error, flex: 1, fontWeight: '500' },
  form:           { gap: S.md },
  successScreen:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  successIconWrap:{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: S.xl },
  successTitle:   { fontSize: F.xl, fontWeight: '800', color: C.text, marginBottom: S.sm },
  successSub:     { fontSize: F.base, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
});
