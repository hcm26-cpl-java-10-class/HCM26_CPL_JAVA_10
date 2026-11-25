import { describe, expect, it } from "vitest";
import { normalizeSubjectIdentity } from "./subject-identity.utils";

describe("normalizeSubjectIdentity", () => {
  it("trims and uppercases code and strips optional leading v on numeric versions", () => {
    expect(
      normalizeSubjectIdentity({ code: "  java_core  ", version: "  V1.0  " })
    ).toEqual({
      code: "JAVA_CORE",
      version: "1.0",
    });
  });

  it("handles lowercase v prefix without touching non-numeric version names", () => {
    expect(normalizeSubjectIdentity({ version: "v2.5" }).version).toBe("2.5");
    expect(normalizeSubjectIdentity({ version: "  vAlpha  " }).version).toBe("valpha");
  });

  it("preserves missing fields without failing", () => {
    expect(normalizeSubjectIdentity({})).toEqual({});
    expect(normalizeSubjectIdentity({ code: "spring" })).toEqual({ code: "SPRING" });
  });
});
