export interface RecommendationTurn { role: "user" | "assistant"; content: string; courseNames?: string[] }
export const recommendationHistoryKey = (account: string) => `course_recommendation_chat:${encodeURIComponent(account)}`;
/** Presentation-only cleanup; IDs remain on validated card objects. Also covers saved/provider text. */
export function courseReplyText(value: string): string {
  return value.replace(/\s*[([{]\s*(?:course[ _-]*ids?|ids?|mã(?: khóa học)?)\s*[:#=：-]?\s*\d+(?:\s*[,;]\s*\d+)*\s*[)\]}]/giu, "")
    .replace(/\b(?:course[ _-]*ids?|ids?|mã(?: khóa học)?)\s*[:#=：-]?\s*\d+(?:\s*[,;]\s*\d+)*/giu, "");
}
export function recommendationPage<T>(items: T[], requested: number) {
  const total = Math.max(1, Math.ceil(items.length / 6));
  const page = Math.min(Math.max(1, requested), total);
  return { page, total, items: items.slice((page - 1) * 6, page * 6) };
}
export function readRecommendationHistory(raw: string | null): RecommendationTurn[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is RecommendationTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.length <= 2000).slice(-8).map(t => t.role === "assistant" ? { ...t, content: courseReplyText(t.content) } : t).map(t => ({ role: t.role, content: t.content, ...(Array.isArray(t.courseNames) ? { courseNames: t.courseNames.filter((name: unknown): name is string => typeof name === "string" && name.length <= 200).slice(0, 30) } : {}) }));
  } catch { return []; }
}
/** Keep the selected course context for follow-ups without repeating a card list in each bubble. */
export function recommendationContext(turns: RecommendationTurn[]): RecommendationTurn[] {
  return turns.slice(-8).map(t => ({role:t.role,content:(t.content + (t.role === "assistant" && t.courseNames?.length ? "\nSuggested courses: " + t.courseNames.join(", ") : "")).slice(0,2000)}));
}
/** Invalidates old responses on clear/reset/unmount, even if cancellation arrives too late. */
export class RecommendationRequest {
  private generation = 0;
  private controller = new AbortController();
  next() {
    this.cancel();
    this.controller = new AbortController();
    const generation = this.generation;
    return { signal: this.controller.signal, current: () => generation === this.generation && !this.controller.signal.aborted };
  }
  cancel() { this.generation++; this.controller.abort(); }
}
