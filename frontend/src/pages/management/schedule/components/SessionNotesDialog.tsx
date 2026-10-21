import { sessionApi } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import type { SessionDTO } from "@/types";
import { getApiErrorCorrelationId, getApiErrorMessage } from "@/utils/api-error.utils";
import { ADMIN_ROLE } from "@/utils/rbac.utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Info, Loader2, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_NOTES_LENGTH = 2000;
const MAX_REASON_LENGTH = 500;
const SESSION_QUERY_KEY = ["session"] as const;

type TargetStatus = "KEEP" | "COMPLETED" | "CANCELLED";

const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-notes-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface SessionNotesDialogProps {
  session: SessionDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * T2 / US-F15-02 — "Update Notes" on /sessions page.
 *
 * Calls `PATCH /api/v1/sessions/{id}/notes` with `If-Match` + `Idempotency-Key`.
 * `updatedBy`/`updatedAt` set by server (BR-SES-06), no client input needed.
 */
export function SessionNotesDialog({ session, open, onOpenChange }: SessionNotesDialogProps) {
  const queryClient = useQueryClient();
  const { activeRole } = usePermissions();
  const isAdmin = activeRole === ADMIN_ROLE;

  const [notes, setNotes] = useState("");
  const [target, setTarget] = useState<TargetStatus>("KEEP");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  const sessionId = session?.id;
  const currentStatus = session?.status ?? "SCHEDULED";
  const canTransition = currentStatus === "SCHEDULED";

  useEffect(() => {
    if (!open) return;
    setNotes(session?.notes ?? "");
    setTarget("KEEP");
    setReason("");
    setError(null);
    // Each dialog open is a new operation: new key to avoid replaying old results.
    idempotencyKeyRef.current = createIdempotencyKey();
  }, [open, session?.id, session?.notes]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error("Missing session ID.");

      return sessionApi.updateNotes(
        sessionId,
        {
          status: target === "KEEP" ? undefined : target,
          // Empty string = actively clear notes (backend normalizes to null).
          notes: notes.trim(),
          reason: target === "CANCELLED" ? reason.trim() : null,
          version: session?.version ?? null,
        },
        { idempotencyKey: idempotencyKeyRef.current, version: session?.version ?? null }
      );
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      const replayed = result.idempotentReplay ? " (replayed from previous submission)" : "";
      toast.success(
        `Notes saved${result.historyId ? " and status history recorded" : ""}${replayed}.`,
        {
          description: result.updatedAt
            ? `Updated at ${dayjs(result.updatedAt).format("MM/DD/YYYY HH:mm:ss")}${
                result.updatedBy ? ` · updated by #${result.updatedBy}` : ""
              }`
            : undefined,
        }
      );
      onOpenChange(false);
    },
    onError: (mutationError) => {
      const message = getApiErrorMessage(mutationError, "Failed to update session notes.");
      const correlationId = getApiErrorCorrelationId(mutationError);
      setError(correlationId ? `${message} (correlationId: ${correlationId})` : message);
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    const trimmedNotes = notes.trim();
    const originalNotes = (session?.notes ?? "").trim();

    if (trimmedNotes.length > MAX_NOTES_LENGTH) {
      setError(`Notes must not exceed ${MAX_NOTES_LENGTH} characters.`);
      return;
    }

    if (target === "CANCELLED" && !reason.trim()) {
      setError("Please provide a cancellation reason.");
      return;
    }

    if (trimmedNotes === originalNotes && target === "KEEP") {
      setError("No changes to save.");
      return;
    }

    setError(null);
    mutation.mutate();
  };

  const lastUpdate = session?.updatedAt
    ? `Last updated: ${dayjs(session.updatedAt).format("MM/DD/YYYY HH:mm:ss")}${
        session.updatedBy ? ` · updated by #${session.updatedBy}` : ""
      }`
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <NotebookPen className="size-4 text-primary" />
            </span>
            Update Notes
          </DialogTitle>
          <DialogDescription>
            Notes for session "{session?.title || session?.classCode || "—"}". Optionally update
            status; system auto-records updater, timestamp, and immutable history.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`session-notes-${sessionId}`}>Notes</Label>
            {/* Fixed height: long content scrolls inside instead of expanding dialog. */}
            <Textarea
              id={`session-notes-${sessionId}`}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Taught make-up OOP section, class had 15-min break…"
              maxLength={MAX_NOTES_LENGTH}
              disabled={mutation.isPending}
              className="h-36 resize-none overflow-y-auto [field-sizing:fixed]"
            />
            <div className="flex justify-end">
              <p className="text-xs text-muted-foreground">
                {notes.length}/{MAX_NOTES_LENGTH}
              </p>
            </div>
          </div>

          {canTransition && (
            <div className="grid gap-2">
              <Label htmlFor={`session-status-${sessionId}`}>Status After Save</Label>
              <Select
                value={target}
                onValueChange={(value) => {
                  setTarget(value as TargetStatus);
                  if (value !== "CANCELLED") setReason("");
                  if (error) setError(null);
                }}
                disabled={mutation.isPending}
              >
                <SelectTrigger id={`session-status-${sessionId}`} className="w-full">
                  <SelectValue placeholder="Keep current status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KEEP">Keep Current Status</SelectItem>
                  <SelectItem value="COMPLETED">Complete Session</SelectItem>
                  {isAdmin && <SelectItem value="CANCELLED">Cancel Session</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}

          {target === "CANCELLED" && (
            <div className="grid gap-2">
              <Label htmlFor={`session-reason-${sessionId}`}>
                Cancellation Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id={`session-reason-${sessionId}`}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Trainer unavailable, class holiday…"
                maxLength={MAX_REASON_LENGTH}
                rows={3}
                disabled={mutation.isPending}
              />
              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">
                  {reason.length}/{MAX_REASON_LENGTH}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Updater and timestamp are recorded by the system (not sent from client).
              {lastUpdate ? ` ${lastUpdate}.` : ""}
            </span>
          </div>

          <p className="min-h-5 text-xs text-destructive">{error ?? ""}</p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Close
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Notes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
