import { test } from "node:test";
import assert from "node:assert/strict";
import { formatScheduleDateTime, safeMeetingUrl } from "../src/pages/management/teaching-assignment/assignment-detail.ts";

test("displays schedule-local timestamps without shifting the date or time", () => {
  assert.equal(formatScheduleDateTime("2026-11-01T00:15:00"), "01/11/2026 00:15");
  assert.equal(formatScheduleDateTime("2026-12-31T23:59:59.123456"), "31/12/2026 23:59");
  assert.equal(formatScheduleDateTime("2026-11-01T09:30"), "01/11/2026 09:30");
});

test("does not display malformed dates and invalid times as real schedule times", () => {
  for (const value of ["", "2026-02-30T09:00:00", "2026-11-01T25:00:00", "2026-11-01T09:90:00", "2026-11-01T09:00:99", "not-a-date"]) {
    assert.equal(formatScheduleDateTime(value), "—");
  }
});

test("meeting links allow only absolute http/https URLs without embedded credentials", () => {
  assert.equal(safeMeetingUrl("https://example.com/meeting"), "https://example.com/meeting");
  assert.equal(safeMeetingUrl(" http://localhost:8080/meeting "), "http://localhost:8080/meeting");
  for (const value of [null, "", "javascript:alert(1)", "data:text/html,test", "/meeting", "//example.com/meeting", "https://user:password@example.com/"]) {
    assert.equal(safeMeetingUrl(value), undefined);
  }
});
