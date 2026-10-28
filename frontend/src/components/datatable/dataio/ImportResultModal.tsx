import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GeneratedCredential, ImportResult } from "@/types";
import { ArrowLeft, CheckCircle2, Download, KeyRound, ListChecks, Mail, RefreshCw, SkipForward, XCircle } from "lucide-react";

interface ImportResultContentProps {
  result: ImportResult;
}

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

export const ImportResultContent = ({ result }: ImportResultContentProps) => {
  const totalCount =
    result.totalCount && result.totalCount > 0
      ? result.totalCount
      : result.successCount + result.failureCount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <h4 className="font-semibold">Total</h4>
          </div>
          <p className="text-3xl font-bold text-center">{totalCount}</p>
        </div>

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
              {(result.errors ?? []).map((err, index) => (
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
}

export function ImportResultModal({
  open,
  onOpenChange,
  result,
  onBackToImport,
}: ImportResultModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
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
              <ImportResultContent result={result} />
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
