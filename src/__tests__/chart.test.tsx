import { fireEvent, render, screen } from '@testing-library/react-native';
import { PriceChart } from '../components/PriceChart';
import { chartGeometry, nearestPoint } from '../lib/chart';
import { money, timestamp } from '../lib/format';

jest.mock('../api/data', () => ({ useData: () => ({ demo: false, online: true }) }));
// Representative observed closes with a gap; no interpolation points are invented.
const observations = [
  { time: '2026-01-02T16:00:00Z', close: 271.01 },
  { time: '2026-01-05T16:00:00Z', close: 267.26 },
  { time: '2026-01-20T16:00:00Z', close: 246.70 },
];
const label = (index: number) => `${money(observations[index]!.close, 'USD')}, ${timestamp(observations[index]!.time, true)}`;

test('sparse series uses elapsed time and selects actual observations at the edges and gaps', () => {
  const geometry = chartGeometry(observations, 316, 200);
  expect(geometry.points).toHaveLength(3);
  expect(geometry.points[1]!.x).toBeCloseTo(58);
  expect(geometry.points[2]!.x).toBe(308);
  expect(nearestPoint(geometry.points, -100)?.close).toBe(271.01);
  expect(nearestPoint(geometry.points, 100)?.close).toBe(267.26);
  expect(nearestPoint(geometry.points, 500)?.close).toBe(246.70);
});

test('price scale aligns with observed extremes and uses one label for flat history', () => {
  const geometry = chartGeometry(observations, 316, 200);
  expect(geometry.ticks[0]).toEqual({ value: 271.01, y: geometry.points[0]!.y });
  expect(geometry.ticks[2]).toEqual({ value: 246.70, y: geometry.points[2]!.y });
  expect(geometry.ticks[1]!.y).toBeCloseTo(100);
  expect(chartGeometry(observations.map(p => ({ ...p, close: 10 })), 316, 200).ticks).toEqual([{ value: 10, y: expect.closeTo(100) }]);
});

test('touch and accessible increment/decrement inspect observations and retain selection after live updates', () => {
  const view = render(<PriceChart observations={observations} currency="USD" />);
  const chart = () => screen.getByRole('adjustable');
  fireEvent(chart(), 'layout', { nativeEvent: { layout: { width: 316 } } });
  expect(chart()).toHaveAccessibilityValue({ text: label(2) });
  fireEvent(chart(), 'responderGrant', { nativeEvent: { locationX: 8 } });
  expect(chart()).toHaveAccessibilityValue({ text: label(0) });
  fireEvent(chart(), 'responderMove', { nativeEvent: { locationX: 100 } });
  expect(chart()).toHaveAccessibilityValue({ text: label(1) });
  fireEvent(chart(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(chart()).toHaveAccessibilityValue({ text: label(2) });
  fireEvent(chart(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(chart()).toHaveAccessibilityValue({ text: label(2) });
  fireEvent(chart(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  view.rerender(<PriceChart observations={[...observations, { time: '2026-01-21', close: 248 }]} currency="USD" />);
  expect(chart()).toHaveAccessibilityValue({ text: label(1) });
});

test('absent/invalid history stays unavailable; single and flat history remains inspectable', () => {
  const view = render(<PriceChart observations={[]} currency="USD" />);
  expect(screen.getByText('No real price history is available for this range.')).toBeTruthy();
  expect(screen.queryByRole('adjustable')).toBeNull();
  view.rerender(<PriceChart observations={[observations[0]!]} currency="USD" />);
  fireEvent(screen.getByRole('adjustable'), 'responderGrant', { nativeEvent: { locationX: 300 } });
  expect(screen.getByRole('adjustable')).toHaveAccessibilityValue({ text: label(0) });
  const flat = chartGeometry(observations.map(p => ({ ...p, close: 10 })), 300, 200);
  flat.points.forEach(point => expect(point.y).toBeCloseTo(100));
  expect(flat.path).not.toMatch(/NaN|Infinity/);
});

test('draws buy and sell markers only for trades inside the displayed history', () => {
  render(<PriceChart observations={observations} currency="USD" trades={[
    { side: 'buy', time: '2026-01-02T16:00:00Z' },
    { side: 'sell', time: '2026-01-20T16:00:00Z' },
    { side: 'buy', time: '2025-12-31T16:00:00Z' },
  ]} />);
  expect(screen.getByLabelText('1 buy and 1 sell markers in this chart range')).toBeTruthy();
  expect(screen.getByText('Buy')).toBeTruthy();
  expect(screen.getByText('Sell')).toBeTruthy();
});
