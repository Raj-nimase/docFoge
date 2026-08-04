import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/**
 * Lenis smooth scrolling, scoped to the calling page's lifetime.
 * Destroyed on unmount so other views are never affected. Disabled
 * entirely for users with prefers-reduced-motion.
 *
 * With no arguments it smooths the window scroll (landing page).
 * Pass `wrapperRef`/`contentRef` to smooth an inner scroll container
 * instead (dashboard's .db-scrollable-content). `deps` re-creates the
 * instance when the container remounts (e.g. route-keyed elements).
 *
 * Returns a ref holding the Lenis instance — use
 * `lenisRef.current?.scrollTo(target)` for anchor scrolling so it goes
 * through the smooth pipeline (falls back to native if null).
 */
export default function useLenis({ wrapperRef, contentRef, deps = [] } = {}) {
  const lenisRef = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return undefined;

    // inner-container mode: bail quietly if the elements aren't mounted yet
    const wrapper = wrapperRef ? wrapperRef.current : undefined;
    const content = contentRef ? contentRef.current : undefined;
    if (wrapperRef && !wrapper) return undefined;

    const lenis = new Lenis({
      ...(wrapper ? { wrapper, content: content || wrapper.firstElementChild } : {}),
      duration: 1.1,
      // same family as the house EASE [0.16,1,0.3,1] — fast start, long calm settle
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    let rafId;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return lenisRef;
}
