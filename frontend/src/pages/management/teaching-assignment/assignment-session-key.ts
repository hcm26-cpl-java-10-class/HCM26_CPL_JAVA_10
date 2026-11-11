import type { AssignmentSession } from "@/api/features/class-setup.api";

export function assignmentSessionKey(session: Pick<AssignmentSession, "source" | "id">): string {
  return `${session.source}:${session.id}`;
}
