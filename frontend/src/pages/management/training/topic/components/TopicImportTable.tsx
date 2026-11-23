import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNumericOnly } from "@/schemas/topic.schema";
import type { TopicImportPreviewRow } from "@/types/features/content";

interface TopicImportTableProps {
  rows: TopicImportPreviewRow[];
  onCellChange: <K extends keyof TopicImportPreviewRow>(
    index: number,
    field: K,
    value: TopicImportPreviewRow[K]
  ) => void;
  onDeleteRow: (index: number) => void;
}

function getDurationInvalid(durationHours: TopicImportPreviewRow["durationHours"]): boolean {
  if (durationHours === undefined || durationHours === null || String(durationHours).trim() === "") {
    return true;
  }
  const num = Number(durationHours);
  return Number.isNaN(num) || num <= 0 || !Number.isInteger(num) || num > 1000;
}

export function TopicImportTable({
  rows,
  onCellChange,
  onDeleteRow,
}: TopicImportTableProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-900">
      <div className="max-h-72 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-300 dark:border-gray-700 shadow-sm">
            <tr>
              <th className="p-2 w-10 text-center bg-gray-100 dark:bg-gray-800">#</th>
              <th className="p-2 w-20 bg-gray-100 dark:bg-gray-800">Validity</th>
              <th className="p-2 w-32 min-w-[120px] bg-gray-100 dark:bg-gray-800">Topic Code *</th>
              <th className="p-2 w-48 min-w-[170px] bg-gray-100 dark:bg-gray-800">Topic Name *</th>
              <th className="p-2 w-20 min-w-[70px] bg-gray-100 dark:bg-gray-800">Version *</th>
              <th className="p-2 w-28 min-w-[100px] bg-gray-100 dark:bg-gray-800">
                Technical Group
              </th>
              <th className="p-2 w-24 min-w-[80px] bg-gray-100 dark:bg-gray-800">Duration (h) *</th>
              <th className="p-2 w-24 min-w-[90px] bg-gray-100 dark:bg-gray-800">Status</th>
              <th className="p-2 min-w-[200px] bg-gray-100 dark:bg-gray-800">Error Details</th>
              <th className="p-2 w-10 text-center bg-gray-100 dark:bg-gray-800">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {rows.map((row, idx) => {
              const isRowInvalid = !row.valid;
              const tg = (row.technicalGroup || "").trim();
              const isTgInvalid = (Boolean(tg) && isNumericOnly(tg)) || tg.length > 100;
              const isDurationInvalid = getDurationInvalid(row.durationHours);

              return (
                <tr
                  key={`${row.rowNumber}-${idx}`}
                  className={`transition-colors ${
                    isRowInvalid
                      ? "bg-red-50/70 dark:bg-red-950/30"
                      : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                  }`}
                >
                  <td className="p-2 text-center font-mono font-semibold text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="p-2">
                    {row.valid ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                        <AlertCircle className="h-3 w-3" /> Invalid
                      </span>
                    )}
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      maxLength={50}
                      value={row.code || ""}
                      onChange={(e) => onCellChange(idx, "code", e.target.value)}
                      placeholder="Topic Code..."
                      className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                        !row.code?.trim() || row.code.trim().length > 50
                          ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                          : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                      }`}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      maxLength={255}
                      value={row.name || ""}
                      onChange={(e) => onCellChange(idx, "name", e.target.value)}
                      placeholder="Topic Name..."
                      className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                        !row.name?.trim() || row.name.trim().length > 255
                          ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                          : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                      }`}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      maxLength={20}
                      value={row.version || ""}
                      onChange={(e) => onCellChange(idx, "version", e.target.value)}
                      placeholder="1.0"
                      className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                        !row.version?.trim() || row.version.trim().length > 20
                          ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                          : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                      }`}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      maxLength={100}
                      value={row.technicalGroup || ""}
                      onChange={(e) => onCellChange(idx, "technicalGroup", e.target.value)}
                      placeholder="e.g. Java, Frontend..."
                      className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                        isTgInvalid
                          ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                          : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                      }`}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={row.durationHours ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        onCellChange(idx, "durationHours", raw === "" ? undefined : Number(raw));
                      }}
                      placeholder="Hours"
                      className={`w-full px-2 py-1 text-xs rounded border transition-colors text-right ${
                        isDurationInvalid
                          ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                          : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                      }`}
                    />
                  </td>
                  <td className="p-1">
                    <select
                      value={row.status || "ACTIVE"}
                      onChange={(e) =>
                        onCellChange(idx, "status", e.target.value as "ACTIVE" | "INACTIVE")
                      }
                      className="w-full px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </td>
                  <td className="p-2 text-red-600 dark:text-red-400 text-[11px] leading-tight">
                    {row.errors && row.errors.length > 0 ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {row.errors.map((err, eIdx) => (
                          <li key={`${err}-${eIdx}`}>{err}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteRow(idx)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                      title="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

