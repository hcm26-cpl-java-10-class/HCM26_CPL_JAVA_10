import type { ImportInputRow } from "@/types/common/import-result";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import type { ImportResult } from "@/types";
import axios from "axios";
import { useState } from "react";
import { toast } from "sonner";
import { ImportTab } from "./ImportTab";
import { ImportPreviewDialog } from "./ImportPreviewDialog";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: any;
  title?: string;
  description?: string;
  onImportSuccess?: (result: ImportResult) => void;
  canImport?: boolean;
  onDownloadTemplate?: () => Promise<void>;
}

export function ImportModal({
  open,
  onOpenChange,
  table,
  title,
  description,
  onImportSuccess,
  canImport = true,
  onDownloadTemplate,
}: ImportModalProps) {
  const { schema } = table;
  const entityName = schema?.entityName || "data";
  const [importLoading, setImportLoading] = useState(false);

  if (!canImport) {
    return null;
  }

  const displayTitle =
    title || `Import ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`;
  const displayDescription =
    description || "Upload Excel/CSV file to import data in bulk";

  const handleImport = async (file: File) => {
    if (!table.importFile || !canImport) return;

    try {
      setImportLoading(true);
      const result = await table.importFile(file);
      onImportSuccess?.(result);
      onOpenChange(false);
      if (result.failureCount > 0) {
        const message = `Imported ${result.successCount} row(s); ${result.failureCount} row(s) failed. Check the import result for details.`;
        if (result.successCount > 0) toast.warning(message);
        else toast.error(message);
      } else {
        toast.success(`Imported ${result.successCount} row(s) successfully.`);
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message : undefined;
      toast.error(message ?? "Failed to import data");
      // Let ImportTab keep the selected file and display the request error.
      throw err;
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportRows = async (rows: ImportInputRow[]): Promise<ImportResult> => {
    if (!table.importRows || !canImport) throw new Error("Missing import permission");
    try {
      setImportLoading(true);
      const result: ImportResult = await table.importRows(rows);
      if (result.failureCount > 0) {
        toast.error("No sessions were imported. Review the updated validation results.");
      } else {
        onImportSuccess?.(result);
        onOpenChange(false);
        toast.success(          `Imported ${result.successCount} row(s) successfully.`);
      }
      return result;
    } catch (cause: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message : undefined;
      toast.error(message ?? "Failed to import edited data");
      throw cause;
    } finally { setImportLoading(false); }
  };

  if (table.previewImport) {
    return open ? <ImportPreviewDialog
      onOpenChange={onOpenChange}
      title={displayTitle}
      entityName={entityName}
      loading={importLoading}
      onPreview={table.previewImport}
      onImport={handleImport}
      onPreviewRows={table.previewImportRows}
      onImportRows={table.importRows ? handleImportRows : undefined}
      onDownloadTemplate={onDownloadTemplate}
    /> : null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl min-h-105 flex flex-col">
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          <DialogDescription>{displayDescription}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import" className="w-full flex-1 flex flex-col">
          <ImportTab
            loading={importLoading}
            onImport={handleImport}
            entityName={entityName}
            onDownloadTemplate={onDownloadTemplate}
          />
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importLoading}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
