import { z } from 'zod';

const finite = z.number().finite();
const optionalNumber = finite.nullish();

export const positionSchema = z.object({
  symbol: z.string().min(1),
  quantity: finite,
  avgPrice: optionalNumber,
  lastPrice: optionalNumber,
  currency: z.string().default('USD'),
  baseRate: optionalNumber,
  name: z.string().optional(),
  quoteSource: z.string().optional(),
  quoteRefreshedAt: z.string().optional(),
}).passthrough();

export const watchlistSchema = z.object({
  id: z.string(), name: z.string(), symbols: z.array(z.string()),
}).passthrough();

export const watchlistsSchema = z.object({
  watchlists: z.array(watchlistSchema),
  activeWatchlistId: z.string().nullable(),
}).passthrough();

export const bootstrapSchema = watchlistsSchema.extend({
  generatedAt: z.string(),
  account: z.object({ name: z.string(), ownerId: z.string(), baseCurrency: z.string() }).passthrough(),
  positions: z.array(positionSchema),
  portfolioSummary: z.object({
    value: finite, invested: finite, openPnl: finite, currency: z.string(),
    pricedPositions: finite, totalPositions: finite, coverage: finite, asOf: z.string().nullable(),
  }).passthrough(),
  marketData: z.object({ selectedRefreshSeconds: finite.optional() }).passthrough(),
  authUser: z.object({ sub: z.string(), name: z.string(), email: z.string().optional() }).passthrough(),
});

export const marketSchema = z.object({
  symbol: z.string(), name: z.string(), currency: z.string(), source: z.string(),
  lastPrice: optionalNumber, previousClose: optionalNumber,
  refreshedAt: z.string().optional(), stale: z.boolean().optional(),
  delayed: z.boolean().optional(), cached: z.boolean().optional(), notice: z.string().optional(),
  candles: z.array(z.object({ time: z.string(), close: finite }).passthrough()),
}).passthrough();

export const searchSchema = z.object({ results: z.array(z.object({
  symbol: z.string(), name: z.string(), exchange: z.string(), assetType: z.string(),
}).passthrough()) }).passthrough();

export const credentialSchema = z.object({
  accessToken: z.string().min(1), tokenType: z.literal('Bearer'), expiresAt: finite.positive(),
});
export type Bootstrap = z.infer<typeof bootstrapSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Market = z.infer<typeof marketSchema>;
export type Watchlists = z.infer<typeof watchlistsSchema>;
export type SearchResults = z.infer<typeof searchSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export const chartRanges = ['1D', '5D', '1M', '6M', '1Y', 'ALL'] as const;
export type ChartRange = typeof chartRanges[number];
