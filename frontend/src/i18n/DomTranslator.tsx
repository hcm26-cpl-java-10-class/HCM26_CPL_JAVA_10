import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { i18nApi } from "@/api/features/i18n.api";
import { toLanguage } from "@/i18n/languages";
import {
  createMemoryAutoTranslationStore,
  startDomTranslator,
} from "@/i18n/translator";

/** Số chuỗi tự động dịch gửi trong một request. */
const BATCH_SIZE = 30;

/** Thời gian chờ giữa hai lần gọi API, để không spam backend khi render nhiều trang. */
const REQUEST_DEBOUNCE_MS = 250;

/** Số lần thử lại tối đa cho một chuỗi khi backend lỗi. */
const MAX_RETRIES = 3;

/**
 * Mount once near the app root. Translates every rendered page (text, placeholders, titles)
 * with the phrase dictionary, in either direction, whenever the language changes.
 *
 * Chunks missing from the dictionary are sent to the backend, which translates them with an
 * external provider and caches the result. That is what makes new features translatable
 * without touching a single component.
 */
export function DomTranslator() {
  const { i18n } = useTranslation();
  const storeRef = useRef(createMemoryAutoTranslationStore());
  const pendingRef = useRef<Set<string>>(new Set());
  const failedRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<number | undefined>(undefined);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let language = toLanguage(i18n.language);
    const store = storeRef.current;

    const translator = startDomTranslator(document.body, () => language, {
      lookupAuto: (sourceText, target) => store.get(sourceText, target),
      onPending: (chunk) => {
        pendingRef.current.add(chunk);
      },
    });

    /**
     * Gửi các chuỗi chưa dịch được lên backend.
     *
     * Chạy liên tục (mỗi khi DOM thay đổi) nên khi người dùng chuyển sang trang mới, các
     * chuỗi của trang đó cũng được dịch ngay, không cần đổi ngôn ngữ lần nữa.
     */
    const flushPending = async () => {
      if (inFlightRef.current) return;

      const target = language;
      const relevant = Array.from(pendingRef.current).filter((chunk) => {
        const failures = failedRef.current.get(chunk) ?? 0;
        return failures < MAX_RETRIES;
      });
      if (relevant.length === 0) {
        pendingRef.current.clear();
        return;
      }

      pendingRef.current.clear();
      inFlightRef.current = true;
      try {
        for (let index = 0; index < relevant.length; index += BATCH_SIZE) {
          const batch = relevant.slice(index, index + BATCH_SIZE);
          const response = await i18nApi.translate({
            targetLanguage: target,
            sourceLanguage: "auto",
            texts: batch,
          });
          store.set(response.translations, target);
          batch.forEach((chunk) => {
            if (!(chunk in response.translations)) {
              failedRef.current.set(chunk, (failedRef.current.get(chunk) ?? 0) + 1);
            }
          });
        }
        translator.refresh();
      } catch {
        relevant.forEach((chunk) => {
          failedRef.current.set(chunk, (failedRef.current.get(chunk) ?? 0) + 1);
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    const scheduleFlush = () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        void flushPending();
      }, REQUEST_DEBOUNCE_MS);
    };

    /**
     * Mỗi khi DOM thay đổi (chuyển trang, mở modal, tải dữ liệu) thì có thể xuất hiện chuỗi
     * mới. Cơ chế này đảm bảo chúng được gửi đi dịch ngay.
     */
    const observer = new MutationObserver(() => {
      scheduleFlush();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const onChange = (next: string) => {
      language = toLanguage(next);
      failedRef.current.clear();
      pendingRef.current.clear();
      translator.refresh();
      for (const chunk of translator.collectPending()) {
        pendingRef.current.add(chunk);
      }
      scheduleFlush();
    };

    i18n.on("languageChanged", onChange);

    for (const chunk of translator.collectPending()) {
      pendingRef.current.add(chunk);
    }
    scheduleFlush();

    return () => {
      i18n.off("languageChanged", onChange);
      observer.disconnect();
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      translator.stop();
    };
  }, [i18n]);

  return null;
}

export default DomTranslator;
