import api from "@/api/axios";
import type { CatalogCourse } from "@/types";
export interface Preferences { goals: string; interests: string[] }
export interface Recommendation { course: CatalogCourse; reason: string }
export interface RecommendationResult { recommendations: Recommendation[]; preferences: Preferences; state: string }
export interface Turn { role: "user" | "assistant"; content: string }
export interface ChatResult { reply: string; recommendations: Recommendation[]; aiStatus: string; state: string }
const path = "/course-recommendations";
export const recommendationsApi = {
  get: async (signal: AbortSignal) => (await api.get<RecommendationResult>(path, { signal })).data,
  save: async (value: Preferences, signal: AbortSignal) => (await api.put<Preferences>(`${path}/preferences`, value, { signal })).data,
  dismiss: async (id: number, signal: AbortSignal) => { await api.post(`${path}/dismiss/${id}`, {}, { signal }); },
  reset: async (signal: AbortSignal) => { await api.delete(`${path}/preferences`, { signal }); },
  ask: async (message: string, history: Turn[], language: "en" | "vi", signal: AbortSignal) =>
    (await api.post<ChatResult>(`${path}/chat`, { message, history, language }, { signal, timeout: 30000 })).data,
};
