import {  } from "@/i18n/format";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { EN_TO_VI, EN_TO_JA } from "@/i18n/phrases";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  isLanguage,
  type Language,
} from "@/i18n/languages";

export const LANGUAGE_STORAGE_KEY = "language";

export {
  LOCALE_BY_LANGUAGE,
  createLocaleFormatter,
  formatDateCustomNow,
  formatDateNow,
  formatDateTimeCustomNow,
  formatDateTimeMediumNow,
  formatDateTimeNow,
  formatNumberNow,
  getCurrentLocale,
  getLocaleFormat,
  localeFor,
  useLocaleFormat,
} from "@/i18n/format";
export type { LocaleFormatOptions, LocaleFormatter } from "@/i18n/format";

export const getStoredLanguage = (): Language => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode).
  }
  return DEFAULT_LANGUAGE;
};

const applyLanguage = (language: string) => {
  document.documentElement.lang = language;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable (private mode).
  }
};

/**
 * Natural-key i18n: the English text is the key, so `t("Save")` works even for strings that
 * are missing from the dictionary (they simply render as written).
 */
void i18n.use(initReactI18next).init({
  lng: getStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...LANGUAGE_CODES],
  resources: {
    en: { translation: {} },
    vi: { translation: EN_TO_VI },
    ja: { translation: EN_TO_JA },
  },
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});

applyLanguage(i18n.language);
i18n.on("languageChanged", applyLanguage);

// Keep several tabs in sync.
window.addEventListener("storage", (event) => {
  if (event.key === LANGUAGE_STORAGE_KEY && isLanguage(event.newValue) && event.newValue !== i18n.language) {
    void i18n.changeLanguage(event.newValue);
  }
});

export default i18n;
