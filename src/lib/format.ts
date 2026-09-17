import type { Position } from '../api/contracts';

export function money(value: number | null | undefined, currency = 'USD', signed = false) {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  const quoteCurrency = currency === 'GBX' ? 'GBP' : currency;
  const amount = currency === 'GBX' ? value / 100 : value;
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency', currency: quoteCurrency,
      signDisplay: signed ? 'exceptZero' : 'auto', maximumFractionDigits: 2,
    }).format(amount);
  } catch { return `${signed && amount > 0 ? '+' : ''}${amount.toFixed(2)} ${quoteCurrency}`; }
}

export function number(value: number) { return new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value); }
export function percent(value: number | null) { return value == null ? 'Unavailable' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`; }
export function timestamp(value: string | null | undefined, includeYear = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time unavailable';
  return new Date(value).toLocaleString('en', { ...(includeYear ? { year: 'numeric' } as const : {}), month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function ticker(symbol: string) { return symbol.split(':').at(-1) || symbol; }

// Display-only calculations follow worthfolio/domain/portfolio.py. Totals stay server-owned.
export function positionValues(position: Position, latest = position.lastPrice, baseCurrency = 'USD') {
  const quoteCurrency = position.currency === 'GBX' ? 'GBP' : position.currency === 'USDT' ? 'USD' : position.currency;
  const rate = position.baseRate ?? (quoteCurrency === baseCurrency ? 1 : null);
  if (latest == null || !Number.isFinite(latest) || latest <= 0 || rate == null || !Number.isFinite(rate) || rate <= 0) {
    return { value: null, pnl: null };
  }
  const scale = rate / (position.currency === 'GBX' ? 100 : 1);
  return {
    value: position.quantity * latest * scale,
    pnl: position.avgPrice == null ? null : (latest - position.avgPrice) * position.quantity * scale,
  };
}
