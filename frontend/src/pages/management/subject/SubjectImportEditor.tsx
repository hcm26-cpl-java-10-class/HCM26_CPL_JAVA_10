import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { countWords } from "@/components/datatable/util/word-count";
import type { SubjectImportInputRow, SubjectImportPreview } from "@/types/features/subject";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Fragment, useState } from "react";

interface Props {
  rows: SubjectImportInputRow[];
  preview: SubjectImportPreview;
  editedRows: Set<number>;
  busy: boolean;
  onChange: (rowNumber: number, column: string, value: string) => void;
}

export function SubjectImportEditor({ rows, preview, editedRows, busy, onChange }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const checks = new Map(preview.rows.map((row) => [row.rowNumber, row]));
  const input = (row: SubjectImportInputRow, column: string, className?: string) => (
    <Input aria-label={`${column}, row ${row.rowNumber}`} value={row.values[column] ?? ""}
      className={className} disabled={busy} inputMode={column === "Hours" ? "numeric" : undefined}
      onChange={(event) => onChange(row.rowNumber, column, event.target.value)} />
  );
  const select = (row: SubjectImportInputRow, column: string, options: string[]) => {
    const raw = row.values[column] ?? "";
    const value = raw.trim().toUpperCase();
    return <select aria-label={`${column}, row ${row.rowNumber}`} value={value} disabled={busy}
      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
      onChange={(event) => onChange(row.rowNumber, column, event.target.value)}>
      <option value="">{column === "Status" ? "Active (default)" : "Not specified"}</option>
      {value && !options.includes(value) && <option value={value}>Invalid: {raw}</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>;
  };
  return (
    <div className="max-h-[55vh] overflow-auto rounded-lg border">
      <table className="w-full min-w-[950px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted"><tr>{["Row", "Code", "Name", "Version", "Hours", "Check result", "Details"].map((label) => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => {
          const check = checks.get(row.rowNumber);
          const edited = editedRows.has(row.rowNumber);
          const open = expanded.has(row.rowNumber);
          return <Fragment key={row.rowNumber}>
            <tr className={`border-t align-top ${!check?.valid ? "bg-destructive/5" : ""}`}>
              <td className="px-3 py-3 font-medium">{row.rowNumber}</td>
              <td className="min-w-40 px-3 py-2">{input(row, "Code")}</td>
              <td className="min-w-48 px-3 py-2">{input(row, "Name")}</td>
              <td className="min-w-28 px-3 py-2">{input(row, "Version")}</td>
              <td className="min-w-24 px-3 py-2">{input(row, "Hours")}</td>
              <td className="min-w-56 max-w-80 break-words px-3 py-3">
                {edited && <p className="mb-1 font-medium text-amber-700 dark:text-amber-400">Edited — recheck required</p>}
                <p className={check?.valid ? "text-green-700 dark:text-green-400" : "text-destructive"}>{check?.valid ? "Ready" : check?.errors.join("; ")}</p>
              </td>
              <td className="px-3 py-2"><Button type="button" variant="outline" size="sm" disabled={busy} aria-expanded={open}
                aria-label={`${open ? "Hide" : "Edit"} details, row ${row.rowNumber}`} onClick={() => setExpanded((current) => {
                  const next = new Set(current); if (next.has(row.rowNumber)) next.delete(row.rowNumber); else next.add(row.rowNumber); return next;
                })}>{open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}More fields</Button></td>
            </tr>
            {open && <tr className="border-t bg-muted/20"><td colSpan={7} className="p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-xs font-medium">Technical Group{input(row, "Technical Group")}</label>
                <label className="grid gap-2 text-xs font-medium">Status{select(row, "Status", ["ACTIVE", "INACTIVE"])}</label>
                <label className="grid gap-2 text-xs font-medium">Delivery Mode{select(row, "Delivery Mode", ["ONLINE", "OFFLINE", "HYBRID"])}</label>
                {["Description", "Objectives", "Skills", "Outline"].map((column) => <label key={column} className={`grid gap-2 text-xs font-medium ${column === "Outline" ? "sm:col-span-3" : ""}`}>
                  {column}<Textarea aria-label={`${column}, row ${row.rowNumber}`} rows={3} disabled={busy}
                    value={row.values[column] ?? ""} onChange={(event) => onChange(row.rowNumber, column, event.target.value)} />
                  {column === "Description" && <span className={countWords(row.values[column]) > 500 ? "text-destructive" : "text-muted-foreground"}>{countWords(row.values[column])} / 500 words</span>}
                </label>)}
              </div>
            </td></tr>}
          </Fragment>;
        })}</tbody>
      </table>
    </div>
  );
}
