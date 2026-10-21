import { sessionApi } from "@/api";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import type { SessionDTO } from "@/types";
import { getApiErrorMessage } from "@/utils/api-error.utils";
import { ADMIN_ROLE } from "@/utils/rbac.utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  History,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SessionHistoryDialog } from "./SessionHistoryDialog";
import { SessionNotesDialog } from "./SessionNotesDialog";

const MAX_CANCEL_REASON_LENGTH = 500;
const SESSION_QUERY_KEY = ["session"] as const;

interface SessionRowActionsProps {
  session: SessionDTO;
}

/**
 * Extra row actions for the /sessions page (F15 / T2):
 * - POST   /api/v1/sessions/{id}/complete  (SCHEDULED -> COMPLETED)
 * - POST   /api/v1/sessions/{id}/cancel    (Class Admin only, reason required)
 * - PATCH  /api/v1/sessions/{id}/notes     (notes + optional transition + audit/history)
 * - GET    /api/v1/sessions/{id}/history   (immutable status history)
 * - GET    /api/v1/audit-logs              (Admin only — merged into the History dialog)
 */
export function SessionRowActions({ session }: SessionRowActionsProps) {
  const queryClient = useQueryClient();
  const { activeRole } = usePermissions();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const sessionId = session.id;
  const status = session.status ?? "SCHEDULED";
  const canComplete = status === "SCHEDULED";
  const canCancel = status === "SCHEDULED" && activeRole === ADMIN_ROLE;

  const invalidateSessions = () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

  const completeMutation = useMutation({
    mutationFn: () => sessionApi.complete(sessionId as number, { version: session.version }),
    onSuccess: async (updated) => {
      await invalidateSessions();
      toast.success(`Status updated: ${updated.status ?? "—"}.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to update session status."));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      sessionApi.cancel(sessionId as number, {
        cancelReason: reason,
        version: session.version,
      }),
    onSuccess: async () => {
      await invalidateSessions();
      toast.success("Session cancelled.");
      setCancelOpen(false);
      setCancelReason("");
      setCancelError(null);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Failed to cancel session.");
      setCancelError(message);
      toast.error(message);
    },
  });

  const handleConfirmCancel = () => {
    const reason = cancelReason.trim();

    if (!reason) {
      setCancelError("Please provide a cancellation reason.");
      return;
    }

    if (reason.length > MAX_CANCEL_REASON_LENGTH) {
      setCancelError(`Cancellation reason must not exceed ${MAX_CANCEL_REASON_LENGTH} characters.`);
      return;
    }

    setCancelError(null);
    cancelMutation.mutate(reason);
  };

  const openCancelDialog = () => {
    setCancelError(null);
    setCancelReason("");
    setCancelOpen(true);
  };

  const isBusy = completeMutation.isPending || cancelMutation.isPending;

  return (
    <PermissionGate permission="SESSION_UPDATE">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!sessionId || isBusy}
          >
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <MoreHorizontal className="size-3.5 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Session Status
          </DropdownMenuLabel>

          {canComplete && (
            <DropdownMenuItem
              onSelect={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              <CheckCircle2 className="mr-2 size-4 text-emerald-600" />
              Mark Complete
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onSelect={() => setNotesOpen(true)}>
            <NotebookPen className="mr-2 size-4 text-primary" />
            Update Notes…
          </DropdownMenuItem>

          {status === "COMPLETED" && (
            <DropdownMenuLabel className="max-w-56 whitespace-normal text-xs font-normal text-muted-foreground">
              Completed
            </DropdownMenuLabel>
          )}

          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={openCancelDialog}
                className="text-red-600 focus:text-red-600"
              >
                <XCircle className="mr-2 size-4" />
                Cancel Session…
              </DropdownMenuItem>
            </>
          )}

          {status === "CANCELLED" && (
            <DropdownMenuLabel className="max-w-56 whitespace-normal text-xs font-normal text-muted-foreground">
              Cancelled
              {session.cancelReason ? ` — ${session.cancelReason}` : "."}
            </DropdownMenuLabel>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
            <History className="mr-2 size-4 text-muted-foreground" />
            History
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SessionNotesDialog session={session} open={notesOpen} onOpenChange={setNotesOpen} />
      <SessionHistoryDialog session={session} open={historyOpen} onOpenChange={setHistoryOpen} />

      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          if (cancelMutation.isPending) return;
          setCancelOpen(open);
          if (!open) {
            setCancelError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="size-4 text-red-600" />
              </span>
              Cancel Session
            </DialogTitle>
            <DialogDescription>
              Session "{session.title || session.classCode}" will be moved to
              <span className="font-medium text-destructive">Cancelled</span>. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`cancel-reason-${sessionId}`}>
              Cancellation Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`cancel-reason-${sessionId}`}
              value={cancelReason}
              onChange={(event) => {
                setCancelReason(event.target.value);
                if (cancelError) setCancelError(null);
              }}
              placeholder="e.g. Trainer unavailable, class holiday…"
              maxLength={MAX_CANCEL_REASON_LENGTH}
              rows={4}
              disabled={cancelMutation.isPending}
              aria-invalid={!!cancelError}
            />
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-destructive">{cancelError ?? ""}</p>
              <p className="shrink-0 text-xs text-muted-foreground">
                {cancelReason.length}/{MAX_CANCEL_REASON_LENGTH}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelMutation.isPending}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 size-4" />
                  Confirm Cancel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
