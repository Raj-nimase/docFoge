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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const resetPassword = useAuthStore(s => s.resetPassword);

  const [email, setEmail]           = useState('');
  const [newPassword, setNewPwd]    = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [fieldErr, setFieldErr]     = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!newPassword) errs.newPassword = 'New password is required';
    else if (newPassword.length < 8) errs.newPassword = 'At least 8 characters';
    if (newPassword !== confirm) errs.confirm = 'Passwords do not match';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleReset() {
    if (!validate()) return;
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim(), newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Reset failed. Check your email is registered.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.successWrap, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <View style={[styles.successIcon, { backgroundColor: Colors[scheme].successLight }]}>
          <Ionicons name="checkmark-circle" size={48} color={Brand.success} />
        </View>
        <Text style={[styles.successTitle, { color: C.text }]}>Password reset!</Text>
        <Text style={[styles.successSub, { color: C.textMuted }]}>You're now signed in with your new password.</Text>
        <Button label="Continue" onPress={() => router.replace('/(tabs)')} style={{ marginTop: Space.xl }} />
      </View>
    );
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>

        <Text style={[styles.heading, { color: C.text }]}>Reset password</Text>
        <Text style={[styles.sub, { color: C.textMuted }]}>Enter your email and choose a new password.</Text>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: Colors[scheme].errorLight }]}>
            <Ionicons name="alert-circle-outline" size={16} color={Brand.error} />
            <Text style={[styles.errorText, { color: Brand.error }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Input label="Email" placeholder="you@example.com" value={email}
            onChangeText={v => { setEmail(v); setFieldErr(e => ({ ...e, email: '' })); }}
            keyboardType="email-address" error={fieldErr.email} />
          <Input label="New password" placeholder="Min 8 characters" value={newPassword}
            onChangeText={v => { setNewPwd(v); setFieldErr(e => ({ ...e, newPassword: '' })); }}
            secureTextEntry={!showPwd} error={fieldErr.newPassword}
            rightIcon={<Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textMuted} />}
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
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: Space.lg },
  successTitle: { fontSize: FontSize.xl, fontWeight: '800', marginBottom: Space.sm },
  successSub: { fontSize: FontSize.base, textAlign: 'center' },
});
