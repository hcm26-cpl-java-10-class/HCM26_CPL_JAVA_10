import { sessionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole } from "@/utils/rbac.utils";
import axios from "axios";
import dayjs from "dayjs";
import { ArrowLeft, ClipboardList, ExternalLink, Loader2, Pen, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AttendanceSheetDialog } from "../components/AttendanceSheetDialog";
import { SessionDeleteDialog } from "../components/SessionDeleteDialog";

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  );
}

function formatDate(value?: string) {
  return value && dayjs(value).isValid() ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—";
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeRole, hasPermission } = usePermissions();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const validId = !!id && /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
  const sessionQuery = useQuery({
    queryKey: ["session", "detail", id],
    queryFn: () => sessionApi.getById(id!),
    enabled: validId,
    retry: false,
  });
  const session = sessionQuery.data;
  const canManageDraft =
    !sessionQuery.isError &&
    session?.calendarVersionStatus === "DRAFT" &&
    session.status === "SCHEDULED" &&
    normalizeRole(activeRole) === "ADMIN";
  const errorStatus = axios.isAxiosError(sessionQuery.error)
    ? sessionQuery.error.response?.status
    : undefined;
  let errorMessage = "Failed to load session details. Please try again.";
  if (!validId) errorMessage = "Invalid session ID.";
  else if (errorStatus === 404) errorMessage = "Session not found or has been deleted.";
  else if (errorStatus === 403) errorMessage = "You do not have permission to view this session.";
  const meetingLink = session?.meetingLink?.trim();
  const canOpenMeetingLink = !!meetingLink && /^https?:\/\//i.test(meetingLink);

  return (
    <MainLayout pathName={{ sessions: "Class Schedule", [id || "detail"]: "Session Details" }}>
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="break-words">{session?.title || "Session Details"}</CardTitle>
              <CardDescription className="mt-2">
                {session
                  ? `Session #${session.id} details`
                  : "Session schedule information and status."}
              </CardDescription>
            </div>
            {session && (
              <Badge
                variant={
                  session.status === "CANCELLED"
                    ? "destructive"
                    : session.status === "COMPLETED"
                      ? "default"
                      : "secondary"
                }
              >
                {session.status === "COMPLETED"
                  ? "Completed"
                  : session.status === "CANCELLED"
                    ? "Cancelled"
                    : "Scheduled"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {validId && sessionQuery.isPending ? (
            <div
              role="status"
              className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Loading session details...
            </div>
          ) : !validId || sessionQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                <p>{errorMessage}</p>
                {validId && errorStatus !== 403 && errorStatus !== 404 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      void sessionQuery.refetch();
                    }}
                  >
                    Try Again
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ) : session ? (
            <div className="space-y-6 text-sm">
              <dl className="grid gap-5 sm:grid-cols-2">
                <DetailField label="Class">{session.classCode || "—"}</DetailField>
                <DetailField label="Calendar Version">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {session.calendarVersionNumber != null
                      ? `v${session.calendarVersionNumber}`
                      : session.calendarVersionId != null
                        ? `#${session.calendarVersionId}`
                        : "—"}
                    {session.calendarVersionStatus && (
                      <Badge variant="outline">{session.calendarVersionStatus}</Badge>
                    )}
                  </span>
                </DetailField>
                <DetailField label="Topic">{session.topicName || "—"}</DetailField>
                <DetailField label="Trainer">{session.trainerName || "—"}</DetailField>
                <DetailField label="Start Time">{formatDate(session.startTime)}</DetailField>
                <DetailField label="End Time">{formatDate(session.endTime)}</DetailField>
                <DetailField label="Room">{session.room || "—"}</DetailField>
                <DetailField label="Online Meeting Link">
                  {canOpenMeetingLink ? (
                    <a
                      href={meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-start gap-1.5 text-primary underline underline-offset-4"
                    >
                      <span className="break-all">{meetingLink}</span>
                      <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                    </a>
                  ) : (
                    meetingLink || "—"
                  )}
                </DetailField>
              </dl>
              <div className="space-y-4 border-t pt-5">
                <div>
                  <h3 className="mb-2 font-medium">Notes</h3>
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">
                    {session.notes || "No notes."}
                  </p>
                </div>
                {session.cancelReason && (
                  <div>
                    <h3 className="mb-2 font-medium">Cancellation Reason</h3>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                      {session.cancelReason}
                    </p>
                  </div>
                )}
                {session.isOverridden && (
                  <div>
                    <h3 className="mb-2 font-medium">Override Reason</h3>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                      {session.overrideReason || "—"}
                    </p>
                  </div>
                )}
              </div>
              <dl className="grid gap-5 border-t pt-5 sm:grid-cols-2">
                <DetailField label="Created At">{formatDate(session.createdAt)}</DetailField>
                <DetailField label="Created By">
                  {session.createdBy != null ? `#${session.createdBy}` : "—"}
                </DetailField>
                <DetailField label="Last Updated">{formatDate(session.updatedAt)}</DetailField>
                <DetailField label="Updated By">
                  {session.updatedBy != null ? `#${session.updatedBy}` : "—"}
                </DetailField>
              </dl>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/sessions")}>
              <ArrowLeft className="size-4" />
              Quay lại danh sách
            </Button>
            {session && hasPermission("ATTENDANCE_READ") && (
              <Button type="button" variant="outline" onClick={() => setAttendanceOpen(true)}>
                <ClipboardList className="size-4" />
                Attendance
              </Button>
            )}
          </div>
          {canManageDraft && (
            <div className="flex flex-wrap gap-2">
              {hasPermission("SESSION_UPDATE") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/sessions/" + id + "/edit")}
                >
                  <Pen className="size-4" />
                  Edit
                </Button>
              )}
              {hasPermission("SESSION_DELETE") && (
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-4" />
                  Delete Session
                </Button>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
      {deleteOpen && session && (
        <SessionDeleteDialog
          session={session}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            navigate("/sessions", { replace: true });
          }}
        />
      )}
      <AttendanceSheetDialog
        session={session ?? null}
        open={attendanceOpen}
        onOpenChange={setAttendanceOpen}
      />
    </MainLayout>
  );
}
