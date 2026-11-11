import { useState } from "react";
import { History } from "lucide-react";
import { EntityHistoryDialog } from "@/components/audit/EntityHistoryDialog";

interface EntityHistoryButtonProps {
  /** Audit entity type, i.e. the resource name of the entity (BOOK, COURSE, EXAM...) */
  entityType: string;
  entityId: string | number | null | undefined;
  label?: string;
  className?: string;
}

/**
 * Drop-in "History" button for any page (detail pages, custom screens):
 *   <EntityHistoryButton entityType="BOOK" entityId={book.id} />
 * Tables built with ProTable already get it automatically (ADMIN only).
 */
export function EntityHistoryButton({
  entityType,
  entityId,
  label = "History",
  className,
}: EntityHistoryButtonProps) {
  const [open, setOpen] = useState(false);

  if (entityId === null || entityId === undefined) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        }
      >
        <History size={14} />
        {label}
      </button>

      <EntityHistoryDialog
        open={open}
        entityType={entityType}
        entityId={entityId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export default EntityHistoryButton;
