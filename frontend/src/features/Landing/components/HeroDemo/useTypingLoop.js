import { useState, useEffect } from 'react';
import { useReducedMotion } from 'motion/react';
import SAMPLES from './demoSamples';

const TYPE_TICK_MS = 24;
const HOLD_MS = 2600;
const FADE_MS = 450;

/**
 * Drives the hero demo loop: typing → hold → fade → next sample.
 * All timers live in one effect with cleanup (StrictMode-safe).
 * `active` should be false when the demo is off-screen — the loop pauses.
 * With reduced motion, returns the completed first sample and never loops.
 */
export default function useTypingLoop(active = true) {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState({ sampleIndex: 0, charCount: 0, phase: 'typing' });

  useEffect(() => {
    if (reducedMotion || !active) return undefined;

    const { phase } = state;

    if (phase === 'typing') {
      let tick = 0;
      const id = setInterval(() => {
        tick += 1;
        setState((s) => {
          const full = SAMPLES[s.sampleIndex].fullRaw;
          if (s.charCount >= full.length) return { ...s, phase: 'hold' };
          // slight speed variance so it reads as human-ish typing
          const step = tick % 3 === 0 ? 2 : 1;
          return { ...s, charCount: Math.min(s.charCount + step, full.length) };
        });
      }, TYPE_TICK_MS);
      return () => clearInterval(id);
    }

    if (phase === 'hold') {
      const id = setTimeout(() => setState((s) => ({ ...s, phase: 'fade' })), HOLD_MS);
      return () => clearTimeout(id);
    }

    // fade → advance to the next sample
    const id = setTimeout(() => {
      setState((s) => ({
        sampleIndex: (s.sampleIndex + 1) % SAMPLES.length,
        charCount: 0,
        phase: 'typing',
      }));
    }, FADE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.sampleIndex, active, reducedMotion]);

  if (reducedMotion) {
    const sample = SAMPLES[0];
    return {
      sample,
      typedText: sample.fullRaw,
      visibleBlockCount: sample.blocks.length,
      phase: 'hold',
    };
  }

  const sample = SAMPLES[state.sampleIndex];
  const typedText = sample.fullRaw.slice(0, state.charCount);
  const visibleBlockCount =
    state.phase === 'typing'
      ? sample.blocks.filter((b) => state.charCount >= b.revealAt).length
      : sample.blocks.length;

  return { sample, typedText, visibleBlockCount, phase: state.phase };
}
