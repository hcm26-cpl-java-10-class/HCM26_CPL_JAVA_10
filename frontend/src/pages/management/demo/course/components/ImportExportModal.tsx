import axios from "@/api/axios";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, FileJson } from "lucide-react";
import { toast } from "sonner";
import { courseData, courseError } from "@/integrations/courses/course-data";
import { courseWorkbook, previewCourseRows, previewCourseWorkbook, type ImportPreview, type ImportResult } from "@/integrations/courses/course-workbook";

interface ImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ImportPreview | null;
  result: ImportResult | null;
  onPreview: (preview: ImportPreview) => void;
  onImport: (preview: ImportPreview) => Promise<ImportResult>;
  canImport: boolean;
  busy: boolean;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({ open, onOpenChange, preview, result, onPreview, onImport, canImport, busy }) => {
  const [mode, setMode] = useState<"import" | "export">("export");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const exportLock = useRef(false);
  useEffect(() => { if (open) { setMode(preview && !result ? "import" : "export"); setError(""); } }, [open, preview]);

  const previewFile = async (file?: File) => {
    if (!file) return;
    try { onPreview(previewCourseWorkbook(await file.arrayBuffer())); setError(""); }
    catch (failure) { setError(courseError(failure)); }
  };
  const previewJson = () => {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (!rows.length || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("JSON must contain Course objects.");
      onPreview(previewCourseRows(rows, 1)); setError("");
    } catch (failure) { setError(courseError(failure)); }
  };
  const exportData = async (format: "xlsx" | "csv" | "json") => {
    if (exportLock.current) return;
    exportLock.current = true; setExporting(true); setError("");
    try {
      const records = await courseData.all();
      if (format === "xlsx") {
        const {data}=await axios.get("/courses/export-bundle",{responseType:"blob"});
        const url=URL.createObjectURL(data); const link=document.createElement("a");link.href=url;link.download="course-bundle.xlsx";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      else {
        const text = format === "json" ? JSON.stringify(records, null, 2)
          : XLSX.utils.sheet_to_csv(courseWorkbook(records).Sheets.Courses);
        const url = URL.createObjectURL(new Blob([text], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = `courses-backend.${format}`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      toast.success(`Exported ${records.length} backend courses.`);
    } catch (failure) { setError(courseError(failure)); }
    finally { exportLock.current = false; setExporting(false); }
  };

  return <Dialog open={open} onOpenChange={next => { if (!busy && !exporting) onOpenChange(next); }}>
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-slate-200 bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
      <DialogHeader>
        <DialogTitle className="text-base font-bold">{mode === "export" ? "Export Course Data" : "Import Courses"}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">{mode === "export" ? "Download current backend Course records across all pages." : "Preview the workbook or JSON, then persist supported Course fields."}</DialogDescription>
      </DialogHeader>
      <div className="my-2 flex border-b">
        {["export", "import"].map(value => <button type="button" key={value} disabled={busy || exporting || value === "import" && !canImport}
          className={`flex-1 border-b-2 py-2 text-sm font-semibold ${mode === value ? "border-current" : "border-transparent text-muted-foreground"}`}
          onClick={() => setMode(value as "import" | "export")}>{value === "export" ? "Export" : "Import"}</button>)}
      </div>
      {mode === "export" ? <div className="space-y-4 py-3">
        <p className="text-sm text-muted-foreground">XLSX includes saved Category, Level, Publication Status and Instructor Email. XLSX also includes linked Sections and Lessons.</p>
        <div className="grid grid-cols-3 gap-3">
          {(["xlsx", "csv", "json"] as const).map(format => <Button key={format} type="button" variant="outline" disabled={exporting || busy}
            onClick={() => void exportData(format)} className="h-20 flex-col gap-1.5">
            {format === "json" ? <FileJson className="size-5" /> : <FileSpreadsheet className="size-5" />}
            {format.toUpperCase()}
          </Button>)}
        </div>
        {exporting && <p role="status">Loading and exporting backend courses...</p>}
      </div> : <div className="space-y-4 py-3">
        <div className="rounded-xl border border-dashed p-4 text-center">
          <input ref={fileInput} type="file" accept=".xlsx,.xls" aria-label="Choose Course workbook" className="hidden" onChange={event => { void previewFile(event.target.files?.[0]); event.target.value = ""; }} />
          <p className="mb-2 text-sm text-muted-foreground">Upload a Courses workbook or a complete Courses / Sections / Lessons bundle. ReadMe is documentation.</p>
          <Button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Upload className="size-4" />Upload .xlsx File</Button>
        </div>
        <label className="block space-y-2 text-sm">Or paste Course JSON
          <textarea aria-label="Course JSON" rows={4} value={jsonText} onChange={event => setJsonText(event.target.value)} className="w-full rounded-lg border bg-transparent p-3" placeholder='[{"name":"Course name","instructor":"Instructor","isActive":true}]' />
        </label>
        <Button type="button" variant="outline" disabled={busy} onClick={previewJson}>Preview JSON</Button>
        {preview && <div className="space-y-3 rounded-lg border p-3 text-sm">
          <p>{preview.rows.length} Course rows. Name, Instructor, Description, Thumbnail URL, Active, Category Codes, Level, Status and Instructor Email are persisted.</p>
          {preview.bundle && <label className="flex items-start gap-2"><input type="checkbox" checked={!!preview.updateExisting} disabled={busy} onChange={e=>onPreview({...preview,updateExisting:e.target.checked})} />Update metadata of existing Courses with matching names. Existing Sections and Lessons remain unchanged.</label>}
          {preview.warnings.length > 0 && <div role="note"><p className="font-semibold">Fields or sheets that will not be persisted:</p><ul className="ml-4 list-disc">{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
          {preview.rows.filter(row => row.error).map(row => <p key={row.row} className="text-destructive">Row {row.row}: {row.error}</p>)}
          <Button type="button" disabled={busy || !canImport || !preview.rows.some(row => row.course)} onClick={async () => {
            setError(""); try { await onImport(preview); } catch (failure) { setError(courseError(failure)); }
          }}>{busy ? "Importing..." : "Import supported fields"}</Button>
        </div>}
        {result && <div role="status" className="space-y-2 rounded-lg border p-3 text-sm">
          {result.warnings.map(warning=><p key={warning}>{warning}</p>)}<p className="font-semibold">Imported {result.imported}; updated {result.updated || 0}; skipped {result.skipped}; failed {result.failed}; not attempted {result.unattempted}.</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">{result.rows.map((row,index) => <li key={index}>Row {row.row} {row.name}: {row.status}{row.message ? ` — ${row.message}` : ""}</li>)}</ul>
        </div>}
      </div>}
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy || exporting} onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
};
