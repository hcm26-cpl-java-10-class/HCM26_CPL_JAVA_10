
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

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  table: {
    schema?: {
      entityName?: string;
    };
    importFile?: (file: File) => Promise<ImportResult>;
  };

  title?: string;
  description?: string;
  onImportSuccess?: (result: ImportResult) => void;
  canImport?: boolean;

  // Optional Base extensions.
  allowedExtensions?: string[];
  maxFileSizeBytes?: number;
  onDownloadTemplate?: () => Promise<void>;
}

function isImportResult(value: unknown): value is ImportResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<ImportResult>;

  return (
      typeof data.successCount === "number" &&
      typeof data.failureCount === "number" &&
      Array.isArray(data.errors)
  );
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
        | {
      message?: string;
      detail?: string;
    }
        | undefined;

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (error.response?.status === 403) {
      return "Import is disabled or you do not have permission.";
    }
  }

  return error instanceof Error
      ? error.message
      : "Failed to import data.";
}

export function ImportModal({
                              open,
                              onOpenChange,
                              table,
                              title,
                              description,
                              onImportSuccess,
                              canImport = true,
                              allowedExtensions,
                              maxFileSizeBytes,
                              onDownloadTemplate,
                            }: ImportModalProps) {
  const [loading, setLoading] = useState(false);

  const entityName = table?.schema?.entityName || "data";

  if (!canImport) {
    return null;
  }

  const displayTitle =
      title ||
      `Import ${entityName.charAt(0).toUpperCase()}${entityName.slice(1)}`;

  async function handleImport(file: File): Promise<void> {
    if (!table.importFile) {
      throw new Error("Import is not available.");
    }

    setLoading(true);

    try {
      const result = await table.importFile(file);

      if (!isImportResult(result)) {
        throw new Error("Unexpected import result format.");
      }

      onImportSuccess?.(result);
      onOpenChange(false);

      if (result.failureCount === 0) {
        toast.success("Import completed successfully.");
      }
    } catch (error: unknown) {
      const responseData = axios.isAxiosError(error)
          ? error.response?.data
          : undefined;

      // Keep partial-result support used by Course.
      if (isImportResult(responseData)) {
        onImportSuccess?.(responseData);
        onOpenChange(false);
        return;
      }

      const message = getErrorMessage(error);

      toast.error(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
      <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            if (!loading) {
              onOpenChange(nextOpen);
            }
          }}
      >
        <DialogContent className="flex min-h-105 flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{displayTitle}</DialogTitle>
            <DialogDescription>
              {description ||
                  "Upload an Excel/CSV file to import data in bulk."}
            </DialogDescription>
          </DialogHeader>

          <Tabs
              defaultValue="import"
              className="flex w-full flex-1 flex-col"
          >
            <ImportTab
                loading={loading}
                onImport={handleImport}
                entityName={entityName}
                allowedExtensions={allowedExtensions}
                maxFileSizeBytes={maxFileSizeBytes}
                onDownloadTemplate={onDownloadTemplate}
            />
          </Tabs>

          <DialogFooter>
            <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
