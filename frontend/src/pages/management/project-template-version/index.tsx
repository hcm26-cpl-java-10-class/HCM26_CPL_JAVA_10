import { projectTemplateVersionApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import type { EntityConfig } from "@/types";
import { ADMIN_ROLE, normalizeRole } from "@/utils/rbac.utils";
import { ProjectTemplateVersionCard } from "./components/ProjectTemplateVersionCard";
import { projectTemplateVersionAdminEntityConfig } from "./project-template-version.admin.config";
import { projectTemplateVersionSchema } from "./project-template-version.schema";
import ProjectTemplateVersionWorkspacePage from "./workspace/ProjectTemplateVersionWorkspacePage";

/**
 * Project template version route (`/project-template-versions`), rendered per
 * role and cloned from the sprint page (`/sprints`):
 * <ul>
 *   <li><b>Admin</b>: the generic CRUD data table driven by
 *       {@link projectTemplateVersionAdminEntityConfig}.</li>
 *   <li><b>Student</b> (and every other persona): the template version
 *       workspace built by {@link ProjectTemplateVersionWorkspacePage}, with
 *       the version ribbon, the overview KPIs and the version catalogue.</li>
 * </ul>
 * The entity config below keeps the route registered in `buildEntityRoutes`
 * and documents the schema, permissions and browse-mode behaviour of the
 * Project Template Version entity.
 */
export default function ProjectTemplateVersionPage() {
  const { activeRole } = usePermissions();
  const isAdmin = normalizeRole(activeRole) === ADMIN_ROLE;

  if (isAdmin) {
    return <AutoCrudPage entity={projectTemplateVersionAdminEntityConfig} />;
  }

  return <ProjectTemplateVersionWorkspacePage />;
}

export const entityConfig: EntityConfig = {
  name: "ProjectTemplateVersion",
  path: "/project-template-versions",
  api: projectTemplateVersionApi,
  schema: projectTemplateVersionSchema,
  /**
   * Versions are rendered as stacked full-width rows so the version label,
   * template / project ids and creation time stay readable.
   */
  cardRenderer: (props) => <ProjectTemplateVersionCard {...props} />,
  cardLayout: "list",
  /**
   * Students browse in the read-only card layout but keep full CRUD on the
   * versions they can see, gated by the matching
   * PROJECT_TEMPLATE_VERSION_* permissions.
   */
  browseModeCreate: true,
  browseModeActions: true,
};
