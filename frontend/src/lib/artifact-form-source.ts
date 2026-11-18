import type { ArtifactDraft, ArtifactSubmission } from "@/types";

// Drafts remain stored after submission. Only a draft saved since the latest
// submission represents edits for the next version (including cleared fields).
export function artifactFormSource(draft: ArtifactDraft | null, latest: ArtifactSubmission | null) {
  if (!draft) return latest;
  if (!latest) return draft;
  return Date.parse(draft.updatedAt) >= Date.parse(latest.submittedAt) ? draft : latest;
}
