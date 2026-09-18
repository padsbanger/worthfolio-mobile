import { counterDurationMs, interpolateCount, useCountedNumber } from '../components/use-counted-number';
import { AccessibilityInfo } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

test('counter interpolation preserves direction and clamps out-of-range frames', () => {
  expect(counterDurationMs).toBe(360);
  expect(interpolateCount(100, 125, 0)).toBe(100);
  expect(interpolateCount(100, 125, 0.5)).toBe(112.5);
  expect(interpolateCount(125, 100, 0.5)).toBe(112.5);
  expect(interpolateCount(100, 125, -1)).toBe(100);
  expect(interpolateCount(100, 125, 2)).toBe(125);
});

test('first values and Reduce Motion updates remain static', async () => {
  const reduceMotion = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const { result, rerender } = renderHook<number, { value: number }>(({ value }) => useCountedNumber(value), { initialProps: { value: 100 } });
  expect(result.current).toBe(100);
  rerender({ value: 125 });
  await act(async () => {});
  expect(result.current).toBe(125);
  reduceMotion.mockRestore();
});
