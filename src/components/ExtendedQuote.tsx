import { Text } from 'react-native';
import type { Market } from '../api/contracts';
import { money, percent, timestamp } from '../lib/format';
import { styles } from './ui';
import { colors } from '../theme/theme';

/** One compact session quote; never substitute it for regular price/valuation. */
export function ExtendedQuote({ market, details = false }: { market?: Market; details?: boolean }) {
  const session = market?.session;
  if (!session) return null;
  const pre = session.preMarket && { ...session.preMarket, label: 'Pre-market' };
  const post = session.postMarket && { ...session.postMarket, label: 'After hours' };
  const quote = session.state === 'pre' ? pre : session.state === 'post' ? post
    : [pre, post].filter(q => !!q).sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
  if (!quote) return null;
  if (details) return <Text style={styles.small}>{quote.label} quote: {timestamp(quote.time, true)}</Text>;
  const price = money(quote.price, market?.currency);
  const change = quote.changePct == null ? '' : ` ${percent(quote.changePct)}`;
  const color = quote.changePct == null || quote.changePct === 0 ? colors.muted
    : quote.changePct > 0 ? colors.positive : colors.negative;
  return <Text accessibilityLabel={`${quote.label} ${price}${change}. Quote time: ${timestamp(quote.time, true)}`}
    numberOfLines={1} style={[styles.small, { color, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>
    {quote.label === 'Pre-market' ? 'Pre' : 'After'} {price}{change}
  </Text>;
}
