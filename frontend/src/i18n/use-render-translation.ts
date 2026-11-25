import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toLanguage, type Language } from "@/i18n/languages";
import { translateForRender } from "@/i18n/translator";

/**
 * Dịch nhãn ngay lúc render.
 *
 * DOM translator sửa DOM sau khi trình duyệt vẽ, nên nhãn sẽ nháy tiếng Anh rồi mới ra
 * tiếng Việt. Hàm này dịch trực tiếp trong quá trình render nên không bị nháy.
 *
 * @param sourceText chuỗi gốc do ứng dụng render ra (thường là tiếng Anh)
 * @returns chuỗi đã dịch, hoặc `sourceText` nếu chưa có bản dịch
 */
export function useRenderTranslation(sourceText: string): string {
  const { i18n } = useTranslation();
  const language = toLanguage(i18n.language);

  return useMemo(
    () => translateForRender(sourceText, language) ?? sourceText,
    [sourceText, language],
  );
}

/**
 * Dịch nhiều nhãn cùng lúc.
 *
 * @param sourceTexts danh sách chuỗi gốc
 * @returns danh sách chuỗi đã dịch, giữ nguyên thứ tự và độ dài
 */
export function useRenderTranslations(sourceTexts: string[]): string[] {
  const { i18n } = useTranslation();
  const language = toLanguage(i18n.language);

  return useMemo(
    () => sourceTexts.map((text) => translateForRender(text, language) ?? text),
    [sourceTexts, language],
  );
}

/**
 * Hàm dịch dùng trong component.
 *
 * Trả về hàm để component có thể dịch nhiều chuỗi trong một lần render mà không phải
 * gọi hook cho từng chuỗi.
 */
export function useTranslate(): (sourceText: string) => string {
  const { i18n } = useTranslation();
  const language = toLanguage(i18n.language);

  return useMemo(
    () => (sourceText: string) => translateForRender(sourceText, language) ?? sourceText,
    [language],
  );
}

export type { Language };
