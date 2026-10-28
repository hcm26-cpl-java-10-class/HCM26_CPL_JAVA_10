import { examApi, invitationApi, userApi } from "@/api";
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import type {
  BatchInvitationResponse,
  InvitationDTO,
  InvitationFilter,
  InvitationStatus,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateStr);
  }
}

function getErrorMessage(error: any): string {
  if (error?.response?.data?.message) return String(error.response.data.message);
  if (error?.response?.data?.detail) return String(error.response.data.detail);
  if (typeof error?.response?.data === "string" && error.response.data.length < 200) {
    return error.response.data;
  }
  if (error?.message) return String(error.message);
  return "Đã xảy ra lỗi. Vui lòng thử lại.";
}

export default function InvitationManagementPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission("INVITATION_CREATE");
  const canUpdate = hasPermission("INVITATION_UPDATE");
  const canDelete = hasPermission("INVITATION_DELETE");

  // Filter state
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterExamTitle, setFilterExamTitle] = useState("");
  const [filterUserEmail, setFilterUserEmail] = useState("");

  // Modals state
  const [isSingleInviteOpen, setSingleInviteOpen] = useState(false);
  const [isBatchInviteOpen, setBatchInviteOpen] = useState(false);
  const [detailInvitation, setDetailInvitation] = useState<InvitationDTO | null>(null);
  const [revokingInvitation, setRevokingInvitation] = useState<InvitationDTO | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [deletingInvitation, setDeletingInvitation] = useState<InvitationDTO | null>(null);
  const [batchResult, setBatchResult] = useState<BatchInvitationResponse | null>(null);

  // Form states - Single Invite
  const [singleExamId, setSingleExamId] = useState<string>("");
  const [singleUserId, setSingleUserId] = useState<string>("");
  const [singleExpiresAt, setSingleExpiresAt] = useState<string>("");
  const [singleNote, setSingleNote] = useState<string>("");
  const [singleStudentSearch, setSingleStudentSearch] = useState<string>("");

  // Form states - Batch Invite
  const [batchExamId, setBatchExamId] = useState<string>("");
  const [batchUserIds, setBatchUserIds] = useState<Set<number>>(new Set());
  const [batchExpiresAt, setBatchExpiresAt] = useState<string>("");
  const [batchNote, setBatchNote] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState<string>("");

  // Query: Invitations list
  const activeFilter: InvitationFilter = useMemo(() => {
    const f: InvitationFilter = {};
    if (filterStatus !== "ALL") f.status = filterStatus as InvitationStatus;
    if (filterExamTitle.trim()) f.examTitle = filterExamTitle.trim();
    if (filterUserEmail.trim()) f.userEmail = filterUserEmail.trim();
    return f;
  }, [filterStatus, filterExamTitle, filterUserEmail]);

  const invitationsQuery = useQuery({
    queryKey: ["invitations", page, search, activeFilter],
    queryFn: () =>
      invitationApi.getPage(
        { page, size: PAGE_SIZE, sort: "createdAt,desc" },
        search.trim() || undefined,
        activeFilter,
      ),
  });

  // Query: Exams list for dropdown
  const examsQuery = useQuery({
    queryKey: ["all-exams-options"],
    queryFn: () => examApi.getPage({ page: 0, size: 200, sort: "id,desc" }, "", { isActive: true }),
    enabled: isSingleInviteOpen || isBatchInviteOpen,
  });

  // Query: Students list for dropdown/picker
  const usersQuery = useQuery({
    queryKey: ["all-users-options"],
    queryFn: () => userApi.getPage({ page: 0, size: 300, sort: "firstName,asc" }),
    enabled: isSingleInviteOpen || isBatchInviteOpen,
  });

  const exams = examsQuery.data?.content ?? [];
  const users = usersQuery.data?.content ?? [];

  // Filter students for single invite
  const singleCandidateStudents = useMemo(() => {
    return users.filter((u) => {
      if (u.isActive === false) return false;
      if (!singleStudentSearch.trim()) return true;
      const term = singleStudentSearch.toLowerCase();
      const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      return fullName.includes(term) || email.includes(term);
    });
  }, [users, singleStudentSearch]);

  // Filter students for batch invite
  const candidateStudents = useMemo(() => {
    return users.filter((u) => {
      if (u.isActive === false) return false;
      if (!studentSearch.trim()) return true;
      const term = studentSearch.toLowerCase();
      const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      return fullName.includes(term) || email.includes(term);
    });
  }, [users, studentSearch]);

  const refreshInvitations = () => {
    queryClient.invalidateQueries({ queryKey: ["invitations"] });
  };

  // Mutation: Single Invite
  const singleInviteMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<InvitationDTO> = {
        examId: Number(singleExamId),
        userId: Number(singleUserId),
        note: singleNote.trim() || undefined,
        expiresAt: singleExpiresAt ? new Date(singleExpiresAt).toISOString() : undefined,
      };
      return invitationApi.inviteSingle(payload);
    },
    onSuccess: (data) => {
      toast.success(`Đã gửi lời mời tới ${data.userEmail || data.userFullName || "thí sinh"}`);
      setSingleInviteOpen(false);
      setSingleExamId("");
      setSingleUserId("");
      setSingleExpiresAt("");
      setSingleNote("");
      refreshInvitations();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Mutation: Batch Invite
  const batchInviteMutation = useMutation({
    mutationFn: () => {
      const payload = {
        examId: Number(batchExamId),
        userIds: Array.from(batchUserIds),
        note: batchNote.trim() || undefined,
        expiresAt: batchExpiresAt ? new Date(batchExpiresAt).toISOString() : undefined,
      };
      return invitationApi.inviteBatch(payload);
    },
    onSuccess: (data: BatchInvitationResponse) => {
      setBatchInviteOpen(false);
      setBatchExamId("");
      setBatchUserIds(new Set());
      setBatchExpiresAt("");
      setBatchNote("");
      setBatchResult(data);
      refreshInvitations();
      toast.success(
        `Xử lý mời hàng loạt: ${data.successCount} thành công, ${data.skippedCount} bỏ qua, ${data.failedCount} thất bại.`,
      );
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Mutation: Resend
  const resendMutation = useMutation({
    mutationFn: (id: number) => invitationApi.resend(id),
    onSuccess: (updated) => {
      toast.success(`Đã gửi lại lời mời thành công (Lần ${updated.resendCount})`);
      refreshInvitations();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Mutation: Revoke
  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      invitationApi.revoke(id, { reason }),
    onSuccess: () => {
      toast.success("Đã thu hồi lời mời thành công");
      setRevokingInvitation(null);
      setRevokeReason("");
      refreshInvitations();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Mutation: Delete
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invitationApi.delete(id),
    onSuccess: () => {
      toast.success("Đã xóa lời mời");
      setDeletingInvitation(null);
      refreshInvitations();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Status Badge Component
  const renderStatusBadge = (status?: InvitationStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Clock className="size-3" />
            Chờ phản hồi
          </Badge>
        );
      case "ACCEPTED":
        return (
          <Badge variant="outline" className="border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="size-3" />
            Đã chấp nhận
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            <XCircle className="size-3" />
            Đã từ chối
          </Badge>
        );
      case "REVOKED":
        return (
          <Badge variant="outline" className="border-zinc-400 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <Ban className="size-3" />
            Đã thu hồi
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="outline" className="border-slate-400 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <AlertCircle className="size-3" />
            Đã hết hạn
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status || "Không xác định"}</Badge>;
    }
  };

  const rows = invitationsQuery.data?.content ?? [];
  const totalPages = invitationsQuery.data?.totalPages ?? 0;
  const totalElements = invitationsQuery.data?.totalElements ?? 0;

  const resetFilters = () => {
    setSearch("");
    setFilterStatus("ALL");
    setFilterExamTitle("");
    setFilterUserEmail("");
    setPage(0);
  };

  const toggleStudentSelection = (userId: number, checked: boolean) => {
    setBatchUserIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const selectAllStudents = () => {
    if (batchUserIds.size === candidateStudents.length) {
      setBatchUserIds(new Set());
    } else {
      setBatchUserIds(new Set(candidateStudents.map((s) => s.id!).filter(Boolean)));
    }
  };

  return (
    <MainLayout pathName={{ invitations: "Quản lý lời mời thi" }}>
      <section className="flex flex-col gap-5">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Exam management</p>
            <h1 className="mt-1 text-2xl font-semibold flex items-center gap-2">
              <Mail className="size-6 text-primary" />
              Quản lý lời mời thi
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSingleExamId("");
                    setSingleUserId("");
                    setSingleExpiresAt("");
                    setSingleNote("");
                    setSingleStudentSearch("");
                    setSingleInviteOpen(true);
                  }}
                >
                  <Plus />
                  Mời thí sinh
                </Button>
                <Button
                  onClick={() => {
                    setBatchExamId("");
                    setBatchUserIds(new Set());
                    setBatchExpiresAt("");
                    setBatchNote("");
                    setStudentSearch("");
                    setBatchInviteOpen(true);
                  }}
                >
                  <Users />
                  Mời hàng loạt
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              title="Tải lại danh sách"
              onClick={refreshInvitations}
              disabled={invitationsQuery.isFetching}
            >
              <RefreshCw className={`size-4 ${invitationsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </header>

        {/* Filters */}
        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Tìm theo ghi chú..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <div>
            <Select
              value={filterStatus}
              onValueChange={(val) => {
                setFilterStatus(val);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                <SelectItem value="PENDING">Chờ phản hồi (PENDING)</SelectItem>
                <SelectItem value="ACCEPTED">Đã chấp nhận (ACCEPTED)</SelectItem>
                <SelectItem value="REJECTED">Đã từ chối (REJECTED)</SelectItem>
                <SelectItem value="REVOKED">Đã thu hồi (REVOKED)</SelectItem>
                <SelectItem value="EXPIRED">Đã hết hạn (EXPIRED)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Input
              placeholder="Lọc theo tên đề thi..."
              value={filterExamTitle}
              onChange={(e) => {
                setFilterExamTitle(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <div>
            <Input
              placeholder="Lọc theo email học sinh..."
              value={filterUserEmail}
              onChange={(e) => {
                setFilterUserEmail(e.target.value);
                setPage(0);
              }}
            />
          </div>

          {(search || filterStatus !== "ALL" || filterExamTitle || filterUserEmail) && (
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-muted-foreground">
                <X className="size-3 mr-1" />
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>

        {/* Count banner */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Tổng cộng: <strong className="text-foreground">{totalElements}</strong> lời mời
          </span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Kỳ thi</TableHead>
                <TableHead>Học sinh / Thí sinh</TableHead>
                <TableHead className="w-36">Trạng thái</TableHead>
                <TableHead className="w-36">Ngày gửi</TableHead>
                <TableHead className="w-24 text-center">Gửi lại</TableHead>
                <TableHead className="w-36">Hạn chót</TableHead>
                <TableHead className="w-48 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitationsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-4 animate-spin text-primary" />
                      <span>Đang tải danh sách lời mời...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {invitationsQuery.isError && (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-destructive">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <p className="font-medium">Không thể tải danh sách lời mời.</p>
                      <p className="text-xs text-muted-foreground">{getErrorMessage(invitationsQuery.error)}</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!invitationsQuery.isLoading && !invitationsQuery.isError && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Mail className="size-8 text-muted-foreground/50" />
                      <p>Không tìm thấy lời mời nào.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {rows.map((inv) => {
                const isPending = inv.status === "PENDING";
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{inv.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <span>{inv.examTitle || `Kỳ thi #${inv.examId}`}</span>
                        <div className="text-xs text-muted-foreground">ID kỳ thi: {inv.examId}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {inv.userFullName || inv.userEmail || `User #${inv.userId}`}
                        </div>
                        {inv.userCode && (
                          <div className="text-xs text-muted-foreground">{inv.userCode}</div>
                        )}
                        {inv.userEmail && (
                          <div className="text-xs text-muted-foreground">{inv.userEmail}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{renderStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(inv.sentAt)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {inv.resendCount ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.expiresAt ? formatDateTime(inv.expiresAt) : "Không giới hạn"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Detail */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Xem chi tiết"
                          onClick={() => setDetailInvitation(inv)}
                        >
                          <Eye className="size-4" />
                        </Button>

                        {/* Resend - only when status === 'PENDING' and has INVITATION_UPDATE */}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={
                              isPending
                                ? "Gửi lại lời mời"
                                : "Chỉ có thể gửi lại lời mời ở trạng thái PENDING"
                            }
                            disabled={!isPending || resendMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Gửi lại email lời mời tới ${inv.userEmail || "thí sinh"}?`)) {
                                resendMutation.mutate(inv.id!);
                              }
                            }}
                          >
                            <RotateCw
                              className={`size-4 ${
                                resendMutation.isPending && resendMutation.variables === inv.id
                                  ? "animate-spin"
                                  : ""
                              }`}
                            />
                          </Button>
                        )}

                        {/* Revoke - only when status === 'PENDING' and has INVITATION_UPDATE */}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={
                              isPending
                                ? "Thu hồi lời mời"
                                : "Chỉ có thể thu hồi lời mời ở trạng thái PENDING"
                            }
                            disabled={!isPending}
                            className="text-amber-600 hover:text-amber-700"
                            onClick={() => {
                              setRevokingInvitation(inv);
                              setRevokeReason("");
                            }}
                          >
                            <Ban className="size-4" />
                          </Button>
                        )}

                        {/* Delete - only when has INVITATION_DELETE */}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Xóa lời mời"
                            className="text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeletingInvitation(inv)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span className="min-w-24 text-center text-sm text-muted-foreground">
            {totalPages === 0 ? 0 : page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      </section>

      {/* DIALOG 1: Single Invite */}
      <Dialog open={isSingleInviteOpen} onOpenChange={setSingleInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!singleExamId || !singleUserId) {
                toast.error("Vui lòng chọn kỳ thi và học sinh");
                return;
              }
              singleInviteMutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="size-5 text-primary" />
                Gửi lời mời tham gia kỳ thi
              </DialogTitle>
              <DialogDescription>
                Mời một học sinh cụ thể vào kỳ thi. Hệ thống sẽ tự động gửi email thông báo.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Select Exam */}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Kỳ thi <span className="text-destructive">*</span>
                </label>
                <Select value={singleExamId} onValueChange={setSingleExamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn kỳ thi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {exams.map((exam) => (
                      <SelectItem key={exam.id} value={String(exam.id)}>
                        {exam.title} ({exam.durationMinutes} phút)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select Student */}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Học sinh <span className="text-destructive">*</span>
                </label>
                <div className="relative mb-1">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-xs"
                    placeholder="Tìm tên hoặc email học sinh..."
                    value={singleStudentSearch}
                    onChange={(e) => setSingleStudentSearch(e.target.value)}
                  />
                </div>
                <Select value={singleUserId} onValueChange={setSingleUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn học sinh..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {singleCandidateStudents.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        Không tìm thấy học sinh phù hợp
                      </div>
                    ) : (
                      singleCandidateStudents.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.firstName} {u.lastName}{u.userCode ? ` · ${u.userCode}` : ""} ({u.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Expiry Date */}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Thời hạn lời mời (tùy chọn)</label>
                <Input
                  type="datetime-local"
                  value={singleExpiresAt}
                  onChange={(e) => setSingleExpiresAt(e.target.value)}
                />
              </div>

              {/* Note */}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Ghi chú (tối đa 1000 ký tự)</label>
                <Textarea
                  placeholder="Ghi chú thêm cho lời mời..."
                  maxLength={1000}
                  value={singleNote}
                  onChange={(e) => setSingleNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSingleInviteOpen(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={singleInviteMutation.isPending || !singleExamId || !singleUserId}
              >
                {singleInviteMutation.isPending ? "Đang gửi..." : "Gửi lời mời"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Batch Invite */}
      <Dialog open={isBatchInviteOpen} onOpenChange={setBatchInviteOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <form
            className="flex flex-col flex-1 min-h-0"
            onSubmit={(e) => {
              e.preventDefault();
              if (!batchExamId) {
                toast.error("Vui lòng chọn kỳ thi");
                return;
              }
              if (batchUserIds.size === 0) {
                toast.error("Vui lòng chọn ít nhất một học sinh");
                return;
              }
              batchInviteMutation.mutate();
            }}
          >
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                Mời nhiều học sinh vào kỳ thi (Batch)
              </DialogTitle>
              <DialogDescription>
                Chọn kỳ thi và danh sách học sinh muốn mời cùng một lúc.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 min-h-0 flex-1 overflow-y-auto pr-1">
              {/* Select Exam */}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Kỳ thi <span className="text-destructive">*</span>
                </label>
                <Select value={batchExamId} onValueChange={setBatchExamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn kỳ thi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {exams.map((exam) => (
                      <SelectItem key={exam.id} value={String(exam.id)}>
                        {exam.title} ({exam.durationMinutes} phút)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student Picker with search & multi-select */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Chọn học sinh <span className="text-destructive">*</span>
                    <span className="ml-2 font-normal text-muted-foreground text-xs">
                      (Đã chọn: {batchUserIds.size})
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAllStudents}
                  >
                    {batchUserIds.size === candidateStudents.length
                      ? "Bỏ chọn tất cả"
                      : "Chọn tất cả"}
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-sm"
                    placeholder="Tìm tên hoặc email học sinh..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                  {candidateStudents.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Không tìm thấy học sinh phù hợp.
                    </p>
                  ) : (
                    candidateStudents.map((st) => {
                      const checked = batchUserIds.has(st.id!);
                      return (
                        <label
                          key={st.id}
                          className="flex items-center gap-3 p-2.5 text-sm hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="size-4 rounded accent-primary"
                            checked={checked}
                            onChange={(e) => toggleStudentSelection(st.id!, e.target.checked)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {st.firstName} {st.lastName}{st.userCode ? ` · ${st.userCode}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{st.email}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Expiry Date */}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Thời hạn lời mời (tùy chọn)</label>
                <Input
                  type="datetime-local"
                  value={batchExpiresAt}
                  onChange={(e) => setBatchExpiresAt(e.target.value)}
                />
              </div>

              {/* Note */}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Ghi chú (tùy chọn)</label>
                <Textarea
                  placeholder="Ghi chú áp dụng cho toàn bộ lời mời..."
                  maxLength={1000}
                  value={batchNote}
                  onChange={(e) => setBatchNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setBatchInviteOpen(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={
                  batchInviteMutation.isPending || !batchExamId || batchUserIds.size === 0
                }
              >
                {batchInviteMutation.isPending
                  ? "Đang xử lý..."
                  : `Gửi ${batchUserIds.size} lời mời`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Batch Result Summary */}
      <Dialog open={Boolean(batchResult)} onOpenChange={() => setBatchResult(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Kết quả gửi lời mời hàng loạt</DialogTitle>
            <DialogDescription>
              Tổng số yêu cầu: <strong>{batchResult?.totalRequested ?? 0}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 py-2 shrink-0">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-800 dark:bg-emerald-950/50">
              <div className="text-2xl font-bold text-emerald-600">{batchResult?.successCount ?? 0}</div>
              <div className="text-xs text-emerald-700">Thành công</div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-800 dark:bg-amber-950/50">
              <div className="text-2xl font-bold text-amber-600">{batchResult?.skippedCount ?? 0}</div>
              <div className="text-xs text-amber-700">Bỏ qua (đã tồn tại)</div>
            </div>
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-center dark:border-rose-800 dark:bg-rose-950/50">
              <div className="text-2xl font-bold text-rose-600">{batchResult?.failedCount ?? 0}</div>
              <div className="text-xs text-rose-700">Thất bại</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email học sinh</TableHead>
                  <TableHead className="w-28">Trạng thái</TableHead>
                  <TableHead>Chi tiết / Lý do</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchResult?.items?.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium text-xs">
                      {item.userEmail || `User ID #${item.userId}`}
                    </TableCell>
                    <TableCell>
                      {item.status === "SUCCESS" && (
                        <Badge variant="outline" className="border-emerald-400 bg-emerald-50 text-emerald-700">
                          Thành công
                        </Badge>
                      )}
                      {item.status === "SKIPPED" && (
                        <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700">
                          Bỏ qua
                        </Badge>
                      )}
                      {item.status === "FAILED" && (
                        <Badge variant="outline" className="border-rose-400 bg-rose-50 text-rose-700">
                          Thất bại
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="shrink-0 border-t pt-3">
            <Button onClick={() => setBatchResult(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Detail View */}
      <Dialog open={Boolean(detailInvitation)} onOpenChange={() => setDetailInvitation(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5 text-primary" />
              Chi tiết lời mời #{detailInvitation?.id}
            </DialogTitle>
          </DialogHeader>

          {detailInvitation && (
            <div className="grid gap-3 py-3 text-sm">
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground">Kỳ thi:</span>
                <span className="col-span-2 font-medium">
                  {detailInvitation.examTitle || `ID #${detailInvitation.examId}`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground">Thí sinh:</span>
                <div className="col-span-2">
                  <div className="font-medium">{detailInvitation.userFullName || "—"}</div>
                  {detailInvitation.userCode && (
                    <div className="text-xs text-muted-foreground">{detailInvitation.userCode}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{detailInvitation.userEmail}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground">Trạng thái:</span>
                <span className="col-span-2">{renderStatusBadge(detailInvitation.status)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground">Ngày gửi:</span>
                <span className="col-span-2">{formatDateTime(detailInvitation.sentAt)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground">Số lần gửi lại:</span>
                <span className="col-span-2 font-mono">{detailInvitation.resendCount ?? 0}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground">Hạn phản hồi:</span>
                <span className="col-span-2">
                  {detailInvitation.expiresAt
                    ? formatDateTime(detailInvitation.expiresAt)
                    : "Không giới hạn"}
                </span>
              </div>

              {detailInvitation.revokedAt && (
                <div className="grid grid-cols-3 gap-2 border-b pb-2">
                  <span className="text-muted-foreground">Thời điểm thu hồi:</span>
                  <span className="col-span-2 text-rose-600">
                    {formatDateTime(detailInvitation.revokedAt)}
                  </span>
                </div>
              )}

              {detailInvitation.revokedReason && (
                <div className="grid grid-cols-3 gap-2 border-b pb-2">
                  <span className="text-muted-foreground">Lý do thu hồi:</span>
                  <span className="col-span-2 text-muted-foreground italic">
                    {detailInvitation.revokedReason}
                  </span>
                </div>
              )}

              {detailInvitation.note && (
                <div className="grid grid-cols-3 gap-2 border-b pb-2">
                  <span className="text-muted-foreground">Ghi chú:</span>
                  <span className="col-span-2 whitespace-pre-wrap">{detailInvitation.note}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Ngày tạo:</span>
                <span className="col-span-2 text-xs text-muted-foreground">
                  {formatDateTime(detailInvitation.createdAt)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailInvitation(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: Revoke Confirmation */}
      <Dialog
        open={Boolean(revokingInvitation)}
        onOpenChange={() => {
          setRevokingInvitation(null);
          setRevokeReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="size-5" />
              Thu hồi lời mời thi
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn thu hồi lời mời thi gửi tới{" "}
              <strong>{revokingInvitation?.userEmail || revokingInvitation?.userFullName}</strong>? Thí
              sinh sẽ không thể tham gia bài thi bằng lời mời này nữa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-3">
            <label className="text-sm font-medium">Lý do thu hồi (tùy chọn, tối đa 500 ký tự)</label>
            <Textarea
              placeholder="Nhập lý do thu hồi lời mời..."
              maxLength={500}
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRevokingInvitation(null);
                setRevokeReason("");
              }}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() => {
                if (revokingInvitation?.id) {
                  revokeMutation.mutate({
                    id: revokingInvitation.id,
                    reason: revokeReason.trim() || undefined,
                  });
                }
              }}
            >
              {revokeMutation.isPending ? "Đang thu hồi..." : "Xác nhận thu hồi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6: Delete Confirmation */}
      <Dialog
        open={Boolean(deletingInvitation)}
        onOpenChange={() => setDeletingInvitation(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              Xác nhận xóa lời mời
            </DialogTitle>
            <DialogDescription>
              Hành động này sẽ xóa hoàn toàn bản ghi lời mời #{deletingInvitation?.id} khỏi hệ thống.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingInvitation(null)}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingInvitation?.id) {
                  deleteMutation.mutate(deletingInvitation.id);
                }
              }}
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
