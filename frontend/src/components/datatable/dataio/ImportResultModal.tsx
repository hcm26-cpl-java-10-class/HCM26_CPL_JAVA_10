import { departmentApi } from "@/api/features/rbac/department.api";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePermissions } from "@/hooks/usePermissions";
import { apiErrorMessage } from "@/utils/api-error.utils";
import type { DepartmentTreeNode, GeneratedCredential, ImportResult } from "@/types";
import { ArrowLeft, Building2, CheckCircle2, Download, KeyRound, Loader2, Mail, RefreshCw, SkipForward, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface ImportResultContentProps {
  result: ImportResult;
  /** Imports the same file again. Offered once the missing departments were added. */
  onRetryImport?: () => Promise<void>;
}

/** The error table shows this many rows at most; the whole list can be downloaded. */
const MAX_ERROR_ROWS_SHOWN = 200;

const downloadErrors = (errors: { rowNumber: number; message: string }[]) => {
  const quote = (text: string) => `"${String(text ?? "").replace(/"/g, '""')}"`;
  const lines = ["excel_row,error", ...errors.map((e) => `${e.rowNumber},${quote(e.message)}`)];

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "import-errors.csv";
  link.click();
  URL.revokeObjectURL(url);
};

/** Saves the generated temporary passwords as a CSV file (BOM so Excel opens it correctly). */
const downloadCredentials = (credentials: GeneratedCredential[]) => {
  const lines = ["email,temporary_password,excel_row"];
  credentials.forEach((c) => lines.push(`${c.email},${c.temporaryPassword},${c.rowNumber}`));

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "temporary-passwords.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const ROOT = "__root__";

/** The department tree as one list, children indented under their parent. */
const flattenDepartments = (nodes: DepartmentTreeNode[], depth = 0): { id: number; label: string }[] =>
  nodes.flatMap((node) => [
    {
      id: node.id,
      label: `${"\u00A0\u00A0".repeat(depth)}${depth > 0 ? "└ " : ""}${node.name} (${node.code})`,
    },
    ...flattenDepartments(node.children ?? [], depth + 1),
  ]);

/**
 * Offered when the file refers to departments that do not exist yet. The result stays short: one line
 * and one button. The button opens its own window where each missing code can be ticked and given a name.
 * Then the person goes back and imports the file again.
 */
const MissingDepartmentsNotice = ({
  codes,
  onRetryImport,
}: {
  codes: string[];
  onRetryImport?: () => Promise<void>;
}) => {
  const { hasPermission } = usePermissions();
  const canAdd = hasPermission("DEPARTMENT_CREATE");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(codes);
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(codes.map((code) => [code, code])),
  );
  const [added, setAdded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [parentId, setParentId] = useState<string>(ROOT);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [parents, setParents] = useState<{ id: number; label: string }[]>([]);

  // The parent list is read when the window opens, so it includes departments created a moment ago.
  useEffect(() => {
    if (!open) return;
    departmentApi
      .getTree()
      .then((tree) => setParents(flattenDepartments(tree)))
      .catch(() => setParents([]));
  }, [open]);

  const remaining = codes.filter((code) => !added.includes(code));
  const toAdd = remaining.filter((code) => selected.includes(code));

  const toggle = (code: string, checked: boolean) =>
    setSelected((prev) => (checked ? [...prev, code] : prev.filter((c) => c !== code)));

  const addSelected = async () => {
    setSaving(true);
    setError(null);
    const done = [...added];
    let current = "";
    try {
      for (const code of toAdd) {
        current = code;
        await departmentApi.create({
          code,
          name: names[code]?.trim() || code,
          description: descriptions[code]?.trim() || undefined,
          parentDepartmentId: parentId === ROOT ? null : Number(parentId),
          isActive: true,
        } as any);
        done.push(code);
        setAdded([...done]);
      }
      setOpen(false);
    } catch (err: any) {
      setError(`Could not add "${current}": ${apiErrorMessage(err, "please try again.")}`);
    } finally {
      setSaving(false);
    }
  };

  const retry = async () => {
    if (!onRetryImport) return;
    setRetrying(true);
    try {
      await onRetryImport();
    } finally {
      setRetrying(false);
    }
  };

  if (remaining.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            <Building2 className="h-4 w-4 shrink-0" />
            Departments added
          </div>
          {!onRetryImport && (
            <p className="mt-1">
              Click <strong>Back to Import</strong> and upload the file again.
            </p>
          )}
        </div>
        {onRetryImport && (
          <Button type="button" size="sm" className="shrink-0" onClick={retry} disabled={retrying}>
            {retrying && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {retrying ? "Importing..." : "Import the file again"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm dark:border-blue-500/40 dark:bg-blue-500/10">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            <Building2 className="h-4 w-4 shrink-0" />
            {remaining.length} department(s) in the file do not exist yet
          </div>
          {!canAdd && (
            <p className="mt-1 truncate text-muted-foreground" title={remaining.join(", ")}>
              Ask an administrator to add: {remaining.join(", ")}
            </p>
          )}
        </div>
        {canAdd && (
          <Button type="button" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
            Add departments...
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add departments</DialogTitle>
            <DialogDescription>
              Tick the departments to add, give each a name and, if you like, a description. They can be changed later in Departments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>Parent department</Label>
              <Select value={parentId} onValueChange={setParentId} disabled={saving}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None (top level)" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={ROOT}>None (top level)</SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All the ticked departments are added under this one. Leave it on "None" to add them at the top level.
              </p>
            </div>

            <label className="flex items-center gap-2 pt-1 text-sm font-medium">
              <Checkbox
                checked={toAdd.length === remaining.length}
                onCheckedChange={(checked) => setSelected(checked ? [...remaining] : [])}
                disabled={saving}
              />
              Select all ({remaining.length})
            </label>

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-2">
              {remaining.map((code) => (
                <div key={code} className="flex items-start gap-2">
                  <Checkbox
                    className="mt-2"
                    checked={selected.includes(code)}
                    onCheckedChange={(checked) => toggle(code, checked === true)}
                    disabled={saving}
                  />
                  <span className="mt-1.5 w-24 shrink-0 truncate font-mono text-xs" title={code}>
                    {code}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Input
                      value={names[code] ?? ""}
                      onChange={(e) => setNames((prev) => ({ ...prev, [code]: e.target.value }))}
                      disabled={saving || !selected.includes(code)}
                      maxLength={150}
                      className="h-8"
                      placeholder="Department name"
                    />
                    <Input
                      value={descriptions[code] ?? ""}
                      onChange={(e) => setDescriptions((prev) => ({ ...prev, [code]: e.target.value }))}
                      disabled={saving || !selected.includes(code)}
                      maxLength={500}
                      className="h-8"
                      placeholder="Description (optional)"
                    />
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={addSelected} disabled={saving || toAdd.length === 0}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Add {toAdd.length} department(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ImportResultContent = ({ result, onRetryImport }: ImportResultContentProps) => {
  return (
    <div className="space-y-4">
      {result.rolledBack && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex items-center gap-1.5 font-medium">
            <XCircle className="h-4 w-4" />
            No accounts were created or changed
          </div>
          <p className="mt-1">
            {result.message ??
              "The import was cancelled because some rows have errors. Fix them and import the file again."}
          </p>
        </div>
      )}

      {(result.missingCodes?.length ?? 0) > 0 && (
        <MissingDepartmentsNotice
          key={result.missingCodes!.join("|")}
          codes={result.missingCodes!}
          onRetryImport={onRetryImport}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold">Success</h4>
          </div>
          <p className="text-3xl font-bold text-center text-green-700 dark:text-green-300">
            {result.successCount}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <h4 className="font-semibold">Failed</h4>
          </div>
          <p className="text-3xl font-bold text-center text-red-700 dark:text-red-300">
            {result.failureCount}
          </p>
        </div>
      </div>

      {((result.updatedCount ?? 0) > 0 ||
        (result.skippedCount ?? 0) > 0 ||
        (result.emailsSent ?? 0) > 0 ||
        (result.emailsFailed ?? 0) > 0) && (
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              Existing, updated
            </div>
            <p className="mt-1 text-xl font-semibold">{result.updatedCount ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <SkipForward className="h-4 w-4" />
              Existing, unchanged
            </div>
            <p className="mt-1 text-xl font-semibold">{result.skippedCount ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-4 w-4" />
              Notices sent
            </div>
            <p className="mt-1 text-xl font-semibold">{result.emailsSent ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-4 w-4" />
              Notices failed
            </div>
            <p className="mt-1 text-xl font-semibold text-red-700 dark:text-red-300">
              {result.emailsFailed ?? 0}
            </p>
          </div>
        </div>
      )}

      {(result.credentials?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <div className="flex items-center gap-1.5 font-medium">
            <KeyRound className="h-4 w-4" />
            {result.credentials!.length} temporary password(s) generated
          </div>
          <p className="mt-1 text-muted-foreground">
            These accounts had no password in the file. Each person got their own random temporary
            password and must create their own at the first sign-in. No email was sent for them.
            <strong> This list is shown only once</strong>: download it now, hand the passwords out
            securely, then delete the file.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => downloadCredentials(result.credentials!)}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download passwords (CSV)
          </Button>
        </div>
      )}

      {(result.emailsSkipped ?? 0) > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {result.emailsSkipped} notice email(s) were not sent because the limit per import was reached.
          The passwords were still updated.
        </p>
      )}

      {(result.errors ?? []).length > MAX_ERROR_ROWS_SHOWN && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            Showing the first {MAX_ERROR_ROWS_SHOWN} of {(result.errors ?? []).length} errors.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadErrors(result.errors ?? [])}>
            <Download className="mr-1.5 h-4 w-4" />
            Download all errors (CSV)
          </Button>
        </div>
      )}

      {(result.errors ?? []).length > 0 && (
        <ScrollArea className="rounded-md border h-[250px]">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left font-medium border-b w-20">
                  Row
                </th>
                <th className="px-4 py-2 text-left font-medium border-b">
                  Error Message
                </th>
              </tr>
            </thead>
            <tbody>
              {(result.errors ?? []).slice(0, MAX_ERROR_ROWS_SHOWN).map((err, index) => (
                <tr
                  key={index}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3 border-r align-top">
                    <Badge variant="outline" className="font-mono">
                      #{err.rowNumber}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 break-words overflow-hidden">
                    <span className="text-red-600 dark:text-red-400">
                      {err.message}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
};

interface ImportResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ImportResult | null;
  onBackToImport?: () => void;
  onRetryImport?: () => Promise<void>;
}

export function ImportResultModal({
  open,
  onOpenChange,
  result,
  onBackToImport,
  onRetryImport,
}: ImportResultModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        {!result ? (
          <div className="p-8 text-center text-muted-foreground">
            No result data
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Import Result
              </DialogTitle>
              <DialogDescription>
                Summary of your import operation
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto py-4">
              <ImportResultContent result={result} onRetryImport={onRetryImport} />
            </div>

            <DialogFooter>
              <div className="flex-1 flex justify-between gap-2">
                {onBackToImport && (
                  <Button variant="outline" onClick={onBackToImport}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Import
                  </Button>
                )}
                <Button onClick={() => onOpenChange(false)} className="ml-auto">
                  Close
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
