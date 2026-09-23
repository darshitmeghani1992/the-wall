import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node's strip-types runner needs the source extension.
import { markHistoryFilter, mergeWallMarks, readMarkHistoryPage, wallInsertGate, type MarkCursor } from "./mark-history-cursor.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const time = "2026-09-20T12:00:00Z";

test("history cursor validates the pinned phase and descending tie breaker", () => {
  assert.equal(markHistoryFilter({ pinned: true, created_at: time, id: B }),
    `created_at.lt.${time},and(created_at.eq.${time},id.lt.${B})`);
  assert.throws(() => markHistoryFilter({ pinned: "true" as unknown as boolean, created_at: time, id: B }));
  assert.throws(() => markHistoryFilter({ pinned: false, created_at: time, id: "bad),pinned.eq.true" }));
});

test("overlapping pages and realtime rows preserve pinned first and unique IDs", () => {
  const a = { id: A, pinned: false, created_at: time };
  const b = { id: B, pinned: true, created_at: time };
  assert.deepEqual(mergeWallMarks([a], [a, b]).map((row) => row.id), [B, A]);
});

test("live merge preserves PostgreSQL microsecond order within one JS millisecond", () => {
  const older = { id: B, pinned: false, created_at: "2026-09-20T12:00:00.000100+00:00" };
  const newer = { id: A, pinned: false, created_at: "2026-09-20T12:00:00.000900+00:00" };
  assert.deepEqual(mergeWallMarks([older], [newer]).map((mark) => mark.id), [A, B]);
});

test("an old Wall's delayed hydration cannot insert after unsubscribe or into another Wall", async () => {
  const arrivals: string[] = [];
  const oldGate = wallInsertGate<{ id: string; wall_id: string }>("old", (mark) => arrivals.push(mark.id));
  const newGate = wallInsertGate<{ id: string; wall_id: string }>("new", (mark) => arrivals.push(mark.id));
  let finishHydration!: (mark: { id: string; wall_id: string }) => void;
  const hydration = new Promise<{ id: string; wall_id: string }>((resolve) => { finishHydration = resolve; });
  const late = hydration.then(oldGate.accept);
  oldGate.stop();
  finishHydration({ id: A, wall_id: "old" });
  await late;
  newGate.accept({ id: A, wall_id: "old" });
  newGate.accept({ id: B, wall_id: "new" });
  assert.deepEqual(arrivals, [B]);
});

test("equal timestamps use descending UUID as a stable page boundary", async () => {
  const rows = Array.from({ length: 51 }, (_, index) => ({
    id: `${String(51 - index).padStart(8, "0")}-1111-4111-8111-111111111111`,
    pinned: false,
    created_at: time,
  }));
  const read = async (pinned: boolean, limit: number, after?: string) =>
    (pinned ? [] : rows.filter((row) => !after || row.id < after.match(/id\.lt\.([^)]*)/)![1])).slice(0, limit);
  const first = await readMarkHistoryPage(read);
  assert.equal(first.items.length, 50);
  assert.ok(first.nextCursor);
  const second = await readMarkHistoryPage(read, first.nextCursor);
  assert.deepEqual([...first.items, ...second.items].map((item) => item.id), rows.map((row) => row.id));
  assert.equal(second.nextCursor, null);
});

test("a failed exact-50 boundary probe rejects the whole page", async () => {
  const row = (index: number) => ({
    pinned: true,
    created_at: new Date(Date.UTC(2026, 8, 20) - index * 1000).toISOString(),
    id: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
  });
  const pinnedRows = Array.from({ length: 50 }, (_, index) => row(index));
  await assert.rejects(readMarkHistoryPage(async (pinned) => {
    if (!pinned) throw new Error("offline during unpinned probe");
    return pinnedRows;
  }), /offline during unpinned probe/);
});

for (const pinnedCount of [0, 49, 50, 51]) {
  for (const unpinnedCount of [0, 1, 51]) {
    test(`history crosses ${pinnedCount} pinned / ${unpinnedCount} unpinned without losing a row`, async () => {
      const row = (index: number, pinned: boolean) => ({
        pinned,
        created_at: new Date(Date.UTC(2026, 8, 20, 0, 0, 0, 0) - index * 1000).toISOString(),
        id: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
      });
      const all = [
        ...Array.from({ length: pinnedCount }, (_, index) => row(index, true)),
        ...Array.from({ length: unpinnedCount }, (_, index) => row(index + pinnedCount, false)),
      ];
      const calls: { pinned: boolean; limit: number }[] = [];
      const read = async (pinned: boolean, limit: number, after?: string) => {
        calls.push({ pinned, limit });
        const phase = all.filter((item) => item.pinned === pinned);
        if (!after) return phase.slice(0, limit);
        const match = /created_at\.eq\.([^,]+),id\.lt\.([^)]*)/.exec(after);
        assert.ok(match);
        return phase.filter((item) => item.created_at < match[1]
          || item.created_at === match[1] && item.id < match[2]).slice(0, limit);
      };
      const gathered: string[] = [];
      let cursor: MarkCursor | null = null;
      do {
        const page: { items: MarkCursor[]; nextCursor: MarkCursor | null } = await readMarkHistoryPage(read, cursor ?? undefined);
        gathered.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
        assert.ok(gathered.length <= all.length);
      } while (cursor);
      assert.deepEqual(gathered, all.map((item) => item.id));
      if (pinnedCount === 50 && unpinnedCount > 0) {
        assert.ok(calls.some((call) => !call.pinned && call.limit === 1));
      }
    });
  }
}
