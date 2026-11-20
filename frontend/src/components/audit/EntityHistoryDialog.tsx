import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogApi, type AuditLogDTO } from "@/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getActionBadgeClass,
  getActionDotClass,
  getActionLabel,
} from "@/components/audit/auditActions";

interface EntityHistoryDialogProps {
  open: boolean;
  entityType: string;
  entityId: string | number | null;
  onClose: () => void;
}

const HISTORY_PAGE_SIZE = 10;
const IGNORED_FIELDS = new Set(["updatedAt", "updatedBy", "version"]);

function parseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getChanges(log: AuditLogDTO) {
  const before = parseObject(log.oldValue);
  const after = parseObject(log.newValue);
  if (!before || !after) return [];

  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((key) => !IGNORED_FIELDS.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, from: before[key], to: after[key] }));
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isFailure(result: string | null) {
  return ["FAIL", "FAILED", "FAILURE"].includes((result ?? "").trim().toUpperCase());
}

export function EntityHistoryDialog({
  open,
  entityType,
  entityId,
  onClose,
}: EntityHistoryDialogProps) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [entityType, entityId, open]);

  const query = useQuery({
    queryKey: ["entity-history", entityType, entityId, page],
    queryFn: () =>
      auditLogApi.getEntityHistory(
        entityType,
        String(entityId),
        page,
        HISTORY_PAGE_SIZE,
      ),
    enabled: open && entityId !== null && entityId !== undefined,
  });

  const logs = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            History: {entityType} #{entityId}
          </DialogTitle>
          <DialogDescription>
            {query.data
              ? `${query.data.totalElements} change(s) recorded, newest first.`
              : "All recorded changes of this record."}
          </DialogDescription>
        </DialogHeader>

        {query.isPending && (
          <p className="py-6 text-center text-sm text-slate-500">Loading...</p>
        )}

        {query.isError && (
          <p className="py-6 text-center text-sm text-red-600">
            Unable to load history.
          </p>
        )}

        {query.isSuccess && logs.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">
            No history recorded for this record.
          </p>
        )}

        {logs.length > 0 && (
          <ol className="relative ml-2 border-l border-slate-200 pl-6">
            {logs.map((log) => {
              const action = (log.action ?? "").toUpperCase();
              const changes = getChanges(log);

              return (
                <li key={log.id} className="relative pb-6 last:pb-0">
                  <span
                    className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${getActionDotClass(
                      action,
                    )}`}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${getActionBadgeClass(
                        action,
                      )}`}
                    >
                      {getActionLabel(action)}
                    </span>
                    {isFailure(log.result) && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Failure
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {formatTime(log.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-700">
                    by{" "}
                    <span className="font-medium">
                      {log.actorEmail || "Unknown"}
                    </span>
                  </p>

                  {changes.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                      {changes.map((change) => (
                        <li key={change.key} className="break-words">
                          <span className="font-semibold">{change.key}</span>:{" "}
                          <span className="text-red-600 line-through">
                            {displayValue(change.from)}
                          </span>{" "}
                          → <span className="text-emerald-700">{displayValue(change.to)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {action === "UPDATE" && changes.length === 0 && (
                    <p className="mt-2 text-xs text-slate-400">
                      No field-level changes captured.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-slate-500">
              Page {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EntityHistoryDialog;
