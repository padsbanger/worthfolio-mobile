import type { z } from 'zod';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export class ApiClient {
  private readonly controllers = new Set<AbortController>();
  private closed = false;
  constructor(
    readonly baseUrl: string,
    private readonly token: string | null = null,
    private readonly onUnauthorized: () => void = () => {},
  ) {}

  close() {
    this.closed = true;
    this.cancelAll();
  }

  cancelAll() {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  async request<T>(path: string, schema: z.ZodType<T>, options: {
    signal?: AbortSignal; body?: Record<string, string>;
  } = {}): Promise<T> {
    if (this.closed || options.signal?.aborted) throw new ApiError('Request cancelled.', 0);
    if (!path.startsWith('/') || path.startsWith('//')) throw new ApiError('Invalid API path.', 0);
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    this.controllers.add(controller);
    const timer = setTimeout(cancel, 30_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.body ? 'POST' : 'GET',
        credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
      if (this.closed || controller.signal.aborted) throw new ApiError('Request cancelled.', 0);
      if (response.status === 401) {
        this.onUnauthorized();
        throw new ApiError('Your session expired. Please sign in again.', 401);
      }
      if (!response.ok) throw new ApiError(
        response.status === 403 ? (this.token ? 'This action is not allowed for your mobile session.' :
          'Worthfolio denied the connection. Check the server access settings and try again.') :
          response.status >= 500 ? 'Worthfolio is temporarily unavailable. Try again.' : 'The request could not be completed.',
        response.status,
      );
      const parsed = schema.safeParse(await response.json());
      if (this.closed || controller.signal.aborted) throw new ApiError('Request cancelled.', 0);
      if (!parsed.success) throw new ApiError('The server returned an unsupported response. Check the backend version.', 422);
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'Request cancelled or timed out.' : 'Could not connect to Worthfolio. Check your connection and try again.', 0);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      this.controllers.delete(controller);
    }
  }
}

export function retryRead(failureCount: number, error: Error) {
  return failureCount < 1 && error instanceof ApiError && (error.status === 0 || error.status >= 500);
}
