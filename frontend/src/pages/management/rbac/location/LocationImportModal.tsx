import { useState } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { locationApi } from "@/api/features/rbac/location.api";
import type { LocationImportPreview } from "@/types/features/rbac/location";

export function LocationImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LocationImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const previewFile = async (selected: File) => {
    setFile(selected);
    setPreview(null);
    setError(null);
    setLoading(true);
    try {
      setPreview(await locationApi.previewImport(selected));
    } catch (reason: any) {
      setError(reason?.response?.data?.message || "Unable to preview this file.");
    } finally {
      setLoading(false);
    }
  };

  const importFile = async () => {
    if (!file || !preview || preview.invalidRows > 0) return;
    setLoading(true);
    setError(null);
    try {
      await locationApi.import(file);
      setFile(null);
      setPreview(null);
      onImported();
      onClose();
    } catch (reason: any) {
      setError(reason?.response?.data?.message || "Location import failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold">Import location hierarchy</h3>
            <p className="mt-1 text-xs text-muted-foreground">Preview and validate all rows before committing.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertTriangle className="size-4" />
            {error}
          </div>
        )}

        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
          <Upload className="mb-2 size-5" />
          {file ? file.name : "Choose an Excel file"}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void previewFile(selected);
            }}
          />
        </label>

        {preview && (
          <div className="mt-4">
            <div className="mb-2 flex gap-3 text-xs">
              <span><b>{preview.totalRows}</b> rows</span>
              <span className="text-emerald-600"><b>{preview.validRows}</b> valid</span>
              <span className="text-destructive"><b>{preview.invalidRows}</b> invalid</span>
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/90">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Parent</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className={row.valid ? "" : "bg-destructive/5"}>
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-mono">{row.code || "-"}</td>
                      <td className="px-3 py-2">{row.name || "-"}</td>
                      <td className="px-3 py-2 font-mono">{row.parentCode || "-"}</td>
                      <td className="px-3 py-2">{row.status || "-"}</td>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="size-3" /> Ready
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="size-3" /> {row.message}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-input px-3.5 py-1.5 text-xs">
            Cancel
          </button>
          <button
            type="button"
            disabled={!preview || preview.invalidRows > 0 || loading}
            onClick={importFile}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Processing..." : "Import all rows"}
          </button>
        </div>
      </div>
    </div>
  );
}
