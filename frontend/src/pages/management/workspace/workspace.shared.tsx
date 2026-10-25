import { Badge } from "@/components/ui/badge";
import { isAxiosError } from "axios";
import { Activity, CalendarDays, FolderOpen, LayoutDashboard, ListTodo, MessageSquare, PanelsTopLeft, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceCandidateItem } from "@/types/features/workspace";

export const WORKSPACE_SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, description: "Project information and goals" },
  { id: "members", label: "Members", icon: Users, description: "Team members and working rules" },
  { id: "milestones", label: "Milestone", icon: CalendarDays, description: "Delivery milestones and assessment criteria" },
  { id: "sprints", label: "Sprint", icon: PanelsTopLeft, description: "Sprint plans and task board" },
  { id: "backlog", label: "Backlog", icon: ListTodo, description: "The team's work items" },
  { id: "artifacts", label: "Artifact", icon: FolderOpen, description: "Documents and deliverables" },
  { id: "feedback", label: "Feedback", icon: MessageSquare, description: "Project reviews and feedback" },
  { id: "activity", label: "Activity", icon: Activity, description: "Activity, risks and decisions" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planning", ACTIVE: "Active", COMPLETED: "Completed",
  CANCELLED: "Cancelled", DRAFT: "Draft", ARCHIVED: "Archived", CLOSED: "Closed",
};

export function WorkspaceStatusBadge({ status }: { status?: string }) {
  return <Badge variant={status === "CANCELLED" ? "destructive" : "secondary"}>{status ? STATUS_LABELS[status] ?? status : "Not created"}</Badge>;
}

export function WorkspaceEmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon; title: string; description: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon className="size-5" /></div>
      <div className="space-y-1"><p className="text-sm font-medium">{title}</p><p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div>
      {action}
    </div>
  );
}

export function getWorkspaceError(error: unknown): string {
  if (isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) {
    const fields = error.response?.data?.errors;
    const message = fields ? Object.values(fields).flat().join(" ") : error.response?.data?.message;
    if (message && !/[\u00c0-\u024f\u1e00-\u1eff]/.test(message)) return message;
    if (message?.includes("Project/team đã có workspace")) return "This project/team already has a workspace.";
    if (message?.includes("Idempotency key")) return "This request key was already used with different details.";
    const status = error.response?.status;
    if (status === 401) return "Your session has expired. Sign in again.";
    if (status === 403) return "You do not have permission to access this project/team or perform this action.";
    if (status === 404) return "The requested project, team or workspace was not found.";
    if (status === 409) return "The record has changed or this action is no longer available. Reload the latest details.";
    if (status === 422) return "Check all required fields, the selected team/project and rubric weights (100% in total), then try again.";
    if (!error.response) return "Unable to reach the server. Check your connection and try again.";
  }
  return "Unable to load or save the workspace. Please try again.";
}

export function workspaceIneligibleReason(row: WorkspaceCandidateItem) {
  if (row.workspaceId) return "This project/team already has a workspace.";
  if ((row.memberCount ?? 0) === 0) return "Add at least one active member before creating a workspace.";
  return "The project must be Planning or Active, and the team must be active.";
}

export function formatWorkspaceDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-GB");
}
