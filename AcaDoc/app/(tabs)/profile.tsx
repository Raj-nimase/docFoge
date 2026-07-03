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
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Brand, Space, FontSize, Radius } from '@/constants/theme';

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={[styles.avatar, { backgroundColor: Brand.accentLight }]}>
      <Text style={[styles.avatarText, { color: Brand.accent }]}>{initials}</Text>
    </View>
  );
}

function RowItem({ icon, label, value, onPress, destructive = false, C }: {
  icon: string; label: string; value?: string; onPress?: () => void; destructive?: boolean; C: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={styles.rowItem}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: destructive ? Colors.light.errorLight : C.accentLight }]}>
        <Ionicons name={icon as any} size={18} color={destructive ? Brand.error : C.accent} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: destructive ? Brand.error : C.text }]}>{label}</Text>
        {value ? <Text style={[styles.rowValue, { color: C.textMuted }]} numberOfLines={1}>{value}</Text> : null}
      </View>
      {onPress && !destructive && <Ionicons name="chevron-forward" size={16} color={C.textSubtle} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const insets  = useSafeAreaInsets();
  const scheme  = useColorScheme() ?? 'light';
  const C       = Colors[scheme];

  const user           = useAuthStore(s => s.user);
  const logout         = useAuthStore(s => s.logout);
  const updateProfile  = useAuthStore(s => s.updateProfile);
  const resetProjects  = useProjectStore(s => s.reset);
  const projectCount   = useProjectStore(s => s.projects.length);

  const [editOpen, setEditOpen] = useState(false);

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          resetProjects();
          await logout();
        },
      },
    ]);
  }

  if (!user) return null;

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Space.md, backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: C.text }]}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Space.xl }]}
      >
        {/* ── User card ── */}
        <Card style={styles.userCard}>
          <View style={styles.userCardInner}>
            <Avatar name={user.name} />
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: C.text }]}>{user.name}</Text>
              <Text style={[styles.userEmail, { color: C.textMuted }]}>{user.email}</Text>
              {user.role ? (
                <View style={[styles.roleBadge, { backgroundColor: C.accentLight }]}>
                  <Text style={[styles.roleText, { color: C.accent }]}>{user.role}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard} padding={Space.md}>
            <Text style={[styles.statNumber, { color: C.text }]}>{projectCount}</Text>
            <Text style={[styles.statLabel, { color: C.textMuted }]}>Projects</Text>
          </Card>
          <Card style={styles.statCard} padding={Space.md}>
            <Text style={[styles.statNumber, { color: C.text }]}>PDF</Text>
            <Text style={[styles.statLabel, { color: C.textMuted }]}>LaTeX output</Text>
          </Card>
        </View>

        {/* ── Account section ── */}
        <Text style={[styles.sectionLabel, { color: C.textMuted }]}>ACCOUNT</Text>
        <Card style={styles.listCard} padding={0}>
          <RowItem
            icon="person-circle-outline"
            label="Edit profile"
            value={user.institution || user.department || 'Update your details'}
            onPress={() => setEditOpen(true)}
            C={C}
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <RowItem
            icon="business-outline"
            label="Institution"
            value={user.institution || 'Not set'}
            C={C}
          />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <RowItem
            icon="school-outline"
            label="Department"
            value={user.department || 'Not set'}
            C={C}
          />
        </Card>

        {/* ── App section ── */}
        <Text style={[styles.sectionLabel, { color: C.textMuted }]}>APP</Text>
        <Card style={styles.listCard} padding={0}>
          <RowItem icon="document-text-outline" label="Total projects" value={`${projectCount} projects`} C={C} />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <RowItem icon="information-circle-outline" label="Version" value="1.0.0" C={C} />
        </Card>

        {/* ── Sign out ── */}
        <Card style={styles.listCard} padding={0}>
          <RowItem icon="log-out-outline" label="Sign out" onPress={handleLogout} destructive C={C} />
        </Card>
      </ScrollView>

      {/* Edit profile modal */}
      <EditProfileModal
        visible={editOpen}
        user={user}
        onClose={() => setEditOpen(false)}
        onSave={async (fields) => {
          await updateProfile(fields);
          setEditOpen(false);
        }}
      />
    </View>
  );
}

function EditProfileModal({ visible, user, onClose, onSave }: {
  visible: boolean;
  user: any;
  onClose: () => void;
  onSave: (fields: any) => Promise<void>;
}) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [name, setName]           = useState(user?.name ?? '');
  const [role, setRole]           = useState(user?.role ?? '');
  const [institution, setInst]    = useState(user?.institution ?? '');
  const [department, setDept]     = useState(user?.department ?? '');
  const [loading, setLoading]     = useState(false);
  const [nameErr, setNameErr]     = useState('');

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
        style={{ flex: 1, backgroundColor: C.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, { paddingTop: insets.top + Space.sm, backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.modalHeaderTitle, { color: C.text }]}>Edit profile</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Input label="Full name *" value={name} onChangeText={v => { setName(v); setNameErr(''); }}
              error={nameErr} autoCapitalize="words" placeholder="Your name" />
            <Input label="Role" value={role} onChangeText={setRole} placeholder="e.g. Student" autoCapitalize="words" />
            <Input label="Institution" value={institution} onChangeText={setInst}
              placeholder="College / University" autoCapitalize="words" />
            <Input label="Department" value={department} onChangeText={setDept}
              placeholder="e.g. Computer Engineering" autoCapitalize="words" />
            <Button label="Save changes" onPress={handleSave} loading={loading} size="lg" style={{ marginTop: Space.sm }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1 },
  header:    { paddingHorizontal: Space.lg, paddingBottom: Space.md, borderBottomWidth: 1 },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800' },
  scroll:    { padding: Space.lg, gap: Space.md },

  userCard:     { },
  userCardInner: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  avatar:       { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: FontSize.xl, fontWeight: '800' },
  userInfo:     { flex: 1 },
  userName:     { fontSize: FontSize.lg, fontWeight: '700' },
  userEmail:    { fontSize: FontSize.sm, marginTop: 2 },
  roleBadge:    { alignSelf: 'flex-start', paddingHorizontal: Space.sm, paddingVertical: 2, borderRadius: Radius.sm, marginTop: Space.xs },
  roleText:     { fontSize: FontSize.xs, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: Space.md },
  statCard: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: FontSize.xl, fontWeight: '800' },
  statLabel:  { fontSize: FontSize.xs, marginTop: 2 },

  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.8, marginBottom: -Space.xs, marginTop: Space.xs },
  listCard:  { overflow: 'hidden' },
  rowItem:   { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md },
  rowIcon:   { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowLabel:  { fontSize: FontSize.base, fontWeight: '500' },
  rowValue:  { fontSize: FontSize.sm, marginTop: 1 },
  divider:   { height: 1, marginLeft: Space.md + 34 + Space.md },

  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.lg, paddingBottom: Space.md, borderBottomWidth: 1 },
  modalHeaderTitle: { fontSize: FontSize.md, fontWeight: '700' },
  modalScroll:      { padding: Space.lg },
  form:             { gap: Space.md },
});
