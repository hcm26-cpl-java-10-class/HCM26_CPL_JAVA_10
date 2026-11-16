import { describe, expect, it } from "vitest";
import type { TopicImportPreviewRow } from "@/types/features/content";
import { validateTopicImportRows } from "./topic-import.utils";

const baseRow = (overrides: Partial<TopicImportPreviewRow> = {}): TopicImportPreviewRow => ({
  rowNumber: 1,
  code: "JAVA_CORE",
  name: "Java Core",
  version: "1.0",
  technicalGroup: "Java",
  durationHours: 40,
  description: "Java fundamentals",
  status: "ACTIVE",
  valid: true,
  errors: [],
  ...overrides,
});

describe("validateTopicImportRows", () => {
  it("accepts valid distinct rows", () => {
    const rows = [
      baseRow({ rowNumber: 1, code: "JAVA_CORE", version: "1.0" }),
      baseRow({ rowNumber: 2, code: "SPRING_BOOT", name: "Spring Boot", version: "2.0" }),
    ];

    const result = validateTopicImportRows(rows, rows);
    expect(result.every((r) => r.valid && r.errors.length === 0)).toBe(true);
  });

  it("flags normalized duplicates across preview rows", () => {
    const rows = [
      baseRow({ rowNumber: 1, code: "java_core", version: "1.0" }),
      baseRow({ rowNumber: 2, code: "JAVA_CORE", version: "v1.0" }),
    ];

    const result = validateTopicImportRows(rows, rows);
    expect(result[0].valid).toBe(true);
    expect(result[1].valid).toBe(false);
    expect(result[1].errors.some((e) => e.includes("Duplicate Code"))).toBe(true);
  });

  it("flags numeric-only technical group and out-of-range duration", () => {
    const rows = [
      baseRow({
        rowNumber: 1,
        technicalGroup: "999",
        durationHours: 1200,
      }),
    ];

    const result = validateTopicImportRows(rows, rows);
    expect(result[0].valid).toBe(false);
    expect(result[0].errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cannot be only numbers"),
        expect.stringContaining("cannot exceed 1000"),
      ])
    );
  });

  it("preserves backend already-exists conflict until identity changes", () => {
    const original = [
      baseRow({
        rowNumber: 1,
        code: "JAVA_CORE",
        version: "1.0",
        valid: false,
        errors: ["Topic with Code 'JAVA_CORE' and Version '1.0' already exists in system."],
      }),
    ];

    const unchanged = validateTopicImportRows(original, original);
    expect(unchanged[0].valid).toBe(false);
    expect(unchanged[0].errors.some((e) => e.toLowerCase().includes("already exists"))).toBe(true);

    const edited = [{ ...original[0], version: "2.0" }];
    const revalidated = validateTopicImportRows(edited, original);
    expect(revalidated[0].valid).toBe(true);
    expect(revalidated[0].errors).toEqual([]);
  });
});

