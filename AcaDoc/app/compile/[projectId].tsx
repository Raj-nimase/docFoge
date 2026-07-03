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
import * as Sharing from 'expo-sharing';import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

// ── Spinning ring ─────────────────────────────────────────────────────────────
function Spinner({ color }: { color: string }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={[styles.spinner, { borderTopColor: color, transform: [{ rotate }] }]} />
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: pct,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { backgroundColor: color, width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CompileScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const scheme  = useColorScheme() ?? 'light';
  const C       = Colors[scheme];

  const { getActiveProject, openProject } = useProjectStore();

  React.useEffect(() => {
    if (projectId) openProject(projectId as string);
  }, [projectId]);

  const project = getActiveProject();

  const [jobState, setJobState]   = useState<JobState>('idle');
  const [pollCount, setPollCount] = useState(0);
  const [elapsed, setElapsed]     = useState(0);
  const [error, setError]         = useState('');
  const [jobId, setJobId]         = useState('');
  const [localPdf, setLocalPdf]   = useState<string | null>(null); // local file URI after download
  const [downloading, setDownloading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCompiling = jobState === 'pending' || jobState === 'processing';

  // elapsed timer
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
    setLocalPdf(null);

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

      // expo-file-system v2: File.downloadFileAsync(url, destination, options)
      await File.downloadFileAsync(url, destFile, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      } as any);

      setLocalPdf(destFile.uri);

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
      <View style={[styles.screen, styles.center, { backgroundColor: C.background }]}>
        <Text style={{ color: C.textMuted }}>Project not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Space.sm, backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]} numberOfLines={1}>
          {project.metadata?.title || 'Compile'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Space.xl }]}
        alwaysBounceVertical={false}
      >
        {/* ── Idle ── */}
        {jobState === 'idle' && (
          <View style={styles.idleWrap}>
            <View style={[styles.idleIconWrap, { backgroundColor: C.accentLight }]}>
              <Text style={styles.idleIcon}>📄</Text>
            </View>
            <Text style={[styles.idleTitle, { color: C.text }]}>Ready to compile</Text>
            <Text style={[styles.idleSub, { color: C.textMuted }]}>
              Your document will be compiled to a professional PDF using LaTeX.
              {'\n'}This usually takes 6–12 seconds.
            </Text>

            {/* Project summary */}
            <Card style={styles.summaryCard}>
              <SummaryRow icon="document-text-outline" label="Title" value={project.metadata?.title || 'Untitled'} C={C} />
              <SummaryRow icon="person-outline" label="Authors" value={project.metadata?.authors || '—'} C={C} />
              <SummaryRow icon="library-outline" label="Template" value={project.templateId} C={C} />
              <SummaryRow icon="layers-outline" label="Chapters" value={String(project.chapters.length)} C={C} />
            </Card>

            <Button label="Compile to PDF" onPress={startCompile} size="lg" style={styles.compileBtn} />
          </View>
        )}

        {/* ── Compiling ── */}
        {isCompiling && (
          <View style={styles.compilingWrap}>
            <Spinner color={Brand.accent} />
            <Text style={[styles.compilingTitle, { color: C.text }]}>Compiling…</Text>
            <Text style={[styles.stageLabel, { color: C.textMuted }]}>{stageLabel}</Text>

            <View style={styles.progressWrap}>
              <ProgressBar pct={progressPct} color={Brand.accent} />
              <Text style={[styles.progressPct, { color: C.textMuted }]}>{Math.round(progressPct)}%</Text>
            </View>

            <Text style={[styles.elapsed, { color: C.textSubtle }]}>{elapsed}s elapsed</Text>

            <Text style={[styles.tip, { color: C.textSubtle }]}>
              💡 First compile is slower — subsequent compiles use cache and are much faster.
            </Text>
          </View>
        )}

        {/* ── Done ── */}
        {jobState === 'done' && (
          <View style={styles.doneWrap}>
            <View style={[styles.doneIconWrap, { backgroundColor: Colors[scheme].successLight }]}>
              <Ionicons name="checkmark-circle" size={52} color={Brand.success} />
            </View>
            <Text style={[styles.doneTitle, { color: C.text }]}>PDF compiled!</Text>
            <Text style={[styles.doneSub, { color: C.textMuted }]}>
              Your document is ready. Download and share it or compile again after making changes.
            </Text>

            <View style={styles.doneActions}>
              <Button
                label={downloading ? 'Preparing…' : 'Download & Share'}
                onPress={downloadAndShare}
                loading={downloading}
                size="lg"
              />
              <Button
                label="Compile again"
                onPress={startCompile}
                variant="secondary"
                size="md"
              />
              <Button
                label="Back to editor"
                onPress={() => router.back()}
                variant="ghost"
                size="md"
              />
            </View>
          </View>
        )}

        {/* ── Failed ── */}
        {jobState === 'failed' && (
          <View style={styles.failedWrap}>
            <View style={[styles.failedIconWrap, { backgroundColor: Colors[scheme].errorLight }]}>
              <Ionicons name="close-circle" size={52} color={Brand.error} />
            </View>
            <Text style={[styles.failedTitle, { color: C.text }]}>Compilation failed</Text>
            <Text style={[styles.failedSub, { color: C.textMuted }]}>
              The LaTeX compiler returned an error. Check your content for special characters or formatting issues.
            </Text>

            {error ? (
              <Card style={styles.errorCard} padding={Space.md}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  <Text style={styles.errorLog}>{error}</Text>
                </ScrollView>
              </Card>
            ) : null}

            <View style={styles.doneActions}>
              <Button label="Try again" onPress={startCompile} size="lg" />
              <Button label="Back to editor" onPress={() => router.back()} variant="ghost" size="md" />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryRow({ icon, label, value, C }: { icon: any; label: string; value: string; C: any }) {
  return (
    <View style={summaryStyles.row}>
      <Ionicons name={icon} size={16} color={C.textMuted} />
      <Text style={[summaryStyles.label, { color: C.textMuted }]}>{label}</Text>
      <Text style={[summaryStyles.value, { color: C.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: Space.xs },
  label: { fontSize: FontSize.sm, width: 70 },
  value: { fontSize: FontSize.sm, fontWeight: '500', flex: 1 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.lg, paddingBottom: Space.md, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700', flex: 1, textAlign: 'center' },
  scroll: { padding: Space.xl },

  // Idle
  idleWrap:     { alignItems: 'center', gap: Space.lg },
  idleIconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  idleIcon:     { fontSize: 40 },
  idleTitle:    { fontSize: FontSize.xl, fontWeight: '800' },
  idleSub:      { fontSize: FontSize.base, textAlign: 'center', lineHeight: 22 },
  summaryCard:  { width: '100%', gap: Space.xs },
  compileBtn:   { width: '100%' },

  // Compiling
  compilingWrap:  { alignItems: 'center', gap: Space.lg, paddingTop: Space['2xl'] },
  compilingTitle: { fontSize: FontSize.xl, fontWeight: '700' },
  stageLabel:     { fontSize: FontSize.base, textAlign: 'center' },
  progressWrap:   { width: '100%', flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  progressTrack:  { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: Radius.full, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: Radius.full },
  progressPct:    { fontSize: FontSize.xs, width: 36, textAlign: 'right' },
  elapsed:        { fontSize: FontSize.sm },
  tip:            { fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18, paddingTop: Space.lg },

  spinner: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 3, borderColor: 'rgba(79,107,237,0.15)',
  },

  // Done
  doneWrap:      { alignItems: 'center', gap: Space.lg },
  doneIconWrap:  { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  doneTitle:     { fontSize: FontSize.xl, fontWeight: '800' },
  doneSub:       { fontSize: FontSize.base, textAlign: 'center', lineHeight: 22 },
  doneActions:   { width: '100%', gap: Space.md, marginTop: Space.sm },

  // Failed
  failedWrap:    { alignItems: 'center', gap: Space.lg },
  failedIconWrap:{ width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  failedTitle:   { fontSize: FontSize.xl, fontWeight: '800' },
  failedSub:     { fontSize: FontSize.base, textAlign: 'center', lineHeight: 22 },
  errorCard:     { width: '100%' },
  errorLog:      { fontSize: FontSize.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#EF4444', lineHeight: 18 },
});
