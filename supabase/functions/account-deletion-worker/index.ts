// @ts-nocheck -- Deno runtime module; validated by the dedicated Deno CI job.
const RUN_PATH = "/functions/v1/account-deletion-worker/run";
const MAX_BODY_BYTES = 256;
const MAX_AVATAR_BATCHES = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DueDeletion {
  user_id: string;
  requested_at: string;
  purge_after: string;
}

export interface AccountDeletionAdapter {
  listDue(limit: number): Promise<DueDeletion[]>;
  listAvatarPaths(userId: string, limit: number): Promise<string[]>;
  removeAvatarPaths(userId: string, paths: readonly string[]): Promise<void>;
  prepare(userId: string, requestedAt: string): Promise<boolean>;
  deleteIdentity(userId: string): Promise<void>;
}

export function createAccountDeletionWorkerHandler(options: Readonly<{
  schedulerSecrets: readonly string[];
  adapterFactory: () => AccountDeletionAdapter;
  log?: (event: Readonly<{ event: "account_deletion_failed" }>) => void;
}> = defaultOptions()): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!await authenticate(request.headers.get("authorization"), options.schedulerSecrets)) {
      return fixedResponse(404);
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== RUN_PATH) {
      return fixedResponse(404);
    }
    let limit: number;
    try {
      const payload = await readBoundedJson(request);
      if (!isExactRecord(payload, ["limit"]) || !Number.isInteger(payload.limit)
        || (payload.limit as number) < 1 || (payload.limit as number) > 50) {
        return fixedResponse(404);
      }
      limit = payload.limit as number;
    } catch {
      return fixedResponse(404);
    }

    const adapter = options.adapterFactory();
    try {
      const due = await adapter.listDue(limit);
      if (!Array.isArray(due) || due.length > limit) throw new Error("invalid due batch");
      for (const requestRow of due) {
        try {
          validateDue(requestRow);
          await removeAllAvatars(adapter, requestRow.user_id);
          if (!await adapter.prepare(requestRow.user_id, requestRow.requested_at)) continue;
          await adapter.deleteIdentity(requestRow.user_id);
        } catch {
          options.log?.({ event: "account_deletion_failed" });
        }
      }
    } catch {
      options.log?.({ event: "account_deletion_failed" });
    }
    return fixedResponse(204);
  };
}

async function removeAllAvatars(adapter: AccountDeletionAdapter, userId: string): Promise<void> {
  for (let batch = 0; batch < MAX_AVATAR_BATCHES; batch += 1) {
    const paths = await adapter.listAvatarPaths(userId, 100);
    if (!Array.isArray(paths) || paths.length > 100) throw new Error("invalid avatar batch");
    if (paths.length === 0) return;
    for (const path of paths) assertAvatarPath(userId, path);
    await adapter.removeAvatarPaths(userId, paths);
  }
  throw new Error("avatar cleanup bound exceeded");
}

function validateDue(value: DueDeletion): void {
  if (!isExactRecord(value, ["purge_after", "requested_at", "user_id"])
    || !UUID.test(value.user_id)
    || !validTimestamp(value.requested_at)
    || !validTimestamp(value.purge_after)
    || Date.parse(value.purge_after) <= Date.parse(value.requested_at)) {
    throw new Error("invalid due deletion");
  }
}

function assertAvatarPath(userId: string, path: string): void {
  const prefix = `avatars/${userId}/`;
  if (typeof path !== "string" || !path.startsWith(prefix) || path.length <= prefix.length
    || path.includes("..") || /[*?\[\]{}]/.test(path)) {
    throw new Error("invalid avatar path");
  }
}

