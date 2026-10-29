import type { TeachingAssignment } from "@/api/features/class-setup.api";

export type DeleteTarget = Pick<TeachingAssignment, "id" | "revision" | "classCode" | "subjectCode">;
export type BulkDeleteResult = { deletedIds: number[]; failures: { assignment: DeleteTarget; error: unknown }[] };

export async function deleteSelectedAssignments(
  assignments: DeleteTarget[],
  remove: (id: number, revision: number) => Promise<unknown>,
  onProgress: (completed: number) => void = () => {},
): Promise<BulkDeleteResult> {
  const result: BulkDeleteResult = { deletedIds: [], failures: [] };
  // Keep each existing server-side revision and session-history check intact.
  for (const assignment of assignments) {
    try {
      if (!Number.isSafeInteger(assignment.revision) || assignment.revision < 0) {
        throw new Error("Refresh the list before deleting this assignment.");
      }
      await remove(assignment.id, assignment.revision);
      result.deletedIds.push(assignment.id);
    } catch (error) {
      result.failures.push({ assignment, error });
    }
    onProgress(result.deletedIds.length + result.failures.length);
  }
  return result;
}
