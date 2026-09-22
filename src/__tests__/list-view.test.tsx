import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';
import { ListControls } from '../components/ListControls';
import { useListPreferences } from '../features/list-preferences';
import { baseUnitPrice, periodChange, priceRates, sortAssets, type AssetSort } from '../lib/list-view';
import { sampleBootstrap, sampleMarket } from '../fixtures/portfolio';

jest.mock('../lib/config', () => ({ server: { url: 'https://worthfolio.test' } }));
const market = sampleMarket('NASDAQ:AAPL');
const assets = [
  { symbol: 'Z', name: 'Zulu', change: -4, price: 10 },
  { symbol: 'A', name: 'Alpha', change: 12, price: 100 },
  { symbol: 'N', name: 'Missing', change: null, price: null },
  { symbol: 'B', name: 'Beta', change: 0, price: 20 },
];
test.each<[AssetSort, string[]]>([
  ['default', ['Z', 'A', 'N', 'B']], ['gains', ['A', 'B', 'Z', 'N']], ['losses', ['Z', 'B', 'A', 'N']],
  ['alpha', ['A', 'B', 'N', 'Z']], ['price-high', ['A', 'B', 'Z', 'N']], ['price-low', ['Z', 'B', 'A', 'N']],
])('%s sorting keeps unavailable last and does not mutate the source', (sort, symbols) => {
  const original = [...assets];
  expect(sortAssets(assets, sort, a => a).map(a => a.symbol)).toEqual(symbols);
  expect(assets).toEqual(original);
});
test('ties have deterministic name/symbol ordering; non-finite values are missing', () => {
  const rows = ['Z', 'A'].map(symbol => ({ symbol, name: 'Same', change: 2, price: 10 }));
  expect(sortAssets(rows, 'gains', a => a).map(a => a.symbol)).toEqual(['A', 'Z']);
  expect(sortAssets([...rows, { symbol: 'N', name: 'AAA', change: NaN, price: Infinity }], 'losses', a => a).at(-1)?.symbol).toBe('N');
});
test('daily change uses previous close rather than the first intraday candle', () => {
  expect(periodChange({ ...market, lastPrice: 110, previousClose: 100, candles: [{ time: '2026-09-18', close: 109 }] }, '1D').value).toBeCloseTo(10);
  expect(periodChange({ ...market, previousClose: null }, '1D').value).toBeNull();
});
test('hourly change needs actual observations covering the hour, rejecting overnight gaps', () => {
  const candles = [
    { time: '2026-09-18T10:00:00Z', close: 100 }, { time: '2026-09-18T10:30:00Z', close: 108 },
    { time: '2026-09-18T11:00:00Z', close: 110 },
  ];
  expect(periodChange({ ...market, lastPrice: 150, candles }, '1H')).toEqual({ value: expect.closeTo(10), from: candles[0]!.time, to: candles[2]!.time });
  expect(periodChange({ ...market, candles: candles.slice(1) }, '1H').value).toBeNull();
  expect(periodChange({ ...market, candles: [{ time: '2026-09-17T16:00:00Z', close: 100 }, candles[2]!] }, '1H').value).toBeNull();
});
test('weekly change uses seven days with a bounded market-closure gap, not five-day return', () => {
  const end = { time: '2026-09-18T16:00:00Z', close: 120 };
  expect(periodChange({ ...market, candles: [{ time: '2026-09-11T16:00:00Z', close: 100 }, end] }, '1W').value).toBeCloseTo(20);
  for (const time of ['2026-09-13T16:00:00Z', '2026-09-07T16:00:00Z']) {
    expect(periodChange({ ...market, candles: [{ time, close: 100 }, end] }, '1W').value).toBeNull();
  }
});
test('unit prices normalize GBX and use only available FX regardless of position direction', () => {
  const rates = priceRates([{ ...sampleBootstrap.positions[0]!, quantity: -4, currency: 'GBX', baseRate: 1.25 }], 'USD');
  expect(baseUnitPrice(2000, 'GBX', rates)).toBe(25);
  expect(baseUnitPrice(20, 'GBP', rates)).toBe(25);
  expect(baseUnitPrice(20, 'USD', rates)).toBe(20);
  expect(baseUnitPrice(20, 'EUR', rates)).toBeNull();
  expect(baseUnitPrice(0, 'USD', rates)).toBeNull();
});
test('dropdown announces selection and closes after choosing; chips report the selected period', () => {
  const sort = jest.fn(), period = jest.fn();
  render(<ListControls sort="default" period="1D" currency="USD" onSort={sort} onPeriod={period} />);
  fireEvent.press(screen.getByLabelText('Sort assets. Default order'));
  fireEvent.press(screen.getByLabelText('Largest price rises'));
  expect(sort).toHaveBeenCalledWith('gains');
  expect(screen.queryByLabelText('Close sorting')).toBeNull();
  expect(screen.getByLabelText('1D price change')).toBeSelected();
  fireEvent.press(screen.getByLabelText('1H price change'));
  expect(period).toHaveBeenCalledWith('1H');
});
test('selected controls identify the active view and reset sort and period through the sorting dialog', () => {
  const reset = jest.fn();
  const view = render(<ListControls sort="default" period="1D" currency="USD" onSort={jest.fn()} onPeriod={jest.fn()} onReset={reset} />);
  expect(screen.getByText('Sort: Default order')).toBeTruthy();
  expect(screen.getByText('1D price change · previous close')).toBeTruthy();
  expect(screen.queryByLabelText('Reset list view')).toBeNull();
  view.rerender(<ListControls sort="gains" period="1W" currency="USD" onSort={jest.fn()} onPeriod={jest.fn()} onReset={reset} />);
  expect(screen.getByText('Sort: Largest price rises')).toBeTruthy();
  expect(screen.getByText('1W price change · observed closes')).toBeTruthy();
  expect(screen.queryByLabelText('Reset list view')).toBeNull();
  fireEvent.press(screen.getByLabelText('Sort assets. Largest price rises'));
  fireEvent.press(screen.getByLabelText('Reset list view'));
  expect(reset).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Close sorting')).toBeNull();
});
test('Android Back closes sorting without changing the local view', () => {
  render(<ListControls sort="gains" period="1D" currency="USD" onSort={jest.fn()} onPeriod={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('Sort assets. Largest price rises'));
  act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
  expect(screen.queryByLabelText('Close sorting')).toBeNull();
  expect(screen.getByText('Sort: Largest price rises')).toBeTruthy();
});
test('late preference restoration cannot override user choice or leak across owners', async () => {
  let finish!: (value: string) => void;
  const get = jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const set = jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue();
  const { result, rerender } = renderHook(({ owner }: { owner: string }) => useListPreferences('portfolio', owner, false), { initialProps: { owner: 'one' } });
  act(() => result.current.update({ sort: 'gains', period: '1H' }));
  await act(async () => finish(JSON.stringify({ sort: 'alpha', period: '1W' })));
  expect(result.current.sort).toBe('gains');
  expect(set).toHaveBeenCalledWith('list-view:https://worthfolio.test:one:portfolio', '{"sort":"gains","period":"1H"}');
  get.mockResolvedValue(null);
  rerender({ owner: 'two' });
  expect(result.current.sort).toBe('default');
  expect(result.current.period).toBe('1D');
  await act(async () => {});
  get.mockRestore(); set.mockRestore();
});
test('reset restores and persists this screen defaults without altering another owner', async () => {
  const get = jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
  const set = jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue();
  const { result } = renderHook(() => useListPreferences('watchlists', 'one', false));
  await act(async () => {});
  act(() => result.current.update({ sort: 'price-high', period: '1W' }));
  act(() => result.current.reset());
  expect(result.current).toMatchObject({ sort: 'default', period: '1D' });
  await act(async () => {});
  expect(set).toHaveBeenLastCalledWith('list-view:https://worthfolio.test:one:watchlists', '{"sort":"default","period":"1D"}');
  get.mockRestore(); set.mockRestore();
});
