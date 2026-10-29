import { test } from "node:test";
import assert from "node:assert/strict";
import { groupTeachingSlots, showLinkedSessionHistory } from "../src/pages/management/teaching-assignment/assignment-schedule.ts";

test("groups a chronological preview without changing saved slot numbers or input order", () => {
  const slots = [
    { date: "2026-11-02", startTime: "08:00:00", endTime: "09:00:00" },
    { date: "2026-11-01", startTime: "14:00", endTime: "15:00" },
    { date: "2026-11-01", startTime: "08:00", endTime: "10:00" },
    { date: "2026-11-03", startTime: "08:00", endTime: "10:00" },
  ];
  const original = structuredClone(slots);
  const groups = groupTeachingSlots(slots, 3);
  assert.deepEqual(groups.map(group => [group.date, group.slots.map(slot => slot.number)]), [
    ["2026-11-01", [3, 2]], ["2026-11-02", [1]],
  ]);
  assert.deepEqual(slots, original);
  assert.deepEqual(groupTeachingSlots(), []);
});

test("hides only confirmed empty unfiltered history and retains controls on filtered empty pages", () => {
  const empty = { total: 0, status: "all", page: 0, pending: false, failed: false };
  assert.equal(showLinkedSessionHistory(empty), false);
  for (const change of [{ total: 1 }, { status: "COMPLETED" }, { page: 1 }, { pending: true }, { failed: true }]) {
    assert.equal(showLinkedSessionHistory({ ...empty, ...change }), true);
  }
});
