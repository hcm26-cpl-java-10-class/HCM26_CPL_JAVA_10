import { projectTemplateApi } from "@/api/features/project-template.api";
import { TemplateDeleteDialog } from "./components/TemplateDeleteDialog";
import { TemplateActivationDialog } from "./components/TemplateActivationDialog";
import { TemplateArchiveDialog } from "./components/TemplateArchiveDialog";
import ActionButton from "@/components/datatable/common/ActionButton";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { ProTable } from "@/components/datatable/ProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectTemplateFilter, ProjectTemplateListItem } from "@/types/features/project-template";
import type { Pagination } from "@/types";
import { Eye, Files, FolderTree, Pen, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
  const [showModules, setShowModules] = useState(false);
  const listApi = useMemo(() => ({
    ...projectTemplateApi,
    getPage: async (pagination: Pagination, search?: string, filter?: ProjectTemplateFilter) => {
      const filters = { ...filter, includeModules: showModules };
      if (canReadVersions) return projectTemplateApi.getVersionPage(pagination, search, filters);
      const page = await projectTemplateApi.getPage(pagination, search, filters);
      const content = (page.content ?? page.items ?? []).map(template => ({ ...template, rowId: `template-${template.id}`,
        versionId: null, versionLabel: `v${template.templateVersion}.0`, latestVersion: true, templateStatus: template.status }));
      return { ...page, content, items: content };
    },
  }), [canReadVersions, showModules]);
  const schema = useMemo(() => ({
    ...projectTemplateSchema,
    idField: "rowId",
    fields: projectTemplateSchema.fields.map((field) => {
      if (field.name === "category") return { ...field,
        filterOptions: (options.data?.categories ?? []).map((value) => ({ value, label: value })) };
      if (field.name === "level") return { ...field, filterOptions: options.data?.levels ?? [] };
      return field;
    }),
  }), [options.data?.categories, options.data?.levels]);
  const table = useProTable(listApi, schema, {
    queryKeyRoot: "project-templates",
    queryKeyParts: [options.user.email, options.activeRole, "list", canReadVersions ? "versions" : "templates", showModules],
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
  const view = (template: ProjectTemplateListItem) => navigate(`/project-templates/${template.id}/detail`);
  const edit = (template: ProjectTemplateListItem) => navigate(template.versionId == null ? `/project-templates/${template.id}/edit` : `${versionPath(template)}&edit=overview`);

  return (
    <MainLayout pathName={{ "project-templates": "Project Templates" }}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
        <h1 className="sr-only">Project Templates</h1>
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
              renderCard={(props) => <ProjectTemplateCard {...props} levels={options.data?.levels} />}
              renderCell={(template, field) => {
                if (field.name === "status") return <ProjectTemplateStatusBadge status={template.status} />;
                if (field.name === "level") return templateLevelLabel(template.level, options.data?.levels);
                if (field.name === "estimatedDurationWeeks") return template.estimatedDurationWeeks == null ? "—" : `${template.estimatedDurationWeeks} weeks`;
                if (field.name === "code") return <span className="font-mono text-xs">{template.code}</span>;
                if (field.name === "templateVersion") return <span className="font-medium">{template.versionLabel}</span>;
                if (field.name === "name") return (
                  <div className={`flex min-w-0 items-center gap-2 ${template.parentTemplateId != null ? "border-l-2 pl-3" : ""}`}>
                    {template.parentTemplateId != null && <Badge variant="outline" className="shrink-0 border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Module</Badge>}
                    <button className="min-w-0 truncate text-left font-medium hover:text-primary hover:underline" onClick={() => view(template)}>
                      {template.name}
                    </button>
                  </div>
                );
                return undefined;
              }}
              headerActions={(
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" aria-pressed={showModules}
                    className="aria-pressed:border-indigo-200 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700 dark:aria-pressed:border-indigo-800 dark:aria-pressed:bg-indigo-950 dark:aria-pressed:text-indigo-300" onClick={() => {
                    table.setPage(0); setShowModules(value => !value);
                  }}><FolderTree className="size-4" />{showModules ? "Hide modules" : "Show modules"}</Button>
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
