import { z } from 'zod';
import { ApiClient, retryRead, ApiError } from '../api/client';
import { MarketQueue } from '../api/market-queue';

const schema = z.object({ ok: z.boolean() });
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test('API requests omit cookies, use bearer auth, and reject malformed responses', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  global.fetch = fetcher;
  const client = new ApiClient('https://example.com', 'secret');
  await expect(client.request('/api/bootstrap', schema)).resolves.toEqual({ ok: true });
  expect(fetcher.mock.calls[0]![1]).toMatchObject({ credentials: 'omit', redirect: 'error', headers: { Authorization: 'Bearer secret' } });
  fetcher.mockResolvedValue({ ok: true, status: 200, json: async () => ({ unexpected: true }) });
  await expect(client.request('/api/bootstrap', schema)).rejects.toMatchObject({ status: 422 });
});

test('401 ends the session and does not retry', async () => {
  const expired = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  const client = new ApiClient('https://example.com', 'expired', expired);
  await expect(client.request('/api/bootstrap', schema)).rejects.toMatchObject({ status: 401 });
  expect(expired).toHaveBeenCalledTimes(1);
  expect(retryRead(0, new ApiError('expired', 401))).toBe(false);
  expect(retryRead(0, new ApiError('temporary', 503))).toBe(true);
  expect(retryRead(1, new ApiError('temporary', 503))).toBe(false);
});

test('closing a session rejects late responses even when the transport ignores abort', async () => {
  let release!: (value: unknown) => void;
  global.fetch = jest.fn().mockReturnValue(new Promise(resolve => { release = resolve; }));
  const client = new ApiClient('https://example.com', 'old-token');
  const pending = client.request('/api/bootstrap', schema);
  client.close();
  release({ ok: true, status: 200, json: async () => ({ ok: true }) });
  await expect(pending).rejects.toMatchObject({ status: 0 });
  await expect(client.request('/api/bootstrap', schema)).rejects.toMatchObject({ status: 0 });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('an old session cannot expire the new session through a late 401', async () => {
  let release!: (value: unknown) => void;
  const expire = jest.fn();
  global.fetch = jest.fn().mockReturnValue(new Promise(resolve => { release = resolve; }));
  const client = new ApiClient('https://example.com', 'old-token', expire);
  const pending = client.request('/api/bootstrap', schema);
  client.close();
  release({ ok: false, status: 401 });
  await expect(pending).rejects.toMatchObject({ status: 0 });
  expect(expire).not.toHaveBeenCalled();
});

test('market queue bounds concurrency, merges duplicates, and cancels waiting work', async () => {
  const queue = new MarketQueue();
  let active = 0;
  let peak = 0;
  const release: (() => void)[] = [];
  const run = jest.fn(() => new Promise<number>(resolve => {
    peak = Math.max(peak, ++active);
    release.push(() => { active--; resolve(1); });
  }));
  const control = new AbortController();
  const a = queue.request('a', control.signal, run);
  const duplicate = queue.request('a', control.signal, run);
  const b = queue.request('b', control.signal, run);
  const c = queue.request('c', control.signal, run);
  const cancel = new AbortController();
  const d = queue.request('d', cancel.signal, run);
  cancel.abort();
  await expect(d).rejects.toThrow('cancelled');
  expect(run).toHaveBeenCalledTimes(3);
  release.forEach(finish => finish());
  await expect(Promise.all([a, duplicate, b, c])).resolves.toEqual([1, 1, 1, 1]);
  expect(peak).toBe(3);
});

test('one subscriber cancelling cannot abort another subscriber of the same quote', async () => {
  const queue = new MarketQueue();
  const first = new AbortController();
  const second = new AbortController();
  let finish!: (value: number) => void;
  let transportSignal!: AbortSignal;
  const run = jest.fn((signal: AbortSignal) => {
    transportSignal = signal;
    return new Promise<number>(resolve => { finish = resolve; });
  });
  const a = queue.request('shared', first.signal, run);
  const b = queue.request('shared', second.signal, run);
  await Promise.resolve();
  const cancelled = expect(a).rejects.toThrow('cancelled');
  first.abort();
  await cancelled;
  expect(transportSignal.aborted).toBe(false);
  finish(42);
  await expect(b).resolves.toBe(42);
  expect(run).toHaveBeenCalledTimes(1);
});

test('cancelled transports keep their concurrency slots until they actually settle', async () => {
  const queue = new MarketQueue();
  const old = new AbortController();
  const fresh = new AbortController();
  const complete: (() => void)[] = [];
  const run = jest.fn(() => new Promise<void>(resolve => { complete.push(resolve); }));
  const pending = ['a', 'b', 'c'].map(key => queue.request(key, old.signal, run));
  const settled = Promise.allSettled(pending);
  await Promise.resolve();
  old.abort();
  const next = queue.request('d', fresh.signal, run);
  await settled;
  expect(run).toHaveBeenCalledTimes(3);
  complete.splice(0).forEach(done => done());
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(run).toHaveBeenCalledTimes(4);
  complete.splice(0).forEach(done => done());
  await next;
});
