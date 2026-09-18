import { render, screen } from '@testing-library/react-native';
import { ExtendedQuote, extendedQuoteDescription } from '../components/ExtendedQuote';
import { marketSchema } from '../api/contracts';
import { sampleMarket } from '../fixtures/portfolio';
import { colors } from '../theme/theme';
import { timestamp } from '../lib/format';

const pre = { price: 101, changePct: 1, time: '2026-09-18T12:00:00Z' };
const post = { price: 102, changePct: -2, time: '2026-09-17T21:00:00Z' };
const market = (state: string) => marketSchema.parse({ ...sampleMarket('NASDAQ:AAPL'),
  session: { state, preMarket: pre, postMarket: post } });

test('pre-market uses a compact green label with timestamp in details', () => {
  const view = render(<ExtendedQuote market={market('pre')} />);
  expect(screen.getByText(/Pre \$101.00/)).toBeTruthy();
  expect(screen.getByText(/Pre \$101.00 \+1.00%/)).toHaveStyle({ color: colors.positive, textAlign: 'right' });
  expect(screen.queryByText(new RegExp(timestamp(pre.time, true)))).toBeNull();
  expect(screen.getByLabelText(/Pre-market.*Quote time:/)).toBeTruthy();
  view.rerender(<ExtendedQuote market={market('pre')} details />);
  expect(screen.getByText(new RegExp(timestamp(pre.time, true)))).toBeTruthy();
  expect(screen.queryByText(/After hours/)).toBeNull();
});

test('post-market selects its own quote and closed markets show only the latest timestamped session', () => {
  const view = render(<ExtendedQuote market={market('post')} />);
  expect(screen.getByText(/After \$102.00/)).toBeTruthy();
  expect(screen.getByText(/After \$102.00 -2.00%/)).toHaveStyle({ color: colors.negative });
  view.rerender(<ExtendedQuote market={market('closed')} />);
  expect(screen.getByText(/Pre \$101.00/)).toBeTruthy();
  expect(screen.queryByText(/After hours/)).toBeNull();
});

test('missing active quote never substitutes a previous session or adds a placeholder', () => {
  render(<ExtendedQuote market={marketSchema.parse({ ...market('pre'),
    session: { state: 'pre', postMarket: post } })} />);
  expect(screen.toJSON()).toBeNull();
});

test('malformed optional session data leaves regular quotes usable and occupies no space', () => {
  for (const session of [undefined, null, { state: 'pre', preMarket: { ...pre, price: -1 } },
    { state: 'pre', preMarket: { ...pre, time: 'invalid' } }, 'invalid']) {
    const parsed = marketSchema.parse({ ...sampleMarket('NASDAQ:AAPL'), session });
    const view = render(<ExtendedQuote market={parsed} />);
    expect(parsed.lastPrice).toBeGreaterThan(0);
    expect(view.toJSON()).toBeNull();
    view.unmount();
  }
});

test('missing percentage is not displayed as zero', () => {
  render(<ExtendedQuote market={marketSchema.parse({ ...market('pre'),
    session: { state: 'pre', preMarket: { ...pre, changePct: null } } })} />);
  expect(screen.getByText(/Pre \$101.00/)).toBeTruthy();
  expect(screen.queryByText(/%/)).toBeNull();
});

test('the compact extended quote has a full non-color accessibility description', () => {
  expect(extendedQuoteDescription(market('pre'))).toContain('Pre-market price $101.00. Up 1.00%.');
  expect(extendedQuoteDescription(market('post'))).toContain('After hours price $102.00. Down 2.00%.');
  expect(extendedQuoteDescription(undefined)).toBeUndefined();
});
