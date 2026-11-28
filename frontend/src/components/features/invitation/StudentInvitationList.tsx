
import { invitationApi } from "@/api";
import type { InvitationDTO } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardTitle,
} from "@/components/ui/card";
import { studentInvitationsQueryKey } from "@/hooks/usePendingInvitations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Check,
    Clock3,
    KeyRound,
    Mail,
    RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ExamPasswordDialog } from "@/pages/student/components/ExamPasswordDialog";

function formatDate(value?: string | null) {
    return value
        ? new Date(value).toLocaleString()
        : "No limit";
}

function getStatus(invitation: InvitationDTO) {
    if (invitation.status === "ACCEPTED")
        return { label: "Accepted", variant: "default" as const };
    if (invitation.status === "PENDING")
        return { label: "Pending", variant: "secondary" as const };
    if (invitation.status === "SENT")
        return { label: "Sent", variant: "secondary" as const };
    if (invitation.status === "EXPIRED")
        return { label: "Expired", variant: "outline" as const };
    if (invitation.status === "REVOKED")
        return { label: "Revoked", variant: "destructive" as const };
    if (invitation.status === "REJECTED")
        return { label: "Rejected", variant: "outline" as const };
    if (invitation.status === "COMPLETED")
        return { label: "Completed", variant: "outline" as const };

    return {
        label: invitation.status ?? "Unknown",
        variant: "outline" as const,
    };
}

type ButtonGate = {
    label: string;
    disabled: boolean;
    waiting: boolean;
    closed: boolean;
    remainingMs: number;
};

function computeExamWindow(
    invitation: InvitationDTO,
    now: number,
): ButtonGate {
    const start = invitation.availableFrom
        ? new Date(invitation.availableFrom).getTime()
        : null;
    const end = invitation.expiresAt
        ? new Date(invitation.expiresAt).getTime()
        : null;

    if (start != null && now < start) {
        return {
            label: "Not yet available",
            disabled: true,
            waiting: true,
            closed: false,
            remainingMs: start - now,
        };
    }

    if (end != null && now >= end) {
        return {
            label: "Exam session closed",
            disabled: true,
            waiting: false,
            closed: true,
            remainingMs: 0,
        };
    }

    return {
        label: "Take Exam",
        disabled: false,
        waiting: false,
        closed: false,
        remainingMs: 0,
    };
}

function formatRemaining(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (days > 0)
        return `${days} days ${hours} hours ${minutes} minutes`;

    if (hours > 0)
        return `${hours} hours ${minutes} minutes ${seconds} seconds`;

    return `${minutes} minutes ${seconds} seconds`;
}

