import type { WorkspaceSectionKey, WorkspaceSectionAccess } from "@/types/features/workspace";

const READ: Record<WorkspaceSectionKey, string> = {
  overview: "WORKSPACE_READ", members: "WORKSPACE_MEMBER_READ", milestones: "MILESTONE_READ",
  sprints: "SPRINT_READ", backlog: "SPRINT_READ", artifacts: "ARTIFACT_READ",
  feedback: "FEEDBACK_READ", activity: "WORKSPACE_ACTIVITY_READ"
};
const WRITE: Partial<Record<WorkspaceSectionKey, Record<string, string[]>>> = {
  members: { manage: ["TEAM_UPDATE"] },
  milestones: { create: ["MILESTONE_WRITE"], review: ["MILESTONE_WRITE"] },
  sprints: { create: ["SPRINT_WRITE"], createTask: ["SPRINT_WRITE", "TASK_WRITE"], review: ["MILESTONE_WRITE"] },
  backlog: { createTask: ["SPRINT_WRITE", "TASK_WRITE"] },
  artifacts: { create: ["ARTIFACT_WRITE"], submit: ["ARTIFACT_SUBMIT"], review: ["ARTIFACT_REVIEW", "FEEDBACK_WRITE"] },
  feedback: { create: ["FEEDBACK_WRITE"] }
};
export function sectionAccess(server: WorkspaceSectionAccess, hasPermission: (permission: string) => boolean): WorkspaceSectionAccess {
  const canRead = server.canRead && (hasPermission(READ[server.key]) || server.key === "overview" && hasPermission("VIEW_PROJECT_WORKSPACE"));
  const actions = Object.fromEntries(Object.entries(server.actions).map(([key, enabled]) => [
    key, canRead && enabled && (WRITE[server.key]?.[key] ?? []).some(hasPermission)
  ]));
  return { ...server, canRead, actions };
}
