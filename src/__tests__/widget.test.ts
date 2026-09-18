import { NativeModules } from 'react-native';
import { activateWidget, clearWidget, publishWidget, setWidgetVisible, widgetSnapshot } from '../widget/bridge';
import { sampleBootstrap } from '../fixtures/portfolio';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  actual.Platform.OS = 'android';
  actual.NativeModules.WorthfolioWidget = {
    activate: jest.fn().mockResolvedValue(undefined), clear: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined), visibility: jest.fn().mockResolvedValue(undefined),
  };
  return actual;
});
const native = NativeModules.WorthfolioWidget;
beforeEach(async () => { await clearWidget(); jest.clearAllMocks(); });

test('summary uses backend totals, signed P&L and observation time without leaking account or holdings', () => {
  const data = { ...sampleBootstrap, portfolioSummary: { ...sampleBootstrap.portfolioSummary,
    value: 123.45, openPnl: -5, currency: 'USD', asOf: '2026-09-18T12:00:00Z', pricedPositions: 1, totalPositions: 2 } };
  expect(widgetSnapshot(data)).toEqual({ value: '$123.45', pnl: '-$5.00', direction: -1,
    coverage: 'Partial value: 1/2 holdings priced', asOf: Date.parse('2026-09-18T12:00:00Z') });
});

test('unpriced holdings remain unavailable while an empty portfolio can show zero', () => {
  const data = { ...sampleBootstrap, portfolioSummary: { ...sampleBootstrap.portfolioSummary,
    value: 0, openPnl: 0, pricedPositions: 0, totalPositions: 2, asOf: null } };
  expect(widgetSnapshot(data)).toMatchObject({ value: 'Unavailable', pnl: 'Unavailable', asOf: 0 });
  expect(widgetSnapshot({ ...data, portfolioSummary: { ...data.portfolioSummary, totalPositions: 0 } })).toMatchObject({ value: '$0.00', coverage: '' });
});

test('signed-out and obsolete sessions cannot publish a snapshot', async () => {
  await publishWidget(1, sampleBootstrap);
  await activateWidget(2, 'new-session', 123456);
  await publishWidget(1, sampleBootstrap);
  expect(native.publish).not.toHaveBeenCalled();
  await publishWidget(2, sampleBootstrap);
  expect(native.publish).toHaveBeenCalledWith('new-session', JSON.stringify(widgetSnapshot(sampleBootstrap)));
  expect(native.activate).toHaveBeenCalledWith('new-session', 123456000);
});

test('logout invalidates already queued updates and visibility changes before they reach native storage', async () => {
  await activateWidget(1, 'old-session', 123456);
  const update = publishWidget(1, sampleBootstrap);
  const visibility = setWidgetVisible(true).catch(error => error);
  await clearWidget();
  await update;
  expect(await visibility).toBeInstanceOf(Error);
  expect(native.publish).not.toHaveBeenCalled();
  expect(native.visibility).not.toHaveBeenCalled();
  expect(native.clear).toHaveBeenCalledTimes(1);
});

test('switching accounts drops old work and publishes only with the new lease', async () => {
  await activateWidget(1, 'account-a', 123456);
  const stale = publishWidget(1, sampleBootstrap);
  await activateWidget(2, 'account-b', 123456);
  await stale;
  await publishWidget(2, sampleBootstrap);
  expect(native.publish).toHaveBeenCalledTimes(1);
  expect(native.publish.mock.calls[0][0]).toBe('account-b');
});

test('a native failure does not poison later clearing or publishing', async () => {
  await activateWidget(1, 'a', 123456);
  native.publish.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(publishWidget(1, sampleBootstrap)).rejects.toThrow('storage unavailable');
  await clearWidget();
  await activateWidget(2, 'b', 123456);
  await publishWidget(2, sampleBootstrap);
  expect(native.publish).toHaveBeenLastCalledWith('b', expect.any(String));
});
