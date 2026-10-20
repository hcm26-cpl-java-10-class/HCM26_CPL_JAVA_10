import { invitationApi } from '@/api';
import type { InvitationDTO } from '@/types';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Mail, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const invitationsQueryKey = ['student-invitations'] as const;

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleString() : 'Không giới hạn';
}

function getStatus(invitation: InvitationDTO) {
    if (invitation.status === 'ACCEPTED') return { label: 'Đã chấp nhận', variant: 'default' as const };
    if (invitation.status === 'PENDING') return { label: 'Chờ chấp nhận', variant: 'secondary' as const };
    if (invitation.status === 'EXPIRED') return { label: 'Hết hạn', variant: 'outline' as const };
    if (invitation.status === 'REVOKED') return { label: 'Đã thu hồi', variant: 'destructive' as const };
    if (invitation.status === 'REJECTED') return { label: 'Từ chối', variant: 'outline' as const };
    return { label: invitation.status ?? 'Không xác định', variant: 'outline' as const };
}

export default function StudentInvitationsPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [now] = useState(() => Date.now());

    const invitationsQuery = useQuery({
        queryKey: invitationsQueryKey,
        queryFn: invitationApi.getMyInvitations,
    });

    const acceptMutation = useMutation({
        mutationFn: invitationApi.accept,
        onSuccess: (updated: InvitationDTO) => {
            queryClient.setQueryData<InvitationDTO[]>(invitationsQueryKey, (current) =>
                current?.map((invitation) => invitation.id === updated.id ? updated : invitation),
            );
            toast.success('Đã chấp nhận lời mời.');
        },
        onError: () => toast.error('Không thể chấp nhận lời mời. Hãy tải lại để kiểm tra trạng thái.'),
    });

    const invitations = invitationsQuery.data ?? [];

    return (
        <MainLayout pathName={{ invitations: 'Lời mời thi' }}>
            <section className="mx-auto w-full max-w-5xl space-y-6">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-cyan-700">
                            <Mail className="size-5" />
                            <span className="text-sm font-medium">Khu vực sinh viên</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lời mời thi</h1>
                    </div>
                    <div className="flex gap-2">
                        {invitationsQuery.isError && (
                            <Button variant="outline" onClick={() => void invitationsQuery.refetch()}>
                                <RefreshCw className="size-4" /> Tải lại
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => navigate('/student/exams')}>
                            <CalendarDays className="size-4" /> Lịch thi
                        </Button>
                    </div>
                </header>

                {invitationsQuery.isError && (
                    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        Không thể tải lời mời thi.
                    </div>
                )}

                {invitationsQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Đang tải lời mời...</p>
                ) : invitations.length === 0 ? (
                    <Card className="border-dashed text-center">
                        <CardContent className="space-y-2 py-10">
                            <Mail className="mx-auto size-8 text-slate-400" />
                            <CardTitle>Chưa có lời mời thi</CardTitle>
                            <CardDescription>Lời mời mới sẽ xuất hiện tại đây.</CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="divide-y rounded-md border bg-background">
                        {invitations.map((invitation) => {
                            const status = getStatus(invitation);
                            const expired = invitation.expiresAt != null
                                && new Date(invitation.expiresAt).getTime() <= now;
                            const canAccept = invitation.status === 'PENDING' && !expired;
                            return (
                                <article key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-semibold text-slate-900">{invitation.examTitle}</h2>
                                            <Badge variant={expired ? 'outline' : status.variant}>
                                                {expired ? 'Lời mời hết hạn' : status.label}
                                            </Badge>
                                        </div>
                                        {invitation.expiresAt && (
                                            <p className="text-xs text-muted-foreground">Hạn phản hồi: {formatDate(invitation.expiresAt)}</p>
                                        )}
                                        {invitation.note && <p className="text-sm text-slate-600">{invitation.note}</p>}
                                    </div>
                                    {canAccept ? (
                                        <Button
                                            onClick={() => acceptMutation.mutate(invitation.id!)}
                                            disabled={acceptMutation.isPending}
                                        >
                                            <Check className="size-4" /> Chấp nhận
                                        </Button>
                                    ) : invitation.status === 'ACCEPTED' ? (
                                        <Button variant="outline" onClick={() => navigate('/student/exams')}>
                                            Mở lịch thi
                                        </Button>
                                    ) : null}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </MainLayout>
    );
}