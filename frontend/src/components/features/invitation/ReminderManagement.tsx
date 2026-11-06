import { invitationApi } from "@/api";
import type { InvitationDTO, ReminderDTO, ReminderStatus, ReminderType } from "@/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarClock, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const REMINDER_TYPE_LABEL: Record<ReminderType, string> = {
  ONE_HOUR: "1 hour before",
  ONE_DAY: "1 day before",
  CUSTOM: "Custom",
};

const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const REMINDER_STATUS_VARIANT: Record<ReminderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  SENT: "default",
  FAILED: "destructive",
  CANCELLED: "outline",
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || fallback;
};

interface ReminderManagementProps {
  examId: number;
  invitations: InvitationDTO[];
}

export function ReminderManagement({ examId, invitations }: ReminderManagementProps) {
  const queryClient = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reminderType, setReminderType] = useState<ReminderType>("ONE_HOUR");
  const [scheduledAt, setScheduledAt] = useState("");
  const [targetInvitationId, setTargetInvitationId] = useState("ALL");

  const remindersQuery = useQuery({
    queryKey: ["exam-reminders", examId],
    queryFn: () => invitationApi.getReminders(examId),
    enabled: Number.isFinite(examId) && examId > 0,
    retry: false,
  });

  const scheduleMutation = useMutation({
    mutationFn: () => invitationApi.scheduleReminder(examId, {
      reminderType,
      scheduledAt: reminderType === "CUSTOM" ? new Date(scheduledAt).toISOString() : undefined,
      invitationId: targetInvitationId === "ALL" ? undefined : Number(targetInvitationId),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-reminders", examId] });
      toast.success("Reminder scheduled.");
      setScheduleOpen(false);
      setScheduledAt("");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to schedule reminder.")),
  });

  const cancelMutation = useMutation({
    mutationFn: (reminderId: number) => invitationApi.cancelReminder(reminderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-reminders", examId] });
      toast.success("Reminder cancelled.");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to cancel reminder.")),
  });

  const reminders = remindersQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BellRing className="size-4" />
            Reminders
          </h2>
          <p className="text-sm text-muted-foreground">
            {reminders.length} reminder(s) scheduled for this exam.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={targetInvitationId} onValueChange={setTargetInvitationId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Target invitation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All invitations of this exam</SelectItem>
              {invitations
                .filter((invitation) => invitation.id && invitation.status !== "REVOKED")
                .map((invitation) => (
                  <SelectItem key={invitation.id} value={String(invitation.id)}>
                    {invitation.anonymous
                      ? invitation.guestName ?? invitation.guestEmail ?? "Guest"
                      : invitation.userFullName ?? invitation.userEmail ?? `Invitation #${invitation.id}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setScheduleOpen(true)} disabled={scheduleMutation.isPending}>
            <CalendarClock className="size-4" />
            Schedule Reminder
          </Button>
          {remindersQuery.isFetching && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <RefreshCw className="size-3.5 animate-spin" />
              Loading...
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Scheduled At</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-24">Attempts</TableHead>
              <TableHead>Last Error</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remindersQuery.isLoading && (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading reminders...</TableCell></TableRow>
            )}
            {remindersQuery.isError && (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-destructive">Failed to load reminders list.</TableCell></TableRow>
            )}
            {!remindersQuery.isLoading && !remindersQuery.isError && reminders.length === 0 && (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No reminders scheduled yet.</TableCell></TableRow>
            )}
            {reminders.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                onCancel={(id) => cancelMutation.mutate(id)}
                cancelling={cancelMutation.isPending}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Reminder</DialogTitle>
            <DialogDescription>
              Schedule an email reminder for {targetInvitationId === "ALL" ? "all remindable invitations" : "the selected invitation"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reminder type</Label>
              <RadioGroup
                value={reminderType}
                onValueChange={(value) => setReminderType(value as ReminderType)}
                className="flex flex-wrap gap-3"
              >
                {(Object.keys(REMINDER_TYPE_LABEL) as ReminderType[]).map((type) => (
                  <Label key={type} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-muted/50">
                    <RadioGroupItem value={type} />
                    {REMINDER_TYPE_LABEL[type]}
                  </Label>
                ))}
              </RadioGroup>
            </div>
            {reminderType === "CUSTOM" && (
              <div className="space-y-2">
                <Label htmlFor="reminder-scheduled-at">Scheduled at</Label>
                <Input
                  id="reminder-scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button
              disabled={scheduleMutation.isPending || (reminderType === "CUSTOM" && !scheduledAt)}
              onClick={() => scheduleMutation.mutate()}
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ReminderRowProps {
  reminder: ReminderDTO;
  onCancel: (id: number) => void;
  cancelling: boolean;
}

function ReminderRow({ reminder, onCancel, cancelling }: ReminderRowProps) {
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-1.5 text-sm">
          <CalendarClock className="size-3.5" />
          {REMINDER_TYPE_LABEL[reminder.reminderType] ?? reminder.reminderType}
        </span>
      </TableCell>
      <TableCell className="text-sm">{new Date(reminder.scheduledAt).toLocaleString()}</TableCell>
      <TableCell className="text-sm">{reminder.userFullName ?? reminder.userEmail ?? "-"}</TableCell>
      <TableCell>
        {reminder.status && (
          <Badge variant={REMINDER_STATUS_VARIANT[reminder.status]}>
            {REMINDER_STATUS_LABEL[reminder.status]}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm">{reminder.sendAttempts ?? 0}</TableCell>
      <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
        {reminder.lastError ? <span title={reminder.lastError}>{reminder.lastError}</span> : "-"}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Cancel reminder"
          disabled={reminder.status !== "PENDING" || cancelling || reminder.id == null}
          onClick={() => reminder.id != null && onCancel(reminder.id)}
        >
          <XCircle className="size-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}