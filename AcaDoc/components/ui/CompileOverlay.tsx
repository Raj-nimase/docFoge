/**
 * CompileOverlay
 * Full-screen modal that appears when the user taps "Build PDF".
 * Shows a spinner, animated progress bar, and stage labels while compiling.
 * Disappears automatically when the parent transitions to done/failed state.
 */
import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Easing,
} from 'react-native';
import { C, F, R, S, shadows } from '@/constants/theme';

export type CompileStage = 'pending' | 'processing' | 'done' | 'failed';

interface Props {
  visible: boolean;
  stage: CompileStage;
  pollCount: number;
  elapsed: number;
  progressPct: number;
}

const STAGE_LABELS: { after: number; label: string }[] = [
  { after: 0, label: 'Sending document to compiler…' },
  { after: 1, label: 'Generating LaTeX source…' },
  { after: 2, label: 'Running pdflatex (pass 1)…' },
  { after: 4, label: 'Running pdflatex (pass 2)…' },
  { after: 6, label: 'Finalising PDF…' },
];

function Spinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[st.spinner, { transform: [{ rotate }] }]} />;
}

function ProgressBar({ pct }: { pct: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View style={st.track}>
      <Animated.View
        style={[
          st.fill,
          {
            width: anim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

export default function CompileOverlay({ visible, stage, pollCount, elapsed, progressPct }: Props) {
  const stageLabel =
    [...STAGE_LABELS].reverse().find(s => pollCount >= s.after)?.label ??
    STAGE_LABELS[0].label;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={st.backdrop}>
        <View style={st.card}>
          {/* Logo mark */}
          <Text style={st.logoMark}>⬡</Text>

          <Spinner />

          <Text style={st.title}>Compiling PDF…</Text>
          <Text style={st.label}>{stageLabel}</Text>

          <View style={st.progressWrap}>
            <ProgressBar pct={progressPct} />
            <Text style={st.pct}>{Math.round(progressPct)}%</Text>
          </View>

          <Text style={st.elapsed}>{elapsed}s elapsed</Text>

          <View style={st.tip}>
            <Text style={st.tipText}>
              💡 First compile is slower — subsequent ones use cache.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.surface,
    borderRadius: R.xl,
    padding: S.xl,
    alignItems: 'center',
    gap: S.md,
    ...shadows.strong,
  },
  logoMark: {
    fontSize: 28,
    color: C.accent,
    marginBottom: S.xs,
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: C.border,
    borderTopColor: C.accent,
  },
  title: {
    fontSize: F.lg,
    fontWeight: '700',
    color: C.text,
    marginTop: S.xs,
  },
  label: {
    fontSize: F.sm,
    color: C.textMuted,
    textAlign: 'center',
  },
  progressWrap: {
    width: '100%',
    gap: S.xs,
  },
  track: {
    width: '100%',
    height: 4,
    backgroundColor: C.border,
    borderRadius: R.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: R.full,
  },
  pct: {
    fontSize: F.xs,
    color: C.textFaint,
    textAlign: 'right',
  },
  elapsed: {
    fontSize: F.xs,
    color: C.textFaint,
  },
  tip: {
    marginTop: S.xs,
    backgroundColor: C.accentGlow,
    borderRadius: R.md,
    padding: S.md,
    width: '100%',
  },
  tipText: {
    fontSize: F.xs,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
