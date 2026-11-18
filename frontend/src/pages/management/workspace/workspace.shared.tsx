import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isAxiosError } from "axios";
import { Activity, Bell, BookOpen, CalendarDays, FolderOpen, LayoutDashboard, ListTodo, PanelsTopLeft, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceCandidateItem } from "@/types/features/workspace";

export const WORKSPACE_SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, description: "Project information and goals" },
  { id: "resources", label: "Resources", icon: BookOpen, description: "Documents, repositories and links shared with the team" },
  { id: "members", label: "Members", icon: Users, description: "Team members and working rules" },
  { id: "milestones", label: "Milestone", icon: CalendarDays, description: "Delivery milestones and assessment criteria" },
  { id: "sprints", label: "Kanban Board", icon: PanelsTopLeft, description: "Sprint plans and team task board" },
  { id: "backlog", label: "Backlog", icon: ListTodo, description: "The team's work items" },
  { id: "artifacts", label: "Artifact", icon: FolderOpen, description: "Documents and deliverables" },
  { id: "feedback", label: "Alerts", icon: Bell, description: "Task and milestone alerts sent to this team" },
  { id: "activity", label: "Risks, Decisions & Logs", icon: Activity, description: "Decision logs, risks, meeting notes and audit history" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planning", ACTIVE: "Active", COMPLETED: "Completed",
  CANCELLED: "Cancelled", DRAFT: "Draft", ARCHIVED: "Archived", CLOSED: "Closed",
};

export function WorkspaceStatusBadge({ status, colored = false }: { status?: string; colored?: boolean }) {
  const color = status === "COMPLETED" || status === "ACTIVE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
    : status === "CANCELLED" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
    : status === "PLANNING" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
    : "border-border bg-muted text-muted-foreground";
  return <Badge variant={status === "CANCELLED" ? "destructive" : "secondary"} className={cn(colored && "gap-1.5 rounded-full border px-2.5 py-0.5", colored && color)}>{colored && <span className="size-1.5 shrink-0 rounded-full bg-current" />}{status ? STATUS_LABELS[status] ?? status : "Not created"}</Badge>;
}

export function WorkspaceEmptyState({ icon: Icon, title, description, action, compact = false }: {
  icon: LucideIcon; title: string; description: string; action?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={compact ? "flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-muted/20 p-4" : "flex flex-col items-center justify-center gap-3 px-5 py-12 text-center"}>
      <div className={`flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ${compact ? "size-10" : "size-12 rounded-full"}`}><Icon className="size-5" /></div>
      <div className={compact ? "min-w-0 flex-1 basis-40 space-y-1" : "space-y-1"}><p className="text-sm font-medium">{title}</p><p className={compact ? "text-xs leading-5 text-muted-foreground" : "mx-auto max-w-md text-sm leading-6 text-muted-foreground"}>{description}</p></div>
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
