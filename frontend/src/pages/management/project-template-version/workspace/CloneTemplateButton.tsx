import { projectTemplateVersionApi } from "@/api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { PermissionGate } from "@/components/PermissionGate";
import type { ProjectTemplateVersionDTO } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { DuplicateTemplateDialog } from "./DuplicateTemplateDialog";

interface CloneTemplateButtonProps {
  /** Version whose template is cloned into a new, independent template. */
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
 * Self-contained "Clone template" action (US-08) usable from any data table.
 * <p>
 * Renders a small icon button plus the {@link DuplicateTemplateDialog}: the
 * dialog collects the new template name, then
 * `POST /api/project-template-versions/{id}/duplicate` creates a brand new
 * template stored as `v1.0` / `DRAFT` with no `parentTemplateId` link. The
 * source template and its versions are never modified.
 */
export function CloneTemplateButton({
  version,
  iconSize = 10,
}: CloneTemplateButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);

  const handleConfirm = async (payload: { name: string }) => {
    if (!version?.id || pending.current) return;
    pending.current = true;

    setLoading(true);

    try {
      const created = await projectTemplateVersionApi.duplicateTemplate(
        version.id,
        payload,
      );
      setOpen(false);

      await queryClient.invalidateQueries({
        queryKey: ["project_template_version"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["project-template-versions"],
      });
      await queryClient.invalidateQueries({ queryKey: ["project-templates"] });

      toast.success(
        `Template "${payload.name}" duplicated as a draft (${created?.version ?? "v1.0"}).`,
      );
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Unable to duplicate the project template."),
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <PermissionGate permission="PROJECT_TEMPLATE_VERSION_CREATE">
      <ActionButton
        onClick={() => setOpen(true)}
        tooltip="Clone template"
        disabled={!version?.id || loading}
        icon={
          loading ? (
            <Loader2 size={iconSize} className="animate-spin text-gray-500" />
          ) : (
            <Copy size={iconSize} className="text-gray-500" />
          )
        }
      />
      <DuplicateTemplateDialog
        open={open}
        onOpenChange={value => { if (!pending.current) setOpen(value); }}
        source={version}
        loading={loading}
        onConfirm={handleConfirm}
      />
    </PermissionGate>
  );
}
