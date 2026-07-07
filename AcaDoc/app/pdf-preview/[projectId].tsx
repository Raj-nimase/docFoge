/**
 * PDF Preview Screen — Shows compiled PDF with page thumbnails,
 * zoom controls, and share action. Premium Japandi design.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Animated, Easing, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import { useProjectStore } from '@/stores/projectStore';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { C, F, S, R, shadows } from '@/constants/theme';
import { Colors, Brand } from '@/constants/theme';
import { pdfUrl, getToken } from '@/services/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const THUMB_W = 56;
const THUMB_H = 72;
const PAGE_W  = SCREEN_W - S.xl * 2;
const PAGE_H  = PAGE_W * 1.414; // A4 ratio

// ── Fake page generator (placeholder until real PDF render) ───────────────────

const SECTION_NAMES = [
  '1. Introduction',
  '2. Literature Review',
  '3. Methodology',
  '4. System Design',
  '5. Results and Discussion',
  '6. Conclusion',
  '7. References',
];

// ── Page thumbnail ─────────────────────────────────────────────────────────────

function PageThumb({ pageNum, total, isActive, onPress }: {
  pageNum: number; total: number; isActive: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[
        pt.thumb,
        isActive && pt.thumbActive,
      ]}>
        {/* Fake page content */}
        <View style={pt.pageLines}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[
                pt.line,
                { width: `${60 + (i % 3) * 15}%`, opacity: i === 0 ? 0.6 : 0.25 },
              ]}
            />
          ))}
        </View>
        <Text style={[pt.pageNum, isActive && pt.pageNumActive]}>{pageNum}</Text>
      </View>
    </TouchableOpacity>
  );
}

const pt = StyleSheet.create({
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: R.md,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    paddingVertical: S.xs,
    paddingHorizontal: 6,
    gap: 3,
    ...shadows.card,
  },
  thumbActive: {
    borderColor: C.accent,
    borderWidth: 2,
    ...shadows.strong,
  },
  pageLines: { flex: 1, width: '100%', gap: 3, paddingTop: 4 },
  line: { height: 2, backgroundColor: C.text, borderRadius: 1 },
  pageNum: { fontSize: 9, color: C.textFaint, fontWeight: '600' },
  pageNumActive: { color: C.accent },
});

// ── Full page preview ──────────────────────────────────────────────────────────

function PagePreview({ pageNum, total, projectTitle }: {
  pageNum: number; total: number; projectTitle: string;
}) {
  const sectionIndex = Math.min(pageNum - 1, SECTION_NAMES.length - 1);
  const sectionName  = pageNum === 1
    ? projectTitle || 'Document Title'
    : SECTION_NAMES[sectionIndex];

  return (
    <View style={pp.page}>
      {/* Header */}
      <View style={pp.pageHeader}>
        <Text style={pp.pageHeaderLeft}>{projectTitle || 'AcaDoc'}</Text>
        <Text style={pp.pageHeaderRight}>{pageNum}</Text>
      </View>

      <View style={pp.divider} />

      {/* Section heading */}
      {pageNum === 1 ? (
        <View style={pp.titlePage}>
          <Text style={pp.docTitle}>{projectTitle || 'Document Title'}</Text>
          <View style={pp.titleDivider} />
          <Text style={pp.subtitle}>IEEE Research Paper</Text>
        </View>
      ) : (
        <>
          <Text style={pp.sectionTitle}>{sectionName?.toUpperCase()}</Text>
          <View style={pp.contentLines}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View
                key={i}
                style={[
                  pp.textLine,
                  { width: i === 11 ? '60%' : '100%' },
                ]}
              />
            ))}
          </View>
          {/* Simulated equation block */}
          {pageNum === 3 && (
            <View style={pp.equationBlock}>
              <Text style={pp.equation}>ƒ(x) = max(0, x)    (1)</Text>
            </View>
          )}
          <View style={pp.contentLines}>
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} style={[pp.textLine, { width: i === 7 ? '45%' : '100%' }]} />
            ))}
          </View>
        </>
      )}

      {/* Footer */}
      <View style={pp.divider} />
      <View style={pp.pageFooter}>
        <Text style={pp.footerText}>{sectionName}</Text>
        <Text style={pp.footerPage}>{pageNum} / {total}</Text>
      </View>
    </View>
  );
}

