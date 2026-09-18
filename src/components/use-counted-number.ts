import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { useEffect, useRef, useState } from 'react';

export const counterDurationMs = 360;
export function interpolateCount(start: number, end: number, progress: number) {
  return start + (end - start) * Math.max(0, Math.min(1, progress));
}

/** Animate later authoritative updates, never a first render or an unavailable value. */
export function useCountedNumber(value: number, duration = counterDurationMs) {
  const [displayed, setDisplayed] = useState(value);
  const previous = useRef<number | undefined>(undefined);
  useEffect(() => {
    const start = previous.current;
    previous.current = value;
    if (!Number.isFinite(value) || start == null || !Number.isFinite(start) || start === value) {
      setDisplayed(value);
      return;
    }
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduced => {
      if (cancelled) return;
      if (reduced) { setDisplayed(value); return; }
      const progress = new Animated.Value(0);
      const listener = progress.addListener(({ value: fraction }) => setDisplayed(interpolateCount(start, value, fraction)));
      animation = Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
      animation.start(({ finished }) => {
        progress.removeListener(listener);
        if (finished && !cancelled) setDisplayed(value);
      });
    });
    return () => { cancelled = true; animation?.stop(); };
  }, [value, duration]);
  return displayed;
}
