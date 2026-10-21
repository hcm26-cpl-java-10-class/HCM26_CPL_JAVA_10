import { attendanceApi } from "@/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_OPTIONS,
  MAX_ATTENDANCE_NOTE_LENGTH,
  MAX_ATTENDANCE_REASON_LENGTH,
  MAX_BULK_ATTENDANCE_ROWS,
  type AttendanceRecord,
  type AttendanceStatus,
  type BulkAttendanceItemRequest,
  type BulkAttendanceItemResult,
  type BulkAttendanceRequest,
  type SessionDTO,
} from "@/types";
import { getApiErrorBody, getApiErrorCorrelationId, getApiErrorMessage } from "@/utils/api-error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import dayjs from "dayjs";
import {
  AlertTriangle,
  ClipboardList,
  History,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `attendance-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

interface DraftRow {
  key: string;
  studentId: number;
  status: AttendanceStatus;
  note: string;
  /** Version of a persisted record — null for a new row. */
  version: number | null;
  recordId: number | null;
  originalStatus?: AttendanceStatus;
  originalNote?: string;
  /** Business error returned for this row by the bulk endpoint (results[]). */
  serverError?: string | null;
  /** Current server version when a conflict happened. */
  conflictCurrentVersion?: number | null;
}

const toDraftRow = (record: AttendanceRecord): DraftRow => ({
  key: `record-${record.id}`,
  studentId: record.studentId,
  status: record.status,
  note: record.note ?? "",
  version: record.version,
  recordId: record.id,
  originalStatus: record.status,
  originalNote: record.note ?? "",
  serverError: null,
  conflictCurrentVersion: null,
});

const isRowDirty = (row: DraftRow): boolean =>
  row.recordId === null ||
  row.status !== row.originalStatus ||
  row.note.trim() !== (row.originalNote ?? "").trim() ||
  !!row.serverError;

const STATUS_BADGE_VARIANT: Record<
  AttendanceStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PRESENT: "default",
  ABSENT: "destructive",
  LATE: "outline",
  EXCUSED: "secondary",
};

interface AttendanceSheetDialogProps {
  session: SessionDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * T1 / SCR-53 — Attendance sheet of one session, opened from the `/sessions` page.
 *
 * UI states: `loading / empty / error / success / permission denied / conflict`
 * (SRS §3.2). Saving uses `POST /api/v1/sessions/{id}/attendance:bulk` with a fresh
 * `Idempotency-Key` per attempt (BR-UNI-20); each row gets its own result
 * (CREATED / UPDATED / UNCHANGED / REJECTED) and version conflicts offer reload/keep.
 */
export function AttendanceSheetDialog({ session, open, onOpenChange }: AttendanceSheetDialogProps) {
  const sessionId = session?.id;
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canRecord = hasAnyPermission(["ATTENDANCE_UPDATE", "ATTENDANCE_CREATE"]);
  const canUnlock = hasAnyPermission(["ATTENDANCE_UNLOCK"]);

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [reason, setReason] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<BulkAttendanceItemResult[]>([]);
  const [historyRecordId, setHistoryRecordId] = useState<number | null>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  const sheetQuery = useQuery({
    queryKey: ["attendance-sheet", sessionId],
    queryFn: () => attendanceApi.getSessionSheet(sessionId as number),
    enabled: open && !!sessionId,
    retry: false,
  });

  const sheet = sheetQuery.data;
  const locked = !!sheet?.locked;
  const sessionCancelled = sheet?.sessionStatus === "CANCELLED";
  // BR-ATT-01: attendance can only be recorded for sessions on or before today.
  const attendanceDateIsFuture =
    !!sheet?.attendanceDate && dayjs(sheet.attendanceDate).isAfter(dayjs(), "day");
  const readOnly =
    !canRecord || sessionCancelled || attendanceDateIsFuture || (locked && !canUnlock);
  const dirtyCount = useMemo(() => rows.filter(isRowDirty).length, [rows]);

  const sheetErrorStatus = axios.isAxiosError(sheetQuery.error)
    ? sheetQuery.error.response?.status
    : undefined;
  const permissionDenied = sheetErrorStatus === 401 || sheetErrorStatus === 403;

  // Each dialog session is a new operation — never replay the previous result.
  useEffect(() => {
    if (!open) return;
    setReason("");
    setNewStudentId("");
    setAddError(null);
    setFormError(null);
    setConflicts([]);
    setHistoryRecordId(null);
    idempotencyKeyRef.current = createIdempotencyKey();
  }, [open, sessionId]);

  useEffect(() => {
    if (!sheet) return;
    setRows(sheet.records.map(toDraftRow));
  }, [sheet]);

  const historyQuery = useQuery({
    queryKey: ["attendance-history", historyRecordId],
    queryFn: () => attendanceApi.getRecordHistory(historyRecordId as number),
    enabled: open && !!historyRecordId,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: BulkAttendanceRequest) =>
      attendanceApi.bulkUpsert(sessionId as number, payload, idempotencyKeyRef.current),
    onSuccess: async (result) => {
      const rejected = result.results.filter((item) => item.result === "REJECTED");
      setConflicts(rejected);

      if (result.rejected === 0) {
        await queryClient.invalidateQueries({ queryKey: ["attendance-sheet", sessionId] });
        toast.success("Attendance saved.", {
          description: `${result.created} created · ${result.updated} updated · ${result.unchanged} unchanged${
            result.idempotentReplay ? " · replayed from the previous request" : ""
          }`,
        });
        idempotencyKeyRef.current = createIdempotencyKey();
        return;
      }

      // Rows were rejected: keep what the user typed (no data loss — AC T1-07).
      setRows((previous) =>
        previous.map((row) => {
          const failure = rejected.find((item) => item.studentId === row.studentId);
          return failure
            ? {
                ...row,
                serverError: failure.message ?? "This row could not be saved.",
                conflictCurrentVersion: failure.currentVersion ?? null,
              }
            : row;
        }),
      );
      toast.warning(`Saved ${result.created + result.updated} row(s), ${result.rejected} rejected.`, {
        description: "Your input has been kept. Reload to see the latest version if needed.",
      });
    },
    onError: (error) => {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const body = getApiErrorBody(error) as Record<string, unknown> | undefined;
      const code = typeof body?.code === "string" ? body.code : undefined;
      const currentVersion =
        typeof body?.currentVersion === "number" ? body.currentVersion : undefined;
      const message = getApiErrorMessage(error, "Could not save attendance.");
      const correlationId = getApiErrorCorrelationId(error);

      if (status === 409) {
        setConflicts([
          {
            studentId: 0,
            result: "REJECTED",
            code: code ?? "CONFLICT",
            message,
            currentVersion: currentVersion ?? null,
          },
        ]);
      }
      setFormError(correlationId ? `${message} (correlationId: ${correlationId})` : message);
      toast.error(message);
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => attendanceApi.seedDemoAttendance(sessionId as number),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["attendance-sheet", sessionId] });
      idempotencyKeyRef.current = createIdempotencyKey();
      toast.success("Sample attendance generated.", {
        description: `${result.created} created${
          result.skipped ? ` · ${result.skipped} already existed` : ""
        }.`,
      });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Could not generate sample attendance.");
      setFormError(message);
      toast.error(message);
    },
  });

  const isBusy = saveMutation.isPending || seedMutation.isPending;

  const updateRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((previous) =>
      previous.map((row) =>
        row.key === key ? { ...row, ...patch, serverError: null, conflictCurrentVersion: null } : row,
      ),
    );
    setFormError(null);
  };

  const handleAddRow = () => {
    const parsed = Number(newStudentId.trim());
    if (!newStudentId.trim() || !Number.isSafeInteger(parsed) || parsed <= 0) {
      setAddError("Student ID must be a positive integer.");
      return;
    }
    if (rows.some((row) => row.studentId === parsed)) {
      setAddError("This student is already in the attendance sheet.");
      return;
    }
    if (rows.length >= MAX_BULK_ATTENDANCE_ROWS) {
      setAddError(`A maximum of ${MAX_BULK_ATTENDANCE_ROWS} rows can be written per request.`);
      return;
    }
    setRows((previous) => [
      ...previous,
      {
        key: `new-${parsed}-${Date.now()}`,
        studentId: parsed,
        status: "PRESENT",
        note: "",
        version: null,
        recordId: null,
      },
    ]);
    setNewStudentId("");
    setAddError(null);
    setFormError(null);
  };

  const handleRemoveRow = (key: string) => {
    setRows((previous) => previous.filter((row) => row.key !== key));
    setFormError(null);
  };

  const handleReload = async () => {
    setHistoryRecordId(null);
    setConflicts([]);
    setFormError(null);
    idempotencyKeyRef.current = createIdempotencyKey();
    await sheetQuery.refetch();
  };

  const handleGenerateSample = () => {
    if (!sessionId) return;
    setFormError(null);
    seedMutation.mutate();
  };

  const handleSave = () => {
    if (!sessionId) return;
    if (rows.length === 0) {
      setFormError("There is no attendance row to save yet.");
      return;
    }
    const tooLong = rows.find((row) => row.note.trim().length > MAX_ATTENDANCE_NOTE_LENGTH);
    if (tooLong) {
      setFormError(
        `The reason for student ${tooLong.studentId} exceeds ${MAX_ATTENDANCE_NOTE_LENGTH} characters.`,
      );
      return;
    }
    if (locked && canUnlock && !reason.trim()) {
      setFormError("Attendance is locked — enter a correction reason (BR-ATT-03).");
      return;
    }

    const items: BulkAttendanceItemRequest[] = rows.map((row) => ({
      studentId: row.studentId,
      status: row.status,
      note: row.note.trim() ? row.note.trim() : null,
      version: row.version,
    }));

    setFormError(null);
    saveMutation.mutate({
      mode: "UPSERT",
      reason: locked && canUnlock ? reason.trim() || null : null,
      items,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <ClipboardList className="size-4 text-primary" />
            </span>
            Session attendance
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block">
              {session?.title || session?.classCode || "Session"}
              {session?.startTime ? ` · ${dayjs(session.startTime).format("DD/MM/YYYY HH:mm")}` : ""}
            </span>
            <span className="block text-xs">
              One record per student per session. The server records the actor/time and keeps an
              append-only change history.
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* ---------------------------------------------------- summary badges */}
        {sheet && !sheetQuery.isError && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Total: {sheet.total}</Badge>
            <Badge variant="default">Present: {sheet.present}</Badge>
            <Badge variant="destructive">Absent: {sheet.absent}</Badge>
            <Badge variant="outline">Late: {sheet.late}</Badge>
            <Badge variant="secondary">Excused: {sheet.excused}</Badge>
            {locked && (
              <Badge variant="destructive" className="gap-1">
                <Lock className="size-3" />
                Locked
              </Badge>
            )}
            {sheet.attendanceDate && (
              <span className="text-xs text-muted-foreground">
                Attendance date: {dayjs(sheet.attendanceDate).format("DD/MM/YYYY")}
              </span>
            )}
          </div>
        )}

        {/* ------------------------------------------------------ system alerts */}
        {sessionCancelled && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>Session cancelled</AlertTitle>
            <AlertDescription>
              Attendance records are retained (RETAINED) and excluded from statistics; recording or
              updating is disabled.
            </AlertDescription>
          </Alert>
        )}

        {attendanceDateIsFuture && !sessionCancelled && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>Session has not happened yet</AlertTitle>
            <AlertDescription>
              Attendance can only be recorded for sessions on or before today (BR-ATT-01). You can
              still review existing data; open a past session to record attendance.
            </AlertDescription>
          </Alert>
        )}

        {locked && (
          <Alert>
            <Lock className="size-4" />
            <AlertTitle>Attendance is locked (class COMPLETED)</AlertTitle>
            <AlertDescription>
              {canUnlock
                ? "You have ATTENDANCE_UNLOCK — enter a reason to record a correction (audited)."
                : "Only a Class Admin with ATTENDANCE_UNLOCK can modify locked records."}
            </AlertDescription>
          </Alert>
        )}

        {conflicts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Data has changed</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                {conflicts.some((item) => item.code === "ATTENDANCE_VERSION_CONFLICT")
                  ? "Some rows were updated by someone else. Reload to get the latest version, then submit again."
                  : (conflicts[0]?.message ?? "Attendance could not be saved.")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void handleReload()}>
                  <RefreshCw className="size-3.5" />
                  Reload data
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // "Merge": keep what the user typed and just hide the warning.
                    setConflicts([]);
                    setRows((previous) =>
                      previous.map((row) => ({
                        ...row,
                        serverError: null,
                        conflictCurrentVersion: null,
                      })),
                    );
                  }}
                >
                  Keep my changes
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {/* ------------------------------------------------------ main content */}
        {!sessionId ? (
          <Alert variant="destructive">
            <AlertDescription>Session id is missing.</AlertDescription>
          </Alert>
        ) : sheetQuery.isPending ? (
          <div role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading attendance…
          </div>
        ) : sheetQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{permissionDenied ? "Access denied" : "Could not load attendance"}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {permissionDenied
                  ? "You do not have permission to view attendance for this session (ATTENDANCE_READ required, or the session is outside your scope)."
                  : getApiErrorMessage(sheetQuery.error, "Unable to load the attendance sheet.")}
              </p>
              {!permissionDenied && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void sheetQuery.refetch()}
                >
                  <RefreshCw className="size-3.5" />
                  Try again
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <ClipboardList className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No attendance records yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate sample data or add students by Student ID to start recording.
            </p>
          </div>
        ) : (
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {rows.map((row) => (
              <div
                key={row.key}
                className="rounded-lg border p-3"
                data-dirty={isRowDirty(row) ? "true" : "false"}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Student #{row.studentId}</span>
                    {row.recordId === null ? (
                      <Badge variant="outline">New</Badge>
                    ) : (
                      <Badge variant={STATUS_BADGE_VARIANT[row.status]}>
                        {ATTENDANCE_STATUS_LABELS[row.status]}
                      </Badge>
                    )}
                    {row.version != null && (
                      <span className="text-xs text-muted-foreground">v{row.version}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {row.recordId != null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Change history"
                        aria-label="Change history"
                        onClick={() =>
                          setHistoryRecordId((current) =>
                            current === row.recordId ? null : row.recordId,
                          )
                        }
                      >
                        <History className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    {row.recordId === null && !readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Remove row"
                        aria-label="Remove row"
                        onClick={() => handleRemoveRow(row.key)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                  <RadioGroup
                    value={row.status}
                    onValueChange={(value) =>
                      updateRow(row.key, { status: value as AttendanceStatus })
                    }
                    disabled={readOnly || isBusy}
                    className="flex flex-wrap gap-x-4 gap-y-2"
                    aria-label={`Status for student ${row.studentId}`}
                  >
                    {ATTENDANCE_STATUS_OPTIONS.map((status) => {
                      const optionId = `${row.key}-${status}`;
                      return (
                        <div key={status} className="flex items-center gap-2">
                          <RadioGroupItem value={status} id={optionId} />
                          <Label
                            htmlFor={optionId}
                            className="cursor-pointer text-sm font-normal"
                          >
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>

                  <div className="grid gap-1">
                    <Input
                      value={row.note}
                      onChange={(event) => updateRow(row.key, { note: event.target.value })}
                      placeholder="Reason (absence, late arrival…)"
                      maxLength={MAX_ATTENDANCE_NOTE_LENGTH}
                      disabled={readOnly || isBusy}
                      aria-label={`Reason for student ${row.studentId}`}
                      aria-invalid={!!row.serverError}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-destructive">{row.serverError ?? ""}</p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {row.note.length}/{MAX_ATTENDANCE_NOTE_LENGTH}
                      </p>
                    </div>
                  </div>
                </div>

                {historyRecordId != null && historyRecordId === row.recordId && (
                  <div className="mt-3 rounded-md border bg-muted/40 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Change history (append-only)
                    </p>
                    {historyQuery.isPending ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        Loading history…
                      </div>
                    ) : historyQuery.isError ? (
                      <p className="text-xs text-destructive">
                        {getApiErrorMessage(historyQuery.error, "Could not load history.")}
                      </p>
                    ) : (historyQuery.data ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No history yet.</p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {(historyQuery.data ?? []).map((entry) => (
                          <li key={entry.id} className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{entry.action}</Badge>
                            <span>
                              {entry.fromStatus ? `${entry.fromStatus} → ` : ""}
                              {entry.toStatus}
                            </span>
                            <span className="text-muted-foreground">
                              {dayjs(entry.changedAt).format("DD/MM/YYYY HH:mm:ss")} · #
                              {entry.changedBy}
                            </span>
                            {entry.reason && (
                              <span className="text-muted-foreground">· {entry.reason}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ---------------------------------------------------------- add row */}
        {!sheetQuery.isError && !readOnly && (
          <div className="grid gap-2 border-t pt-3">
            <Label htmlFor={`attendance-add-${sessionId}`}>Add a student by Student ID</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`attendance-add-${sessionId}`}
                value={newStudentId}
                onChange={(event) => {
                  setNewStudentId(event.target.value);
                  if (addError) setAddError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddRow();
                  }
                }}
                placeholder="e.g. 2001"
                inputMode="numeric"
                className="max-w-48"
                disabled={isBusy}
              />
              <Button type="button" variant="outline" onClick={handleAddRow} disabled={isBusy}>
                <Plus className="size-4" />
                Add row
              </Button>
            </div>
            <p className="text-xs text-destructive">{addError ?? ""}</p>
          </div>
        )}

        {locked && canUnlock && !readOnly && (
          <div className="grid gap-2">
            <Label htmlFor={`attendance-reason-${sessionId}`}>
              Correction reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`attendance-reason-${sessionId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Adjusted per the class minutes approved by the trainer."
              rows={2}
              maxLength={MAX_ATTENDANCE_REASON_LENGTH}
              disabled={isBusy}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{readOnly ? "Read-only" : ""}</span>
              <span>
                {reason.length}/{MAX_ATTENDANCE_REASON_LENGTH}
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {!canRecord && <span>You have view-only access.</span>}
            {canRecord && dirtyCount > 0 && (
              <span>
                {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
              Close
            </Button>
            {!readOnly && (sheet?.total ?? 0) === 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateSample}
                disabled={isBusy || sheetQuery.isPending || sheetQuery.isError}
              >
                {seedMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 size-4" />
                    Generate sample data
                  </>
                )}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                readOnly || isBusy || sheetQuery.isPending || sheetQuery.isError || rows.length === 0
              }
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Save attendance
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
