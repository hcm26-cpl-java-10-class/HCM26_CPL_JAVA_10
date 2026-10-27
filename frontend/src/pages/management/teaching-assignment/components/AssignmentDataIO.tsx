import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { classSetupApi, type AssignmentSearchParams } from "@/api/features/class-setup.api";
import { ImportModal } from "@/components/datatable/dataio/ImportModal";
import { ExportModal } from "@/components/datatable/dataio/ExportModal";
import { ImportResultModal } from "@/components/datatable/dataio/ImportResultModal";
import { Button } from "@/components/ui/button";
import type { FileFormat, ImportResult } from "@/types";

export function AssignmentDataIO({ filters, canImport }: { filters: AssignmentSearchParams; canImport: boolean }) {
  const client = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const table = {
    schema: { entityName: "teaching-assignments" },
    importFile: classSetupApi.importAssignments,
    exportFile: (format: FileFormat) => classSetupApi.exportAssignments(format, filters),
  };
  function imported(value: ImportResult) {
    setResult(value);
    if (value.successCount > 0) {
      void client.invalidateQueries({ queryKey: ["teaching-assignments"] });
      void client.invalidateQueries({ queryKey: ["teaching-assignment-options"] });
      void client.invalidateQueries({ queryKey: ["teaching-assignment-create-context"] });
      void client.invalidateQueries({ queryKey: ["available-assignments"] });
    }
  }
  return <>
    {canImport && <Button variant="secondary" onClick={() => setImporting(true)}><Upload className="size-4" />Import</Button>}
    <Button variant="secondary" onClick={() => setExporting(true)}><Download className="size-4" />Export</Button>
    <ImportModal open={importing} onOpenChange={setImporting} table={table} canImport={canImport}
      title="Import Teaching Assignments"
      description="Create assignments from Excel or UTF-8 CSV (up to 1,000 rows). The template includes class, curriculum and trainer reference sheets. Role: MAIN or ASSISTANT. Dates: YYYY-MM-DD; Effective To may be blank. Each valid row is saved separately; existing assignments are never overwritten."
      onDownloadTemplate={classSetupApi.downloadAssignmentTemplate}
      onImportSuccess={imported} />
    <ExportModal open={exporting} onOpenChange={setExporting} table={table} title="Export Teaching Assignments"
      description="Export all assignments matching the current filters, across all pages (up to 10,000 rows). Excel and CSV include the import columns. Importing an existing assignment again reports an overlap error. PDF is for viewing only." />
    <ImportResultModal open={result !== null && !importing} onOpenChange={(open) => { if (!open) setResult(null); }} result={result}
      onBackToImport={() => { setResult(null); setImporting(true); }} />
  </>;
}
