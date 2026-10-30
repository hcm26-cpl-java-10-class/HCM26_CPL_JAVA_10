import { projectTemplateApi } from "@/api/features/project-template.api";
import { TemplateDeleteDialog } from "./components/TemplateDeleteDialog";
import { TemplateActivationDialog } from "./components/TemplateActivationDialog";
import { TemplateArchiveDialog } from "./components/TemplateArchiveDialog";
import ActionButton from "@/components/datatable/common/ActionButton";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { ProTable } from "@/components/datatable/ProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import type { ProjectTemplateFilter, ProjectTemplateListItem } from "@/types/features/project-template";
import type { Pagination } from "@/types";
import { Eye, Files, Pen, Plus, RefreshCw, Rocket, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ProjectTemplateCard } from "./components/ProjectTemplateCard";
import { ProjectTemplateError, ProjectTemplateLoading } from "./components/ProjectTemplateState";
import { ProjectTemplateStatusBadge } from "./components/ProjectTemplateStatusBadge";
import { useProjectTemplateOptions } from "./hooks/useProjectTemplateOptions";
import { projectTemplateSchema } from "./project-template.schema";
import { templateLevelLabel } from "./project-template.utils";

export default function ProjectTemplateListPage() {
  const navigate = useNavigate();
  const options = useProjectTemplateOptions();
  const canReadVersions = options.hasPermission("PROJECT_TEMPLATE_VERSION_READ");
  const listApi = useMemo(() => ({
    ...projectTemplateApi,
    getPage: async (pagination: Pagination, search?: string, filter?: ProjectTemplateFilter) => {
      if (canReadVersions) return projectTemplateApi.getVersionPage(pagination, search, filter);
      const page = await projectTemplateApi.getPage(pagination, search, filter);
      const content = (page.content ?? page.items ?? []).map(template => ({ ...template, rowId: `template-${template.id}`,
        versionId: null, versionLabel: `v${template.templateVersion}.0`, latestVersion: true, templateStatus: template.status }));
      return { ...page, content, items: content };
    },
  }), [canReadVersions]);
  const schema = useMemo(() => ({
    ...projectTemplateSchema,
    idField: "rowId",
    fields: projectTemplateSchema.fields.map((field) => field.name === "category" ? {
      ...field,
      filterable: true,
      filterType: "select" as const,
      filterMultiple: false,
      filterOptions: (options.data?.categories ?? []).map((value) => ({ value, label: value })),
    } : field),
  }), [options.data?.categories]);
  const table = useProTable(listApi, schema, {
    queryKeyRoot: "project-templates",
    queryKeyParts: [options.user.email, options.activeRole, "list", canReadVersions ? "versions" : "templates"],
    enabled: options.isSuccess,
    searchDebounceMs: 300,
    retry: false,
    permissionOverrides: {
      canRead: options.canRead && options.isSuccess,
      canCreate: options.data?.canCreate === true && options.hasPermission("PROJECT_TEMPLATE_CREATE"),
      canUpdate: options.data?.canUpdate === true && options.hasPermission("PROJECT_TEMPLATE_UPDATE"),
      canDelete: false,
      canImport: false,
      canExport: false,
    },
  });
  const versionPath = (template: ProjectTemplateListItem) => `/project-templates/${template.id}/detail?tab=versions&version=${template.versionId}`;
  const view = (template: ProjectTemplateListItem) => navigate(template.versionId == null ? `/project-templates/${template.id}/detail` : versionPath(template));
  const edit = (template: ProjectTemplateListItem) => navigate(template.versionId == null ? `/project-templates/${template.id}/edit` : `${versionPath(template)}&edit=overview`);

  return (
    <MainLayout pathName={{ "project-templates": "Project Templates" }}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="text-2xl font-semibold">Project Templates</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage project template versions. Each new version starts as an editable draft.</p>
          </div>
          {options.data && <Badge variant="outline">{options.data.tenantName}</Badge>}
        </header>
        {!options.canRead ? <ProjectTemplateError denied />
          : options.isLoading ? <ProjectTemplateLoading />
          : options.isError ? <ProjectTemplateError error={options.error} onRetry={() => void options.refetch()} />
          : (
            <ProTable<ProjectTemplateListItem>
              table={table}
              autoPageSize={false}
              compactToolbar
              responsiveCards
              selectable={false}
              actionsColumnWidth={190}
              onView={view}
              onEdit={edit}
              onRowClick={view}
              renderFormModal={() => null}
              renderCard={(props) => <ProjectTemplateCard {...props} />}
              renderCell={(template, field) => {
                if (field.name === "status") return <ProjectTemplateStatusBadge status={template.status} />;
                if (field.name === "level") return templateLevelLabel(template.level);
                if (field.name === "estimatedDurationWeeks") return template.estimatedDurationWeeks == null ? "—" : `${template.estimatedDurationWeeks} weeks`;
                if (field.name === "code") return <span className="font-mono text-xs">{template.code}</span>;
                if (field.name === "templateVersion") return (
                  <button className="font-medium underline-offset-4 hover:text-primary hover:underline"
                    aria-label={`View version history for ${template.code}`}
                    onClick={() => view(template)}>
                    {template.versionLabel}
                  </button>
                );
                if (field.name === "name") return (
                  <button className="block w-full truncate text-left font-medium hover:text-primary hover:underline" onClick={() => view(template)}>
                    {template.name}
                  </button>
                );
                return undefined;
              }}
              headerActions={(
                <div className="flex items-center gap-2">
                  <ActionButton tooltip="Refresh templates" disabled={table.isFetching} onClick={() => void table.refetch()}
                    icon={<RefreshCw className={`size-4 ${table.isFetching ? "animate-spin" : ""}`} />} />
                  {table.permission.canCreate && <ActionButton title="Create" tooltip="Create project template" variant="default"
                    onClick={() => navigate("/project-templates/create")} icon={<Plus className="size-4" />} />}
                </div>
              )}
              renderRowActions={(template) => (
                <>
                  <ActionButton tooltip={`View template ${template.code} ${template.versionLabel}`} onClick={() => view(template)} icon={<Eye className="size-4 text-muted-foreground" />} />
                  {template.editable && table.permission.canUpdate && (template.versionId == null || options.hasPermission("PROJECT_TEMPLATE_VERSION_UPDATE")) && <ActionButton tooltip={`Edit draft ${template.code} ${template.versionLabel}`}
                    onClick={() => edit(template)} icon={<Pen className="size-4 text-muted-foreground" />} />}
                  {template.versionId != null && template.editable && options.data?.canActivate && options.hasPermission("PROJECT_TEMPLATE_ACTIVATE")
                    && options.hasPermission("PROJECT_TEMPLATE_VERSION_UPDATE") && <ActionButton tooltip={`Publish draft ${template.versionLabel}`}
                      onClick={() => view(template)} icon={<Rocket className="size-4 text-muted-foreground" />} />}
                  {template.versionId == null && !template.readOnly && template.status === "DRAFT" && options.data?.canActivate && options.hasPermission("PROJECT_TEMPLATE_ACTIVATE") &&
                    <TemplateActivationDialog compact template={template} onActivated={() => void table.refetch()}
                      onOpenSection={section => navigate(`/project-templates/${template.id}/detail?tab=${section}`)} />}
                  {!template.readOnly && template.latestVersion && template.status === "ACTIVE" && options.data?.canArchive && options.hasPermission("PROJECT_TEMPLATE_ARCHIVE") &&
                    <TemplateArchiveDialog compact template={template} onArchived={() => void table.refetch()} />}
                  {template.versionId != null && template.editable && (template.templateStatus !== "DRAFT" || template.templateVersion > 1)
                    && options.hasPermission("PROJECT_TEMPLATE_VERSION_DELETE") &&
                    <ActionButton tooltip={`Delete draft version ${template.versionLabel}`} onClick={() => navigate(`${versionPath(template)}&action=delete`)}
                      icon={<Trash2 className="size-4 text-destructive" />} />}
                  {!template.readOnly && template.status === "DRAFT" && template.templateStatus === "DRAFT" && template.latestVersion
                    && (template.versionId == null || template.templateVersion === 1)
                    && options.data?.canArchive && options.hasPermission("PROJECT_TEMPLATE_ARCHIVE") &&
                    <TemplateDeleteDialog template={template} />}
                </>
              )}
              renderError={<ProjectTemplateError error={table.error} onRetry={() => void table.refetch()} />}
              renderEmpty={(
                <div className="grid justify-items-center gap-2 py-16 text-center">
                  <Files className="mb-1 size-9 text-muted-foreground" />
                  <p className="font-medium">No project templates found</p>
                  <p className="text-sm text-muted-foreground">{table.permission.canCreate
                    ? "Create a template or adjust your search and filters."
                    : "Try adjusting your search and filters."}</p>
                </div>
              )}
              showPagination={!table.error && !table.loading && table.total > 0}
            />
          )}
      </section>
    </MainLayout>
  );
}
