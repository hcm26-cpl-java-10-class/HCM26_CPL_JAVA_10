export interface TranslateResponse {
  translations: Record<string, string>;
  cached: number;
  translated: number;
}
