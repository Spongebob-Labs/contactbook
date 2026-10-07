import { JWT } from 'google-auth-library';

/** Base of the Google Wallet REST API. */
export const GOOGLE_WALLET_API =
  'https://walletobjects.googleapis.com/walletobjects/v1';

const WALLET_ISSUER_SCOPE =
  'https://www.googleapis.com/auth/wallet_object.issuer';

/** A request that hangs must not hang the owner's tap or the outbox worker. */
const REQUEST_TIMEOUT_MS = 10_000;

/** DI token for the authenticated HTTP client. `null` when the feature is off. */
export const GOOGLE_WALLET_HTTP = Symbol('GOOGLE_WALLET_HTTP');

export interface GoogleWalletRequest {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  /** JSON body. Only ever a pass class or pass object built by `google-wallet-pass.util`. */
  data?: Record<string, unknown>;
}

/**
 * The one seam between this module and Google. The service depends on this
 * interface, never on `google-auth-library` directly, so tests swap in a double
 * and no test can reach the network.
 */
export interface GoogleWalletHttp {
  /** Resolves on 2xx. Rejects with {@link GoogleWalletHttpError} otherwise. */
  request(req: GoogleWalletRequest): Promise<void>;
}

/**
 * A failed call, reduced to what callers branch on. Deliberately carries no
 * response body and no request payload: the message ends up in logs and in
 * `OutboxMessage.lastError`.
 */
export class GoogleWalletHttpError extends Error {
  constructor(
    /** HTTP status, or `undefined` when no response arrived (DNS, timeout, auth). */
    readonly status: number | undefined,
    readonly method: string,
  ) {
    super(
      status === undefined
        ? `Google Wallet API unreachable (${method})`
        : `Google Wallet API answered ${status} (${method})`,
    );
    this.name = 'GoogleWalletHttpError';
  }
}

function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { status?: unknown; response?: { status?: unknown } };
  if (typeof e.response?.status === 'number') return e.response.status;
  return typeof e.status === 'number' ? e.status : undefined;
}

/**
 * Builds the real client: a service-account JWT client that mints and caches
 * its own OAuth access token. Constructing it makes no network call — the
 * first token exchange happens on the first `request()`.
 */
export function createGoogleWalletHttp(credentials: {
  serviceAccountEmail: string;
  privateKeyPem: string;
}): GoogleWalletHttp {
  const client = new JWT({
    email: credentials.serviceAccountEmail,
    key: credentials.privateKeyPem,
    scopes: [WALLET_ISSUER_SCOPE],
  });

  return {
    async request({ method, url, data }: GoogleWalletRequest): Promise<void> {
      try {
        await client.request({
          method,
          url,
          data,
          timeout: REQUEST_TIMEOUT_MS,
        });
      } catch (err) {
        throw new GoogleWalletHttpError(statusOf(err), method);
      }
    },
  };
}