export function createSupabaseAccountDeletionAdapter(input: Readonly<{
  supabaseUrl: string;
  serviceRoleKey: string;
  fetch: typeof fetch;
}>): AccountDeletionAdapter {
  const origin = new URL(input.supabaseUrl);
  if (origin.protocol !== "https:" || origin.username || origin.password
    || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("invalid Supabase URL");
  }
  if (input.serviceRoleKey.length < 32) throw new Error("invalid service credential");
  const headers = {
    Authorization: `Bearer ${input.serviceRoleKey}`,
    apikey: input.serviceRoleKey,
    "Content-Type": "application/json",
  };
  const rpc = async (name: string, body: Record<string, unknown>): Promise<unknown> => {
    const response = await input.fetch(`${origin.origin}/rest/v1/rpc/${name}`, {
      method: "POST", headers, body: JSON.stringify(body), redirect: "error",
    });
    if (!response.ok) throw new Error("database operation unavailable");
    return response.json();
  };
  return {
    listDue: async (limit) => {
      const value = await rpc("list_due_account_deletions", { p_limit: limit });
      if (!Array.isArray(value)) throw new Error("invalid due response");
      return value as DueDeletion[];
    },
    listAvatarPaths: async (userId, limit) => {
      const prefix = `avatars/${userId}/`;
      const response = await input.fetch(`${origin.origin}/storage/v1/object/list/attachments`, {
        method: "POST", headers, redirect: "error",
        body: JSON.stringify({ prefix, limit, offset: 0, sortBy: { column: "name", order: "asc" } }),
      });
      if (!response.ok) throw new Error("avatar listing unavailable");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("invalid avatar listing");
      return value.map((entry) => {
        if (!isExactRecordSubset(entry, ["name"]) || typeof entry.name !== "string") {
          throw new Error("invalid avatar object");
        }
        return `${prefix}${entry.name}`;
      });
    },
    removeAvatarPaths: async (userId, paths) => {
      for (const path of paths) assertAvatarPath(userId, path);
      const response = await input.fetch(`${origin.origin}/storage/v1/object/attachments`, {
        method: "DELETE", headers, redirect: "error",
        body: JSON.stringify({ prefixes: paths }),
      });
      if (!response.ok) throw new Error("avatar deletion unavailable");
    },
    prepare: async (userId, requestedAt) => {
      const value = await rpc("prepare_account_deletion_for_purge", {
        p_user_id: userId, p_expected_requested_at: requestedAt,
      });
      if (typeof value !== "boolean") throw new Error("invalid preparation response");
      return value;
    },
    deleteIdentity: async (userId) => {
      const response = await input.fetch(`${origin.origin}/auth/v1/admin/users/${userId}`, {
        method: "DELETE", headers, redirect: "error",
      });
      if (!response.ok && response.status !== 404) throw new Error("identity deletion unavailable");
    },
  };
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > MAX_BODY_BYTES) throw new Error("body too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("body too large");
  return JSON.parse(text);
}

async function authenticate(value: string | null, secrets: readonly string[]): Promise<boolean> {
  if (!value?.startsWith("Bearer ")) return false;
  const candidate = value.slice(7);
  if (candidate.length < 32 || secrets.length < 1) return false;
  const candidateHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(candidate)));
  let accepted = 0;
  for (const secret of secrets) {
    const expected = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
    let difference = candidateHash.length ^ expected.length;
    for (let i = 0; i < candidateHash.length; i += 1) difference |= candidateHash[i] ^ (expected[i] ?? 0);
    accepted |= Number(difference === 0);
  }
  return accepted === 1;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value as Record<string, unknown>).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isExactRecordSubset(value: unknown, required: readonly string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function fixedResponse(status: 204 | 404): Response {
  return status === 204
    ? new Response(null, { status, headers: { "Cache-Control": "private, no-store" } })
    : new Response('{"status":"unavailable"}', {
      status, headers: { "Cache-Control": "private, no-store", "Content-Type": "application/json" },
    });
}

function defaultOptions() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const schedulerSecrets = [Deno.env.get("ACCOUNT_DELETION_SCHEDULER_SECRET") ?? ""].filter(Boolean);
  return {
    schedulerSecrets,
    adapterFactory: () => createSupabaseAccountDeletionAdapter({ supabaseUrl, serviceRoleKey, fetch }),
    log: (event: { event: "account_deletion_failed" }) => console.error(JSON.stringify(event)),
  };
}

if (import.meta.main) Deno.serve(createAccountDeletionWorkerHandler());
