import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { i18nApi } from "@/api/features/i18n.api";
import { toLanguage, type Language } from "@/i18n/languages";
import {
  getSharedAutoTranslationStore,
  startDomTranslator,
} from "@/i18n/translator";

/** Số chuỗi tự động dịch gửi trong một request. */
const BATCH_SIZE = 30;

/**
 * Thời gian chờ giữa hai lần gọi API.
 *
 * Khoảng chờ đủ dài để gom nhiều thay đổi DOM liên tiếp (React render, mở modal, điều hướng)
 * thành một lần gọi, tránh spam backend khi người dùng chuyển trang liên tục.
 */
const REQUEST_DEBOUNCE_MS = 600;

/** Số lần thử lại tối đa cho một chuỗi khi backend lỗi. */
const MAX_RETRIES = 3;

/**
 * Ngôn ngữ nguồn của chuỗi gửi đi dịch.
 *
 * Ứng dụng có cả nhãn viết sẵn bằng tiếng Việt lẫn tiếng Anh. Nếu dùng `auto` thì provider
 * phải tự nhận diện và có thể dịch ngược (tiếng Việt -> tiếng Việt), còn provider dự phòng
 * (MyMemory) không hỗ trợ `auto` nên luôn trả rỗng. Vì vậy khi đích là `vi`/`ja` thì nguồn
 * được coi là `en`, khi đích là `en` thì nguồn là `vi`.
 */
const sourceLanguageFor = (target: Language): Language => (target === "en" ? "vi" : "en");

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
  const storeRef = useRef(getSharedAutoTranslationStore());
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
        // Translator đã phát hiện chuỗi mới nên không cần observer riêng để theo dõi DOM.
        scheduleFlush();
      },
    });

    /**
     * Gửi các chuỗi chưa dịch được lên backend.
     *
     * Chạy liên tục (mỗi khi DOM thay đổi) nên khi người dùng chuyển sang trang mới, các
     * chuỗi của trang đó cũng được dịch ngay, không cần đổi ngôn ngữ lần nữa.
     */
    const flushPending = async () => {
      // Tab đang ẩn: không gọi API để tránh tốn băng thông ngoài ý muốn người dùng.
      if (document.hidden) {
        scheduleFlush();
        return;
      }

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
            sourceLanguage: sourceLanguageFor(target),
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

      // Trong lúc request đang chạy, DOM có thể sinh ra chuỗi mới. Nếu không gửi tiếp thì
      // các chuỗi đó bị bỏ rơi và không bao giờ được dịch.
      if (pendingRef.current.size > 0) {
        scheduleFlush();
      }
    };

    /**
     * Lên lịch gửi chuỗi chưa dịch lên backend.
     *
     * Dùng function declaration để hàm này có thể được gọi từ callback `onPending` phía trên.
     */
    function scheduleFlush() {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        void flushPending();
      }, REQUEST_DEBOUNCE_MS);
    }

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
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      translator.stop();
    };
  }, [i18n]);

  return null;
}

export default DomTranslator;
