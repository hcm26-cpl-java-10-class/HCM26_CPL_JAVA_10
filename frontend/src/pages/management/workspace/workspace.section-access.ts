import type { WorkspaceSectionKey, WorkspaceSectionAccess } from "@/types/features/workspace";

const READ: Record<WorkspaceSectionKey, string> = {
  overview: "WORKSPACE_READ", members: "WORKSPACE_MEMBER_READ", milestones: "MILESTONE_READ",
  sprints: "SPRINT_READ", backlog: "SPRINT_READ", artifacts: "ARTIFACT_READ",
  feedback: "FEEDBACK_READ", activity: "WORKSPACE_ACTIVITY_READ"
};
export function sectionAccess(server: WorkspaceSectionAccess, hasPermission: (permission: string) => boolean): WorkspaceSectionAccess {
  const canRead = server.canRead && (hasPermission(READ[server.key]) || server.key === "overview" && hasPermission("VIEW_PROJECT_WORKSPACE"));
  const actions = Object.fromEntries(Object.entries(server.actions).map(([key, enabled]) => [
    key, canRead && enabled
  ]));
  return { ...server, canRead, actions };
}
