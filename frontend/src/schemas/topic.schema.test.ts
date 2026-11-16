import { describe, expect, it } from "vitest";
import {
  cloneTopicSchema,
  getTechnicalGroupBadgeClass,
  isNumericOnly,
  topicFormSchema,
} from "./topic.schema";

describe("topicFormSchema & helpers", () => {
  it("parses valid input and normalizes code and version", () => {
    const parsed = topicFormSchema.parse({
      code: "  java_core ",
      name: "  Java Core  ",
      version: "v1.0",
      technicalGroup: "Java",
      durationHours: "40",
      description: "Core Java syllabus",
      isActive: true,
    });

    expect(parsed).toEqual({
      code: "JAVA_CORE",
      name: "Java Core",
      version: "1.0",
      technicalGroup: "Java",
      durationHours: 40,
      description: "Core Java syllabus",
      isActive: true,
    });
  });

  it("blocks numeric-only technical group", () => {
    const result = topicFormSchema.safeParse({
      code: "JAVA",
      name: "Java",
      version: "1.0",
      technicalGroup: "12345",
      durationHours: 20,
      description: "",
      isActive: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("cannot be only numbers");
    }
  });

  it.each([0, -5, 12.5, 1001, ""])("rejects invalid durationHours value %s", (badDuration) => {
    const result = topicFormSchema.safeParse({
      code: "JAVA",
      name: "Java",
      version: "1.0",
      technicalGroup: "Backend",
      durationHours: badDuration,
      isActive: true,
    });
    expect(result.success).toBe(false);
  });

  it("normalizes cloneTopicSchema versions", () => {
    expect(cloneTopicSchema.parse({ version: " V2.1 " })).toEqual({ version: "2.1" });
    expect(cloneTopicSchema.safeParse({ version: "   " }).success).toBe(false);
  });

  it("detects numeric-only text and resolves technical group badge classes", () => {
    expect(isNumericOnly("42")).toBe(true);
    expect(isNumericOnly(" 3.14 ")).toBe(true);
    expect(isNumericOnly("Java 21")).toBe(false);
    expect(getTechnicalGroupBadgeClass("Java")).toContain("blue");
    expect(getTechnicalGroupBadgeClass("React Native")).toContain("cyan");
    expect(getTechnicalGroupBadgeClass(undefined)).toContain("gray");
  });
});

