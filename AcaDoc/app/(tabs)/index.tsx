import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Brand, Space, FontSize, Radius } from '@/constants/theme';
import { Project } from '@/services/api';

const TEMPLATE_LABELS: Record<string, string> = {
  'diploma-project-report': 'Diploma / Project Report',
  'ieee-paper':             'IEEE Paper',
  'thesis':                 'Thesis',
  'assignment':             'Assignment',
  'blank':                  'Blank Document',
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProjectCard({ project, onOpen, onDelete }: { project: Project; onOpen: () => void; onDelete: () => void }) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];

  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.8}>
      <Card style={styles.projectCard}>
        <View style={styles.cardTop}>
          <View style={[styles.templateBadge, { backgroundColor: C.accentLight }]}>
            <Text style={[styles.templateBadgeText, { color: C.accent }]} numberOfLines={1}>
              {TEMPLATE_LABELS[project.templateId] ?? project.templateId}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={8}
            style={[styles.deleteBtn, { backgroundColor: Colors[scheme].errorLight }]}
          >
            <Ionicons name="trash-outline" size={15} color={Brand.error} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.projectTitle, { color: C.text }]} numberOfLines={2}>
          {project.metadata?.title || 'Untitled Document'}
        </Text>

        {project.metadata?.authors ? (
          <Text style={[styles.projectMeta, { color: C.textMuted }]} numberOfLines={1}>
            {project.metadata.authors}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={[styles.dateText, { color: C.textSubtle }]}>
            Updated {formatDate(project.updatedAt)}
          </Text>
          <View style={styles.openRow}>
            <Text style={[styles.openText, { color: C.accent }]}>Open</Text>
            <Ionicons name="chevron-forward" size={14} color={C.accent} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const scheme   = useColorScheme() ?? 'light';
  const C        = Colors[scheme];

  const user          = useAuthStore(s => s.user);
  const { projects, loaded, loadProjects, deleteProject, openProject } = useProjectStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loaded) loadProjects();
  }, [loaded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  }, []);

  function handleDelete(project: Project) {
    Alert.alert(
      'Delete project',
      `Delete "${project.metadata?.title || 'Untitled'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => deleteProject(project.id),
        },
      ]
    );
  }

  function handleOpen(project: Project) {
    openProject(project.id);
    router.push({ pathname: '/editor/[projectId]', params: { projectId: project.id } });
  }

  const greeting = user?.name ? `Hey, ${user.name.split(' ')[0]}` : 'My Projects';

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Space.md, backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: C.textMuted }]}>
              {user ? 'Welcome back 👋' : 'AcaDoc'}
            </Text>
            <Text style={[styles.headerTitle, { color: C.text }]}>{greeting}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/new-project')}
            style={[styles.fabSmall, { backgroundColor: Brand.accent }]}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={p => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Space.xl }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onOpen={() => handleOpen(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={[styles.emptyTitle, { color: C.text }]}>No projects yet</Text>
              <Text style={[styles.emptyText, { color: C.textMuted }]}>
                Create your first document and generate a professional PDF in seconds.
              </Text>
              <Button
                label="Create project"
                onPress={() => router.push('/new-project')}
                style={{ marginTop: Space.lg }}
                fullWidth={false}
              />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { paddingHorizontal: Space.lg, paddingBottom: Space.md, borderBottomWidth: 1 },
  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting:     { fontSize: FontSize.sm, fontWeight: '500', marginBottom: 2 },
  headerTitle:  { fontSize: FontSize.xl, fontWeight: '800' },
  fabSmall:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list:         { padding: Space.lg, gap: Space.md },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },

  projectCard:  { gap: Space.sm },
  cardTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateBadge:{ paddingHorizontal: Space.sm, paddingVertical: 3, borderRadius: Radius.sm, maxWidth: '75%' },
  templateBadgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  deleteBtn:    { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  projectTitle: { fontSize: FontSize.lg, fontWeight: '700', lineHeight: 24 },
  projectMeta:  { fontSize: FontSize.sm },
  cardFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Space.xs },
  dateText:     { fontSize: FontSize.xs },
  openRow:      { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText:     { fontSize: FontSize.sm, fontWeight: '600' },

  empty:       { alignItems: 'center', paddingTop: Space['3xl'], paddingHorizontal: Space.xl },
  emptyIcon:   { fontSize: 48, marginBottom: Space.md },
  emptyTitle:  { fontSize: FontSize.xl, fontWeight: '700', marginBottom: Space.sm },
  emptyText:   { fontSize: FontSize.base, textAlign: 'center', lineHeight: 22 },
});
