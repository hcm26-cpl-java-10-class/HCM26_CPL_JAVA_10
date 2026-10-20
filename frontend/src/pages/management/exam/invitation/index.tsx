import { invitationApi } from "@/api";
import type { InvitationDTO, InvitationStatus } from "@/types";
import { CreateInvitationModal } from "@/components/features/invitation/CreateInvitationModal";
import { MainLayout } from "@/components/layout/MainLayout";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ChevronLeft,
    Clock3,
    Copy,
    Mail,
    MoreHorizontal,
    QrCode,
    RefreshCw,
    Send,
    Users,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<InvitationStatus, string> = {
    PENDING: "Chờ",
    SENT: "Đã gửi",
    ACCEPTED: "Đã chấp nhận",
    REJECTED: "Từ chối",
    EXPIRED: "Hết hạn",
    REVOKED: "Thu hồi",
    COMPLETED: "Hoàn tất",
};

const STATUS_VARIANT: Record<InvitationStatus, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING: "secondary",
    SENT: "secondary",
    ACCEPTED: "default",
    REJECTED: "outline",
    EXPIRED: "outline",
    REVOKED: "destructive",
    COMPLETED: "default",
};

export default function InvitationsPage() {
    const { examId } = useParams<{ examId: string }>();
    const numericExamId = Number(examId);

    const isValidExamId = !isNaN(numericExamId) && numericExamId > 0;

    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<InvitationStatus | "ALL">("ALL");
    const [typeFilter, setTypeFilter] = useState<"ALL" | "authenticated" | "anonymous">("ALL");
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState<InvitationDTO | null>(null);
    const [revokeReason, setRevokeReason] = useState("");
    const [qrTarget, setQrTarget] = useState<InvitationDTO | null>(null);
    const [examTitle, setExamTitle] = useState("Kỳ thi");

    const queryKey = ["exam-invitations", numericExamId, statusFilter, typeFilter] as const;

    const invitationsQuery = useQuery({
        queryKey,
        queryFn: () => {
            if (!isValidExamId) throw new Error("Invalid exam ID");
            return invitationApi.getByExam(numericExamId, {
                status: statusFilter === "ALL" ? undefined : statusFilter,
                anonymous: typeFilter === "ALL" ? undefined : typeFilter === "anonymous",
            });
        },
        enabled: isValidExamId,
        retry: false,
    });

    useEffect(() => {
        const loadExamTitle = async () => {
            if (!isValidExamId) return;
            try {
                const { examApi } = await import("@/api");
                const exam = await examApi.getById(String(numericExamId));
                if (exam.title) setExamTitle(exam.title);
            } catch {
                // ignore - will show examId in header instead
            }
        };
        loadExamTitle();
    }, [numericExamId, isValidExamId]);

    const rows = invitationsQuery.data ?? [];
    const total = rows.length;

    const resendMutation = useMutation({
        mutationFn: (id: number) => invitationApi.resend(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
            toast.success("Đã gửi lại email.");
        },
        onError: () => toast.error("Không thể gửi lại."),
    });

    const revokeMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            invitationApi.revoke(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
            toast.success("Đã thu hồi lời mời.");
            setRevokeTarget(null);
            setRevokeReason("");
        },
        onError: () => toast.error("Không thể thu hồi."),
    });

    return (
        <MainLayout pathName={{ exams: "Quản lý đề thi", invitations: "Lời mời" }}>
            <section className="flex flex-col gap-5">
                {/* Header */}
                <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                    <div>
                        <p className="text-sm text-muted-foreground">
                            <ChevronLeft
                                className="mr-1 inline size-3.5 cursor-pointer"
                                onClick={() => window.history.back()}
                            />{" "}
                            Quản lý đề thi
                        </p>
                        <h1 className="mt-1 text-2xl font-semibold">
                            Lời mời thi: <span className="text-primary">{examTitle}</span>
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {total} lời mời
                        </p>
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Mail className="size-4" />
                        Tạo lời mời
                    </Button>
                </header>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); }}
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Trạng thái" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                            {(Object.keys(STATUS_LABEL) as InvitationStatus[]).map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={typeFilter}
                        onValueChange={(v) => { setTypeFilter(v as typeof typeFilter); }}
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Loại" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tất cả</SelectItem>
                            <SelectItem value="authenticated">Có tài khoản</SelectItem>
                            <SelectItem value="anonymous">Không tài khoản</SelectItem>
                        </SelectContent>
                    </Select>

                    {invitationsQuery.isFetching && (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <RefreshCw className="size-3.5 animate-spin" />
                            Đang tải...
                        </span>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Người nhận</TableHead>
                                <TableHead className="w-32">Loại</TableHead>
                                <TableHead className="w-32">Trạng thái</TableHead>
                                <TableHead className="w-44">Mã truy cập</TableHead>
                                <TableHead className="w-40">Ngày gửi</TableHead>
                                <TableHead className="w-24 text-right">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invitationsQuery.isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        Đang tải...
                                    </TableCell>
                                </TableRow>
                            )}
                            {invitationsQuery.isError && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                                        Không tải được danh sách.
                                    </TableCell>
                                </TableRow>
                            )}
                            {!invitationsQuery.isLoading && !invitationsQuery.isError && rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        Chưa có lời mời nào.
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((inv) => (
                                <TableRow key={inv.id}>
                                    <TableCell>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">
                                                {inv.anonymous
                                                    ? inv.guestName ?? "Khách vãng lai"
                                                    : inv.userFullName ?? "—"}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {inv.anonymous ? inv.guestEmail : inv.userEmail}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="gap-1">
                                            {inv.anonymous ? (
                                                <>
                                                    <Users className="size-3" /> Không account
                                                </>
                                            ) : (
                                                <>
                                                    <Mail className="size-3" /> Có account
                                                </>
                                            )}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {inv.status && (
                                            <Badge variant={STATUS_VARIANT[inv.status]}>
                                                {STATUS_LABEL[inv.status]}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {inv.accessCode ? (
                                            <div className="flex items-center gap-1.5">
                                                <code className="text-xs font-mono font-semibold">{inv.accessCode}</code>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    title="Copy"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(inv.accessCode!);
                                                        toast.success("Đã copy!");
                                                    }}
                                                >
                                                    <Copy className="size-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {inv.sentAt ? (
                                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Clock3 className="size-3" />
                                                {new Date(inv.sentAt).toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon-sm">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {!inv.anonymous && (
                                                    <DropdownMenuItem
                                                        onClick={() => resendMutation.mutate(inv.id!)}
                                                        disabled={resendMutation.isPending}
                                                    >
                                                        <Send className="size-3.5" />
                                                        Gửi lại email
                                                    </DropdownMenuItem>
                                                )}
                                                {inv.anonymous && (
                                                    <DropdownMenuItem
                                                        onClick={() => setQrTarget(inv)}
                                                    >
                                                        <QrCode className="size-3.5" />
                                                        Xem QR Code
                                                    </DropdownMenuItem>
                                                )}
                                                {inv.accessCode && (
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(inv.accessCode!);
                                                            toast.success("Đã copy mã!");
                                                        }}
                                                    >
                                                        <Copy className="size-3.5" />
                                                        Copy mã truy cập
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setRevokeTarget(inv)}
                                                    disabled={
                                                        inv.status === "REVOKED" ||
                                                        inv.status === "COMPLETED"
                                                    }
                                                >
                                                    <XCircle className="size-3.5" />
                                                    Thu hồi lời mời
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </section>

            {/* Create Modal */}
            <CreateInvitationModal
                examId={examId}
                examTitle={examTitle}
                open={isCreateOpen}
                onOpenChange={setCreateOpen}
            />

            {/* Revoke Dialog */}
            <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Thu hồi lời mời</DialogTitle>
                        <DialogDescription>
                            Thu hồi lời mời của{" "}
                            <strong>
                                {revokeTarget?.anonymous
                                    ? revokeTarget?.guestName
                                    : revokeTarget?.userFullName}
                            </strong>
                            ?. Người nhận sẽ nhận email thông báo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Lý do (tùy chọn)</label>
                        <Input
                            placeholder="Ví dụ: Thay đổi đề thi..."
                            value={revokeReason}
                            onChange={(e) => setRevokeReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRevokeTarget(null)}>
                            Hủy
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={revokeMutation.isPending}
                            onClick={() => {
                                if (revokeTarget?.id) {
                                    revokeMutation.mutate({
                                        id: revokeTarget.id,
                                        reason: revokeReason || undefined,
                                    });
                                }
                            }}
                        >
                            {revokeMutation.isPending ? "Đang thu hồi..." : "Thu hồi"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* QR Dialog */}
            <Dialog open={!!qrTarget} onOpenChange={(o) => { if (!o) setQrTarget(null); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>QR Code truy cập</DialogTitle>
                        <DialogDescription>
                            Mã: <strong>{qrTarget?.accessCode}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-2">
                        <img
                            src={`${import.meta.env.VITE_API_URL ?? "http://localhost:8080/api"}/invitations/${qrTarget?.id}/qr`}
                            alt="QR Code"
                            className="size-64 rounded-lg border bg-white"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                        <Button
                            variant="outline"
                            onClick={() => qrTarget?.accessCode && navigator.clipboard.writeText(qrTarget.accessCode)}
                        >
                            <Copy className="size-4" />
                            Copy mã truy cập
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQrTarget(null)}>
                            Đóng
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}