/* global require, __dirname, process */
// Run with: node scripts/test-team-charter-utils.cjs
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the actual TypeScript helpers without adding a test runtime dependency.
const source = fs.readFileSync(path.join(__dirname, "../src/pages/management/workspace/team-charter.utils.ts"), "utf8");
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const scope = {exports:{}, Intl, Date};
vm.runInNewContext(compiled, scope);
const {charterProgressLabel, charterTimeZone, formatCharterDate, parseCoreHours, formatCoreHours, validateCoreHours} = scope.exports;
const {parseClockTime} = scope.exports;
const view = {
  progress:"NEEDS_REVIEW", contentComplete:true,
  charter:{mission:"Mission", definitionOfDone:"Tests", primaryChannel:"Slack", coreHours:"19–21", conflictResolution:"Discuss"},
  members:[{responsibility:"Test the API"}],
};

test("incomplete content is distinct from roster review, without changing server enums", () => {
  assert.equal(charterProgressLabel({...view,contentComplete:false}), "Draft · Incomplete");
  assert.equal(charterProgressLabel(view), "Needs review");
  assert.equal(charterProgressLabel({...view,progress:"NOT_SAVED"}), "Not created");
  assert.equal(charterProgressLabel({...view,progress:"PENDING"}), "Awaiting confirmation");
  assert.equal(charterProgressLabel({...view,progress:"FULLY_CONFIRMED"}), "Fully confirmed");
});

test("older responses derive content completeness including responsibilities", () => {
  assert.equal(charterProgressLabel({...view,contentComplete:undefined}), "Needs review");
  assert.equal(charterProgressLabel({...view,contentComplete:undefined,charter:{...view.charter,mission:" "}}), "Draft · Incomplete");
  assert.equal(charterProgressLabel({...view,contentComplete:undefined,members:[{responsibility:""}]}), "Draft · Incomplete");
});

test("tenant time zone wins over the browser/host time zone", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    const result = formatCharterDate("2026-11-16T04:00:00Z", "Asia/Tokyo");
    assert.match(result, /16\/11\/2026/);
    assert.match(result, /13:00:00/);
    assert.match(result, /GMT\+9/);
    process.env.TZ = "UTC";
    assert.equal(formatCharterDate("2026-11-16T04:00:00Z", "Asia/Tokyo"), result);
    assert.match(formatCharterDate("2026-11-16T04:00:00Z", "Asia/Ho_Chi_Minh"), /11:00:00/);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("tenant zones respect daylight saving rules", () => {
  assert.match(formatCharterDate("2026-07-01T12:00:00Z", "Europe/Paris"), /14:00:00.*GMT\+2/);
  assert.match(formatCharterDate("2026-01-01T12:00:00Z", "Europe/Paris"), /13:00:00.*GMT\+1/);
});

test("legacy/invalid zones have an explicit UTC fallback", () => {
  assert.equal(charterTimeZone(undefined), "UTC");
  assert.equal(charterTimeZone("invalid-zone"), "UTC");
  assert.match(formatCharterDate("2026-11-16T04:00:00Z"), /04:00:00.*GMT/);
});

test("missing or invalid timestamps are safe to render", () => {
  for (const value of [null, undefined, "", "not-a-date"]) {
    assert.equal(formatCharterDate(value, "Asia/Tokyo"), "Not available");
  }
});

test("core hours are stored in weekday order and can be reopened for editing", () => {
  const value = formatCoreHours({days: ["Fri", "Mon"], start: "19:00", end: "21:00"});
  assert.equal(value, "Mon, Fri · 19:00–21:00");
  assert.equal(formatCoreHours(parseCoreHours(value)), value);
  assert.equal(validateCoreHours(value), null);
  assert.equal(parseCoreHours("Mon–Fri, 19:00–21:00"), null);
});

test("core hours allow an empty draft but reject incomplete and overnight selections", () => {
  assert.equal(validateCoreHours(""), null);
  for (const value of [" · 19:00–21:00", "Mon · 19:00–", "Mon · –", "Mon · 24:00–23:00"]) {
    assert.match(validateCoreHours(value), /at least one day/);
  }
  for (const end of ["19:00", "18:00"]) {
    assert.match(validateCoreHours(formatCoreHours({days: ["Mon"], start: "19:00", end})), /later than start/);
  }
});

test("typed times accept shorthand, 24-hour notation and explicit AM/PM", () => {
  for (const [input, expected] of [
    ["204", "02:04"], ["0204", "02:04"], ["1404", "14:04"], ["14:04", "14:04"],
    ["204pm", "14:04"], ["2:04 AM", "02:04"], ["12:00 AM", "00:00"],
    ["12:00 PM", "12:00"], ["2", "02:00"], ["0", "00:00"], ["  ", ""],
  ]) assert.equal(parseClockTime(input), expected);
  for (const input of ["2060", "2400", "14 PM", "2:4", "2:04 P", "xyz"]) {
    assert.equal(parseClockTime(input), null, input);
  }
});
