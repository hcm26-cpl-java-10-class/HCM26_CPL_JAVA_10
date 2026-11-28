import fs from "node:fs";

const path = "src/i18n/translator.ts";
let src = fs.readFileSync(path, "utf8");

const anchor = "const TRANSLATED_ATTRIBUTES = [\"placeholder\", \"title\", \"aria-label\", \"alt\"] as const;";

const addition = `/**
 * Store d\u1eedng chung cho to\u00e0n \u1ee9ng d\u1ee5ng.
 *
 * DOM translator ghi b\u1ea3n d\u1ecbch v\u00e0o store n\u00e0y, n\u00ean component c\u00f3 th\u1ec3 d\u1ecbch ngay l\u00fac render
 * (kh\u00f4ng ph\u1ea3i ch\u1edd DOM \u0111\u01b0\u1ee3c s\u1eeda sau khi v\u1ebd) \u0111\u1ec3 kh\u00f4ng b\u1ecb nh\u00e1y ti\u1ebfng Anh
 * tr\u01b0\u1edbc khi ra ti\u1ebfng Vi\u1ec7t.
 */
const sharedAutoTranslationStore = createMemoryAutoTranslationStore();

/** Store d\u1ecbch t\u1ef1 \u0111\u1ed9ng d\u00f9ng chung. */
export const getSharedAutoTranslationStore = (): AutoTranslationStore => sharedAutoTranslationStore;

/**
 * D\u1ecbch m\u1ed9t chu\u1ed7i ngay l\u00fac render.
 *
 * \u0110\u1ea7u ti\u00ean tra t\u1eeb \u0111i\u1ec3n trong t\u1eeb \u0111i\u1ec3n, sau \u0111\u00f3 tra cache c\u1ee7a backend.
 * Tr\u1ea3 v\u1ec1 null khi kh\u00f4ng c\u00f3 b\u1ea3n d\u1ecbch \u2014 l\u00fac \u0111\u1ed9 component gi\u1eef nguy\u00ean.
 */
export function translateForRender(sourceText: string, language: Language): string | null {
  if (!sourceText) return null;
  const local = translatePhrase(sourceText, language);
  if (local !== null) return local;
  return sharedAutoTranslationStore.get(sourceText, language);
}

`;

if (!src.includes(anchor)) {
  throw new Error("anchor not found");
}

src = src.replace(anchor, addition + anchor);

fs.writeFileSync(path, src);
console.log("ok");
