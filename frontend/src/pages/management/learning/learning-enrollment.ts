import type { QueryClient } from "@tanstack/react-query";
import type { Enrollment } from "@/types";
import { learningCatalogApi } from "./learning-catalog.api";

export const personalEnrollmentKey = (email: string) => ["my-enrollments", email] as const;
const pending = new WeakMap<QueryClient, Map<string, { query: object; promise: Promise<EnrollmentResult | null> }>>();
export interface EnrollmentResult { enrollment: Enrollment; created: boolean }

/** Share in-flight requests, and never repopulate a cache cleared by logout/account changes. */
export function enrollCourse(client: QueryClient, email: string, courseId: number,
  isCurrentAccount: () => boolean): Promise<EnrollmentResult | null> {
  if (!email || !Number.isSafeInteger(courseId) || courseId <= 0 || !isCurrentAccount()) {
    return Promise.reject(new Error("Please sign in with learning access before enrolling."));
  }
  const key = personalEnrollmentKey(email);
  const query = client.getQueryCache().find({ queryKey: key, exact: true });
  if (!query || query.state.status !== "success") return Promise.reject(new Error("Please reload your enrollments before trying again."));
  const current = () => isCurrentAccount() && client.getQueryCache().find({ queryKey: key, exact: true }) === query;
  const existing = client.getQueryData<Enrollment[]>(key)?.find(e => e.courseId === courseId);
  if (existing) return Promise.resolve({ enrollment: existing, created: false });

  let requests = pending.get(client);
  if (!requests) { requests = new Map(); pending.set(client, requests); }
  // Include query identity: a fresh login must not inherit the previous session's promise.
  const requestKey = JSON.stringify([email, courseId]);
  const inFlight = requests.get(requestKey);
  if (inFlight?.query === query) return inFlight.promise;

  const request = (async (): Promise<EnrollmentResult | null> => {
    let enrollment: Enrollment;
    let created = true;
    try {
      enrollment = await learningCatalogApi.enroll(courseId);
      if (enrollment.courseId !== courseId || !Number.isSafeInteger(enrollment.id) || enrollment.id <= 0) {
        throw new Error("Enrollment could not be confirmed. Please reload and try again.");
      }
    } catch (error) {
      if (!current()) return null;
      // Reconcile an existing/concurrently-created enrollment only from backend evidence.
      let confirmed: Enrollment | undefined;
      try { confirmed = (await learningCatalogApi.mine()).find(e => e.courseId === courseId); } catch { /* Preserve original error. */ }
      if (!confirmed) throw error;
      enrollment = confirmed;
      created = false;
    }
    if (!current()) return null;
    client.setQueryData<Enrollment[]>(key, (previous = []) => [enrollment, ...previous.filter(e => e.courseId !== courseId)]);
    void client.invalidateQueries({ queryKey: ["personal-learning", email] });
    // Target-user Learning records may also be open in an authorized inspection view.
    void client.invalidateQueries({ queryKey: ["admin-learning"] });
    void client.invalidateQueries({ queryKey: key });
    return { enrollment, created };
  })().finally(() => { if (requests!.get(requestKey)?.promise === request) requests!.delete(requestKey); });
  requests.set(requestKey, { query, promise: request });
  return request;
}
