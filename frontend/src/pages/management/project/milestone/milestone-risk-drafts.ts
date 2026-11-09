export interface MilestoneRiskDraft {
  milestoneId: string; title: string; note: string; key?: string; fingerprint?: string;
}
const fallback = new Map<string, MilestoneRiskDraft>();
export function milestoneDraftScope(tenantId: number, actorId: number, projectId: string) {
  return `milestone-risk-draft:${tenantId}:${actorId}:${projectId}:`;
}
export function saveMilestoneDraft(scope: string, draft: MilestoneRiskDraft) {
  const key = scope + draft.milestoneId;
  fallback.set(key, draft);
  try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* Keep the in-memory draft if storage is full or unavailable. */ }
}
export function getMilestoneDraft(scope: string, id: string): MilestoneRiskDraft | undefined {
  const key = scope + id;
  if (fallback.has(key)) return fallback.get(key);
  try { const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value?.milestoneId === id && typeof value.note === "string" ? value : undefined;
  } catch { return undefined; }
}
export function removeMilestoneDraft(scope: string, id: string) {
  fallback.delete(scope + id);
  try { localStorage.removeItem(scope + id); } catch { /* Nothing else to remove. */ }
}
export function listMilestoneDrafts(scope: string): MilestoneRiskDraft[] {
  const ids = new Set([...fallback.keys()].filter(key => key.startsWith(scope)).map(key => key.slice(scope.length)));
  try { for (let i=0;i<localStorage.length;i++) { const key = localStorage.key(i); if (key?.startsWith(scope)) ids.add(key.slice(scope.length)); } } catch { /* Use memory. */ }
  return [...ids].map(id => getMilestoneDraft(scope,id)).filter((draft): draft is MilestoneRiskDraft => !!draft);
}
