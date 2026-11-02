import { useState } from "react";
import axios from "axios";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, RefreshCw, Upload, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import type { ImportInputRow, ImportPreview, ImportResult } from "@/types/common/import-result";
import { ImportTab } from "./ImportTab";

interface Props {
  title: string;
  entityName: string;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (file: File) => Promise<ImportPreview>;
  onImport: (file: File) => Promise<void>;
  onPreviewRows?: (rows: ImportInputRow[]) => Promise<ImportPreview>;
  onImportRows?: (rows: ImportInputRow[]) => Promise<ImportResult>;
  onDownloadTemplate?: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{message?: string; errors?: Record<string, string[]>}>(error)) {
    const body = error.response?.data;
    const details = body?.errors ? Object.values(body.errors).flat().join("; ") : "";
    return details || body?.message || error.message;
  }
  return error instanceof Error ? error.message : "Unable to process this file. Please try again.";
}

const PAGE_SIZE = 20;
const draftsFrom = (value: ImportPreview): ImportInputRow[] => value.rows.map(row => ({ rowNumber: row.rowNumber, values: { ...row.values } }));
const hintFor = (column: string) => column.endsWith(" ID") ? "Positive whole number; 1 and 1.0 are accepted"
  : column === "Start Time" || column === "End Time" ? "yyyy-MM-ddTHH:mm, for example 2026-10-28T09:00"
  : column === "Meeting URL" ? "https://meet.example/session" : column;

