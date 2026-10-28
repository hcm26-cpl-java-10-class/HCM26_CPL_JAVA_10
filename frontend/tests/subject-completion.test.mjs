import assert from "node:assert/strict";
import test from "node:test";
import { subjectDefaults, subjectPayload, validateSubject } from "../src/pages/management/subject/subject-form.ts";
import { subjectFilters, subjectExportParams } from "../src/utils/subject-query.utils.ts";

const valid = () => ({...subjectDefaults(), code: "JAVA", name: "Java", version: "1.0", durationHours: 8});

test("new subjects default to Active and editing preserves all learning content", () => {
  assert.equal(subjectDefaults().isActive, true);
  const data = {...valid(), id: 10, objectives: "OOP", skills: "Java", deliveryMode: "HYBRID", outline: "Week 1", isActive: false};
  const defaults = subjectDefaults(data);
  assert.equal(defaults.objectives, "OOP"); assert.equal(defaults.outline, "Week 1"); assert.equal(defaults.isActive, false);
});
test("hours reject negatives, zero, fractions, NaN and an empty value", () => {
  for (const durationHours of [-10, 0, 1.5, NaN, ""]) assert.ok(validateSubject({...valid(), durationHours}).durationHours);
  for (const durationHours of [1, 8, 100]) assert.equal(validateSubject({...valid(), durationHours}).durationHours, undefined);
});
test("required identity fields and content length limits are checked", () => {
  assert.ok(validateSubject({...valid(), code: " ", name: "\t", version: ""}).code);
  assert.ok(validateSubject({...valid(), objectives: "x".repeat(4001)}).objectives);
  assert.ok(validateSubject({...valid(), outline: "x".repeat(12001)}).outline);
  assert.deepEqual(validateSubject({...valid(), objectives: "x".repeat(4000), outline: "x".repeat(12000)}), {});
});
test("the form still accepts exactly 500 description words and rejects 501", () => {
  assert.equal(validateSubject({...valid(), description: Array(500).fill("lập_trình").join(" ")}).description, undefined);
  assert.ok(validateSubject({...valid(), description: Array(501).fill("lập_trình").join(" ")}).description);
});
test("payload includes content and status without copying audit data or IDs", () => {
  const payload = subjectPayload({...valid(), id: 12, createdBy: 1, code: " JAVA ", outline: "Content"});
  assert.equal(payload.code, "JAVA"); assert.equal(payload.outline, "Content");
  assert.equal("id" in payload, false); assert.equal("createdBy" in payload, false);
});
test("list and export translate range controls without changing the caller's filter object", () => {
  const filters = {durationHours: {min: 8, max: 40}, technicalGroup: "Backend", isActive: false};
  assert.deepEqual(subjectFilters(filters), {minHours: 8, maxHours: 40, technicalGroup: "Backend", isActive: false});
  assert.deepEqual(filters.durationHours, {min: 8, max: 40});
  const params = subjectExportParams("CSV", " Java ", {...filters, ids: [1, 2]}, ["code,asc", "version,desc"]);
  assert.equal(params.get("minHours"), "8"); assert.equal(params.get("isActive"), "false");
  assert.deepEqual(params.getAll("ids"), ["1", "2"]); assert.deepEqual(params.getAll("sort"), ["code,asc", "version,desc"]);
  assert.equal(params.get("search"), "Java"); assert.equal(params.has("page"), false);
});
test("one-sided hours and date filters remain usable", () => {
  assert.deepEqual(subjectFilters({durationHours: {min: 4}}), {minHours: 4});
  const filters = subjectFilters({createdAt: {from: "2026-10-01", to: "2026-10-28"}});
  assert.deepEqual(filters.createdRange, ["2026-10-01T00:00:00", "2026-10-28T23:59:59.999999"]);
});
