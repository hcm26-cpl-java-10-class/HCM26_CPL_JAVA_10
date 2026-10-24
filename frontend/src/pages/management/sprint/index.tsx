import { sprintApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import BacklogPage from "@/pages/management/backlog";
import type { EntityConfig } from "@/types";
import { ADMIN_ROLE, normalizeRole } from "@/utils/rbac.utils";
import { SprintCard } from "./components/SprintCard";
import { sprintAdminEntityConfig } from "./sprint.admin.config";
import { sprintSchema } from "./sprint.schema";

/**
 * Sprint route (`/sprints`), rendered per role:
 * <ul>
 *   <li><b>Admin</b>: the generic CRUD data table cloned from the temporary
 *       task page (`/taskstemp`) - see {@link sprintAdminEntityConfig}.</li>
 *   <li><b>Student</b> (and every other persona): the Jira style backlog view
 *       shared with the `/backlogs` page - see
 *       `pages/management/backlog`.</li>
 * </ul>
 * The entity config below keeps the route registered in `buildEntityRoutes`
 * and documents the schema, permissions and browse-mode behaviour of the
 * Sprint entity.
 */
export default function SprintPage() {
  const { activeRole } = usePermissions();
  const isAdmin = normalizeRole(activeRole) === ADMIN_ROLE;

  if (isAdmin) {
    return <AutoCrudPage entity={sprintAdminEntityConfig} />;
  }

  return <BacklogPage />;
}

export const entityConfig: EntityConfig = {
  name: "Sprint",
  path: "/sprints",
  api: sprintApi,
  schema: sprintSchema,
  /**
   * Sprints are rendered as stacked full-width rows so status, start time and
   * end time stay readable for the student browse view.
   */
  cardRenderer: (props) => <SprintCard {...props} />,
  cardLayout: "list",
  /**
   * UFR-PRJ-003-01 is owned by the student persona: let students browse in the
   * read-only card layout, but keep full CRUD on the sprint they can see
   * (create via the inline form modal, plus edit / delete / active toggle).
   * Each action stays gated by the matching SPRINT_* permission.
   */
  browseModeCreate: true,
  browseModeActions: true,
};
