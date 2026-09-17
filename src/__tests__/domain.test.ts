import { bootstrapSchema, marketSchema } from '../api/contracts';
import { sampleBootstrap, sampleMarket } from '../fixtures/portfolio';
import { chartGeometry, nearestPoint } from '../lib/chart';
import { parseServerUrl } from '../lib/config';
import { positionValues, money } from '../lib/format';

test('only HTTPS origins without credentials, paths, or query strings are accepted', () => {
  expect(parseServerUrl('https://worthfolio.pripyat.cloud/').url).toBe('https://worthfolio.pripyat.cloud');
  for (const value of ['', 'http://example.com', 'https://user:password@example.com', 'https://example.com/api', 'https://example.com/?key=secret']) {
    expect(parseServerUrl(value).error).not.toBeNull();
  }
});

test('fixtures match the backend contracts and malformed essentials are rejected', () => {
  expect(bootstrapSchema.safeParse(sampleBootstrap).success).toBe(true);
  expect(marketSchema.safeParse(sampleMarket('NASDAQ:AAPL')).success).toBe(true);
  expect(bootstrapSchema.safeParse({ ...sampleBootstrap, positions: [{ symbol: 'X', quantity: 'invalid' }] }).success).toBe(false);
});

test('position displays preserve short signs, GBX scaling, and missing conversions', () => {
  expect(positionValues({ symbol: 'LSE:TEST', quantity: 10, lastPrice: 200, avgPrice: 100, currency: 'GBX', baseRate: 1.25 }))
    .toEqual({ value: 25, pnl: 12.5 });
  expect(positionValues({ symbol: 'X', quantity: -10, lastPrice: 90, avgPrice: 100, currency: 'USD' }))
    .toEqual({ value: -900, pnl: 100 });
  expect(positionValues({ symbol: 'X', quantity: 10, lastPrice: 10, currency: 'PLN' }))
    .toEqual({ value: null, pnl: null });
  expect(positionValues({ symbol: 'X', quantity: 10, lastPrice: null, currency: 'USD' }).value).toBeNull();
  expect(money(null)).toBe('Unavailable');
  expect(money(0)).toBe('$0.00');
});

test('chart handles empty, flat, single-point, unsorted, and invalid observations', () => {
  expect(chartGeometry([], 300, 200).points).toEqual([]);
  const single = chartGeometry([{ time: '2026-01-01', close: 10 }], 300, 200);
  expect(single.points[0]?.x).toBe(150);
  expect(single.points[0]?.y).toBeCloseTo(100);
  const chart = chartGeometry([
    { time: '2026-01-03', close: 10 }, { time: 'invalid', close: 5 },
    { time: '2026-01-01', close: 10 }, { time: '2026-01-02', close: NaN },
  ], 300, 200);
  expect(chart.path).not.toMatch(/NaN|Infinity/);
  expect(chart.points.map(p => p.time)).toEqual(['2026-01-01', '2026-01-03']);
  expect(nearestPoint(chart.points, 0)?.time).toBe('2026-01-01');
  expect(nearestPoint(chart.points, 300)?.time).toBe('2026-01-03');
});

test('chart sorting preserves immutable cached observations', () => {
  const observations = [{ time: '2026-01-03', close: 12 }, { time: '2026-01-01', close: 10 }];
  Object.freeze(observations);
  const chart = chartGeometry(observations, 300, 200);
  expect(chart.points.map(p => p.time)).toEqual(['2026-01-01', '2026-01-03']);
  expect(observations[0]?.time).toBe('2026-01-03');
});
