import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator, Animated,
  TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { C, F, S, R, shadows, Fonts } from '@/constants/theme';
import { Project } from '@/services/api';

const TEMPLATE_LABELS: Record<string, string> = {
  'diploma-project-report': 'Diploma',
  'ieee-paper':             'Project Report',
  'thesis':                 'Thesis',
  'assignment':             'Assignment',
  'blank':                  'Draft',
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

  const templateLabel = TEMPLATE_LABELS[project.templateId] ?? project.templateId;
  const isAsymmetric = index === 2;
  const hasStrip = index === 0;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity onPress={onOpen} activeOpacity={0.85}>
        <View style={isAsymmetric ? hs.cardAsymmetric : hs.card}>
          {hasStrip && <View style={hs.cardStrip} />}
          <View style={hs.cardBody}>
            <View style={hs.cardTop}>
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
            
            <View style={hs.authorsRow}>
              <Ionicons name="person-outline" size={16} color="#404944" />
              <Text style={hs.cardAuthors} numberOfLines={1}>
                {project.metadata?.authors || 'Raj Malhotra'}
              </Text>
            </View>

            {isAsymmetric && (
              <Text style={hs.asymmetricDescription} numberOfLines={2}>
                Comparative analysis of quantum gate implementation across superconducting and trapped ion architectures...
              </Text>
            )}

            <View style={hs.cardFooter}>
              <View style={hs.dateRow}>
                <Ionicons name="time-outline" size={14} color="#404944" style={{ opacity: 0.7 }} />
                <Text style={hs.dateText}>Updated {formatDate(project.updatedAt)}</Text>
              </View>
              <View style={hs.openBtnRound}>
                <Ionicons name="chevron-forward" size={15} color="#003527" />
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

  const user         = useAuthStore(s => s.user);
  const projects     = useProjectStore(s => s.projects);
  const loaded       = useProjectStore(s => s.loaded);
  const loadProjects = useProjectStore(s => s.loadProjects);
  const deleteProject = useProjectStore(s => s.deleteProject);
  const openProject  = useProjectStore(s => s.openProject);

  const [refreshing,    setRefreshing]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusFilter,  setStatusFilter]  = useState<'all' | 'progress' | 'completed'>('all');

  useEffect(() => { if (!loaded) loadProjects(); }, [loaded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  }, [loadProjects]);

  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter === 'progress') {
      list = projects.filter((_, idx) => idx % 2 === 0);
    } else if (statusFilter === 'completed') {
      list = projects.filter((_, idx) => idx % 2 !== 0);
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(p =>
      (p.metadata?.title   || '').toLowerCase().includes(q) ||
      (p.metadata?.authors || '').toLowerCase().includes(q) ||
      (TEMPLATE_LABELS[p.templateId] || '').toLowerCase().includes(q)
    );
  }, [projects, search, statusFilter]);

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

  const renderItem = useCallback(({ item, index }: { item: Project; index: number }) => (
    <ProjectCard
      project={item}
      index={index}
      onOpen={() => handleOpen(item)}
      onDelete={() => handleDelete(item)}
    />
  ), [handleOpen, handleDelete]);

  const keyExtractor = useCallback((p: Project) => p.id, []);

  const userName = user?.name ? user.name.split(' ')[0] : 'Raj';

  return (
    <View style={[hs.screen, { backgroundColor: '#f7f9fb' }]}>

      {/* ── Header Top bar ── */}
      <View style={[hs.topBarShell, { paddingTop: insets.top + 8 }]}>
        <View style={hs.topBarContent}>
          <TouchableOpacity style={hs.topBarIconBtn} activeOpacity={0.7}>
            <Ionicons name="menu" size={22} color="#003527" />
          </TouchableOpacity>
          <Text style={hs.topBarTitle}>AcaDoc</Text>
          <TouchableOpacity 
            style={hs.profileAvatar} 
            onPress={() => router.push('/profile')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-circle" size={30} color="#003527" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable Body ── */}
      {!loaded ? (
        <View style={hs.center}>
          <ActivityIndicator color="#003527" size="large" />
          <Text style={hs.loadingText}>Loading projects…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[hs.list, { paddingBottom: insets.bottom + 40 }]}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#003527"
              colors={["#003527"]}
            />
          }
          ListHeaderComponent={
            <View style={hs.listHeader}>
              {/* Welcome Section */}
              <View style={hs.welcomeSection}>
                <Text style={hs.welcomeTitle}>Hey, {userName}</Text>
                <Text style={hs.welcomeSubtitle}>
                  Welcome back to your research workspace. Ready to continue?
                </Text>
              </View>

              {/* Search bar */}
              <View style={[hs.searchBar, searchFocused && hs.searchBarFocused]}>
                <Ionicons name="search-outline" size={18} color="#707974" style={{ marginRight: 8 }} />
                <TextInput
                  style={hs.searchInput}
                  placeholder="Search projects..."
                  placeholderTextColor="#707974"
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color="#707974" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Quick Actions Row */}
              <View style={hs.quickActionsRow}>
                {/* Create Card */}
                <TouchableOpacity 
                  style={hs.createCard} 
                  onPress={() => router.push('/new-project')}
                  activeOpacity={0.9}
                >
                  <View style={hs.createIconWrap}>
                    <Ionicons name="add" size={26} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={hs.createCardTitle}>Create New Project</Text>
                    <Text style={hs.createCardSub} numberOfLines={1}>Start a new research document</Text>
                  </View>
                </TouchableOpacity>

                {/* Storage Card */}
                <View style={hs.storageCard}>
                  <View style={hs.storageHeader}>
                    <Text style={hs.storageTitle}>Cloud Storage</Text>
                    <Text style={hs.storageFraction}>4.2 GB / 50 GB</Text>
                  </View>
                  <View style={hs.progressBarContainer}>
                    <View style={[hs.progressBarFill, { width: '8.4%' }]} />
                  </View>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={hs.upgradeText}>Upgrade Storage</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status filter tabs */}
              <View style={hs.filterTabsRow}>
                <TouchableOpacity 
                  style={[hs.filterTab, statusFilter === 'all' && hs.filterTabActive]}
                  onPress={() => setStatusFilter('all')}
                  activeOpacity={0.8}
                >
                  <Text style={[hs.filterTabText, statusFilter === 'all' && hs.filterTabTextActive]}>All Projects</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[hs.filterTab, statusFilter === 'progress' && hs.filterTabActive]}
                  onPress={() => setStatusFilter('progress')}
                  activeOpacity={0.8}
                >
                  <Text style={[hs.filterTabText, statusFilter === 'progress' && hs.filterTabTextActive]}>In Progress</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[hs.filterTab, statusFilter === 'completed' && hs.filterTabActive]}
                  onPress={() => setStatusFilter('completed')}
                  activeOpacity={0.8}
                >
                  <Text style={[hs.filterTabText, statusFilter === 'completed' && hs.filterTabTextActive]}>Completed</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            search ? (
              <View style={hs.empty}>
                <Ionicons name="search-outline" size={40} color="#707974" />
                <Text style={hs.emptyTitle}>No results found</Text>
                <Text style={hs.emptyText}>Try a different search term</Text>
              </View>
            ) : (
              <View style={hs.emptyDashed}>
                <Ionicons name="document-text-outline" size={32} color="#404944" style={{ marginBottom: 8, opacity: 0.6 }} />
                <Text style={hs.emptyTitle}>End of recent projects</Text>
                <Text style={hs.emptyText}>Use the search to find older work</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 16, color: '#404944', fontFamily: Fonts.interRegular },

  // Shell TopBar
  topBarShell: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e3e5',
    paddingBottom: 8,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  topBarIconBtn: {
    padding: 4,
    borderRadius: 999,
  },
  topBarTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#003527',
    fontFamily: Fonts.display,
  },
  profileAvatar: {
    padding: 4,
  },

  // List Header Area
  listHeader: {
    gap: 24,
    marginBottom: 8,
  },

  // Welcome section
  welcomeSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#003527',
    fontFamily: Fonts.hankenBold,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#404944',
    lineHeight: 26,
    opacity: 0.8,
    fontFamily: Fonts.interRegular,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e3e5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
  },
  searchBarFocused: { borderColor: '#003527' },
  searchInput: { flex: 1, fontSize: 12, color: '#191c1e', padding: 0, fontFamily: Fonts.mono },

  // Quick Actions Row
  quickActionsRow: {
    flexDirection: 'column',
    gap: 16,
    paddingHorizontal: 16,
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003527',
    padding: 24,
    borderRadius: 8,
    gap: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  createIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCardTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#ffffff',
    fontFamily: Fonts.hankenBold,
  },
  createCardSub: {
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.8,
    marginTop: 2,
    fontFamily: Fonts.mono,
  },

  // Storage Card
  storageCard: {
    backgroundColor: '#064e3b',
    padding: 24,
    borderRadius: 8,
    gap: 12,
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#ffffff',
    fontFamily: Fonts.hankenSemiBold,
  },
  storageFraction: {
    fontSize: 12,
    color: '#80bea6',
    fontFamily: Fonts.mono,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#80bea6',
  },
  upgradeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#80bea6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Fonts.mono,
  },

  // Filter tabs
  filterTabsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterTab: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f7f9fb',
    borderWidth: 1,
    borderColor: '#e0e3e5',
  },
  filterTabActive: {
    backgroundColor: '#064e3b',
    borderColor: '#064e3b',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#404944',
    fontFamily: Fonts.mono,
  },
  filterTabTextActive: {
    color: '#80bea6',
    fontWeight: '700',
  },

  // List
  list: { paddingVertical: 16, gap: 16 },

  // Card styling
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e3e5',
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardAsymmetric: {
    flexDirection: 'row',
    backgroundColor: '#f2f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e3e5',
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardStrip: { width: 4, backgroundColor: '#064e3b' },
  cardBody:  { flex: 1, padding: 24, gap: 12 },
  cardTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateBadge: {
    backgroundColor: '#d5e0f8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  templateBadgeText: { fontSize: 12, color: '#586377', fontWeight: '600', fontFamily: Fonts.mono },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle:   { fontSize: 20, fontWeight: '500', color: '#191c1e', lineHeight: 28, fontFamily: Fonts.hankenBold },
  authorsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  cardAuthors: { fontSize: 16, color: '#404944', fontFamily: Fonts.interRegular },
  asymmetricDescription: { fontSize: 16, color: '#404944', fontFamily: Fonts.interRegular, marginTop: 4, lineHeight: 24 },
  cardFooter:  { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e0e3e5',
    paddingTop: 16,
    marginTop: 12,
  },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText:    { fontSize: 12, color: '#404944', opacity: 0.7, fontFamily: Fonts.mono },
  openBtnRound: { 
    width: 32, 
    height: 32, 
    borderRadius: 16,
    backgroundColor: '#d5e0f8',
    alignItems: 'center', 
    justifyContent: 'center',
  },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 16 },
  emptyDashed: {
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 24, 
    paddingHorizontal: 24, 
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#bfc9c3',
    opacity: 0.7,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#191c1e', fontFamily: Fonts.hankenBold },
  emptyText:  { fontSize: 12, textAlign: 'center', color: '#404944', fontFamily: Fonts.interRegular },
});
