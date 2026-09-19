import {
  createAccountDeletionWorkerHandler,
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

for (const entry of tests) {
  // @ts-ignore Deno test registration is validated in the dedicated Edge CI job.
  Deno.test(entry.name, entry.run);
}
