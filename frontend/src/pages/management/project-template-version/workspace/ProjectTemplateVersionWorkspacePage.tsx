import { projectTemplateVersionApi } from "@/api";
import Loading from "@/components/datatable/common/Loading";
import { ConfirmDeleteModal } from "@/components/datatable/modal/ConfirmDeleteModal";
import { FormModal } from "@/components/datatable/modal/form/FormModal";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { ProjectTemplateVersionDTO } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { projectTemplateVersionSchema } from "../project-template-version.schema";
import { CreateVersionDialog } from "./CreateVersionDialog";
import { OverviewTab } from "./OverviewTab";
import { ProjectTemplateVersionWorkspaceHeader } from "./ProjectTemplateVersionWorkspaceHeader";
import { VersionListPanel } from "./VersionListPanel";
import { versionLabel } from "./version.constants";

const VERSIONS_QUERY_KEY = ["project-template-versions", "workspace"] as const;

const EMPTY_CONTENT = `{
  "name": "",
  "description": "",
  "sections": []
}`;

/** Mirrors the error extraction used by the sprint workspace. */
const extractErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string" && error.trim()) return error;

  const response = (error as { response?: { data?: unknown } } | null)?.response;
  const data = response?.data;

  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const payload = data as { message?: unknown; detail?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
};

const TAB_ITEMS = [
  { value: "overview", label: "Overview" },
  { value: "versions", label: "Versions" },
] as const;

/**
 * `/project-template-versions` workspace, cloned from the `/sprints` page.
 * <p>
 * Project style header + version ribbon + the overview / versions tabs.
 * "Create New Version" (US-07) calls the dedicated
 * `POST /api/project-template-versions/{id}/new-version` endpoint, which
 * auto-increments the version, copies the configuration, stores the row as
 * `DRAFT` and links it to its parent. The remaining create / edit / delete
 * actions go through the regular snapshot CRUD API, which keeps the unique
 * (template, version) rule and the JSON validation.
 */
