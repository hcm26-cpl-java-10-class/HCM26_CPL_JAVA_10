import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { toLanguage, type Language } from "@/i18n/languages";

/**
 * Locale hiển thị tương ứng với từng ngôn ngữ của hệ thống.
 *
 * Đây là nguồn duy nhất cho locale: không được hardcode `"vi-VN"` / `"en-GB"` rải rác trong
 * component, vì như vậy đổi ngôn ngữ thì ngày/số vẫn giữ định dạng cũ.
 */
export const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  en: "en-US",
  vi: "vi-VN",
  ja: "ja-JP",
};

export const localeFor = (language: Language): string => LOCALE_BY_LANGUAGE[language] ?? LOCALE_BY_LANGUAGE.en;

export interface LocaleFormatOptions {
  /** Múi giờ hiển thị; mặc định dùng múi giờ của máy người dùng. */
  timeZone?: string;
}

export interface LocaleFormatter {
  /** Locale đang dùng, ví dụ `vi-VN`. */
  locale: string;
  /** Ngôn ngữ đang dùng, ví dụ `vi`. */
  language: Language;
  formatDate: (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => string;
  formatDateTime: (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => string;
  /** Ngày giờ dạng đầy đủ (medium + short), dùng cho deadline. */
  formatDateTimeMedium: (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => string;
  formatTime: (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => string;
  /** Định dạng ngày với tuỳ chọn tuỳ biến, nhưng locale lấy theo ngôn ngữ hiện tại. */
  formatDateCustom: (
    value: string | number | Date | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ) => string;
  /** Định dạng ngày giờ với tuỳ chọn tuỳ biến. */
  formatDateTimeCustom: (
    value: string | number | Date | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
  /** Khoảng thời gian tương đối, ví dụ "3 ngày trước". */
  formatRelative: (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => string;
  /** Tương đối dạng ngắn: "3d", "5h", "12m". */
  formatRelativeShort: (value: string | number | Date | null | undefined) => string;
}

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Relative time dùng `Intl.RelativeTimeFormat` với locale hiện tại. */
const relativeFormatter = (locale: string) => new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

/** Dạng ngắn: "3d ago" / "3 ngày trước" — dùng style "narrow" của Intl. */
const shortRelativeFormatter = (locale: string) =>
  new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "narrow" });

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

type RelativeUnit = Intl.RelativeTimeFormatUnit;

const pickRelativeUnit = (diffMs: number): { value: number; unit: RelativeUnit } => {
  const abs = Math.abs(diffMs);
  if (abs < MINUTE) return { value: 0, unit: "second" };
  if (abs < HOUR) return { value: Math.round(diffMs / MINUTE), unit: "minute" };
  if (abs < DAY) return { value: Math.round(diffMs / HOUR), unit: "hour" };
  if (abs < MONTH) return { value: Math.round(diffMs / DAY), unit: "day" };
  if (abs < YEAR) return { value: Math.round(diffMs / MONTH), unit: "month" };
  return { value: Math.round(diffMs / YEAR), unit: "year" };
};

/**
 * Tạo bộ formatter theo locale.
 *
 * Hàm thuần để dùng được cả trong module không phải React (utility, schema).
 */
export function createLocaleFormatter(language: Language): LocaleFormatter {
  const locale = localeFor(language);
  const relative = relativeFormatter(locale);
  const shortRelative = shortRelativeFormatter(locale);

  const dateFormatter = (options?: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, options);

  const formatDate = (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => {
    const date = toDate(value);
    if (!date) return "—";
    try {
      return dateFormatter({
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
      }).format(date);
    } catch {
      return "—";
    }
  };

  const formatDateTime = (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => {
    const date = toDate(value);
    if (!date) return "—";
    try {
      return dateFormatter({
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
      }).format(date);
    } catch {
      return "—";
    }
  };

  const formatTime = (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => {
    const date = toDate(value);
    if (!date) return "—";
    try {
      return dateFormatter({
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
      }).format(date);
    } catch {
      return "—";
    }
  };

  const formatDateTimeMedium = (value: string | number | Date | null | undefined, options?: LocaleFormatOptions) => {
    const date = toDate(value);
    if (!date) return "—";
    try {
      return dateFormatter({
        dateStyle: "medium",
        timeStyle: "short",
        ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
      }).format(date);
    } catch {
      return "—";
    }
  };

  const formatDateCustom = (
    value: string | number | Date | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ) => {
    const date = toDate(value);
    if (!date) return "—";
    try {
      return dateFormatter(options).format(date);
    } catch {
      return "—";
    }
  };

  const formatDateTimeCustom = (
    value: string | number | Date | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ) => {
    const date = toDate(value);
    if (!date) return "—";
    try {
      return dateFormatter(options).format(date);
    } catch {
      return "—";
    }
  };

  const formatNumber = (value: number | null | undefined, options?: Intl.NumberFormatOptions) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(locale, options).format(value);
  };

  const formatRelative = (value: string | number | Date | null | undefined) => {
    const date = toDate(value);
    if (!date) return "—";
    const diff = date.getTime() - Date.now();
    const { value: amount, unit } = pickRelativeUnit(diff);
    return relative.format(amount, unit);
  };

  const formatRelativeShort = (value: string | number | Date | null | undefined) => {
    const date = toDate(value);
    if (!date) return "—";
    const diff = date.getTime() - Date.now();
    const { value: amount, unit } = pickRelativeUnit(diff);
    return shortRelative.format(amount, unit);
  };

  return {
    locale,
    language,
    formatDate,
    formatDateTime,
    formatDateTimeMedium,
    formatDateCustom,
    formatDateTimeCustom,
    formatTime,
    formatNumber,
    formatRelative,
    formatRelativeShort,
  };
}

/**
 * Hook trả về bộ formatter theo ngôn ngữ đang chọn.
 *
 * Component dùng hook này sẽ tự render lại khi người dùng đổi ngôn ngữ, nên ngày/số hiển thị
 * cũng đổi theo — không cần copy dữ liệu vào state.
 */
export function useLocaleFormat(): LocaleFormatter {
  const { i18n } = useTranslation();
  const language = toLanguage(i18n.language);
  return useMemo(() => createLocaleFormatter(language), [language]);
}

/**
 * Bộ formatter theo ngôn ngữ hiện tại, dùng được trong module không phải React
 * (utility, schema, helper của chart).
 *
 * Giá trị được tính lại mỗi lần gọi nên luôn khớp ngôn ngữ đang chọn.
 */
export function getLocaleFormat(): LocaleFormatter {
  return createLocaleFormatter(toLanguage(i18next.language));
}

/** Locale hiện tại, ví dụ `vi-VN`. */
export function getCurrentLocale(): string {
  return localeFor(toLanguage(i18next.language));
}

/** Định dạng ngày theo locale hiện tại. */
export function formatDateNow(
  value: string | number | Date | null | undefined,
  options?: LocaleFormatOptions,
): string {
  return getLocaleFormat().formatDate(value, options);
}

/** Định dạng ngày giờ theo locale hiện tại. */
export function formatDateTimeNow(
  value: string | number | Date | null | undefined,
  options?: LocaleFormatOptions,
): string {
  return getLocaleFormat().formatDateTime(value, options);
}

/** Định dạng ngày giờ dạng đầy đủ (medium + short) theo locale hiện tại. */
export function formatDateTimeMediumNow(
  value: string | number | Date | null | undefined,
  options?: LocaleFormatOptions,
): string {
  return getLocaleFormat().formatDateTimeMedium(value, options);
}

/** Định dạng số theo locale hiện tại. */
export function formatNumberNow(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  return getLocaleFormat().formatNumber(value, options);
}

/** Định dạng ngày theo locale hiện tại với tuỳ chọn tuỳ biến. */
export function formatDateCustomNow(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return getLocaleFormat().formatDateCustom(value, options);
}

/** Định dạng ngày giờ theo locale hiện tại với tuỳ chọn tuỳ biến. */
export function formatDateTimeCustomNow(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return getLocaleFormat().formatDateTimeCustom(value, options);
}
