import { ResourceFormDialog } from "@/components/resources/ResourceFormDialog";
import type {
  TemplateResource,
  TemplateResourceCollection,
  TemplateResourcePayload,
} from "@/types/features/project-template-resource";

interface TemplateResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: TemplateResource | null;
  collection: TemplateResourceCollection;
  saving: boolean;
  error?: string | null;
  onSubmit: (payload: TemplateResourcePayload, file: File | null) => Promise<void>;
}

/**
 * US-RES-001 / AC01 + AC03 — add or edit a template resource.
 * The form itself lives in the shared `ResourceFormDialog` so the template and
 * workspace resource screens always use the same modal.
 */
export function TemplateResourceDialog({
  open,
  onOpenChange,
  resource,
  collection,
  saving,
  error,
  onSubmit,
}: TemplateResourceDialogProps) {
  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      idPrefix="resource"
      modalTitle={resource ? "Edit template resource" : "Add template resource"}
      modalDescription="Resources are attached to this template version. Existing projects keep the resources they were assigned with."
      submitLabel={resource ? "Save changes" : "Add resource"}
      saving={saving}
      error={error}
      resource={resource}
      collection={collection}
      onSubmit={onSubmit}
    />
  );
}
