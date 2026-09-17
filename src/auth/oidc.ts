import { z } from 'zod';
import type { Credential } from '../api/contracts';
import { callbackUri, oidc } from '../lib/config';

const discoverySchema = z.object({
  issuer: z.string(), authorization_endpoint: z.string(), token_endpoint: z.string(),
  revocation_endpoint: z.string().optional(),
  response_types_supported: z.array(z.string()),
  code_challenge_methods_supported: z.array(z.string()),
});
export type Discovery = z.infer<typeof discoverySchema>;
const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().refine(value => value.toLowerCase() === 'bearer'),
  expires_in: z.number().finite().positive(),
});

/** Only send codes/tokens to HTTPS endpoints on the configured provider origin. */
function providerUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.origin !== new URL(oidc.issuer).origin) throw new Error('Invalid Authentik endpoint configuration.');
  return url;
}

export class OidcClient {
  private readonly controller = new AbortController();
  get signal() { return this.controller.signal; }
  close() { this.controller.abort(); }

  private async request(url: string, form?: Record<string, string>, json = true): Promise<unknown> {
    providerUrl(url);
    if (this.signal.aborted) throw new Error('Sign-in cancelled.');
    const request = new AbortController();
    const cancel = () => request.abort();
    this.signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, 30_000);
    try {
      const response = await fetch(url, {
        method: form ? 'POST' : 'GET', credentials: 'omit', redirect: 'error', signal: request.signal,
        headers: { Accept: 'application/json', ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        ...(form ? { body: new URLSearchParams(form).toString() } : {}),
      });
      if (!response.ok) throw new Error();
      const body: unknown = json ? await response.json() : undefined;
      if (request.signal.aborted) throw new Error();
      return body;
    } catch {
      // Do not expose provider error bodies, codes, or tokens in diagnostics/UI.
      throw new Error(request.signal.aborted ? 'Sign-in cancelled or timed out.' :
        'Authentik could not complete the request. Check your connection and the public mobile client settings.');
    } finally {
      clearTimeout(timer);
      this.signal.removeEventListener('abort', cancel);
    }
  }

  async discover(): Promise<Discovery> {
    const issuer = providerUrl(oidc.issuer);
    if (!oidc.clientId.trim()) throw new Error('The Authentik mobile client ID is missing.');
    const result = discoverySchema.safeParse(await this.request(`${issuer.href.replace(/\/$/, '')}/.well-known/openid-configuration`));
    if (!result.success || result.data.issuer !== oidc.issuer ||
        !result.data.response_types_supported.includes('code') ||
        !result.data.code_challenge_methods_supported.includes('S256')) {
      throw new Error('Authentik discovery does not match the configured issuer or support code login with S256 PKCE.');
    }
    providerUrl(result.data.authorization_endpoint);
    providerUrl(result.data.token_endpoint);
    if (result.data.revocation_endpoint) providerUrl(result.data.revocation_endpoint);
    return result.data;
  }

  async exchange(discovery: Discovery, code: string, verifier: string): Promise<Credential> {
    const issuedAt = Date.now() / 1000;
    const result = tokenSchema.safeParse(await this.request(discovery.token_endpoint, {
      grant_type: 'authorization_code', client_id: oidc.clientId, code,
      code_verifier: verifier, redirect_uri: callbackUri,
    }));
    if (!result.success || !Number.isFinite(issuedAt + result.data.expires_in)) {
      throw new Error('Authentik returned an unsupported access token response.');
    }
    // ID/refresh tokens are intentionally not consumed or stored in v1.
    return { accessToken: result.data.access_token, tokenType: 'Bearer', expiresAt: issuedAt + result.data.expires_in };
  }

  async revoke(token: string, discovery?: Discovery) {
    const provider = discovery ?? await this.discover();
    if (provider.revocation_endpoint) await this.request(provider.revocation_endpoint, {
      client_id: oidc.clientId, token, token_type_hint: 'access_token',
    }, false);
  }
}
