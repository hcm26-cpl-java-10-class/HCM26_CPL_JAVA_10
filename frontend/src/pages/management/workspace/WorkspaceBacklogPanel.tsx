import { BacklogBoard } from "@/pages/management/backlog";

interface WorkspaceBacklogPanelProps {
  /** Project of the workspace, so the board only lists its own sprints. */
  projectId?: number | null;
  /**
   * Team of the workspace. It scopes the board to the sprints and work items of
   * that team instead of every record of the tenant.
   */
  teamId?: number | null;
  taskKeyPrefix?: string | null;
}

/**
 * Backlog tab of a workspace (`/management/workspaces/:id?tab=backlog`).
 * <p>
 * It clones the `/backlogs` board: a collapsible box per sprint plus the
 * product backlog box, inline `+ Create` rows, drag and drop between boxes,
 * status changes and the item detail sheet. The board is rendered in
 * `embedded` mode because the workspace page already provides the layout and
 * the section padding, and it is scoped to the workspace team so every team
 * workspace shows only its own sprints and work items.
 */
export function WorkspaceBacklogPanel({
  projectId = null,
  teamId = null,
  taskKeyPrefix = null,
}: WorkspaceBacklogPanelProps) {
  return <BacklogBoard embedded projectId={projectId} teamId={teamId} taskKeyPrefix={taskKeyPrefix} />;
}
