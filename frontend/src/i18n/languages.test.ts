import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
  isLanguage,
  toLanguage,
} from "@/i18n/languages";

describe("language config", () => {
  it("supports en, vi and ja", () => {
    expect(LANGUAGE_CODES).toEqual(["en", "vi", "ja"]);
  });

  it("exposes a native label and a short label per language", () => {
    expect(LANGUAGES.find((language) => language.code === "ja")?.label).toBe("日本語");
    expect(LANGUAGES.find((language) => language.code === "ja")?.shortLabel).toBe("JA");
  });

  it("only lists enabled languages in the active switcher", () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(["en", "vi"]);
    for (const language of SUPPORTED_LANGUAGES) {
      expect(language.enabled).toBe(true);
    }
  });

  it("validates stored language values", () => {
    expect(isLanguage("vi")).toBe(true);
    expect(isLanguage("ja")).toBe(true);
    expect(isLanguage("de")).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });

  it("falls back to the default language instead of collapsing to en", () => {
    expect(toLanguage("ja")).toBe("ja");
    expect(toLanguage("vi")).toBe("vi");
    expect(toLanguage("de")).toBe(DEFAULT_LANGUAGE);
  });
});
