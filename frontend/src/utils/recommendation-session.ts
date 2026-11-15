export interface RecommendationTurn { role: "user" | "assistant"; content: string }
export const recommendationHistoryKey = (account: string) => `course_recommendation_chat:${encodeURIComponent(account)}`;
export function readRecommendationHistory(raw: string | null): RecommendationTurn[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is RecommendationTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.length <= 2000).slice(-8);
  } catch { return []; }
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
