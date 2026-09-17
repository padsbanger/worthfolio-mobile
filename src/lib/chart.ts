export type Observation = { time: string; close: number };
export type ChartPoint = Observation & { x: number; y: number };

export function chartGeometry(observations: Observation[], width: number, height: number) {
  const sorted = observations.filter(p => Number.isFinite(Date.parse(p.time)) && Number.isFinite(p.close) && p.close > 0)
    // filter creates a new array; sort preserves the cached input and works in Hermes.
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (!sorted.length) return { points: [] as ChartPoint[], path: '', low: 0, high: 0 };
  const low = sorted.reduce((value, p) => Math.min(value, p.close), Infinity);
  const high = sorted.reduce((value, p) => Math.max(value, p.close), -Infinity);
  const margin = high === low ? Math.max(high * 0.01, 0.01) : (high - low) * 0.08;
  const start = Date.parse(sorted[0]!.time);
  const duration = Date.parse(sorted.at(-1)!.time) - start;
  const points = sorted.map(p => ({ ...p,
    x: duration ? 8 + (Date.parse(p.time) - start) / duration * Math.max(0, width - 16) : width / 2,
    y: 8 + (high + margin - p.close) / (high - low + 2 * margin) * Math.max(0, height - 16),
  }));
  return { points, low, high, path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') };
}
export function nearestPoint(points: ChartPoint[], x: number) {
  return points.reduce<ChartPoint | null>((best, point) => !best || Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best, null);
}
