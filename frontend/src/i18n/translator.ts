import { EN_TO_VI, VI_TO_EN, EN_TO_JA } from "@/i18n/phrases";
import { LANGUAGE_CODES, type Language } from "@/i18n/languages";

export type { Language } from "@/i18n/languages";
export {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
  isLanguage,
  languageLabel,
  languageShortLabel,
  toLanguage,
} from "@/i18n/languages";

type Table = Record<string, string>;

const lowerTable = (table: Table): Table => {
  const result: Table = {};
  for (const [key, value] of Object.entries(table)) {
    const lower = key.toLowerCase();
    if (!(lower in result)) result[lower] = value;
  }
  return result;
};

const TABLES: Partial<Record<Language, { exact: Table; lower: Table }>> = {
  // Target language -> dictionary that maps *into* it.
  vi: { exact: EN_TO_VI, lower: lowerTable(EN_TO_VI) },
  en: { exact: VI_TO_EN, lower: lowerTable(VI_TO_EN) },
  ja: { exact: EN_TO_JA, lower: lowerTable(EN_TO_JA) },
};

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

const matchCase = (source: string, translated: string) =>
  source === source.toUpperCase() && /[A-Z]/.test(source) ? translated.toUpperCase() : translated;

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

/** Dynamic English patterns -> Vietnamese. The captured noun phrase is translated recursively. */
const VI_PATTERNS: Array<[RegExp, (noun: string, tail: string) => string]> = [
  [/^Loading (.+?)(\.\.\.|…)?$/i, (n, t) => `Đang tải ${n}${t}`],
  [/^Search (.+?)(\.\.\.|…)?$/i, (n, t) => `Tìm kiếm ${n}${t}`],
  [/^Back to (.+)$/i, (n) => `Quay lại ${n}`],
  [/^No (.+?) found\.?$/i, (n) => `Không tìm thấy ${n}`],
  [/^No (.+?) yet\.?$/i, (n) => `Chưa có ${n}`],
  [/^(?:Create|New) (.+)$/i, (n) => `Tạo ${n}`],
  [/^Add (.+)$/i, (n) => `Thêm ${n}`],
  [/^Edit (.+)$/i, (n) => `Sửa ${n}`],
  [/^Delete (.+)$/i, (n) => `Xóa ${n}`],
  [/^View (.+)$/i, (n) => `Xem ${n}`],
  [/^Select (.+)$/i, (n) => `Chọn ${n}`],
  [/^All (.+)$/i, (n) => `Tất cả ${n}`],
  [/^Total (.+)$/i, (n) => `Tổng ${n}`],
];

/** Dynamic Vietnamese patterns -> English. */
const EN_PATTERNS: Array<[RegExp, (noun: string, tail: string) => string]> = [
  [/^Đang tải (.+?)(\.\.\.|…)?$/i, (n, t) => `Loading ${n}${t}`],
  [/^Tìm kiếm (.+?)(\.\.\.|…)?$/i, (n, t) => `Search ${n}${t}`],
  [/^Quay lại (.+)$/i, (n) => `Back to ${n}`],
  [/^Không tìm thấy (.+?)\.?$/i, (n) => `No ${n} found`],
  [/^Chưa có (.+?)\.?$/i, (n) => `No ${n} yet`],
  [/^(?:Tạo mới|Tạo) (.+)$/i, (n) => `Create ${n}`],
  [/^Thêm mới? (.+)$/i, (n) => `Add ${n}`],
  [/^(?:Chỉnh sửa|Sửa) (.+)$/i, (n) => `Edit ${n}`],
  [/^Xóa (.+)$/i, (n) => `Delete ${n}`],
  [/^(?:Xem chi tiết|Xem) (.+)$/i, (n) => `View ${n}`],
  [/^Chọn (.+)$/i, (n) => `Select ${n}`],
  [/^Tất cả (.+)$/i, (n) => `All ${n}`],
  [/^Tổng (?:số )?(.+)$/i, (n) => `Total ${n}`],
  [/^Danh sách (.+)$/i, (n) => `${n} List`],
  [/^Quản lý (.+)$/i, (n) => `${n} Management`],
  [/^Chi tiết (.+)$/i, (n) => `${n} Details`],
  [/^Thông tin (.+)$/i, (n) => `${n} Information`],
  [/^Báo cáo (.+)$/i, (n) => `${n} Report`],
  [/^Lịch sử (.+)$/i, (n) => `${n} History`],
];

