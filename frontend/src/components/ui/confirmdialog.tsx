// src/components/ui/ConfirmDialog.tsx
import React from "react";
import { Modal } from "./modal";

export const ConfirmDialog: React.FC<{
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}> = ({
  open,
  title = "Are you sure?",
  description,
  confirmLabel = "Yes, delete",
  loadingLabel,
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="space-y-4">
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border rounded hover:bg-muted transition"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded px-4 py-2 text-white transition ${destructive ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`}
            disabled={loading}
          >
            {loading ? (loadingLabel ?? (destructive ? "Deleting..." : "Working...")) : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
