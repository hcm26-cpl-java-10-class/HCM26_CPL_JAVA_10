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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { usePermissions } from "@/hooks/usePermissions";
import { STUDENT_ROLE, normalizeRole } from "@/utils/rbac.utils";

const STATUS_LABEL: Record<InvitationStatus, string> = {
    PENDING: "Pending",
    SENT: "Sent",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    EXPIRED: "Expired",
    REVOKED: "Revoked",
    COMPLETED: "Completed",
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
    const { activeRole } = usePermissions();

    const [statusFilter, setStatusFilter] = useState<InvitationStatus | "ALL">("ALL");
    const [typeFilter, setTypeFilter] = useState<"ALL" | "authenticated" | "anonymous">("ALL");
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState<InvitationDTO | null>(null);
    const [revokeReason, setRevokeReason] = useState("");
    const [qrTarget, setQrTarget] = useState<InvitationDTO | null>(null);
    const [examTitle, setExamTitle] = useState("Exam");

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
            }
        };
        void loadExamTitle();
    }, [numericExamId, isValidExamId]);

    const rows = invitationsQuery.data ?? [];
    const total = rows.length;

    const resendMutation = useMutation({
        mutationFn: (id: number) => invitationApi.resend(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", numericExamId] });
            toast.success("Resent invitation email.");
        },
        onError: () => toast.error("Failed to resend invitation email."),
    });

    const revokeMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            invitationApi.revoke(id, reason),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", numericExamId] });
            toast.success("Invitation revoked successfully.");
            setRevokeTarget(null);
            setRevokeReason("");
        },
        onError: () => toast.error("Failed to revoke invitation."),
    });

    if (normalizeRole(activeRole) === STUDENT_ROLE) {
        return <Navigate to="/invitations" replace />;
    }

    return (
        <MainLayout pathName={{ exams: "Exam Management", invitations: "Invitations" }}>
            <section className="flex flex-col gap-5">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                    <div>
                        <p className="text-sm text-muted-foreground">
                            <ChevronLeft
                                className="mr-1 inline size-3.5 cursor-pointer"
                                onClick={() => navigate("/exams")}
                            />{" "}
                            Exam Management
                        </p>
                        <h1 className="mt-1 text-2xl font-semibold">
                            Exam Invitations: <span className="text-primary">{examTitle}</span>
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {total} invitation(s)
                        </p>
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Mail className="size-4" />
                        Create Invitation
                    </Button>
                </header>

                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); }}
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
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
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Types</SelectItem>
                            <SelectItem value="authenticated">With Account</SelectItem>
                            <SelectItem value="anonymous">Without Account</SelectItem>
                        </SelectContent>
                    </Select>

                    {invitationsQuery.isFetching && (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <RefreshCw className="size-3.5 animate-spin" />
                            Loading...
                        </span>
                    )}
                </div>

                <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Recipient</TableHead>
                                <TableHead className="w-32">Type</TableHead>
                                <TableHead className="w-32">Status</TableHead>
                                <TableHead className="w-44">Access Code</TableHead>
                                <TableHead className="w-40">Sent Date</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invitationsQuery.isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        Loading invitations...
                                    </TableCell>
                                </TableRow>
                            )}
                            {invitationsQuery.isError && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                                        Failed to load invitations list.
                                    </TableCell>
                                </TableRow>
                            )}
                            {!invitationsQuery.isLoading && !invitationsQuery.isError && rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No invitations created yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((inv) => (
                                <TableRow key={inv.id}>
                                    <TableCell>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">
                                                {inv.anonymous
                                                    ? inv.guestName ?? "Guest User"
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
                                                    <Users className="size-3" /> No Account
                                                </>
                                            ) : (
                                                <>
                                                    <Mail className="size-3" /> Account
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
                                                    title="Copy Access Code"
                                                    onClick={() => {
                                                        if (inv.accessCode) {
                                                            void navigator.clipboard.writeText(inv.accessCode);
                                                            toast.success("Code copied!");
                                                        }
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
                                                        onClick={() => inv.id && resendMutation.mutate(inv.id)}
                                                        disabled={resendMutation.isPending}
                                                    >
                                                        <Send className="size-3.5" />
                                                        Resend Email
                                                    </DropdownMenuItem>
                                                )}
                                                {inv.anonymous && (
                                                    <DropdownMenuItem
                                                        onClick={() => setQrTarget(inv)}
                                                    >
                                                        <QrCode className="size-3.5" />
                                                        View QR Code
                                                    </DropdownMenuItem>
                                                )}
                                                {inv.accessCode && (
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            if (inv.accessCode) {
                                                                void navigator.clipboard.writeText(inv.accessCode);
                                                                toast.success("Code copied!");
                                                            }
                                                        }}
                                                    >
                                                        <Copy className="size-3.5" />
                                                        Copy Access Code
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
                                                    Revoke Invitation
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

            {isValidExamId && (
                <CreateInvitationModal
                    examId={numericExamId}
                    examTitle={examTitle}
                    open={isCreateOpen}
                    onOpenChange={setCreateOpen}
                />
            )}

            <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revoke Invitation</DialogTitle>
                        <DialogDescription>
                            Revoke invitation for{" "}
                            <strong>
                                {revokeTarget?.anonymous
                                    ? revokeTarget?.guestName
                                    : revokeTarget?.userFullName}
                            </strong>
                            ? The recipient will receive a notification email.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Reason (optional)</label>
                        <Input
                            placeholder="e.g., Exam rescheduled..."
                            value={revokeReason}
                            onChange={(e) => setRevokeReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRevokeTarget(null)}>
                            Cancel
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
                            {revokeMutation.isPending ? "Revoking..." : "Revoke"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!qrTarget} onOpenChange={(o) => { if (!o) setQrTarget(null); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Access QR Code</DialogTitle>
                        <DialogDescription>
                            Code: <strong>{qrTarget?.accessCode}</strong>
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
                            onClick={() => {
                                if (qrTarget?.accessCode) {
                                    void navigator.clipboard.writeText(qrTarget.accessCode);
                                    toast.success("Code copied!");
                                }
                            }}
                        >
                            <Copy className="size-4" />
                            Copy Access Code
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQrTarget(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
