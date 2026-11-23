/**
 * Deliberately gated C3 media ingress. A valid signed dispatch is authenticated
 * BEFORE enqueue; a bounded in-process queue is only an optimization, never a
 * durable retry source. C2's database lease/nonce remains the durable authority.
 *
 * DevOps must provide TLS termination, a restrictive ingress ACL, exact egress,
 * process sandbox, secrets and image pins before enabling in a hosted runtime.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Ed25519EnvelopeVerifier, type EnvelopeVerifier, type WorkerPublicKey } from './contract.js';
import { createGatewayAdapters } from './gateway.js';
import { processEnvelope, type ProcessorDependencies } from './server.js';

// This container is approved for the isolated staging project only. A distinct
// public-beta release backend requires a separately reviewed runtime allowlist
// and must never reuse the historical production project by accident.
const APPROVED_STAGING_MEDIA_ORIGIN = 'https://ewintxgdxdvschiqodkq.supabase.co';

const BODY_MAX = 65_536;
const NO_STORE = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Content-Length': '0',
} as const;

export interface IngressDependencies {
  verifier: EnvelopeVerifier;
  process: (signedEnvelope: string) => Promise<void>;
  /** Maximum accepted jobs including one in flight, bounded to 1–5. */
  maxPending?: number;
  log?: (event: 'media_job_unavailable' | 'media_job_completed') => void;
}

export function createWorkerIngressServer(dependencies: IngressDependencies): Server {
  // Default to one active attempt: a 120-second video could exhaust the signed
  // 120-second JWS lifetime while a queued second job waits. Scale with pods.
  const capacity = dependencies.maxPending ?? 1;
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 5) {
    throw new Error('invalid worker concurrency limit');
  }
  let pending = 0;
  let chain: Promise<void> = Promise.resolve();
  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/media-jobs' ||
        request.headers['content-type'] !== 'application/jose' ||
        request.headers.authorization || request.headers.cookie) {
      return reply(response, 404);
    }
    const declared = request.headers['content-length'];
    if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > BODY_MAX)) {
      return reply(response, 404);
    }
    // Reserve capacity BEFORE reading the body or checking Ed25519.
    // Otherwise many concurrent slow/forged requests can bypass the bounded
    // queue and exhaust memory/crypto work while all worker slots are busy.
    if (pending >= capacity) return reply(response, 503);
    pending += 1;
    let compact: string;
    try {
      compact = await readBoundedBody(request);
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(compact)) {
        throw new Error('invalid compact media dispatch');
      }
      await dependencies.verifier.verify(compact, Math.floor(Date.now() / 1000));
    } catch {
      pending -= 1; // Failed admission must never hold a worker slot.
      return reply(response, 404);
    }
    reply(response, 202);
    chain = chain.then(() => dependencies.process(compact))
      .then(() => dependencies.log?.('media_job_completed'))
      .catch(() => { dependencies.log?.('media_job_unavailable'); })
      .finally(() => { pending -= 1; });
  });
}

async function readBoundedBody(request: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  request.setTimeout(5_000, () => request.destroy());
  for await (const piece of request as unknown as AsyncIterable<Buffer>) {
    const chunk = Buffer.from(piece);
    size += chunk.byteLength;
    if (size > BODY_MAX) throw new Error('oversized JWS');
    chunks.push(chunk);
  }
  if (size < 10) throw new Error('empty JWS');
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

function reply(response: ServerResponse, status: 202 | 404 | 503): void {
  response.writeHead(status, NO_STORE);
  response.end();
}

function readPublicKeys(value: string): WorkerPublicKey[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('worker public key list invalid'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      Object.getPrototypeOf(parsed) !== Object.prototype) throw new Error('worker public keys invalid');
  const entries = Object.entries(parsed);
  if (entries.length < 1 || entries.length > 2) throw new Error('worker public key count invalid');
  return entries.map(([kid, raw]) => {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(kid) || typeof raw !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new Error('worker public key invalid');
    const bytes = Buffer.from(raw, 'base64url');
    if (bytes.length !== 32 || bytes.toString('base64url') !== raw) throw new Error('worker public key invalid');
    return { kid, publicKey: new Uint8Array(bytes) };
  });
}

/** No server is started or network socket opened unless every gate is present. */
export async function startWorkerRuntime(config: NodeJS.ProcessEnv = process.env): Promise<Server> {
  if (config.MARK_MEDIA_RUNTIME_ENABLED !== 'true') {
    throw new Error('media processor runtime disabled');
  }
  const { projectUrl, gatewaySecret, keys, host, port } = {
    projectUrl: config.MARK_MEDIA_PROJECT_URL ?? '',
    gatewaySecret: config.MARK_MEDIA_WORKER_GATEWAY_SECRET ?? '',
    keys: config.MARK_MEDIA_WORKER_PUBLIC_KEYS ?? '',
    host: config.MARK_MEDIA_LISTEN_HOST ?? '127.0.0.1',
    port: Number(config.PORT ?? '8080'),
  };
  // Fail before keys, gateway construction, DNS or listening on any other project.
  // Allow the canonical URL with an optional root slash, not a different path.
  if (projectUrl !== APPROVED_STAGING_MEDIA_ORIGIN && projectUrl !== `${APPROVED_STAGING_MEDIA_ORIGIN}/`) {
    throw new Error('unapproved media worker Supabase project origin');
  }
  if (host !== '127.0.0.1' && host !== '0.0.0.0') throw new Error('invalid worker listen interface');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('invalid worker listen port');
  const verifier = await Ed25519EnvelopeVerifier.create(readPublicKeys(keys));
  const gateway = createGatewayAdapters({ projectUrl, gatewaySecret });
  const deps: ProcessorDependencies = {
    verifier,
    nonceRedeemer: gateway.nonceRedeemer,
    completionReporter: gateway.completionReporter,
    urlPolicy: gateway.urlPolicy,
    logger: {
      info: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
      error: (event, fields) => console.error(JSON.stringify({ event, ...fields })),
    },
  };
  const server = createWorkerIngressServer({
    verifier,
    process: (compact) => processEnvelope(compact, deps),
    log: (event) => console.log(JSON.stringify({ event })),
  });
  return await new Promise<Server>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}
