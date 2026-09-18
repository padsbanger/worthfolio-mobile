import { NativeModules, Platform } from 'react-native';
import type { Bootstrap } from '../api/contracts';
import { money } from '../lib/format';

type WidgetNative = {
  activate(lease: string, expiresAt: number): Promise<void>;
  clear(): Promise<void>;
  publish(lease: string, snapshot: string): Promise<void>;
  visibility(lease: string, visible: boolean): Promise<void>;
  isVisible(): Promise<boolean>;
  pin(): Promise<boolean>;
};
const native: WidgetNative | undefined = Platform.OS === 'android' ? NativeModules.WorthfolioWidget : undefined;
export const widgetAvailable = !!native;
let lease: string | null = null;
let sessionId: number | null = null;
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => {}).then(operation);
  queue = next;
  return next;
}
export async function activateWidget(id: number, key: string, expiresAt: number) {
  lease = key;
  sessionId = id;
  await enqueue(async () => { await native?.activate(key, expiresAt * 1000); });
}
export function clearWidget() {
  lease = null;
  sessionId = null;
  return enqueue(async () => { await native?.clear(); });
}
export function widgetSnapshot(data: Bootstrap) {
  const summary = data.portfolioSummary;
  const unavailable = summary.totalPositions > 0 && summary.pricedPositions === 0;
  const observed = summary.asOf ? Date.parse(summary.asOf) : NaN;
  return {
    value: unavailable ? 'Unavailable' : money(summary.value, summary.currency),
    pnl: unavailable ? 'Unavailable' : money(summary.openPnl, summary.currency, true),
    direction: unavailable ? 0 : Math.sign(summary.openPnl),
    coverage: summary.pricedPositions < summary.totalPositions
      ? `Partial value: ${summary.pricedPositions}/${summary.totalPositions} holdings priced` : '',
    asOf: Number.isFinite(observed) ? observed : 0,
  };
}
export function publishWidget(id: number, data: Bootstrap) {
  const key = lease;
  if (!key || sessionId !== id) return Promise.resolve();
  const snapshot = JSON.stringify(widgetSnapshot(data));
  return enqueue(async () => {
    if (lease === key && sessionId === id) await native?.publish(key, snapshot);
  });
}
export function setWidgetVisible(visible: boolean) {
  const key = lease;
  return enqueue(async () => {
    if (!native || !key || lease !== key) throw new Error('Sign in again to configure the widget.');
    await native.visibility(key, visible);
  });
}
export async function widgetVisible() { return native ? native.isVisible() : false; }
export async function pinWidget() { return native ? native.pin() : false; }
