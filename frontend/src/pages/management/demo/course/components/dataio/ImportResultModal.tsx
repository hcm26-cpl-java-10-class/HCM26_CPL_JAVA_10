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
import type { ImportResult } from "@/types";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

interface ImportResultContentProps {
  result: ImportResult;
}

export const ImportResultContent = ({ result }: ImportResultContentProps) => {
  return (
    <div className="space-y-4">
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

      {result.errors.length > 0 && (
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
              {result.errors.map((err, index) => (
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
