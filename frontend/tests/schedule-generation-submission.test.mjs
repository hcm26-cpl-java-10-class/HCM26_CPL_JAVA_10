import assert from "node:assert/strict";
import test from "node:test";
import { getBulkSubmission } from "../src/pages/management/schedule-generation/submission-key.ts";

test("a retry after a lost response keeps the same request key", () => {
  const rows = [{ topicId: 1, startTime: "2026-11-02T09:00:00" }];
  const first = getBulkSubmission(null, 1, rows, () => "first");
  const retry = getBulkSubmission(first, 1, structuredClone(rows), () => { throw new Error("must not regenerate"); });
  assert.equal(retry.key, "first");
});

test("changing class or an edited preview generates a new key", () => {
  const first = getBulkSubmission(null, 1, [{ roomId: 1 }], () => "first");
  assert.equal(getBulkSubmission(first, 2, [{ roomId: 1 }], () => "other-class").key, "other-class");
  assert.equal(getBulkSubmission(first, 1, [{ roomId: 2 }], () => "edited").key, "edited");
});