const pp = StyleSheet.create({
  page: {
    width: PAGE_W,
    minHeight: PAGE_H,
    backgroundColor: '#fff',
    borderRadius: R.md,
    padding: S.xl,
    ...shadows.strong,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: S.xs,
  },
  pageHeaderLeft:  { fontSize: F.xs, color: C.textFaint, fontStyle: 'italic' },
  pageHeaderRight: { fontSize: F.xs, color: C.textFaint },
  divider: { height: 1, backgroundColor: C.border, marginBottom: S.md },

  titlePage:    { alignItems: 'center', paddingVertical: S['3xl'] },
  docTitle:     { fontSize: F.xl, fontWeight: '800', color: C.text, textAlign: 'center' },
  titleDivider: { width: 60, height: 2, backgroundColor: C.accent, marginVertical: S.md },
  subtitle:     { fontSize: F.sm, color: C.textMuted, textAlign: 'center' },

  sectionTitle: { fontSize: F.md, fontWeight: '800', color: C.text, marginBottom: S.md, letterSpacing: 0.5 },
  contentLines: { gap: 6, marginBottom: S.md },
  textLine:     { height: 3, backgroundColor: C.border, borderRadius: 2 },

  equationBlock: {
    alignItems: 'center',
    paddingVertical: S.md,
    marginVertical: S.sm,
    backgroundColor: C.bg,
    borderRadius: R.md,
  },
  equation: { fontSize: F.base, fontStyle: 'italic', color: C.text, fontFamily: 'serif' },

  pageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: S.md,
  },
  footerText: { fontSize: F.xs, color: C.textFaint, fontStyle: 'italic' },
  footerPage: { fontSize: F.xs, color: C.textFaint },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PDFPreviewScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const { getActiveProject, openProject } = useProjectStore();
  useEffect(() => { if (projectId) openProject(projectId as string); }, [projectId]);
  const project = getActiveProject();

  const [currentPage,  setCurrentPage]  = useState(1);
  const [zoomLevel,    setZoomLevel]    = useState(100);
  const [sharing,      setSharing]      = useState(false);

  const TOTAL_PAGES = 12;
  const thumbsRef   = useRef<ScrollView>(null);

  function goToPage(page: number) {
    setCurrentPage(page);
    // scroll thumbnail strip
    thumbsRef.current?.scrollTo({ x: (page - 1) * (THUMB_W + S.sm) - SCREEN_W / 2 + THUMB_W / 2, animated: true });
  }

  function zoomIn()  { setZoomLevel(z => Math.min(z + 25, 200)); }
  function zoomOut() { setZoomLevel(z => Math.max(z - 25, 50)); }

  async function handleShare() {
    setSharing(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available', 'Cannot share on this device.');
        return;
      }
      // Attempt to download and share the real PDF if we have a jobId
      // For now, show info
      Alert.alert('Share PDF', 'PDF sharing from the compile screen is available. Compile first, then share from there.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSharing(false);
    }
  }

  if (!project) {
    return (
      <View style={[pv.screen, pv.center, { backgroundColor: C.bg }]}>
        <Text style={{ color: C.textMuted }}>Project not found</Text>
      </View>
    );
  }

  return (
    <View style={[pv.screen, { backgroundColor: C.bg }]}>

      {/* ── Top bar ── */}
      <View style={[pv.topBar, { paddingTop: insets.top + S.xs }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={pv.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>

        <View style={pv.topCenter}>
          <Text style={pv.topTitle}>Preview</Text>
          <Text style={pv.topSub} numberOfLines={1}>{project.metadata?.title || 'Document'}</Text>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          hitSlop={8}
          style={pv.iconBtn}
          disabled={sharing}
        >
          {sharing
            ? <ActivityIndicator size="small" color={C.accent} />
            : <Ionicons name="share-outline" size={22} color={C.text} />
          }
        </TouchableOpacity>
      </View>

      {/* ── Page counter + zoom controls ── */}
      <View style={pv.controls}>
        <View style={pv.pageCounter}>
          <Ionicons name="document-outline" size={14} color={C.textMuted} />
          <Text style={pv.pageCounterText}>
            {currentPage} / {TOTAL_PAGES}
          </Text>
        </View>

        <View style={pv.zoomControls}>
          <TouchableOpacity onPress={zoomOut} style={pv.zoomBtn} hitSlop={8} disabled={zoomLevel <= 50}>
            <Ionicons name="remove" size={18} color={zoomLevel <= 50 ? C.borderStrong : C.text} />
          </TouchableOpacity>
          <Text style={pv.zoomText}>{zoomLevel}%</Text>
          <TouchableOpacity onPress={zoomIn} style={pv.zoomBtn} hitSlop={8} disabled={zoomLevel >= 200}>
            <Ionicons name="add" size={18} color={zoomLevel >= 200 ? C.borderStrong : C.text} />
          </TouchableOpacity>
          <View style={pv.zoomDivider} />
          <TouchableOpacity
            onPress={() => setZoomLevel(100)}
            style={pv.zoomBtn}
            hitSlop={8}
          >
            <Ionicons name="expand-outline" size={18} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Page content ── */}
      <ScrollView
        style={pv.pageScroll}
        contentContainerStyle={[pv.pageScrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ transform: [{ scale: zoomLevel / 100 }], transformOrigin: 'top center' as any }}>
          <PagePreview
            pageNum={currentPage}
            total={TOTAL_PAGES}
            projectTitle={project.metadata?.title || ''}
          />
        </View>
      </ScrollView>

      {/* ── Thumbnail strip ── */}
      <View style={[pv.thumbStrip, { paddingBottom: insets.bottom + S.xs }]}>
        <ScrollView
          ref={thumbsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={pv.thumbsContent}
        >
          {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
            <PageThumb
              key={i}
              pageNum={i + 1}
              total={TOTAL_PAGES}
              isActive={currentPage === i + 1}
              onPress={() => goToPage(i + 1)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Prev / Next ── */}
      <View style={[pv.navBtns, { bottom: insets.bottom + 90 }]}>
        <TouchableOpacity
          onPress={() => goToPage(Math.max(1, currentPage - 1))}
          style={[pv.navBtn, currentPage === 1 && pv.navBtnDisabled]}
          disabled={currentPage === 1}
        >
          <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? C.borderStrong : C.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => goToPage(Math.min(TOTAL_PAGES, currentPage + 1))}
          style={[pv.navBtn, currentPage === TOTAL_PAGES && pv.navBtnDisabled]}
          disabled={currentPage === TOTAL_PAGES}
        >
          <Ionicons name="chevron-forward" size={20} color={currentPage === TOTAL_PAGES ? C.borderStrong : C.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pv = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.lg,
    paddingBottom: S.sm,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    ...shadows.card,
  },
  iconBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topCenter:  { flex: 1, alignItems: 'center' },
  topTitle:   { fontSize: F.base, fontWeight: '700', color: C.text },
  topSub:     { fontSize: F.xs, color: C.textMuted, marginTop: 1 },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.lg,
    paddingVertical: S.sm,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pageCounter:     { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  pageCounterText: { fontSize: F.sm, color: C.textMuted, fontWeight: '600' },
  zoomControls:    { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  zoomBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.md,
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.border,
  },
  zoomText:    { fontSize: F.sm, fontWeight: '600', color: C.text, minWidth: 42, textAlign: 'center' },
  zoomDivider: { width: 1, height: 20, backgroundColor: C.border, marginHorizontal: S.xs },

  pageScroll:        { flex: 1, backgroundColor: C.bg },
  pageScrollContent: { alignItems: 'center', paddingTop: S.xl, paddingHorizontal: S.xl },

  thumbStrip: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: S.sm,
    ...shadows.sheet,
  },
  thumbsContent: {
    paddingHorizontal: S.lg,
    gap: S.sm,
    paddingBottom: S.xs,
  },

  navBtns: {
    position: 'absolute',
    right: S.md,
    flexDirection: 'column',
    gap: S.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  navBtnDisabled: { opacity: 0.4 },
});
