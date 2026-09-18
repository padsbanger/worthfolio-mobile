import type { Market, Position } from '../api/contracts';

export const sortOptions = [
  { id: 'default', label: 'Default order' },
  { id: 'gains', label: 'Biggest gains' },
  { id: 'losses', label: 'Lowest gains' },
  { id: 'alpha', label: 'Alphabetical' },
  { id: 'price-high', label: 'Highest price' },
  { id: 'price-low', label: 'Lowest price' },
] as const;
export type AssetSort = typeof sortOptions[number]['id'];
export const periods = ['1H', '1D', '1W'] as const;
export type ListPeriod = typeof periods[number];
export const periodLabel = (period: ListPeriod) => period === '1D' ? 'Daily change' : `${period} price change`;
const positive = (value: number | null | undefined): value is number => value != null && Number.isFinite(value) && value > 0;

export function periodChange(market: Market | undefined, period: ListPeriod) {
  const unavailable = { value: null, from: null, to: null };
  if (!market) return unavailable;
  if (period === '1D') return positive(market.lastPrice) && positive(market.previousClose)
    ? { value: (market.lastPrice / market.previousClose - 1) * 100, from: null, to: null } : unavailable;
  const points = market.candles.filter(p => positive(p.close) && Number.isFinite(Date.parse(p.time)))
    .slice().sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const end = points.at(-1);
  if (!end) return unavailable;
  const duration = period === '1H' ? 3_600_000 : 7 * 86_400_000;
  const tolerance = period === '1H' ? 15 * 60_000 : 3 * 86_400_000;
  const target = Date.parse(end.time) - duration;
  const start = points.filter(p => Date.parse(p.time) <= target).at(-1);
  if (!start || target - Date.parse(start.time) > tolerance) return unavailable;
  return { value: (end.close / start.close - 1) * 100, from: start.time, to: end.time };
}

export const normalizedCurrency = (currency: string) => currency === 'GBX' ? 'GBP' : currency === 'USDT' ? 'USD' : currency;
export function priceRates(positions: Position[], base: string) {
  const rates: Record<string, number> = { [base]: 1 };
  for (const p of positions) {
    const currency = normalizedCurrency(p.currency);
    if (currency !== base && positive(p.baseRate) && rates[currency] == null) rates[currency] = p.baseRate;
  }
  return rates;
}
export function baseUnitPrice(price: number | null | undefined, currency: string, rates: Record<string, number>) {
  const rate = rates[normalizedCurrency(currency)];
  return positive(price) && positive(rate) ? price * rate / (currency === 'GBX' ? 100 : 1) : null;
}
export function sortAssets<T>(items: readonly T[], sort: AssetSort, get: (item: T) => {
  symbol: string; name: string; change: number | null; price: number | null;
}): T[] {
  if (sort === 'default') return [...items];
  // Compute historical metrics once per asset, not once per sort comparison.
  return items.map(item => ({ item, ...get(item) })).sort((x, y) => {
    const tie = x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }) || x.symbol.localeCompare(y.symbol);
    if (sort === 'alpha') return tie;
    const left = sort.startsWith('price') ? x.price : x.change;
    const right = sort.startsWith('price') ? y.price : y.change;
    const leftMissing = left == null || !Number.isFinite(left), rightMissing = right == null || !Number.isFinite(right);
    if (leftMissing || rightMissing) return leftMissing === rightMissing ? tie : leftMissing ? 1 : -1;
    return (sort === 'gains' || sort === 'price-high' ? right! - left! : left! - right!) || tie;
  }).map(row => row.item);
}
