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
import { isImportResult } from "@/types/common/import-result";
import { isAxiosError } from "axios";
import { useState } from "react";
import { toast } from "sonner";
import { ImportTab } from "./ImportTab";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: {
    schema?: { entityName?: string };
    importFile?: (file: File) => Promise<unknown>;
  };
  title?: string;
  description?: string;
  onImportSuccess?: (result: ImportResult) => void;
  canImport?: boolean;
}

export function ImportModal({
  open,
  onOpenChange,
  table,
  title,
  description,
  onImportSuccess,
  canImport = true,
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
      if (!isImportResult(result)) {
        toast.error("Unable to import: the server returned invalid result data.");
        return;
      }
      onImportSuccess?.(result);
      onOpenChange(false);
      toast.success("Import successful!");
    } catch (err: unknown) {
      const response = isAxiosError<unknown>(err) ? err.response : undefined;
      const data = response?.data;
      const message =
        typeof data === "string" && data.trim() && !data.trim().startsWith("<")
          ? data
          : typeof data === "object" && data !== null &&
              "message" in data && typeof data.message === "string" && data.message.trim()
            ? data.message
            : undefined;

      if (response?.status === 400) {
        toast.error(message ?? "Import rejected (HTTP 400). Check the file against the downloaded import template.");
      } else {
        toast.error(message ?? "Failed to import data");
      }

      if (isImportResult(data)) {
        onImportSuccess?.(data);
        onOpenChange(false);
      }
    } finally {
      setImportLoading(false);
    }
  };

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