export default function ProjectTemplateVersionWorkspacePage() {
  const queryClient = useQueryClient();
  const { hasAllPermissions } = usePermissions();

  const canCreate = hasAllPermissions(["PROJECT_TEMPLATE_VERSION_CREATE"]);
  const canUpdate = hasAllPermissions(["PROJECT_TEMPLATE_VERSION_UPDATE"]);
  const canDelete = hasAllPermissions(["PROJECT_TEMPLATE_VERSION_DELETE"]);

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const versionsQuery = useQuery({
    queryKey: VERSIONS_QUERY_KEY,
    queryFn: () =>
      projectTemplateVersionApi.getPage({
        page: 0,
        size: 200,
        sort: ["templateId,asc", "createdAt,desc"],
      }),
  });

  const versions = useMemo<ProjectTemplateVersionDTO[]>(
    () => versionsQuery.data?.content ?? [],
    [versionsQuery.data],
  );

  /** Default to the newest active version. */
  useEffect(() => {
    if (versions.length === 0) return;
    if (
      selectedVersionId &&
      versions.some((item) => item.id === selectedVersionId)
    ) {
      return;
    }

    const preferred =
      versions.find((item) => item.isActive) ?? versions[versions.length - 1];

    setSelectedVersionId(preferred?.id ?? null);
  }, [selectedVersionId, versions]);

  const selectedVersion =
    versions.find((item) => item.id === selectedVersionId) ?? null;

  const templatesCovered = useMemo(
    () =>
      new Set(
        versions
          .map((item) => item.templateId)
          .filter((id): id is number => id != null),
      ).size,
    [versions],
  );

  const templateLabel =
    selectedVersion?.templateId != null
      ? `TPL-${selectedVersion.templateId}`
      : "TEMPLATE VERSIONS";

  const refreshVersions = async () => {
    await queryClient.invalidateQueries({ queryKey: VERSIONS_QUERY_KEY });
  };

  /**
   * US-07: derive the next version from the selected one. The backend owns the
   * version number, the copied configuration, the DRAFT status and the
   * `parentTemplateId` link; the source snapshot is never modified.
   */
  const handleCreateNewVersion = async () => {
    if (!selectedVersion?.id || submitting) return;

    setSubmitting(true);

    try {
      const created = await projectTemplateVersionApi.createNewVersion(
        selectedVersion.id,
      );
      setNewVersionOpen(false);
      await refreshVersions();

      if (created?.id != null) {
        setSelectedVersionId(created.id);
        setActiveTab("versions");
      }

      toast.success(
        `Đã tạo phiên bản ${created?.version ?? "mới"} ở trạng thái DRAFT.`,
      );
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Không thể tạo phiên bản mới."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVersion = async (values: Record<string, unknown>) => {
    if (submitting) return;

    setSubmitting(true);

    try {
      const created = await projectTemplateVersionApi.create(
        values as ProjectTemplateVersionDTO,
      );
      setCreateOpen(false);
      await refreshVersions();

      if (created?.id != null) {
        setSelectedVersionId(created.id);
        setActiveTab("versions");
      }

      toast.success("Đã tạo phiên bản Project Template mới.");
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Không thể tạo phiên bản Project Template."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateVersion = async (values: Record<string, unknown>) => {
    if (!selectedVersion?.id || submitting) return;

    setSubmitting(true);

    try {
      await projectTemplateVersionApi.update(String(selectedVersion.id), {
        ...selectedVersion,
        ...values,
      } as ProjectTemplateVersionDTO);
      setEditOpen(false);
      await refreshVersions();

      toast.success("Đã cập nhật phiên bản.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể cập nhật phiên bản."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!selectedVersion?.id) return;

    setSubmitting(true);

    try {
      await projectTemplateVersionApi.delete(String(selectedVersion.id));
      setDeleteOpen(false);
      setSelectedVersionId(null);
      await refreshVersions();

      toast.success("Đã xóa phiên bản.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể xóa phiên bản."));
    } finally {
      setSubmitting(false);
    }
  };

  const createInitial = {
    templateId: selectedVersion?.templateId,
    projectId: selectedVersion?.projectId,
    version: "",
    status: "DRAFT",
    contentJson: EMPTY_CONTENT,
    isActive: true,
  };

  const tabCounts: Record<string, number> = {
    versions: versions.length,
  };

  return (
    <MainLayout pathName={{ "project-template-versions": "Project Template Versions" }}>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <ProjectTemplateVersionWorkspaceHeader
          version={selectedVersion}
          versions={versions}
          onSelectVersion={setSelectedVersionId}
          templateLabel={templateLabel}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          submitting={submitting}
          onNewVersion={() => setNewVersionOpen(true)}
          onEditVersion={() => setEditOpen(true)}
          onDeleteVersion={() => setDeleteOpen(true)}
          tabs={
            <TabsList
              variant="line"
              className="h-auto! w-full flex-wrap justify-start gap-x-1 border-b pb-1"
            >
              {TAB_ITEMS.map((tab) => {
                const count = tabCounts[tab.value];

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-none px-2 pb-2 text-[11px] font-medium data-[state=active]:text-primary"
                  >
                    {tab.label}
                    {count !== undefined && (
                      <span
                        className={cn(
                          "ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground",
                          activeTab === tab.value &&
                            "bg-primary/10 text-primary",
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          }
        />

        {versionsQuery.isLoading ? (
          <Loading />
        ) : versionsQuery.isError ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Unable to load the version list</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {extractErrorMessage(
                  versionsQuery.error,
                  "The version service did not answer. Please try again.",
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => void versionsQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-20 text-center">
            <span className="rounded-full bg-muted p-3 text-muted-foreground">
              <Layers className="h-5 w-5" />
            </span>
            <h2 className="mt-1 text-sm font-semibold">
              No project template version has been created yet
            </h2>
            <p className="max-w-md text-xs text-muted-foreground">
              Create the first version to snapshot a project template and keep
              every revision traceable.
            </p>
            {canCreate && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create First Version
              </Button>
            )}
          </div>
        ) : (
          <>
            <TabsContent value="overview" className="mt-0">
              <OverviewTab
                versions={versions}
                selectedVersionId={selectedVersionId ?? undefined}
                onSelectVersion={(id) => {
                  setSelectedVersionId(id);
                  setActiveTab("versions");
                }}
                onOpenVersions={() => setActiveTab("versions")}
              />
            </TabsContent>

            <TabsContent value="versions" className="mt-0">
              <VersionListPanel
                title={`All versions (${templatesCovered} template${templatesCovered === 1 ? "" : "s"})`}
                versions={versions}
                selectedId={selectedVersionId ?? undefined}
                onSelect={setSelectedVersionId}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <CreateVersionDialog
        open={newVersionOpen}
        onOpenChange={setNewVersionOpen}
        source={selectedVersion}
        versions={versions}
        loading={submitting}
        onConfirm={handleCreateNewVersion}
      />

      <FormModal
        open={createOpen}
        onClose={setCreateOpen}
        schema={projectTemplateVersionSchema}
        title="Create Project Template Version"
        initial={createInitial}
        onSubmit={handleCreateVersion}
        isSubmitting={submitting}
      />

      <FormModal
        open={editOpen}
        onClose={setEditOpen}
        schema={projectTemplateVersionSchema}
        title="Edit Project Template Version"
        initial={selectedVersion ? { ...selectedVersion } : null}
        onSubmit={handleUpdateVersion}
        isSubmitting={submitting}
      />

      <ConfirmDeleteModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteVersion}
        loading={submitting}
        title="Delete project template version"
        description={
          selectedVersion
            ? `"${versionLabel(selectedVersion)}" will be removed. This cannot be undone.`
            : undefined
        }
      />
    </MainLayout>
  );
}
