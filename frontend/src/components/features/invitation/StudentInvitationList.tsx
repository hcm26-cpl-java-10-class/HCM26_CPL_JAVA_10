import { invitationApi } from "@/api";
import type { InvitationDTO } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, KeyRound, Mail, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ExamPasswordDialog } from "@/pages/student/components/ExamPasswordDialog";

const invitationsQueryKey = ["student-invitations"] as const;

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleString() : "Không giới hạn";
}

function getStatus(invitation: InvitationDTO) {
    if (invitation.status === "ACCEPTED") return { label: "Đã chấp nhận", variant: "default" as const };
    if (invitation.status === "PENDING") return { label: "Chờ chấp nhận", variant: "secondary" as const };
    if (invitation.status === "SENT") return { label: "Đã gửi", variant: "secondary" as const };
    if (invitation.status === "EXPIRED") return { label: "Hết hạn", variant: "outline" as const };
    if (invitation.status === "REVOKED") return { label: "Đã thu hồi", variant: "destructive" as const };
    if (invitation.status === "REJECTED") return { label: "Từ chối", variant: "outline" as const };
    if (invitation.status === "COMPLETED") return { label: "Đã hoàn thành", variant: "outline" as const };
    return { label: invitation.status ?? "Không xác định", variant: "outline" as const };
}

/**
 * Trạng thái khoá nút bấm dựa trên:
 *  - status hiện tại của invitation
 *  - expiresAt của lời mời (để phản hồi)
 *  - examStartTime / examEndTime (để vào thi)
 * Trả về { label, reason? } để hiển thị trên button khi bị disable.
 */
type ButtonGate = {
    label: string;
    disabled: boolean;
};

function computeExamWindow(invitation: InvitationDTO, now: number): ButtonGate {
    const start = invitation.examStartTime ? new Date(invitation.examStartTime).getTime() : null;
    const end = invitation.examEndTime ? new Date(invitation.examEndTime).getTime() : null;

    if (start != null && now < start) {
        return { label: "Chưa đến giờ mở", disabled: true };
    }
    if (end != null && now >= end) {
        return { label: "Kỳ thi đã đóng", disabled: true };
    }
    return { label: "Vào thi", disabled: false };
}

