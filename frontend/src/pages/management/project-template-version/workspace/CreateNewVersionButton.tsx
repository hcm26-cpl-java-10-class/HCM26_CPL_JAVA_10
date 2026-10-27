import { projectTemplateVersionApi } from "@/api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { PermissionGate } from "@/components/PermissionGate";
import type { ProjectTemplateVersionDTO } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CreateVersionDialog } from "./CreateVersionDialog";

interface CreateNewVersionButtonProps {
  /** Version the new one is derived from (usually the table row). */
  version: ProjectTemplateVersionDTO | null;
  /** Icon size of the trigger button (row actions use 10). */
  iconSize?: number;
}

/** Mirrors the error extraction used by the workspace page. */
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

/**
 * Self-contained "Create New Version" action (US-07 / AC01) usable from any
 * data table — in particular the admin (Program Manager) table, which does not
 * render the version workspace.
 * <p>
 * Renders an icon button plus the {@link CreateVersionDialog}: the dialog
 * previews the auto-incremented label (`v1.0 -> v2.0`), then
 * `POST /api/project-template-versions/{id}/new-version` copies the
 * configuration, stores the row as `DRAFT` and links `parentTemplateId` back to
 * the source version. The source snapshot is never modified, so workspaces
 * already created from it keep their own data (AC02).
 */
export function CreateNewVersionButton({
  version,
  iconSize = 10,
}: CreateNewVersionButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const templateId = version?.templateId ?? null;

  /**
   * Every version of the same template, used to preview the next label. It is
   * only fetched while the dialog is open, so the table does not pay for it.
   */
  const versionsQuery = useQuery({
    queryKey: ["project-template-versions", "by-template", templateId],
    queryFn: () =>
      projectTemplateVersionApi.getByTemplate(templateId as number),
    enabled: open && templateId != null,
  });

  const siblings = versionsQuery.data ?? [];
  // Best guess while the request is in flight: the row itself.
  const knownVersions =
    siblings.length > 0 ? siblings : version ? [version] : [];

  const handleConfirm = async () => {
    if (!version?.id || loading) return;

    setLoading(true);

    try {
      const created = await projectTemplateVersionApi.createNewVersion(
        version.id,
      );
      setOpen(false);

      // Refresh both the admin table (`project_template_version`) and the
      // workspace catalogue (`project-template-versions`).
      await queryClient.invalidateQueries({
        queryKey: ["project_template_version"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["project-template-versions"],
      });

      toast.success(
        `Đã tạo phiên bản ${created?.version ?? "mới"} ở trạng thái DRAFT.`,
      );
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Không thể tạo phiên bản mới."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PermissionGate permission="PROJECT_TEMPLATE_VERSION_CREATE">
      <ActionButton
        onClick={() => setOpen(true)}
        tooltip="Create new version"
        disabled={!version?.id || loading}
        icon={
          loading ? (
            <Loader2 size={iconSize} className="animate-spin text-gray-500" />
          ) : (
            <CopyPlus size={iconSize} className="text-gray-500" />
          )
        }
      />
      <CreateVersionDialog
        open={open}
        onOpenChange={setOpen}
        source={version}
        versions={knownVersions}
        loading={loading || versionsQuery.isFetching}
        onConfirm={handleConfirm}
      />
    </PermissionGate>
  );
}
