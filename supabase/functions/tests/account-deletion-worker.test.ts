import {
  createAccountDeletionWorkerHandler,
  createSupabaseAccountDeletionAdapter,
  type AccountDeletionAdapter,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../account-deletion-worker/index.ts";

const SECRET = "s".repeat(32);
const USER = "11111111-1111-4111-8111-111111111111";
const DUE = { user_id: USER, requested_at: "2026-08-01T00:00:00Z", purge_after: "2026-08-31T00:00:00Z" };
const tests: { name: string; run: () => void | Promise<void> }[] = [];
function test(name: string, run: () => void | Promise<void>): void { tests.push({ name, run }); }
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function request(secret = SECRET): Request {
  return new Request("https://project.supabase.co/functions/v1/account-deletion-worker/run", {
    method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 10 }),
  });
}
function adapter(): AccountDeletionAdapter {
  return {
    listDue: async () => [], listAvatarPaths: async () => [], removeAvatarPaths: async () => undefined,
    prepare: async () => true, deleteIdentity: async () => undefined,
  };
}

test("authentication precedes privileged adapter construction", async () => {
  let factories = 0;
  const handler = createAccountDeletionWorkerHandler({ schedulerSecrets: [SECRET], adapterFactory: () => {
    factories += 1; return adapter();
  } });
  equal((await handler(request("x".repeat(32)))).status, 404, "unauthorized status");
  equal(factories, 0, "no privileged construction");
});

test("worker removes every avatar before preparation and identity deletion", async () => {
  const events: string[] = [];
  let listings = 0;
  const value = adapter();
  value.listDue = async () => [DUE];
  value.listAvatarPaths = async () => {
    listings += 1; events.push(`list:${listings}`);
    return listings === 1 ? [`avatars/${USER}/avatar.jpg`] : [];
  };
  value.removeAvatarPaths = async () => { events.push("remove"); };
  value.prepare = async () => { events.push("prepare"); return true; };
  value.deleteIdentity = async () => { events.push("delete-identity"); };
  const handler = createAccountDeletionWorkerHandler({ schedulerSecrets: [SECRET], adapterFactory: () => value });
  equal((await handler(request())).status, 204, "accepted status");
  equal(events.join(","), "list:1,remove,list:2,prepare,delete-identity", "safe operation order");
});

test("failed preparation never deletes the identity", async () => {
  let deleted = false;
  const value = adapter();
  value.listDue = async () => [DUE];
  value.prepare = async () => false;
  value.deleteIdentity = async () => { deleted = true; };
  const handler = createAccountDeletionWorkerHandler({ schedulerSecrets: [SECRET], adapterFactory: () => value });
  equal((await handler(request())).status, 204, "accepted status");
  equal(deleted, false, "identity preserved");
});

test("hostile avatar paths fail closed before prepare", async () => {
  let prepared = false;
  const value = adapter();
  value.listDue = async () => [DUE];
  value.listAvatarPaths = async () => ["avatars/other-user/avatar.jpg"];
  value.prepare = async () => { prepared = true; return true; };
  const handler = createAccountDeletionWorkerHandler({ schedulerSecrets: [SECRET], adapterFactory: () => value });
  equal((await handler(request())).status, 204, "admitted tick acknowledged");
  equal(prepared, false, "preparation blocked");
});

test("one failed account does not starve later due deletions", async () => {
  const secondUser = "22222222-2222-4222-8222-222222222222";
  const deleted: string[] = [];
  let failures = 0;
  const value = adapter();
  value.listDue = async () => [DUE, { ...DUE, user_id: secondUser }];
  value.listAvatarPaths = async (userId) => {
    if (userId === USER) throw new Error("storage unavailable");
    return [];
  };
  value.deleteIdentity = async (userId) => { deleted.push(userId); };
  const handler = createAccountDeletionWorkerHandler({
    schedulerSecrets: [SECRET],
    adapterFactory: () => value,
    log: () => { failures += 1; },
  });
  equal((await handler(request())).status, 204, "admitted tick acknowledged");
  equal(failures, 1, "failed row logged");
  equal(deleted.join(","), secondUser, "later row completed");
});

test("Supabase adapter sends exact storage, RPC, and Auth Admin requests", async () => {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const responses: unknown[] = [
    [DUE],
    [{ name: "avatar.jpg", id: "ignored" }],
    null,
    true,
    null,
  ];
  const statuses = [200, 200, 200, 200, 404];
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url: String(input), method: init?.method ?? "GET", body });
    const status = statuses.shift() ?? 500;
    const responseBody = responses.shift();
    return new Response(responseBody === null ? null : JSON.stringify(responseBody), {
      status,
      headers: responseBody === null ? undefined : { "Content-Type": "application/json" },
    });
  };
  const value = createSupabaseAccountDeletionAdapter({
    supabaseUrl: "https://project.supabase.co/",
    serviceRoleKey: "k".repeat(32),
    fetch: fakeFetch as typeof fetch,
  });
  await value.listDue(10);
  const paths = await value.listAvatarPaths(USER, 100);
  await value.removeAvatarPaths(USER, paths);
  equal(await value.prepare(USER, DUE.requested_at), true, "preparation response");
  await value.deleteIdentity(USER);
  equal(calls.length, 5, "request count");
  equal(calls[0].url, "https://project.supabase.co/rest/v1/rpc/list_due_account_deletions", "due RPC URL");
  equal(calls[0].method, "POST", "due RPC method");
  equal(JSON.stringify(calls[0].body), JSON.stringify({ p_limit: 10 }), "due RPC body");
  equal(calls[1].url, "https://project.supabase.co/storage/v1/object/list/attachments", "list URL");
  equal(JSON.stringify(calls[1].body), JSON.stringify({
    prefix: `avatars/${USER}/`, limit: 100, offset: 0, sortBy: { column: "name", order: "asc" },
  }), "list body");
  equal(calls[1].method, "POST", "list method");
  equal(calls[2].url, "https://project.supabase.co/storage/v1/object/attachments", "delete URL");
  equal(calls[2].method, "DELETE", "delete method");
  equal(JSON.stringify(calls[2].body), JSON.stringify({ prefixes: [`avatars/${USER}/avatar.jpg`] }), "delete body");
  equal(calls[3].url, "https://project.supabase.co/rest/v1/rpc/prepare_account_deletion_for_purge", "prepare URL");
  equal(calls[3].method, "POST", "prepare method");
  equal(JSON.stringify(calls[3].body), JSON.stringify({
    p_user_id: USER, p_expected_requested_at: DUE.requested_at,
  }), "prepare body");
  equal(calls[4].url, `https://project.supabase.co/auth/v1/admin/users/${USER}`, "Auth Admin URL");
  equal(calls[4].method, "DELETE", "Auth Admin method");
});

for (const entry of tests) {
  // @ts-ignore Deno test registration is validated in the dedicated Edge CI job.
  Deno.test(entry.name, entry.run);
}
