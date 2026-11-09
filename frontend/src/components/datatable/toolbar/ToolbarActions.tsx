import { Download, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import ActionButton from "../common/ActionButton";
import { ConfirmDeleteModal } from "../modal/ConfirmDeleteModal";
import { ImportResultModal } from "../dataio/ImportResultModal";
import { ImportModal } from "../dataio/ImportModal";
import { ExportModal } from "../dataio/ExportModal";
import type { ImportResult } from "@/types";
import { PermissionGate } from "@/components/PermissionGate";

interface ToolbarActionsProps {
  table: any;
  headerActions?: React.ReactNode;
  labels?: {
    import?: string;
    export?: string;
  };
}

export function ToolbarActions({ table, headerActions, labels }: ToolbarActionsProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const handleImportSuccess = (result: ImportResult) => {
    setImportResult(result);
    setResultOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (!table.permission?.canDelete) return;

    try {
      setBulkDeleteLoading(true);
      await table.bulkDelete();
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row justify-end items-center gap-2">
      <PermissionGate permission={table.permission?.keys?.delete}>
        {table.permission?.canDelete && table.selected?.length > 0 && (
          <ActionButton
            onClick={() => setBulkDeleteOpen(true)}
            tooltip={`Delete ${table.selected.length} selected rows`}
            title="Delete"
            variant="destructive"
            icon={<Trash2 size={16} />}
          />
        )}
      </PermissionGate>

      {table.permission?.canExport && (
        <PermissionGate permission={table.permission?.keys?.export}>
          <ActionButton
            onClick={() => setExportOpen(true)}
            tooltip={labels?.export ?? "Export data"}
            title={labels?.export ?? "Export"}
            variant={labels ? "outline" : "secondary"}
            icon={<Download size={16} />}
            className={labels ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : undefined}
          />
        </PermissionGate>
      )}

      {table.permission?.canImport && (
        <PermissionGate permission={table.permission?.keys?.import}>
          <ActionButton
            onClick={() => setImportOpen(true)}
            tooltip={labels?.import ?? "Import data"}
            title={labels?.import ?? "Import"}
            variant={labels ? "outline" : "secondary"}
            icon={<Upload size={16} />}
            className={labels ? "border-orange-300 bg-white text-orange-700 hover:bg-orange-50" : undefined}
          />
        </PermissionGate>
      )}

      {extraActions}

      {/* Show custom header actions if provided, otherwise show default Create button */}
      {headerActions ||
        (!hideCreate && table.permission?.canCreate && (
          <PermissionGate permission={table.permission?.keys?.create}>
            <ActionButton
              onClick={() => table.openCreate()}
              tooltip="Create new data"
              title="Create"
              variant="default"
              icon={<Plus size={16} />}
            />
          </PermissionGate>
        ))}

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        table={table}
        onImportSuccess={handleImportSuccess}
        canImport={table.permission?.canImport}
      />

      <ExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        table={table}
        canExport={table.permission?.canExport}
      />

      <ImportResultModal
        open={resultOpen}
        onOpenChange={setResultOpen}
        result={importResult}
        onBackToImport={() => {
          setResultOpen(false);
          setImportOpen(true);
        }}
      />

      <ConfirmDeleteModal
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDeleteConfirm}
        loading={bulkDeleteLoading}
        title="Delete Selected Items"
        description={`Are you sure you want to delete ${table.selected?.length || 0} selected items? This action cannot be undone.`}
      />
    </div>
  );
}