export default function StudentInvitationList() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(
            () => setNow(Date.now()),
            1000,
        );

        return () => window.clearInterval(timer);
    }, []);

    const [passwordPrompt, setPasswordPrompt] = useState<{
        examId: number;
        examTitle: string;
        taking: boolean;
    } | null>(null);

    const invitationsQuery = useQuery({
        queryKey: studentInvitationsQueryKey,
        queryFn: invitationApi.getMyInvitations,
    });

    const acceptMutation = useMutation({
        mutationFn: invitationApi.accept,
        onSuccess: (updated: InvitationDTO) => {
            queryClient.setQueryData<InvitationDTO[]>(
                studentInvitationsQueryKey,
                (current) =>
                    current?.map((invitation) =>
                        invitation.id === updated.id
                            ? updated
                            : invitation,
                    ),
            );

            const gate = computeExamWindow(updated, Date.now());

            if (gate.disabled) {
                setNow(Date.now());

                toast.success(
                    gate.closed
                        ? "Invitation accepted, but the exam session has already closed."
                        : `Invitation accepted. The exam opens at ${formatDate(updated.availableFrom ?? null)}.`,
                );

                return;
            }

            toast.success("Invitation accepted.");

            if (updated.examHasPassword) {
                setPasswordPrompt({
                    examId: updated.examId,
                    examTitle: updated.examTitle ?? "",
                    taking: true,
                });
            } else {
                navigate(
                    `/student/exams/${updated.examId}/prepare`,
                    {
                        state: { returnTo: "/invitations" },
                    },
                );
            }
        },
        onError: () =>
            toast.error(
                "Unable to accept the invitation. Please reload the page to check its status.",
            ),
    });

    const invitations = useMemo(
        () => invitationsQuery.data ?? [],
        [invitationsQuery.data],
    );

    const sortedInvitations = useMemo(
        () =>
            [...invitations].sort((a, b) => {
                const dateA = new Date(a.createdAt ?? a.availableFrom ?? 0).getTime();
                const dateB = new Date(b.createdAt ?? b.availableFrom ?? 0).getTime();

                return dateB - dateA;
            }),
        [invitations],
    );

    const goTakeExam = (
        examId: number,
        examTitle: string | undefined,
        hasPassword?: boolean,
    ) => {
        if (hasPassword) {
            setPasswordPrompt({
                examId,
                examTitle: examTitle ?? "",
                taking: true,
            });
        } else {
            navigate(`/student/exams/${examId}/prepare`, {
                state: { returnTo: "/invitations" },
            });
        }
    };

    return (
        <MainLayout pathName={{ invitations: "Exam Invitations" }}>
            <section className="w-full max-w-none space-y-6">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4 text-left">
                    <div className="text-left">
                        <div className="mb-2 flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                            <Mail className="size-5" />
                            <span className="text-sm font-medium">
                                Student Portal
                            </span>
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Exam Invitations
                        </h1>

                        <p className="mt-2 text-sm text-muted-foreground">
                            Accept an invitation to access your exam.
                            Once accepted, you can start the exam
                            immediately or return to this page later.
                        </p>
                    </div>

                    {invitationsQuery.isError && (
                        <Button
                            variant="outline"
                            onClick={() =>
                                void invitationsQuery.refetch()
                            }
                        >
                            <RefreshCw className="size-4" />
                            Refresh
                        </Button>
                    )}
                </header>

                {invitationsQuery.isError && (
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
                    >
                        Unable to load exam invitations.
                    </div>
                )}

                {invitationsQuery.isLoading ? (
                    <p className="py-8 text-left text-sm text-muted-foreground">
                        Loading invitations...
                    </p>
                ) : sortedInvitations.length === 0 ? (
                    <Card className="border-dashed text-left">
                        <CardContent className="space-y-2 py-10">
                            <Mail className="size-8 text-muted-foreground" />

                            <CardTitle className="text-foreground">
                                No Exam Invitations
                            </CardTitle>

                            <CardDescription>
                                New invitations will appear here when
                                your teacher creates them.
                            </CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {sortedInvitations.map((invitation) => {
                            const status = getStatus(invitation);

                            const invitationExpired =
                                invitation.expiresAt != null &&
                                new Date(invitation.expiresAt).getTime() <= now;

                            const isPending =
                                invitation.status === "PENDING" ||
                                invitation.status === "SENT";

                            const canAccept =
                                isPending && !invitationExpired;

                            const canTake =
                                invitation.status === "ACCEPTED";

                            const windowGate =
                                computeExamWindow(invitation, now);

                            return (
                                <article
                                    key={invitation.id}
                                    className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm"
                                >
                                    <header className="space-y-1 text-left">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-semibold text-foreground">
                                                {invitation.examTitle}
                                            </h2>

                                            <Badge
                                                variant={
                                                    invitationExpired
                                                        ? "outline"
                                                        : status.variant
                                                }
                                            >
                                                {invitationExpired
                                                    ? "Invitation Expired"
                                                    : status.label}
                                            </Badge>

                                            {invitation.examHasPassword && (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1"
                                                >
                                                    <KeyRound className="size-3" />
                                                    Password Required
                                                </Badge>
                                            )}
                                        </div>

                                        {invitation.availableFrom ? (
                                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                                🎯 Exam Session:{" "}
                                                {formatDate(invitation.availableFrom)}
                                                {" – "}
                                                {formatDate(invitation.expiresAt)}
                                            </p>
                                        ) : invitation.expiresAt ? (
                                            <p className="text-xs text-muted-foreground">
                                                ⏱ Deadline:{" "}
                                                {formatDate(invitation.expiresAt)}
                                            </p>
                                        ) : null}
                                    </header>

                                    <dl className="grid grid-cols-2 gap-y-2 text-xs text-muted-foreground">
                                        <dt className="flex items-center gap-1">
                                            <Clock3 className="size-3" />
                                            Duration
                                        </dt>

                                        <dd className="text-foreground">
                                            {invitation.examDurationMinutes
                                                ? `${invitation.examDurationMinutes} minutes`
                                                : "—"}
                                        </dd>

                                        <dt>Opens At</dt>
                                        <dd className="text-foreground">
                                            {formatDate(invitation.availableFrom ?? null)}
                                        </dd>

                                        <dt>Closes At</dt>
                                        <dd className="text-foreground">
                                            {formatDate(invitation.expiresAt ?? null)}
                                        </dd>

                                        <dt>Maximum Attempts</dt>
                                        <dd className="text-foreground">
                                            {invitation.examMaxAttempts ?? "—"}
                                        </dd>
                                    </dl>

                                    {invitation.note && (
                                        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                                            {invitation.note}
                                        </p>
                                    )}

                                    {canTake && windowGate.waiting && (
                                        <div
                                            aria-live="polite"
                                            className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
                                        >
                                            <p className="font-medium">
                                                Exam opens in{" "}
                                                <span className="font-mono tabular-nums">
                                                    {formatRemaining(windowGate.remainingMs)}
                                                </span>
                                            </p>

                                            <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-300/90">
                                                {invitation.examHasPassword
                                                    ? "The Take Exam button will become available automatically. You will then need to enter the exam password."
                                                    : "The Take Exam button will become available automatically when the exam opens. You do not need to refresh the page."}
                                            </p>
                                        </div>
                                    )}

                                    <footer className="mt-auto flex flex-wrap gap-2">
                                        {canAccept ? (
                                            <Button
                                                onClick={() =>
                                                    acceptMutation.mutate(invitation.id!)
                                                }
                                                disabled={acceptMutation.isPending}
                                            >
                                                <Check className="size-4" />
                                                Accept Invitation
                                            </Button>
                                        ) : canTake ? (
                                            <Button
                                                onClick={() =>
                                                    goTakeExam(
                                                        invitation.examId,
                                                        invitation.examTitle,
                                                        invitation.examHasPassword,
                                                    )
                                                }
                                                disabled={windowGate.disabled}
                                                title={
                                                    windowGate.waiting
                                                        ? `Exam opens in ${formatRemaining(windowGate.remainingMs)}`
                                                        : windowGate.disabled
                                                            ? windowGate.label
                                                            : undefined
                                                }
                                            >
                                                {windowGate.label}
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">
                                                No available actions
                                            </span>
                                        )}
                                    </footer>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <ExamPasswordDialog
                open={passwordPrompt !== null}
                onOpenChange={(open) => {
                    if (!open) setPasswordPrompt(null);
                }}
                examId={passwordPrompt?.examId ?? null}
                examTitle={passwordPrompt?.examTitle ?? ""}
                onSuccess={(examId, password) => {
                    sessionStorage.setItem(
                        `exam_pass_${examId}`,
                        password,
                    );

                    setPasswordPrompt(null);

                    navigate(`/student/exams/${examId}/prepare`, {
                        state: { returnTo: "/invitations" },
                    });
                }}
            />
        </MainLayout>
    );
}
