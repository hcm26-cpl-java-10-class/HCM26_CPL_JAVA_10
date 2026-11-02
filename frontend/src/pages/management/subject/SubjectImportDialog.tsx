import { subjectApi } from "@/api/features/subject.api";
import { ImportTab } from "@/components/datatable/dataio/ImportTab";
import { ImportResultContent } from "@/components/datatable/dataio/ImportResultModal";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import type { ImportResult } from "@/types";
import type { SubjectImportPreview, SubjectImportInputRow } from "@/types/features/subject";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { subjectError } from "./subject-errors";
import { SubjectImportEditor } from "./SubjectImportEditor";
import { editImportCell, failedImportDrafts, importDrafts } from "./subject-import";

interface Props { onClose: () => void; onImported: () => void }
type ImportSource = { file: File } | { rows: SubjectImportInputRow[] };
type ImportView = "upload" | "preview" | "result";

export function SubjectImportDialog({ onClose, onImported }: Props) {
  const [view, setView] = useState<ImportView>("upload");
  const [backView, setBackView] = useState<"upload" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SubjectImportPreview>();
  const [drafts, setDrafts] = useState<SubjectImportInputRow[]>([]);
  const [editedRows, setEditedRows] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportResult>();
  const [error, setError] = useState<string>();
  const [preparingFailed, setPreparingFailed] = useState(false);
  const analyze = useMutation({ mutationFn: (source: ImportSource) => "rows" in source
      ? subjectApi.previewImportRows(source.rows) : subjectApi.previewImport(source.file),
    onSuccess: (value) => { setPreview(value); setDrafts(importDrafts(value)); setEditedRows(new Set()); setView("preview"); },
    onError: (cause) => setError(subjectError(cause, "Unable to preview this file. Try again.")) });
  const save = useMutation({ mutationFn: (source: ImportSource) => "rows" in source
      ? subjectApi.importRows(source.rows) : subjectApi.import(source.file),
    onSuccess: (value) => {
      setResult(value); setView("result"); onImported();
      if (value.failureCount) toast.warning(`Imported ${value.successCount} rows; ${value.failureCount} rows failed.`);
      else toast.success(`Imported ${value.successCount} subjects.`);
    }, onError: (cause) => setError(subjectError(cause, "Import failed. Review the file and try again.")) });
  const busy = analyze.isPending || save.isPending || preparingFailed;
  const errorRows = view === "result" ? result?.errors ?? [] : preview?.rows.filter((row) => !row.valid)
    .map((row) => ({ rowNumber: row.rowNumber, message: row.errors.join("; ") })) ?? [];
  const downloadErrors = () => {
    const escape = (value: unknown) => `"${String(value).replace(/"/g, '\"\"')}"`;
    const content = "\uFEFFRow,Error\r\n" + errorRows.map((row) => [row.rowNumber, row.message].map(escape).join(",")).join("\r\n");
    downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8" }), "subject_import_errors.csv");
  };
  const correctFailedRows = async () => {
    if (!result || !file) return;
    setPreparingFailed(true); setError(undefined);
    try {
      const source = drafts.length ? drafts : importDrafts(await subjectApi.previewImport(file));
      const failed = failedImportDrafts(source, result);
      setDrafts(failed); setEditedRows(new Set(failed.map((row) => row.rowNumber)));
      setPreview({totalRows: failed.length, validRows: 0, invalidRows: failed.length,
        rows: failed.map((row) => ({...row, data: null, valid: false,
          errors: result.errors.filter((entry) => entry.rowNumber === row.rowNumber).map((entry) => entry.message)}))});
      setBackView("result"); setView("preview");
    } catch (cause) { setError(subjectError(cause, "Unable to load failed rows. Try again.")); }
    finally { setPreparingFailed(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className={`flex max-h-[90vh] flex-col ${view === "preview" ? "sm:max-w-6xl" : "sm:max-w-xl min-h-105"}`}>
        <DialogHeader>
          <DialogTitle>{view === "preview" ? "Preview subjects" : view === "result" ? "Import results" : "Import subjects"}</DialogTitle>
          <DialogDescription>{view === "preview" ? "Review your data and correct errors before importing."
            : view === "result" ? "Review the imported subjects and any rows that need correction." : "Upload Excel/CSV file to import data in bulk"}</DialogDescription>
        </DialogHeader>
        <div hidden={view !== "upload"} className={view === "upload" ? "flex min-h-0 flex-1 flex-col" : undefined}>
          <Tabs defaultValue="import" className="flex min-h-0 w-full flex-1 flex-col">
            <ImportTab loading={busy} entityName="subject" maxFileSize={5 * 1024 * 1024}
              onFileChange={(selected) => { setFile(selected); setPreview(undefined); setDrafts([]); setEditedRows(new Set()); setResult(undefined); setError(undefined); }}
              onDownloadTemplate={async () => { const response = await subjectApi.downloadTemplate(); downloadBlob(response.data, "subjects_template.csv"); }}
              onPreview={async (selected) => {
                setError(undefined); setBackView("upload");
                if (preview) { setView("preview"); return; }
                try { await analyze.mutateAsync({file: selected}); }
                catch (cause) { throw new Error(subjectError(cause, "Unable to preview this file. Try again.")); }
              }}
              onImport={async (selected) => {
                if (editedRows.size > 0) { setView("preview"); throw new Error("Recheck the edited rows before importing."); }
                setError(undefined);
                await save.mutateAsync(preview ? {rows: drafts} : {file: selected});
              }} />
          </Tabs>
        </div>
        {error && view !== "upload" && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {view === "result" && result && <div className="min-h-0 flex-1 overflow-y-auto"><ImportResultContent result={result} /></div>}
        {view === "preview" && preview && <div className="min-h-0 space-y-4 overflow-y-auto">
          <div className="flex flex-wrap gap-2" role="status"><Badge variant="outline">{preview.totalRows} rows</Badge><Badge variant="secondary">{preview.validRows} valid</Badge><Badge variant={preview.invalidRows ? "destructive" : "outline"}>{preview.invalidRows} invalid</Badge></div>
          {editedRows.size > 0 && <p role="status" className="text-sm font-medium text-amber-700 dark:text-amber-400">Changes need to be checked again before importing.</p>}
          <SubjectImportEditor rows={drafts} preview={preview} editedRows={editedRows} busy={busy}
            onChange={(rowNumber, column, value) => {
              setDrafts((rows) => editImportCell(rows, rowNumber, column, value));
              setEditedRows((current) => new Set([...current, rowNumber])); setError(undefined);
            }} />
          <p className="text-sm text-muted-foreground">Use More fields to edit group, status, description or learning content. Recheck rows after edits.</p>
        </div>}
        <DialogFooter className="flex-wrap gap-2">
          {view === "preview" && <Button variant="outline" disabled={busy} onClick={() => { setError(undefined); setView(backView); }}><ArrowLeft className="size-4" />{backView === "upload" ? "Back to import" : "Back to results"}</Button>}
          {view !== "upload" && errorRows.length > 0 && <Button variant="outline" onClick={downloadErrors} disabled={busy || (view === "preview" && editedRows.size > 0)}><Download className="size-4" />Download errors</Button>}
          {view === "result" && result && result.failureCount > 0 && <Button variant="outline" disabled={busy} onClick={() => void correctFailedRows()}>{preparingFailed ? "Loading..." : "Correct failed rows"}</Button>}
          <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          {view === "preview" && preview && <>
            <Button variant="outline" disabled={busy} onClick={() => { setError(undefined); analyze.mutate({rows: drafts}); }}>{analyze.isPending ? "Checking..." : "Recheck rows"}</Button>
            <Button disabled={busy || editedRows.size > 0 || preview.validRows === 0} onClick={() => { setError(undefined); save.mutate({rows: drafts}); }}>
              <Upload className="size-4" />{save.isPending ? "Importing..." : `Import ${preview.validRows} valid rows`}</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