export function ImportPreviewDialog({ title, entityName, loading, onOpenChange, onPreview, onImport, onPreviewRows, onImportRows, onDownloadTemplate }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [drafts, setDrafts] = useState<ImportInputRow[]>([]);
  const [editedRows, setEditedRows] = useState<Set<number>>(new Set());
  const [recheckFailed, setRecheckFailed] = useState(false);
  const busy = loading || checking;
  const canEdit = Boolean(onPreviewRows && onImportRows);
  const needsRecheck = editedRows.size > 0 || recheckFailed;
  const draftByNumber = new Map(drafts.map(row => [row.rowNumber, row]));
  const rows = preview?.rows.filter(row => !errorsOnly || !row.valid || editedRows.has(row.rowNumber)) ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visibleRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function acceptPreview(value: ImportPreview) {
    setPreview(value); setDrafts(draftsFrom(value)); setEditedRows(new Set()); setRecheckFailed(false); setPage(0);
  }

  async function analyze(selected: File, force = false) {
    if (!force && selected === file && preview) { setShowPreview(true); return; }
    setChecking(true); setError(null); setFile(selected);
    try {
      acceptPreview(await onPreview(selected)); setShowPreview(true); setErrorsOnly(false);
    } catch (cause) {
      const message = errorMessage(cause);
      // The upload tab owns upload errors; rechecks display errors in this dialog.
      if (showPreview) setError(message);
      throw new Error(message);
    }
    finally { setChecking(false); }
  }

  function changeCell(rowNumber: number, column: string, value: string) {
    if (busy) return;
    setDrafts(current => current.map(row => row.rowNumber === rowNumber ? { ...row, values: { ...row.values, [column]: value } } : row));
    setEditedRows(current => new Set([...current, rowNumber])); setError(null);
  }

  async function recheck() {
    if (busy) return;
    if (!onPreviewRows) { if (file) await analyze(file, true); return; }
    setChecking(true); setError(null);
    try { acceptPreview(await onPreviewRows(drafts)); }
    catch (cause) { setRecheckFailed(true); setError(errorMessage(cause)); }
    finally { setChecking(false); }
  }

  async function confirmImport() {
    if (!preview?.canImport || busy || needsRecheck) return;
    setError(null);
    try {
      if (canEdit && onImportRows) {
        const result = await onImportRows(drafts);
        if (result.failureCount > 0) await recheck();
      } else if (file) await onImport(file);
    } catch (cause) { setError(errorMessage(cause)); }
  }

  return <Dialog open onOpenChange={open => { if (!busy) onOpenChange(open); }}>
    <DialogContent
      className={showPreview ? "flex max-h-[90vh] flex-col sm:max-w-6xl" : "flex min-h-105 max-h-[90vh] flex-col sm:max-w-xl"}
      showCloseButton={!busy}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
      onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>{showPreview ? "Preview sessions" : title}</DialogTitle>
        <DialogDescription>{showPreview
          ? "Review and edit the data, then recheck before importing. Nothing has been saved yet."
          : "Upload an Excel or CSV file, then preview the sessions before importing."}</DialogDescription>
      </DialogHeader>
      <div className={showPreview ? "hidden" : "flex min-h-0 flex-1 flex-col overflow-y-auto"}>
        <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Session file format</p>
          <p className="mt-1">Required: Class ID, Topic ID, Trainer ID, Session Title, Start Time and End Time. Use the Session template; Subject ID does not replace Topic ID.</p>
          <p className="mt-1">Use a Teaching Assignment ID returned by the class available-assignments API for the session interval. A blank ID is resolved only when exactly one real assignment matches the class and trainer. Topic ID is separate from Subject ID and ProgramSubject ID.</p>
          <p className="mt-1">IDs must be positive whole numbers. Use Excel date/time cells or <code className="text-xs">2026-10-28T09:00</code>. End Time must be later than Start Time.</p>
        </div>
        <Tabs defaultValue="import" className="flex min-h-0 flex-1 flex-col">
          <ImportTab loading={busy} entityName={entityName} previewRequired
            onImport={analyze} onPreview={analyze} onDownloadTemplate={onDownloadTemplate}
            onFileChange={selected => { setFile(selected); setPreview(null); setDrafts([]); setEditedRows(new Set()); setRecheckFailed(false); setError(null); }} />
        </Tabs>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {showPreview && preview && <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0" tabIndex={0} aria-label="Session preview content">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium"><FileSpreadsheet className="size-4 shrink-0" /><span className="truncate">{file?.name}</span></p>
          <div className="flex flex-wrap gap-2" role="status">
            {needsRecheck && <Badge variant="outline">Last check</Badge>}
            <Badge variant="outline">{preview.totalRows} {preview.totalRows === 1 ? "row" : "rows"}</Badge>
            <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400"><CheckCircle2 className="size-3" />{preview.validRows} valid</Badge>
            <Badge variant={preview.invalidRows ? "destructive" : "outline"} className="gap-1"><XCircle className="size-3" />{preview.invalidRows} invalid</Badge>
          </div>
        </div>
        {Boolean(preview.warnings?.length) && <div className="max-h-24 overflow-auto rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Check the file format</p><ul className="mt-1 list-disc space-y-1 pl-4">{preview.warnings?.map(message => <li key={message}>{message}</li>)}</ul>
        </div>}
        {needsRecheck ? <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300">
          {editedRows.size > 0 ? `${editedRows.size} edited row(s) need recheck before importing.` : "The last recheck failed. Check the rows again before importing."} Recheck validates all rows together.
        </p> : !preview.canImport && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {canEdit ? "Edit the invalid rows below, then click Recheck." : "Fix the invalid rows in your file and upload it again."} All rows must pass validation before any sessions are saved.
        </p>}
        {Boolean(preview.rules?.length) && <details className="rounded-lg border bg-muted/20 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Format and scheduling rules</summary>
          <ul className="mt-2 max-h-32 list-disc space-y-1 overflow-auto pl-4 text-muted-foreground">{preview.rules?.map(rule => <li key={rule}>{rule}</li>)}</ul>
        </details>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={errorsOnly}
            onChange={event => { setErrorsOnly(event.target.checked); setPage(0); }} />Show errors only</label>
          <p className="text-xs text-muted-foreground">{canEdit ? "Edit any cell. * Required. " : ""}Scroll horizontally for all columns.</p>
        </div>
        <div className="min-h-0 max-h-[45vh] overflow-auto rounded-lg border" tabIndex={0} aria-label="Session import preview">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Editable session data and validation results before import</caption>
            <thead className="sticky top-0 z-10 bg-muted"><tr>
              <th scope="col" className="border-b px-3 py-3 text-left font-semibold">Row</th>
              <th scope="col" className="min-w-52 border-b px-3 py-3 text-left font-semibold">Validation</th>
              {preview.columns.map(column => <th scope="col" key={column} className="min-w-48 whitespace-nowrap border-b px-3 py-3 text-left font-semibold">{column}{preview.requiredColumns?.includes(column) && <span className="ml-1 text-destructive">*</span>}</th>)}
            </tr></thead>
            <tbody>{visibleRows.map(row => {
              const edited = editedRows.has(row.rowNumber);
              const values = draftByNumber.get(row.rowNumber)?.values ?? row.values;
              return <tr key={row.rowNumber} className={`border-b last:border-b-0 ${edited ? "bg-amber-500/5" : row.valid ? "" : "bg-destructive/5"}`}>
                <th scope="row" className="px-3 py-3 text-left align-top font-mono font-medium">#{row.rowNumber}</th>
                <td id={`session-import-check-${row.rowNumber}`} className="px-3 py-3 align-top">
                  {edited ? <p className="font-medium text-amber-800 dark:text-amber-300">Edited - recheck required</p>
                    : row.valid ? <span className="flex items-center gap-1 text-green-700 dark:text-green-400"><CheckCircle2 className="size-4" />Valid</span>
                      : <ul className="list-disc space-y-1 pl-4 text-destructive">{row.errors.map((message, index) => <li key={index}>{message}</li>)}</ul>}
                </td>
                {preview.columns.map(column => <td key={column} className="min-w-48 max-w-80 px-3 py-2 align-top">
                  {canEdit ? <Input aria-label={`${column}, row ${row.rowNumber}`} aria-describedby={`session-import-check-${row.rowNumber}`}
                    value={values[column] ?? ""} disabled={busy} title={hintFor(column)} placeholder={column === "Start Time" || column === "End Time" ? "2026-10-28T09:00" : undefined}
                    inputMode={column.endsWith(" ID") ? "decimal" : undefined} maxLength={2048}
                    className={column === "Start Time" || column === "End Time" ? "min-w-52 font-mono text-xs" : "min-w-40"}
                    onChange={event => changeCell(row.rowNumber, column, event.target.value)} />
                    : values[column] || <span className="text-muted-foreground">&mdash;</span>}
                </td>)}
              </tr>;
            })}{!visibleRows.length && <tr><td colSpan={preview.columns.length + 2} className="px-3 py-8 text-center text-muted-foreground">No rows to display.</td></tr>}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{rows.length} matching {rows.length === 1 ? "row" : "rows"} | Page {page + 1} of {pageCount}</span>
          <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous preview page" disabled={page === 0 || busy} onClick={() => setPage(value => value - 1)}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="icon" aria-label="Next preview page" disabled={page + 1 >= pageCount || busy} onClick={() => setPage(value => value + 1)}><ChevronRight className="size-4" /></Button></div>
        </div>
      </div>}
      <DialogFooter className="flex-wrap gap-2">
        {showPreview && <Button variant="outline" disabled={busy} onClick={() => { setShowPreview(false); setError(null); }}><ArrowLeft className="size-4" />Back to import</Button>}
        <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Close</Button>
        {showPreview && <>
          <Button variant="outline" disabled={busy || (!onPreviewRows && !file)} onClick={() => void recheck().catch(() => {})}><RefreshCw className={checking ? "size-4 animate-spin" : "size-4"} />{checking ? "Checking..." : "Recheck"}</Button>
          <Button disabled={busy || needsRecheck || !preview?.canImport || (!canEdit && !file)} onClick={() => void confirmImport()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{loading ? "Importing..." : `Import ${preview?.totalRows ?? 0} ${preview?.totalRows === 1 ? "session" : "sessions"}`}
          </Button>
        </>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}