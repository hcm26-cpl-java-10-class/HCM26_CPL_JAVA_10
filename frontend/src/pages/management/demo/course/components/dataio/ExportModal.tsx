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
import type { FileFormat } from "@/types";
import { useState } from "react";
import { toast } from "sonner";
import { ExportTab } from "./ExportTab";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: any;
  title?: string;
  description?: string;
  canExport?: boolean;
}

export function ExportModal({
  open,
  onOpenChange,
  table,
  title,
  description,
  canExport = true,
}: ExportModalProps) {
  const { schema } = table;
  const entityName = schema?.entityName || "data";
  const [exportLoading, setExportLoading] = useState(false);

  if (!canExport) {
    return null;
  }

  const displayTitle =
    title || `Export ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`;
  const displayDescription =
    description || "Choose output format and export your records";

  const handleExport = async (format: FileFormat) => {
    if (!table.exportFile || !canExport) return;

    try {
      setExportLoading(true);
      await table.exportFile(format);
      onOpenChange(false);
      toast.success("Export successful! Check your downloads folder.");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl min-h-105 flex flex-col">
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          <DialogDescription>{displayDescription}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full flex-1 flex flex-col">
          <ExportTab loading={exportLoading} onExport={handleExport} />
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exportLoading}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