function translateExact(text: string, language: Language): string | null {
  const table = TABLES[language];
  if (!table) return null;
  const direct = table.exact[text];
  if (direct !== undefined) return direct;
  const viaLower = table.lower[text.toLowerCase()];
  return viaLower === undefined ? null : matchCase(text, viaLower);
}

/**
 * Translates one phrase into `language`. Returns null when the phrase is unknown, so the caller
 * keeps whatever the component rendered.
 */
export function translatePhrase(text: string, language: Language): string | null {
  const phrase = normalize(text);
  if (!phrase) return null;

  const exact = translateExact(phrase, language);
  if (exact !== null) return exact;

  if (language === "vi") {
    for (const [pattern, build] of VI_PATTERNS) {
      const match = phrase.match(pattern);
      if (!match) continue;
      const noun = translateExact(match[1], "vi");
      if (noun === null) continue;
      return build(lowerFirst(noun), match[2] ?? "");
    }
  } else if (language === "en") {
    for (const [pattern, build] of EN_PATTERNS) {
      const match = phrase.match(pattern);
      if (!match) continue;
      const noun = translateExact(match[1], "en");
      if (noun === null) continue;
      return build(noun, match[2] ?? "");
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auto-translation layer
// ---------------------------------------------------------------------------

/**
 * Chunks that can be translated automatically.
 *
 * The DOM translator feeds every visible text node into this layer, so the rules below keep
 * machine-generated text away from the translation API: pure numbers, codes, URLs, e-mail
 * addresses and file paths are never sent out.
 */
const AUTO_TRANSLATABLE = {
  /** Shortest chunk worth sending (shorter chunks are noise: "OK", "3", "Hi"). */
  minLength: 2,
  /** Longest chunk accepted by the backend. */
  maxLength: 600,
};

/**
 * Chunk viết HOA toàn bộ và ngắn thường là từ viết tắt (ADMIN, STUDENT, URL, PDF...).
 * Dịch những chuỗi này chỉ làm nội dung khó hiểu hơn, nên chúng được giữ nguyên.
 */
const ACRONYM_MAX_LENGTH = 12;

const SKIP_AUTO_PATTERNS: RegExp[] = [
  // Identifiers: snake_case, kebab-case, camelCase, dotted names.
  /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/i,
  // Numbers, percentages, currency, dates, versions.
  /^[0-9\s.,:;%+\-*/()]+$/,
  // Code-ish content.
  /^[<{[]/,
];

/**
 * Chunk chứa bất kỳ nội dung nào sau đây thì không được dịch, vì dịch sẽ làm hỏng chúng:
 * địa chỉ e-mail, URL, đường dẫn tệp, mã định danh.
 */
const SKIP_AUTO_CONTAINS: RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/,
  /(?:https?:|www\.)\S+/i,
  /^[./~\\]|^[a-z]:[\\/]/i,
  /\b[a-z0-9]+(?:[._-][a-z0-9]+)+\b/i,
];

/** True when the chunk is written in all caps and short enough to be an acronym. */
function looksLikeAcronym(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > ACRONYM_MAX_LENGTH) return false;
  return trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
}

/** True when a chunk is worth sending to the auto-translation API. */
export function isAutoTranslatable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < AUTO_TRANSLATABLE.minLength) return false;
  if (trimmed.length > AUTO_TRANSLATABLE.maxLength) return false;
  // A chunk without any letter is a number, a symbol or a code.
  if (!/\p{L}/u.test(trimmed)) return false;
  if (looksLikeAcronym(trimmed)) return false;
  for (const pattern of SKIP_AUTO_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  // A chunk that embeds an e-mail, a URL or a path must not be translated: the translator
  // would mangle it (e.g. "admin@example.com" -> "quản trị viên@example.com").
  for (const pattern of SKIP_AUTO_CONTAINS) {
    if (pattern.test(trimmed)) return false;
  }
  return true;
}

/**
 * Vietnamese-specific letters and the combining marks used for the tone marks.
 */
const VIETNAMESE_MARKERS = /[ĂăÂâĐđÊêÔôƠơƯư]|[̀-ͯ]|[Ạ-ỹ]/;

/** True when the chunk looks like Vietnamese text. */
export function looksVietnamese(text: string): boolean {
  return VIETNAMESE_MARKERS.test(text);
}

/**
 * True when a chunk must be sent to the auto-translation API.
 *
 * Chiều dịch do backend tự nhận diện (`sl=auto`), vì ứng dụng có cả nhãn viết sẵn bằng
 * tiếng Việt lẫn nhãn tiếng Anh.
 */
export function needsAutoTranslation(text: string): boolean {
  return isAutoTranslatable(text);
}

/**
 * Resolves a phrase against the auto-translation cache.
 */
export interface AutoTranslationStore {
  /** Returns the cached translation, or null when the phrase is unknown. */
  get(sourceText: string, language: Language): string | null;
  /** Stores translations for the given language. */
  set(entries: Record<string, string>, language: Language): void;
}

const CACHE_STORAGE_PREFIX = "fams:i18n:";

const MAX_CACHED_ENTRIES = 5000;

const readCache = (language: Language): Record<string, string> => {
  try {
    const raw = localStorage.getItem(`${CACHE_STORAGE_PREFIX}${language}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writeCache = (language: Language, entries: Record<string, string>) => {
  try {
    const keys = Object.keys(entries);
    const trimmed =
      keys.length > MAX_CACHED_ENTRIES
        ? Object.fromEntries(keys.slice(keys.length - MAX_CACHED_ENTRIES).map((k) => [k, entries[k]]))
        : entries;
    localStorage.setItem(`${CACHE_STORAGE_PREFIX}${language}`, JSON.stringify(trimmed));
  } catch {
    // localStorage có thể bị chặn (private mode).
  }
};

/** In-memory store; the DOM translator fills it from the backend response. */
export const createMemoryAutoTranslationStore = (): AutoTranslationStore => {
  const tables = new Map<Language, Map<string, string>>(
    LANGUAGE_CODES.map((code) => [code, new Map<string, string>(Object.entries(readCache(code)))]),
  );

  const lowerIndex = new Map<Language, Map<string, string>>(
    LANGUAGE_CODES.map((code) => [code, new Map<string, string>()]),
  );

  for (const [language, table] of tables) {
    const lower = lowerIndex.get(language)!;
    for (const [key, value] of table) {
      const lowerKey = key.toLowerCase();
      if (!lower.has(lowerKey)) lower.set(lowerKey, value);
    }
  }

  return {
    get(sourceText, language) {
      const exact = tables.get(language)?.get(sourceText);
      if (exact !== undefined) return exact;
      const viaLower = lowerIndex.get(language)?.get(sourceText.toLowerCase());
      return viaLower === undefined ? null : matchCase(sourceText, viaLower);
    },
    set(entries, language) {
      const table = tables.get(language);
      const lower = lowerIndex.get(language);
      if (!table || !lower) return;
      for (const [source, translated] of Object.entries(entries)) {
        table.set(source, translated);
        const key = source.toLowerCase();
        if (!lower.has(key)) lower.set(key, translated);
      }
      writeCache(language, Object.fromEntries(table));
    },
  };
};

// ---------------------------------------------------------------------------
// DOM translator
// ---------------------------------------------------------------------------

const TRANSLATED_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;

/**
 * Vùng không được máy dịch đụng vào.
 *
 * - `data-no-translate` / `.no-translate`: dữ liệu nghiệp vụ lấy từ DB (tên, email, mã) —
 *   nội dung người dùng nhập không được dịch.
 * - `svg` / `.recharts-wrapper`: chart vẽ bằng SVG, sửa text trong đó làm vỡ biểu đồ.
 * - `[role='textbox']` / `textarea` / `[contenteditable]`: vùng soạn thảo rich-text.
 */
const SKIP_SELECTOR =
  "script, style, noscript, code, pre, textarea, [contenteditable='true'], [role='textbox'], [data-no-translate], .no-translate, svg, .recharts-wrapper, .recharts-tooltip-wrapper";

/**
 * Ghi nhớ chuỗi gốc của một node.
 *
 * `original` là chuỗi do ứng dụng render ra, `shown` là chuỗi đang hiển thị. Hai giá trị này
 * giúp translator phân biệt được "React vừa render lại nội dung mới" với "chính translator
 * vừa ghi đè nội dung" - nếu không có nó, mỗi lần dịch sẽ dịch lại chính chuỗi đã dịch.
 */
type TextRecord = { original: string; shown: string };
type AttributeRecord = Record<string, TextRecord>;

/** Keeps the leading/trailing whitespace of the original text node. */
const withOuterWhitespace = (original: string, translated: string) => {
  const lead = original.match(/^\s*/)?.[0] ?? "";
  const trail = original.match(/\s*$/)?.[0] ?? "";
  return `${lead}${translated}${trail}`;
};

export interface DomTranslator {
  /** Re-translates the whole tree (call after the language changed). */
  refresh: () => void;
  /** Re-translates the whole tree and returns the chunks that still need auto-translation. */
  collectPending: () => string[];
  stop: () => void;
}

export interface DomTranslatorOptions {
  /** Returns the cached auto-translation for a phrase, or null. */
  lookupAuto?: (sourceText: string, language: Language) => string | null;
  /** Called whenever a new chunk needs auto-translation. */
  onPending?: (chunk: string) => void;
}

/**
 * Translates visible text of every page without touching the components: text nodes and the
 * placeholder / title / aria-label / alt attributes are replaced in place. Original values are
 * remembered so switching back (or React re-rendering a node) never loses the source text.
 */
export function startDomTranslator(
  root: HTMLElement,
  getLanguage: () => Language,
  options: DomTranslatorOptions = {}
): DomTranslator {
  const textRecords = new WeakMap<Text, TextRecord>();
  const attributeRecords = new WeakMap<Element, AttributeRecord>();
  const pending = new Set<string>();

  const lookupAuto = options.lookupAuto;
  const onPending = options.onPending;

  const shouldSkip = (node: Node): boolean => {
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return !element || element.closest(SKIP_SELECTOR) !== null;
  };

  /**
   * Dịch một chuỗi gốc.
   *
   * @param original chuỗi do ứng dụng render ra
   * @returns chuỗi mới để hiển thị, hoặc null nếu giữ nguyên
   */
  const resolve = (original: string): string | null => {
    const language = getLanguage();

    const local = translatePhrase(original, language);
    if (local !== null) return local;

    if (!lookupAuto) return null;
    if (!needsAutoTranslation(original)) return null;

    const auto = lookupAuto(original, language);
    if (auto === null) {
      const chunk = original.trim();
      if (!pending.has(chunk)) {
        pending.add(chunk);
        onPending?.(chunk);
      }
      return null;
    }
    return auto;
  };

  const processText = (node: Text) => {
    if (shouldSkip(node)) return;
    const value = node.nodeValue ?? "";

    let record = textRecords.get(node);
    if (!record) {
      record = { original: value, shown: value };
    } else if (record.shown !== value) {
      // React vừa ghi nội dung mới vào node: nội dung đó là chuỗi nguồn mới.
      record = { original: value, shown: value };
    }

    const translated = resolve(record.original);
    const next = translated === null ? record.original : withOuterWhitespace(record.original, translated);
    record.shown = next;
    textRecords.set(node, record);
    if (value !== next) node.nodeValue = next;
  };

  const processElementAttributes = (element: Element) => {
    if (shouldSkip(element)) return;
    let records = attributeRecords.get(element);
    for (const name of TRANSLATED_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      let record = records?.[name];
      if (!record || record.shown !== value) {
        record = { original: value, shown: value };
      }
      const translated = resolve(record.original);
      const next = translated ?? record.original;
      record.shown = next;
      records = { ...(records ?? {}), [name]: record };
      if (value !== next) element.setAttribute(name, next);
    }
    if (records) attributeRecords.set(element, records);
  };

  const processTree = (start: Node) => {
    if (start.nodeType === Node.TEXT_NODE) {
      processText(start as Text);
      return;
    }
    if (start.nodeType !== Node.ELEMENT_NODE) return;
    if (shouldSkip(start)) return;
    processElementAttributes(start as Element);
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) processText(current as Text);
      else processElementAttributes(current as Element);
      current = walker.nextNode();
    }
  };

  let scheduled = false;

  const flush = () => {
    scheduled = false;
    processTree(root);
  };

  const observer = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATED_ATTRIBUTES],
  });

  const refresh = () => {
    pending.clear();
    processTree(root);
  };

  refresh();

  return {
    refresh,
    collectPending: () => Array.from(pending),
    stop: () => observer.disconnect(),
  };
}
