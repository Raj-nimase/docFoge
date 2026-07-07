import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator, Animated,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { C, F, S, R, shadows } from '@/constants/theme';
import { Brand, Colors, Space, FontSize, Radius } from '@/constants/theme';
import { Project } from '@/services/api';

const TEMPLATE_LABELS: Record<string, string> = {
  'diploma-project-report': 'Diploma / Project Report',
  'ieee-paper':             'IEEE Paper',
  'thesis':                 'Thesis',
  'assignment':             'Assignment',
  'blank':                  'Blank Document',
};

const TEMPLATE_ICONS: Record<string, string> = {
  'diploma-project-report': 'school-outline',
  'ieee-paper':             'flask-outline',
  'thesis':                 'book-outline',
  'assignment':             'clipboard-outline',
  'blank':                  'document-outline',
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Project card ──────────────────────────────────────────────────────────────

const ProjectCard = memo(function ProjectCard({ project, onOpen, onDelete, index }: {
  project: Project; onOpen: () => void; onDelete: () => void; index: number;
}) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const icon          = TEMPLATE_ICONS[project.templateId]  ?? 'document-outline';
  const templateLabel = TEMPLATE_LABELS[project.templateId] ?? project.templateId;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity onPress={onOpen} activeOpacity={0.85}>
        <View style={hs.card}>
          <View style={hs.cardStrip} />
          <View style={hs.cardBody}>
            <View style={hs.cardTop}>
              <View style={hs.cardIconWrap}>
                <Ionicons name={icon as any} size={18} color={C.accent} />
              </View>
              <View style={hs.templateBadge}>
                <Text style={hs.templateBadgeText} numberOfLines={1}>{templateLabel}</Text>
              </View>
              <TouchableOpacity onPress={onDelete} hitSlop={8} style={hs.deleteBtn}>
                <Ionicons name="trash-outline" size={15} color={C.error} />
              </TouchableOpacity>
            </View>
            <Text style={hs.cardTitle} numberOfLines={2}>
              {project.metadata?.title || 'Untitled Document'}
            </Text>
            {project.metadata?.authors ? (
              <Text style={hs.cardAuthors} numberOfLines={1}>{project.metadata.authors}</Text>
            ) : null}
            <View style={hs.cardFooter}>
              <View style={hs.dateRow}>
                <Ionicons name="time-outline" size={12} color={C.textFaint} />
                <Text style={hs.dateText}>Updated {formatDate(project.updatedAt)}</Text>
              </View>
              <View style={hs.openBtn}>
                <Text style={hs.openBtnText}>Open</Text>
                <Ionicons name="arrow-forward" size={13} color={C.accent} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Narrow selectors — each component only re-renders when its slice changes
  const user         = useAuthStore(s => s.user);
  const projects     = useProjectStore(s => s.projects);
  const loaded       = useProjectStore(s => s.loaded);
  const loadProjects = useProjectStore(s => s.loadProjects);
  const deleteProject = useProjectStore(s => s.deleteProject);
  const openProject  = useProjectStore(s => s.openProject);

  const [refreshing,    setRefreshing]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => { if (!loaded) loadProjects(); }, [loaded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  }, [loadProjects]);

  // useMemo so filter only recomputes when projects or search changes,
  // not on every render triggered by searchFocused or other local state
  const filtered = useMemo(() => {
    if (!search) return projects;
    const q = search.toLowerCase();
    return projects.filter(p =>
      (p.metadata?.title   || '').toLowerCase().includes(q) ||
      (p.metadata?.authors || '').toLowerCase().includes(q) ||
      (TEMPLATE_LABELS[p.templateId] || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const handleDelete = useCallback((project: Project) => {
    Alert.alert(
      'Delete project',
      `Delete "${project.metadata?.title || 'Untitled'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteProject(project.id) },
      ]
    );
  }, [deleteProject]);

  const handleOpen = useCallback((project: Project) => {
    openProject(project.id);
    router.push({ pathname: '/editor/[projectId]', params: { projectId: project.id } });
  }, [openProject, router]);

  // Stable renderItem — won't re-create the function on every render
  const renderItem = useCallback(({ item, index }: { item: Project; index: number }) => (
    <ProjectCard
      project={item}
      index={index}
      onOpen={() => handleOpen(item)}
      onDelete={() => handleDelete(item)}
    />
  ), [handleOpen, handleDelete]);

  const keyExtractor = useCallback((p: Project) => p.id, []);

  const greeting = user?.name ? `Hey, ${user.name.split(' ')[0]} 👋` : 'My Projects';

  return (
    <View style={[hs.screen, { backgroundColor: C.bg }]}>

      {/* ── Header ── */}
      <View style={[hs.header, { paddingTop: insets.top + S.md }]}>
        <View style={hs.headerTop}>
          <View>
            <Text style={hs.greeting}>Welcome back</Text>
            <Text style={hs.headerTitle}>{greeting}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/new-project')}
            style={hs.fab}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={[hs.searchBar, searchFocused && hs.searchBarFocused]}>
          <Ionicons name="search-outline" size={16} color={C.textFaint} />
          <TextInput
            style={hs.searchInput}
            placeholder="Search projects…"
            placeholderTextColor={C.textFaint}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={C.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Stats row */}
        {!search && (
          <View style={hs.statsRow}>
            <Text style={hs.statsText}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* ── List ── */}
      {!loaded ? (
        <View style={hs.center}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={hs.loadingText}>Loading projects…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[hs.list, { paddingBottom: insets.bottom + S.xl }]}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.accent}
              colors={[C.accent]}
            />
          }
          ListEmptyComponent={
            search ? (
              <View style={hs.empty}>
                <Ionicons name="search-outline" size={40} color={C.borderStrong} />
                <Text style={hs.emptyTitle}>No results found</Text>
                <Text style={hs.emptyText}>Try a different search term</Text>
              </View>
            ) : (
              <View style={hs.empty}>
                <View style={hs.emptyIconWrap}>
                  <Text style={hs.emptyEmoji}>📄</Text>
                </View>
                <Text style={hs.emptyTitle}>No projects yet</Text>
                <Text style={hs.emptyText}>
                  Create your first document and generate a professional PDF in seconds.
                </Text>
                <TouchableOpacity
                  style={hs.createBtn}
                  onPress={() => router.push('/new-project')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={hs.createBtnText}>Create project</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const hs = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingText: { fontSize: F.sm, color: C.textMuted },

  // Header
  header: {
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    ...shadows.card,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.md,
  },
  greeting:    { fontSize: F.sm, color: C.textMuted, fontWeight: '500' },
  headerTitle: { fontSize: F.xl, fontWeight: '800', color: C.text },
  fab: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    backgroundColor: C.cardAlt,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    marginBottom: S.sm,
  },
  searchBarFocused: { borderColor: C.accent },
  searchInput: { flex: 1, fontSize: F.sm, color: C.text, padding: 0 },

  statsRow:  { },
  statsText: { fontSize: F.xs, color: C.textFaint },

  // List
  list: { padding: S.lg, gap: S.md },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardStrip: { width: 4, backgroundColor: C.accent },
  cardBody:  { flex: 1, padding: S.md, gap: S.sm },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  cardIconWrap: {
    width: 32, height: 32, borderRadius: R.md,
    backgroundColor: C.accentGlow, alignItems: 'center', justifyContent: 'center',
  },
  templateBadge: {
    flex: 1,
    backgroundColor: C.cardAlt,
    borderRadius: R.full,
    paddingHorizontal: S.sm,
    paddingVertical: 3,
  },
  templateBadgeText: { fontSize: F.xs, color: C.textMuted, fontWeight: '600' },
  deleteBtn: {
    width: 30, height: 30, borderRadius: R.md,
    backgroundColor: C.errorBg,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle:   { fontSize: F.lg, fontWeight: '700', color: C.text, lineHeight: 24 },
  cardAuthors: { fontSize: F.sm, color: C.textMuted },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  dateText:    { fontSize: F.xs, color: C.textFaint },
  openBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openBtnText: { fontSize: F.sm, fontWeight: '600', color: C.accent },

  // Empty
  empty:       { alignItems: 'center', paddingTop: S['3xl'], paddingHorizontal: S.xl, gap: S.md },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accentGlow, alignItems: 'center', justifyContent: 'center',
    marginBottom: S.sm,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: F.xl, fontWeight: '700', color: C.text },
  emptyText:  { fontSize: F.base, textAlign: 'center', lineHeight: 22, color: C.textMuted },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    backgroundColor: C.accent,
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
    borderRadius: R.lg,
    marginTop: S.sm,
    ...shadows.card,
  },
  createBtnText: { fontSize: F.base, fontWeight: '700', color: '#fff' },
});
