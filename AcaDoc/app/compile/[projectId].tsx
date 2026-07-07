/**
 * CompileScreen — Polish pass with premium UI + "Preview PDF" button
 * and a "Back to Editor" flow that preserves the project state.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Easing, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { C, F, S, R, shadows } from '@/constants/theme';
import { Colors, Brand, Space, FontSize, Radius } from '@/constants/theme';
import {
  apiStartCompile, apiPollUntilDone, pdfUrl,
  CompileStatus, getToken,
} from '@/services/api';

type JobState = 'idle' | 'pending' | 'processing' | 'done' | 'failed';

const STAGES = [
  { after: 0, label: 'Sending document to compiler…' },
  { after: 1, label: 'Generating LaTeX source…' },
  { after: 2, label: 'Running pdflatex (pass 1)…' },
  { after: 4, label: 'Running pdflatex (pass 2)…' },
  { after: 6, label: 'Finalising PDF…' },
];

const TEMPLATE_LABELS: Record<string, string> = {
  'diploma-project-report': 'Diploma / Project Report',
  'ieee-paper':             'IEEE Paper',
  'thesis':                 'Thesis',
  'assignment':             'Assignment',
  'blank':                  'Blank Document',
};

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={[cs.spinner, { transform: [{ rotate }] }]} />
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: pct, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View style={cs.progressTrack}>
      <Animated.View style={[
        cs.progressFill,
        { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
      ]} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CompileScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const { getActiveProject, openProject } = useProjectStore();
  useEffect(() => { if (projectId) openProject(projectId as string); }, [projectId]);
  const project = getActiveProject();

  const [jobState,    setJobState]    = useState<JobState>('idle');
  const [pollCount,   setPollCount]   = useState(0);
  const [elapsed,     setElapsed]     = useState(0);
  const [error,       setError]       = useState('');
  const [jobId,       setJobId]       = useState('');
  const [downloading, setDownloading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCompiling = jobState === 'pending' || jobState === 'processing';

  useEffect(() => {
    if (isCompiling) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isCompiling]);

  const stageLabel = jobState === 'done'
    ? 'PDF ready!'
    : [...STAGES].reverse().find(s => pollCount >= s.after)?.label ?? STAGES[0].label;

  const progressPct = jobState === 'done'
    ? 100
    : Math.min(90, 5 + elapsed * 5);

  async function startCompile() {
    if (!project) return;
    setJobState('pending');
    setElapsed(0);
    setPollCount(0);
    setError('');

    try {
      const { jobId: id } = await apiStartCompile(project);
      setJobId(id);
      setJobState('processing');

      const final = await apiPollUntilDone(id, (s: CompileStatus) => {
        setJobState(s.status as JobState);
        setPollCount(c => c + 1);
      });

      if (final.status === 'done') {
        setJobState('done');
      } else {
        setJobState('failed');
        setError(final.error ?? 'Compilation failed');
      }
    } catch (err: any) {
      setJobState('failed');
      setError(err.message ?? 'Unknown error');
    }
  }

  async function downloadAndShare() {
    if (!jobId) return;
    setDownloading(true);
    try {
      const token    = getToken();
      const url      = pdfUrl(jobId);
      const safeName = (project?.metadata?.title ?? 'document').replace(/[^a-z0-9]/gi, '_');
      const destFile = new File(Paths.document, `${safeName}.pdf`);

      await File.downloadFileAsync(url, destFile, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      } as any);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destFile.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or share your PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Downloaded', `PDF saved to:\n${destFile.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Download failed', err.message);
    } finally {
      setDownloading(false);
    }
  }

  if (!project) {
    return (
      <View style={[cs.screen, cs.center, { backgroundColor: C.bg }]}>
        <Text style={{ color: C.textMuted }}>Project not found</Text>
      </View>
    );
  }

  return (
    <View style={[cs.screen, { backgroundColor: C.bg }]}>

      {/* ── Header ── */}
      <View style={[cs.header, { paddingTop: insets.top + S.sm }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={cs.headerBack}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={cs.headerCenter}>
          <Text style={cs.headerTitle} numberOfLines={1}>
            {project.metadata?.title || 'Compile'}
          </Text>
          <Text style={cs.headerSub}>
            {TEMPLATE_LABELS[project.templateId] ?? project.templateId}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[cs.scroll, { paddingBottom: insets.bottom + S.xl }]}
        alwaysBounceVertical={false}
      >

        {/* ── Idle ── */}
        {jobState === 'idle' && (
          <View style={cs.idleWrap}>
            {/* Hero icon */}
            <View style={cs.heroWrap}>
              <View style={cs.heroOuter}>
                <View style={cs.heroInner}>
                  <Text style={cs.heroEmoji}>📄</Text>
                </View>
              </View>
            </View>

            <Text style={cs.idleTitle}>Ready to compile</Text>
            <Text style={cs.idleSub}>
              Your document will be compiled to a professional PDF using LaTeX.
              {'\n'}This usually takes 6–12 seconds.
            </Text>

            {/* Summary card */}
            <View style={cs.summaryCard}>
              <SummaryRow icon="document-text-outline" label="Title"    value={project.metadata?.title || 'Untitled'} />
              <SummaryRow icon="person-outline"        label="Authors"  value={project.metadata?.authors || '—'} />
              <SummaryRow icon="library-outline"       label="Template" value={TEMPLATE_LABELS[project.templateId] ?? project.templateId} />
              <SummaryRow icon="layers-outline"        label="Chapters" value={String(project.chapters.length)} />
            </View>

            <TouchableOpacity onPress={startCompile} style={cs.compileBtn} activeOpacity={0.85}>
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={cs.compileBtnText}>Compile to PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Compiling ── */}
        {isCompiling && (
          <View style={cs.compilingWrap}>
            <Spinner />
            <Text style={cs.compilingTitle}>Compiling…</Text>
            <Text style={cs.stageLabel}>{stageLabel}</Text>

            <View style={cs.progressWrap}>
              <ProgressBar pct={progressPct} />
              <Text style={cs.progressPct}>{Math.round(progressPct)}%</Text>
            </View>

            <Text style={cs.elapsed}>{elapsed}s elapsed</Text>

            <View style={cs.tipCard}>
              <Ionicons name="bulb-outline" size={16} color={C.warning} />
              <Text style={cs.tipText}>
                First compile is slower — subsequent compiles use cache and are much faster.
              </Text>
            </View>
          </View>
        )}

        {/* ── Done ── */}
        {jobState === 'done' && (
          <View style={cs.doneWrap}>
            <View style={cs.doneIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={C.success} />
            </View>
            <Text style={cs.doneTitle}>PDF compiled!</Text>
            <Text style={cs.doneSub}>
              Your document is ready. Preview it, download, or compile again after making changes.
            </Text>

            {/* Preview PDF */}
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/pdf-preview/[projectId]', params: { projectId: project.id } })}
              style={cs.previewBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="eye-outline" size={18} color={C.accent} />
              <Text style={cs.previewBtnText}>Preview PDF</Text>
            </TouchableOpacity>

            {/* Download & Share */}
            <TouchableOpacity
              onPress={downloadAndShare}
              style={cs.compileBtn}
              activeOpacity={0.85}
              disabled={downloading}
            >
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={cs.compileBtnText}>
                {downloading ? 'Preparing…' : 'Download & Share'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={startCompile} style={cs.ghostBtn} activeOpacity={0.7}>
              <Text style={cs.ghostBtnText}>Compile again</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={cs.ghostBtn} activeOpacity={0.7}>
              <Text style={cs.ghostBtnText}>Back to editor</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Failed ── */}
        {jobState === 'failed' && (
          <View style={cs.failedWrap}>
            <View style={cs.failedIconWrap}>
              <Ionicons name="close-circle" size={56} color={C.error} />
            </View>
            <Text style={cs.failedTitle}>Compilation failed</Text>
            <Text style={cs.failedSub}>
              The LaTeX compiler returned an error. Check your content for special characters or formatting issues.
            </Text>

            {error ? (
              <View style={cs.errorCard}>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  <Text style={cs.errorLog}>{error}</Text>
                </ScrollView>
              </View>
            ) : null}

            <TouchableOpacity onPress={startCompile} style={cs.compileBtn} activeOpacity={0.85}>
              <Ionicons name="refresh-outline" size={16} color="#fff" />
              <Text style={cs.compileBtnText}>Try again</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={cs.ghostBtn} activeOpacity={0.7}>
              <Text style={cs.ghostBtnText}>Back to editor</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Summary row ────────────────────────────────────────────────────────────────

function SummaryRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={cs.summaryRow}>
      <View style={cs.summaryIcon}>
        <Ionicons name={icon} size={15} color={C.accent} />
      </View>
      <Text style={cs.summaryLabel}>{label}</Text>
      <Text style={cs.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    ...shadows.card,
  },
  headerBack:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: F.base, fontWeight: '700', color: C.text },
  headerSub:    { fontSize: F.xs, color: C.textMuted, marginTop: 1 },

  scroll: { padding: S.xl },

  // Idle
  idleWrap:  { alignItems: 'center', gap: S.lg },
  heroWrap:  { marginBottom: S.sm },
  heroOuter: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.accentGlow, borderWidth: 2, borderColor: C.accentMid,
    alignItems: 'center', justifyContent: 'center',
  },
  heroInner: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center',
  },
  heroEmoji:  { fontSize: 36 },
  idleTitle:  { fontSize: F.xl, fontWeight: '800', color: C.text },
  idleSub:    { fontSize: F.base, textAlign: 'center', lineHeight: 22, color: C.textMuted },

  summaryCard: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    gap: S.xs,
    ...shadows.card,
  },
  summaryRow:   { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 4 },
  summaryIcon:  { width: 28, height: 28, borderRadius: R.md, backgroundColor: C.accentGlow, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: F.sm, color: C.textMuted, width: 72 },
  summaryValue: { fontSize: F.sm, fontWeight: '600', color: C.text, flex: 1 },

  compileBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    backgroundColor: C.accent,
    paddingVertical: S.md + 2,
    borderRadius: R.lg,
    ...shadows.card,
  },
  compileBtnText: { fontSize: F.base, fontWeight: '700', color: '#fff' },

  previewBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    backgroundColor: C.accentGlow,
    borderWidth: 1.5,
    borderColor: C.accentMid,
    paddingVertical: S.md,
    borderRadius: R.lg,
  },
  previewBtnText: { fontSize: F.base, fontWeight: '700', color: C.accent },

  ghostBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: S.sm,
  },
  ghostBtnText: { fontSize: F.base, color: C.textMuted, fontWeight: '500' },

  // Compiling
  compilingWrap:  { alignItems: 'center', gap: S.lg, paddingTop: S['2xl'] },
  compilingTitle: { fontSize: F.xl, fontWeight: '700', color: C.text },
  stageLabel:     { fontSize: F.base, textAlign: 'center', color: C.textMuted },
  progressWrap:   { width: '100%', flexDirection: 'row', alignItems: 'center', gap: S.sm },
  progressTrack:  { flex: 1, height: 6, backgroundColor: C.border, borderRadius: R.full, overflow: 'hidden' },
  progressFill:   { height: '100%', backgroundColor: C.accent, borderRadius: R.full },
  progressPct:    { fontSize: F.xs, width: 36, textAlign: 'right', color: C.textMuted },
  elapsed:        { fontSize: F.sm, color: C.textSubtle },
  tipCard: {
    flexDirection: 'row',
    gap: S.sm,
    alignItems: 'flex-start',
    backgroundColor: C.warningBg,
    borderRadius: R.lg,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.warning + '33',
    marginTop: S.sm,
  },
  tipText: { flex: 1, fontSize: F.xs, color: C.textMuted, lineHeight: 18 },

  spinner: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 3,
    borderColor: C.border,
    borderTopColor: C.accent,
  },

  // Done
  doneWrap:     { alignItems: 'center', gap: S.md },
  doneIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.successBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.sm,
  },
  doneTitle: { fontSize: F.xl, fontWeight: '800', color: C.text },
  doneSub:   { fontSize: F.base, textAlign: 'center', lineHeight: 22, color: C.textMuted, marginBottom: S.sm },

  // Failed
  failedWrap:     { alignItems: 'center', gap: S.md },
  failedIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.errorBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.sm,
  },
  failedTitle: { fontSize: F.xl, fontWeight: '800', color: C.text },
  failedSub:   { fontSize: F.base, textAlign: 'center', lineHeight: 22, color: C.textMuted, marginBottom: S.sm },
  errorCard: {
    width: '100%',
    backgroundColor: '#1e1e1e',
    borderRadius: R.lg,
    padding: S.md,
  },
  errorLog: {
    fontSize: F.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#ef4444',
    lineHeight: 18,
  },
});
