import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Mail, RefreshCw, Share2, Users } from "lucide-react";

import { examApi } from "@/api";
import { invitationApi } from "@/api/features/invitation.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvitationDTO, InvitationStatus } from "@/types";

const STATUS_LABEL: Record<InvitationStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
  COMPLETED: "Completed",
};

const STATUS_VARIANT: Record<
  InvitationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  SENT: "secondary",
  ACCEPTED: "default",
  REJECTED: "outline",
  EXPIRED: "outline",
  REVOKED: "destructive",
  COMPLETED: "default",
};

/**
 * Trang Invitations tong cho giao vien / admin.
 * - Chon mot exam de xem danh sach invitation cua exam do.
 * - Link sang trang quan ly chi tiet theo exam de tao / thu hoi / xem QR.
 */
export default function InvitationsLandingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  const examsQuery = useQuery({
    queryKey: ["invitations-landing-exams", search],
    queryFn: () =>
      examApi.getPage(
        { page: 0, size: 100, sort: "createdAt,desc" },
        search.trim() || undefined,
      ),
    enabled: search.trim().length === 0 || search.trim().length >= 2,
  });

  const exams = useMemo(() => examsQuery.data?.content ?? [], [examsQuery.data]);

  const activeExamId = selectedExamId ?? exams[0]?.id ?? null;
  const activeExam = exams.find((e) => e.id === activeExamId);

  const invitationsQuery = useQuery({
    queryKey: ["invitations-landing-list", activeExamId],
    queryFn: () => invitationApi.getByExam(activeExamId as number),
    enabled: activeExamId != null,
    retry: false,
  });

  const invitations: InvitationDTO[] = invitationsQuery.data ?? [];

  const totalAnonymous = invitations.filter((i) => i.anonymous).length;
  const totalWithAccount = invitations.length - totalAnonymous;

  return (
    <MainLayout pathName={{ invitations: "Exam Invitations" }}>
      <section className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-700">
              <Mail className="size-4" />
              <span className="text-sm font-medium">Quản lý thi</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Exam Invitations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Chọn một kỳ thi để xem, tạo và quản lý lời mời thi.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void examsQuery.refetch();
              void invitationsQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" />
            Tải lại
          </Button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Kỳ thi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Tìm kỳ thi (ít nhất 2 ký tự)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {examsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Đang tải kỳ thi...</p>
              )}
              {examsQuery.isError && (
                <p className="text-sm text-destructive">
                  Không tải được danh sách kỳ thi.
                </p>
              )}
              {!examsQuery.isLoading && !examsQuery.isError && exams.length === 0 && (
                <p className="text-sm text-muted-foreground">Chưa có kỳ thi nào.</p>
              )}

              <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
                {exams.map((exam) => (
                  <li key={exam.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedExamId(exam.id ?? null)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        exam.id === activeExamId
                          ? "border-primary bg-primary/5 font-medium"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{exam.title}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                {activeExam ? activeExam.title : "Chọn một kỳ thi"}
              </CardTitle>
              {activeExamId != null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/exams/${activeExamId}/invitations`)}
                >
                  Quản lý chi tiết
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {activeExamId == null ? (
                <p className="text-sm text-muted-foreground">
                  Chọn một kỳ thi ở cột bên trái để xem danh sách lời mời.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary" className="gap-1">
                      <Users className="size-3" /> {totalWithAccount} có tài khoản
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Share2 className="size-3" /> {totalAnonymous} link chia sẻ
                    </Badge>
                  </div>

                  <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Người nhận</TableHead>
                          <TableHead className="w-32">Loại</TableHead>
                          <TableHead className="w-32">Trạng thái</TableHead>
                          <TableHead className="w-40">Mã truy cập</TableHead>
                          <TableHead className="w-44">Ngày gửi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitationsQuery.isLoading && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Đang tải lời mời...
                            </TableCell>
                          </TableRow>
                        )}
                        {invitationsQuery.isError && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="h-24 text-center text-destructive"
                            >
                              Không tải được danh sách lời mời.
                            </TableCell>
                          </TableRow>
                        )}
                        {!invitationsQuery.isLoading &&
                          !invitationsQuery.isError &&
                          invitations.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="h-24 text-center text-muted-foreground"
                              >
                                Kỳ thi này chưa có lời mời nào.
                              </TableCell>
                            </TableRow>
                          )}
                        {invitations.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {inv.anonymous
                                    ? (inv.guestName ?? "Guest User")
                                    : (inv.userFullName ?? "—")}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
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
                                <code className="text-xs font-mono font-semibold">
                                  {inv.accessCode}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {inv.sentAt ? (
                                <span className="text-sm text-muted-foreground">
                                  {new Date(inv.sentAt).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </MainLayout>
  );
}
