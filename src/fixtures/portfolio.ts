import type { Bootstrap, Market, SearchResults, ChartRange } from '../api/contracts';

const at = '2026-09-16T16:00:00Z';
export const sampleBootstrap: Bootstrap = {
  generatedAt: at,
  account: { name: 'Sample portfolio', ownerId: 'sample', baseCurrency: 'USD' },
  authUser: { sub: 'sample', name: 'Sample account' },
  positions: [
    { symbol: 'NASDAQ:AAPL', name: 'Apple', quantity: 20, avgPrice: 180, lastPrice: 210, currency: 'USD', baseRate: 1, quoteSource: 'Development fixture', quoteRefreshedAt: at },
    { symbol: 'NASDAQ:MSFT', name: 'Microsoft', quantity: 10, avgPrice: 390, lastPrice: 420, currency: 'USD', baseRate: 1, quoteSource: 'Development fixture', quoteRefreshedAt: at },
    { symbol: 'NYSE:VTI', name: 'Vanguard Total Stock Market ETF', quantity: 30, avgPrice: 260, lastPrice: 280, currency: 'USD', baseRate: 1, quoteSource: 'Development fixture', quoteRefreshedAt: at },
  ],
  portfolioSummary: { value: 16800, invested: 15300, openPnl: 1500, currency: 'USD', pricedPositions: 3, totalPositions: 3, coverage: 100, asOf: at },
  marketData: { selectedRefreshSeconds: 5 },
  watchlists: [
    { id: 'sample-core', name: 'Core holdings', symbols: ['NASDAQ:AAPL', 'NASDAQ:MSFT', 'NYSE:VTI'] },
    { id: 'sample-explore', name: 'On my radar', symbols: ['NASDAQ:NVDA', 'BTC-USD'] },
    { id: 'sample-empty', name: 'New ideas', symbols: [] },
  ],
  activeWatchlistId: 'sample-core',
};

const assets = [
  ...sampleBootstrap.positions.map(p => ({ symbol: p.symbol, name: p.name!, price: p.lastPrice! })),
  { symbol: 'NASDAQ:NVDA', name: 'NVIDIA', price: 120 },
  { symbol: 'BTC-USD', name: 'Bitcoin / US dollar', price: 65000 },
];
export function sampleMarket(symbol: string, range: ChartRange = '1M'): Market {
  const asset = assets.find(a => a.symbol === symbol);
  const price = asset?.price ?? 100;
  const days = { '1D': 1, '5D': 5, '1M': 30, '6M': 180, '1Y': 365, ALL: 1825 }[range];
  const candles = Array.from({ length: 60 }, (_, i) => ({
    time: new Date(Date.parse(at) - ((59 - i) / 59) * days * 86400000).toISOString(),
    close: i === 59 ? price : price * (0.94 + i * 0.001 + Math.sin(i * 0.65) * 0.012),
  }));
  return { symbol, name: asset?.name ?? symbol, currency: 'USD', source: 'Development fixture',
    lastPrice: price, previousClose: price / 1.012, refreshedAt: at, candles };
}
export function sampleSearch(query: string): SearchResults {
  return { results: assets.filter(a => `${a.symbol} ${a.name}`.toLowerCase().includes(query.toLowerCase()))
    .map(a => ({ symbol: a.symbol, name: a.name, exchange: a.symbol.split(':')[0]!, assetType: a.symbol === 'BTC-USD' ? 'Crypto' : 'Security' })) };
}