export default function StudentInvitationList() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [now] = useState(() => Date.now());

    // Dialog xác nhận sau khi accept / vào thi
    const [passwordPrompt, setPasswordPrompt] = useState<{
        examId: number;
        examTitle: string;
        taking: boolean; // true = đã accept, false = vào thẳng từ ACCEPTED
    } | null>(null);

    const invitationsQuery = useQuery({
        queryKey: invitationsQueryKey,
        queryFn: invitationApi.getMyInvitations,
    });

    const acceptMutation = useMutation({
        mutationFn: invitationApi.accept,
        onSuccess: (updated: InvitationDTO) => {
            queryClient.setQueryData<InvitationDTO[]>(invitationsQueryKey, (current) =>
                current?.map((invitation) => (invitation.id === updated.id ? updated : invitation)),
            );
            toast.success("Đã chấp nhận lời mời.");

            // Sau accept: nếu đề có mật khẩu -> mở dialog; không thì vào thi thẳng.
            if (updated.examHasPassword) {
                setPasswordPrompt({
                    examId: updated.examId,
                    examTitle: updated.examTitle ?? "",
                    taking: true,
                });
            } else {
                navigate(`/student/exams/${updated.examId}/take`);
            }
        },
        onError: () =>
            toast.error("Không thể chấp nhận lời mời. Hãy tải lại để kiểm tra trạng thái."),
    });

    const invitations = invitationsQuery.data ?? [];
    const sortedInvitations = useMemo(
        () =>
            [...invitations].sort((a, b) => {
                // Ưu tiên: lời mời đang chờ phản hồi lên đầu
                const rank = (status?: InvitationDTO["status"]) => {
                    if (status === "PENDING" || status === "SENT") return 0;
                    if (status === "ACCEPTED") return 1;
                    return 2;
                };
                const byRank = rank(a.status) - rank(b.status);
                if (byRank !== 0) return byRank;
                // Sau đó sắp xếp theo hạn phản hồi tăng dần
                return new Date(a.expiresAt ?? 0).getTime() - new Date(b.expiresAt ?? 0).getTime();
            }),
        [invitations],
    );

    const goTakeExam = (examId: number, examTitle: string | undefined, hasPassword?: boolean) => {
        if (hasPassword) {
            setPasswordPrompt({
                examId,
                examTitle: examTitle ?? "",
                taking: true,
            });
        } else {
            navigate(`/student/exams/${examId}/take`);
        }
    };

    return (
        <MainLayout pathName={{ invitations: "Lời mời thi" }}>
            <section className="mx-auto w-full max-w-5xl space-y-6">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-cyan-700">
                            <Mail className="size-5" />
                            <span className="text-sm font-medium">Khu vực sinh viên</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Lời mời thi
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            Chấp nhận lời mời để có thể vào thi. Sau khi chấp nhận, bạn có thể vào thi
                            ngay hoặc quay lại danh sách này bất cứ lúc nào.
                        </p>
                    </div>
                    {invitationsQuery.isError && (
                        <Button
                            variant="outline"
                            onClick={() => void invitationsQuery.refetch()}
                        >
                            <RefreshCw className="size-4" /> Tải lại
                        </Button>
                    )}
                </header>

                {invitationsQuery.isError && (
                    <div
                        role="alert"
                        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                    >
                        Không thể tải lời mời thi.
                    </div>
                )}

                {invitationsQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Đang tải lời mời...</p>
                ) : sortedInvitations.length === 0 ? (
                    <Card className="border-dashed text-center">
                        <CardContent className="space-y-2 py-10">
                            <Mail className="mx-auto size-8 text-slate-400" />
                            <CardTitle>Chưa có lời mời thi</CardTitle>
                            <CardDescription>
                                Lời mời mới sẽ xuất hiện tại đây khi giáo viên tạo.
                            </CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {sortedInvitations.map((invitation) => {
                            const status = getStatus(invitation);
                            const invitationExpired =
                                invitation.expiresAt != null &&
                                new Date(invitation.expiresAt).getTime() <= now;
                            const isPending = invitation.status === "PENDING" || invitation.status === "SENT";
                            const canAccept = isPending && !invitationExpired;
                            const canTake = invitation.status === "ACCEPTED";
                            const windowGate = computeExamWindow(invitation, now);

                            return (
                                <article
                                    key={invitation.id}
                                    className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm"
                                >
                                    <header className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-semibold text-slate-900">
                                                {invitation.examTitle}
                                            </h2>
                                            <Badge variant={invitationExpired ? "outline" : status.variant}>
                                                {invitationExpired ? "Lời mời hết hạn" : status.label}
                                            </Badge>
                                            {invitation.examHasPassword && (
                                                <Badge variant="outline" className="gap-1">
                                                    <KeyRound className="size-3" /> Có mật khẩu
                                                </Badge>
                                            )}
                                        </div>
                                        {invitation.expiresAt && (
                                            <p className="text-xs text-muted-foreground">
                                                Hạn phản hồi lời mời: {formatDate(invitation.expiresAt)}
                                            </p>
                                        )}
                                    </header>

                                    <dl className="grid grid-cols-2 gap-y-2 text-xs text-slate-600">
                                        <dt className="flex items-center gap-1">
                                            <Clock3 className="size-3" /> Thời lượng
                                        </dt>
                                        <dd>
                                            {invitation.examDurationMinutes
                                                ? `${invitation.examDurationMinutes} phút`
                                                : "—"}
                                        </dd>

                                        <dt>Mở lúc</dt>
                                        <dd>{formatDate(invitation.examStartTime ?? null)}</dd>

                                        <dt>Đóng lúc</dt>
                                        <dd>{formatDate(invitation.examEndTime ?? null)}</dd>

                                        <dt>Số lượt tối đa</dt>
                                        <dd>{invitation.examMaxAttempts ?? "—"}</dd>
                                    </dl>

                                    {invitation.note && (
                                        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                            {invitation.note}
                                        </p>
                                    )}

                                    <footer className="mt-auto flex flex-wrap gap-2">
                                        {canAccept ? (
                                            <Button
                                                onClick={() => acceptMutation.mutate(invitation.id!)}
                                                disabled={acceptMutation.isPending}
                                            >
                                                <Check className="size-4" /> Chấp nhận
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
                                                title={windowGate.disabled ? windowGate.label : undefined}
                                            >
                                                {windowGate.label}
                                            </Button>
                                        ) : null}
                                        {/* Theo plan, chưa nối UI nút "Từ chối".
                                            Endpoint server đã sẵn. */}
                                        {!canAccept && !canTake && (
                                            <span className="text-xs text-muted-foreground">
                                                Không có hành động khả dụng
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
                    sessionStorage.setItem(`exam_pass_${examId}`, password);
                    setPasswordPrompt(null);
                    navigate(`/student/exams/${examId}/take`);
                }}
            />
        </MainLayout>
    );
}
