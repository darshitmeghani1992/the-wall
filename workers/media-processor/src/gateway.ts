/**
 * HTTP implementation of the C2 gateway interfaces for the isolated C3 worker.
 * No Supabase service role, DB URL, or private JWS signing key is used here.
 * The Edge gateway is the sole actor authorized to spend a dispatch nonce and
 * finalize a completion token, bound to the server-side database lease.
 */
import type {
  CompletionAuthorization,
  CompletionReporter,
  DispatchNonceRedeemer,
} from './contract.js';
import { assertCallbackUrl, type UrlPolicy } from './url-policy.js';

const GATEWAY_PREFIX = '/functions/v1/mark-media-worker/worker/';
const GATEWAY_SECRET = /^[A-Za-z0-9._~-]{32,512}$/;
const ERROR_CODE = /^(INVALID_MEDIA|PROCESSING_FAILED|TOO_LARGE|TOO_LONG|UNSUPPORTED_FORMAT)$/;

export interface GatewayConfig {
  projectUrl: string;
  gatewaySecret: string;
  fetchImpl?: typeof fetch;
}

export interface GatewayAdapters {
  urlPolicy: UrlPolicy;
  nonceRedeemer: DispatchNonceRedeemer;
  completionReporter: CompletionReporter;
}

export function createGatewayAdapters(config: GatewayConfig): GatewayAdapters {
  let url: URL;
  try { url = new URL(config.projectUrl); } catch { throw new Error('invalid gateway project origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search ||
      url.hash || url.pathname !== '/' || !/^[a-z0-9-]{3,40}\.supabase\.co$/.test(url.hostname)) {
    throw new Error('invalid gateway project origin');
  }
  if (!GATEWAY_SECRET.test(config.gatewaySecret) ||
      (config.gatewaySecret.startsWith('eyJ') && config.gatewaySecret.split('.').length === 3)) {
    throw new Error('invalid dedicated worker gateway secret');
  }
  const origin = url.origin;
  const urlPolicy: UrlPolicy = {
    storageHostname: url.hostname,
    callbackOrigin: origin,
    callbackPath: GATEWAY_PREFIX + 'complete',
  };
  const fetchImpl = config.fetchImpl ?? fetch;

  async function submit(
    path: 'redeem' | 'complete' | 'fail',
    token: string,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (token.length < 1 || token.length > 65_536 || /\s/.test(token)) {
      throw new Error('invalid gateway job credential');
    }
    const target = `${origin}${GATEWAY_PREFIX}${path}`;
    let response: Response;
    try {
      response = await fetchImpl(target, {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: {
          Authorization: `Bearer ${config.gatewaySecret}`,
          'X-The-Wall-Job-Token': token,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('worker gateway request unavailable');
    }
    if (response.url && response.url !== target) throw new Error('worker gateway response changed origin');
    if (response.status !== 204) return false;
    // A valid 204 has no body. Never parse or log response content.
    if (response.body !== null) throw new Error('worker gateway returned unexpected content');
    return true;
  }

  function assertCallback(authorization: CompletionAuthorization) {
    assertCallbackUrl(authorization.callbackUrl, urlPolicy);
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(authorization.envelopeKid) ||
        !/^[0-9a-f-]{36}$/.test(authorization.uploadId) ||
        !/^[0-9a-f-]{36}$/.test(authorization.attemptId) ||
        !/^[A-Za-z0-9_-]{43}$/.test(authorization.completionToken)) {
      throw new Error('invalid gateway completion binding');
    }
  }

  const nonceRedeemer: DispatchNonceRedeemer = {
    redeem: (compactJws, signal) => submit('redeem', compactJws, {}, signal),
  };
  const completionReporter: CompletionReporter = {
    complete: async (authorization, processed, signal) => {
      assertCallback(authorization);
      const { full, preview } = processed;
      const result = {
        cache_control_seconds: 60,
        detected_mime: full.mimeType,
        duration_ms: full.durationMs ?? null,
        height: full.height ?? null,
        preview_path: preview?.path ?? null,
        sha256: full.sha256,
        validated_bytes: full.byteSize,
        validated_path: full.path,
        width: full.width ?? null,
      };
      if (!Number.isSafeInteger(result.validated_bytes) || result.validated_bytes <= 0 ||
          !/^[0-9a-f]{64}$/.test(result.sha256)) throw new Error('invalid processed media receipt');
      if (!await submit('complete', authorization.completionToken, {
        upload_id: authorization.uploadId,
        attempt_id: authorization.attemptId,
        kid: authorization.envelopeKid,
        result,
      }, signal)) throw new Error('media completion was not accepted');
    },
    fail: async (authorization, errorCode, signal) => {
      assertCallback(authorization);
      if (!ERROR_CODE.test(errorCode)) throw new Error('invalid media failure code');
      if (!await submit('fail', authorization.completionToken, {
        upload_id: authorization.uploadId,
        attempt_id: authorization.attemptId,
        kid: authorization.envelopeKid,
        result: { error_code: errorCode },
      }, signal)) throw new Error('media failure receipt was not accepted');
    },
  };
  return { urlPolicy, nonceRedeemer, completionReporter };
}
