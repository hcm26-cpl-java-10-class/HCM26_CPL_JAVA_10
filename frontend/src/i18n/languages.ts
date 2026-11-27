export type Language = "en" | "vi" | "ja";

export interface LanguageConfig {
  code: Language;
  label: string;
  shortLabel: string;
  enabled: boolean;
  fallback: Language;
}

export const LANGUAGES: ReadonlyArray<LanguageConfig> = [
  { code: "en", label: "English", shortLabel: "EN", enabled: true, fallback: "en" },
  { code: "vi", label: "Tiếng Việt", shortLabel: "VI", enabled: true, fallback: "en" },
  { code: "ja", label: "日本語", shortLabel: "JA", enabled: false, fallback: "en" },
];

export const SUPPORTED_LANGUAGES: ReadonlyArray<LanguageConfig> =
  LANGUAGES.filter((language) => language.enabled);

export const LANGUAGE_CODES: ReadonlyArray<Language> = LANGUAGES.map((language) => language.code);

export const DEFAULT_LANGUAGE: Language = "en";

export const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && (LANGUAGE_CODES as ReadonlyArray<string>).includes(value);

export const toLanguage = (value: string): Language => (isLanguage(value) ? value : DEFAULT_LANGUAGE);

export const languageLabel = (code: Language): string =>
  LANGUAGES.find((language) => language.code === code)?.label ?? code;

export const languageShortLabel = (code: Language): string =>
  LANGUAGES.find((language) => language.code === code)?.shortLabel ?? code;
