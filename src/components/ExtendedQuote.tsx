import { Text } from 'react-native';
import type { Market } from '../api/contracts';
import { money, percent, timestamp } from '../lib/format';
import { styles } from './ui';
import { colors } from '../theme/theme';

function selectedExtendedQuote(market: Market | undefined) {
  const session = market?.session;
  if (!session) return undefined;
  // `open` is the backend's regular-session state. Its pre/post observations
  // are historical at that point and must not compete with the live price.
  if (session.state === 'open') return undefined;
  const pre = session.preMarket && { ...session.preMarket, label: 'Pre-market' };
  const post = session.postMarket && { ...session.postMarket, label: 'After hours' };
  return session.state === 'pre' ? pre : session.state === 'post' ? post
    : [pre, post].filter(q => !!q).sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
}

export function extendedQuoteDescription(market: Market | undefined) {
  const quote = selectedExtendedQuote(market);
  if (!quote) return undefined;
  const magnitude = quote.changePct == null ? '' : percent(Math.abs(quote.changePct)).replace(/^\+/, '');
  const movement = quote.changePct == null ? 'Change unavailable.' : quote.changePct > 0 ? `Up ${magnitude}.`
    : quote.changePct < 0 ? `Down ${magnitude}.` : 'Unchanged.';
  return `${quote.label} price ${money(quote.price, market?.currency)}. ${movement} Quote time: ${timestamp(quote.time, true)}.`;
}

/** One compact session quote; never substitute it for regular price/valuation. */
export function ExtendedQuote({ market, details = false, align = 'right' }: { market?: Market; details?: boolean; align?: 'left' | 'right' }) {
  const quote = selectedExtendedQuote(market);
  if (!quote) return null;
  if (details) return <Text style={styles.small}>{quote.label} quote: {timestamp(quote.time, true)}</Text>;
  const price = money(quote.price, market?.currency);
  const change = quote.changePct == null ? '' : ` ${percent(quote.changePct)}`;
  const color = quote.changePct == null || quote.changePct === 0 ? colors.muted
    : quote.changePct > 0 ? colors.positive : colors.negative;
  return <Text accessibilityLabel={`${quote.label} ${price}${change}. Quote time: ${timestamp(quote.time, true)}`}
    style={[styles.small, { color, textAlign: align, fontVariant: ['tabular-nums'] }]}>
    {quote.label === 'Pre-market' ? 'Pre' : 'After'} {price}{change}
  </Text>;
}
