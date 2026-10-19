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
import { useState } from "react";
import { toast } from "sonner";
import { ImportTab } from "./ImportTab";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: any;
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
      onImportSuccess?.(result);
      onOpenChange(false);
      toast.success("Import successful!");
    } catch (err: any) {
      if (err?.response?.data) {
        onImportSuccess?.(err.response.data);
        onOpenChange(false);
      }
      toast.error(err?.response?.data?.message ?? "Failed to import data");
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
