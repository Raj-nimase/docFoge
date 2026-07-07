import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { C, F, S, R, shadows } from '@/constants/theme';
import { Colors, Brand, Space, FontSize, Radius } from '@/constants/theme';

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={ps.avatar}>
      <Text style={ps.avatarText}>{initials}</Text>
    </View>
  );
}

// ── Row item ───────────────────────────────────────────────────────────────────

function RowItem({ icon, label, value, onPress, destructive = false }: {
  icon: string; label: string; value?: string;
  onPress?: () => void; destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={ps.rowItem}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[ps.rowIcon, destructive && ps.rowIconDestructive]}>
        <Ionicons
          name={icon as any} size={18}
          color={destructive ? C.error : C.accent}
        />
      </View>
      <View style={ps.rowContent}>
        <Text style={[ps.rowLabel, destructive && { color: C.error }]}>{label}</Text>
        {value ? <Text style={ps.rowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {onPress && !destructive && (
        <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
      )}
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  const user          = useAuthStore(s => s.user);
  const logout        = useAuthStore(s => s.logout);
  const updateProfile = useAuthStore(s => s.updateProfile);
  const resetProjects = useProjectStore(s => s.reset);
  const projectCount  = useProjectStore(s => s.projects.length);

  const [editOpen, setEditOpen] = useState(false);

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => { resetProjects(); await logout(); },
      },
    ]);
  }

  if (!user) return null;

  return (
    <View style={[ps.screen, { backgroundColor: C.bg }]}>

      {/* ── Header ── */}
      <View style={[ps.header, { paddingTop: insets.top + S.md }]}>
        <Text style={ps.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={[ps.scroll, { paddingBottom: insets.bottom + S.xl }]}
      >
        {/* ── User hero card ── */}
        <View style={ps.heroCard}>
          <View style={ps.heroTop}>
            <Avatar name={user.name} />
            <View style={ps.userInfo}>
              <Text style={ps.userName}>{user.name}</Text>
              <Text style={ps.userEmail}>{user.email}</Text>
              {user.role ? (
                <View style={ps.roleBadge}>
                  <Text style={ps.roleText}>{user.role}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => setEditOpen(true)}
              style={ps.editBtn}
              hitSlop={8}
            >
              <Ionicons name="pencil-outline" size={16} color={C.accent} />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={ps.statsRow}>
            <StatChip label="Projects" value={String(projectCount)} icon="folder-open-outline" />
            <View style={ps.statsDivider} />
            <StatChip label="Output" value="PDF" icon="document-outline" />
            <View style={ps.statsDivider} />
            <StatChip label="Engine" value="LaTeX" icon="code-slash-outline" />
          </View>
        </View>

        {/* ── Account ── */}
        <SectionLabel label="ACCOUNT" />
        <View style={ps.listCard}>
          <RowItem
            icon="person-circle-outline"
            label="Edit profile"
            value={user.institution || 'Update your details'}
            onPress={() => setEditOpen(true)}
          />
          <Divider />
          <RowItem
            icon="business-outline"
            label="Institution"
            value={user.institution || 'Not set'}
          />
          <Divider />
          <RowItem
            icon="school-outline"
            label="Department"
            value={user.department || 'Not set'}
          />
        </View>

        {/* ── App info ── */}
        <SectionLabel label="APP" />
        <View style={ps.listCard}>
          <RowItem
            icon="document-text-outline"
            label="Total projects"
            value={`${projectCount} project${projectCount !== 1 ? 's' : ''}`}
          />
          <Divider />
          <RowItem icon="information-circle-outline" label="Version" value="1.0.0" />
        </View>

        {/* ── Sign out ── */}
        <View style={ps.listCard}>
          <RowItem
            icon="log-out-outline"
            label="Sign out"
            onPress={handleLogout}
            destructive
          />
        </View>
      </ScrollView>

      {/* Edit profile modal */}
      <EditProfileModal
        visible={editOpen}
        user={user}
        onClose={() => setEditOpen(false)}
        onSave={async fields => { await updateProfile(fields); setEditOpen(false); }}
      />
    </View>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={ps.statChip}>
      <Ionicons name={icon as any} size={16} color={C.accent} />
      <Text style={ps.statValue}>{value}</Text>
      <Text style={ps.statLabel}>{label}</Text>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={ps.sectionLabel}>{label}</Text>;
}

function Divider() {
  return <View style={ps.divider} />;
}

// ── Edit profile modal ────────────────────────────────────────────────────────

function EditProfileModal({ visible, user, onClose, onSave }: {
  visible: boolean; user: any;
  onClose: () => void;
  onSave: (fields: any) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();

  const [name,       setName]    = useState(user?.name ?? '');
  const [role,       setRole]    = useState(user?.role ?? '');
  const [institution, setInst]  = useState(user?.institution ?? '');
  const [department,  setDept]  = useState(user?.department ?? '');
  const [loading,    setLoading] = useState(false);
  const [nameErr,    setNameErr] = useState('');

  React.useEffect(() => {
    if (visible) {
      setName(user?.name ?? '');
      setRole(user?.role ?? '');
      setInst(user?.institution ?? '');
      setDept(user?.department ?? '');
      setNameErr('');
    }
  }, [visible, user]);

  async function handleSave() {
    if (!name.trim()) { setNameErr('Name is required'); return; }
    setLoading(true);
    try {
      await onSave({ name: name.trim(), role: role.trim(), institution: institution.trim(), department: department.trim() });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[ps.modalHeader, { paddingTop: insets.top + S.sm }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={ps.modalHeaderTitle}>Edit Profile</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView contentContainerStyle={ps.modalScroll} keyboardShouldPersistTaps="handled">
          <View style={ps.form}>
            <Input label="Full name *" value={name}
              onChangeText={v => { setName(v); setNameErr(''); }}
              error={nameErr} autoCapitalize="words" placeholder="Your name" />
            <Input label="Role" value={role} onChangeText={setRole}
              placeholder="e.g. Student" autoCapitalize="words" />
            <Input label="Institution" value={institution} onChangeText={setInst}
              placeholder="College / University" autoCapitalize="words" />
            <Input label="Department" value={department} onChangeText={setDept}
              placeholder="e.g. Computer Engineering" autoCapitalize="words" />
            <Button label="Save changes" onPress={handleSave} loading={loading} size="lg" style={{ marginTop: S.sm }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const ps = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    ...shadows.card,
  },
  headerTitle: { fontSize: F.xl, fontWeight: '800', color: C.text },
  scroll: { padding: S.lg, gap: S.md },

  // Hero card
  heroCard: {
    backgroundColor: C.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.accentGlow,
    borderWidth: 2, borderColor: C.accentMid,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: F.xl, fontWeight: '800', color: C.accent },
  userInfo:   { flex: 1 },
  userName:   { fontSize: F.lg, fontWeight: '700', color: C.text },
  userEmail:  { fontSize: F.sm, color: C.textMuted, marginTop: 2 },
  roleBadge:  {
    alignSelf: 'flex-start',
    backgroundColor: C.accentGlow,
    borderWidth: 1,
    borderColor: C.accentMid,
    borderRadius: R.full,
    paddingHorizontal: S.sm,
    paddingVertical: 2,
    marginTop: S.xs,
  },
  roleText:   { fontSize: F.xs, fontWeight: '600', color: C.accent },
  editBtn: {
    width: 34, height: 34, borderRadius: R.md,
    backgroundColor: C.accentGlow,
    borderWidth: 1, borderColor: C.accentMid,
    alignItems: 'center', justifyContent: 'center',
  },

  statsRow:     { flexDirection: 'row', padding: S.md },
  statsDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  statChip:     { flex: 1, alignItems: 'center', gap: S.xs, paddingVertical: S.xs },
  statValue:    { fontSize: F.md, fontWeight: '800', color: C.text },
  statLabel:    { fontSize: F.xs, color: C.textFaint },

  // Section label
  sectionLabel: {
    fontSize: F.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: C.textFaint,
    marginBottom: -S.xs,
    marginTop: S.xs,
  },

  // List card
  listCard: {
    backgroundColor: C.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: R.md,
    backgroundColor: C.accentGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconDestructive: { backgroundColor: C.errorBg },
  rowContent: { flex: 1 },
  rowLabel:   { fontSize: F.base, fontWeight: '500', color: C.text },
  rowValue:   { fontSize: F.sm, color: C.textMuted, marginTop: 1 },
  divider:    { height: 1, backgroundColor: C.border, marginLeft: S.md + 36 + S.md },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
    ...shadows.card,
  },
  modalHeaderTitle: { fontSize: F.md, fontWeight: '700', color: C.text },
  modalScroll:      { padding: S.lg },
  form:             { gap: S.md },
});
