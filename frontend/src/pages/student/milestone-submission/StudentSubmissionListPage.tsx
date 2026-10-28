import { milestoneSubmissionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmissionStatusBadge } from "@/pages/management/project/milestone-submission/components/SubmissionStatusBadge";
import type { SubmissionStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarClock, ChevronLeft, ChevronRight, Eye, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const statuses: Array<{ label: string; value?: SubmissionStatus }> = [
  { label: "Tất cả" },
  { label: "Cần chỉnh sửa", value: "CHANGES_REQUESTED" },
  { label: "Bản nháp", value: "DRAFT" },
  { label: "Đang chờ duyệt", value: "SUBMITTED" },
  { label: "Đã chấp nhận", value: "ACCEPTED" },
];

export function StudentSubmissionListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<SubmissionStatus>();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["my-milestone-submissions", page, status, search],
    queryFn: () => milestoneSubmissionApi.getMyPage({ page, size: 12, status, search: search.trim() || undefined, sort: "submittedAt:desc" }),
    retry: false,
  });

  return <MainLayout pathName={{ student: "Sinh viên", "milestone-submissions": "Bài nộp của tôi" }}>
    <main className="mx-auto grid w-full max-w-6xl gap-5">
      <div><h1 className="text-2xl font-semibold">Bài nộp của tôi</h1><p className="mt-1 text-sm text-muted-foreground">Theo dõi trạng thái, feedback và các yêu cầu chỉnh sửa milestone.</p></div>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">{statuses.map((item) => <Button key={item.label} size="sm" variant={status === item.value ? "default" : "outline"} onClick={() => { setStatus(item.value); setPage(0); }}>{item.label}</Button>)}</div>
        <label className="relative block sm:w-72"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Tìm milestone hoặc team" /></label>
      </div>
      {query.isPending ? <div className="grid gap-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div>
        : query.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Không tải được bài nộp</AlertTitle><AlertDescription><Button variant="outline" className="mt-2" onClick={() => void query.refetch()}>Thử lại</Button></AlertDescription></Alert>
        : query.data.content.length === 0 ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Chưa có bài nộp phù hợp với bộ lọc hiện tại.</CardContent></Card>
        : <div className="grid gap-3">{query.data.content.map((item) => {
          const needsRevision = item.status === "CHANGES_REQUESTED";
          return <Card key={item.id} className={needsRevision ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/10" : undefined}>
            <CardHeader className="p-4 pb-2"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate text-base">{item.milestoneTitle}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{item.teamName} · Version {item.currentVersionNumber} · Lần nộp {item.submissionAttempts}</p></div><SubmissionStatusBadge status={item.status} /></div></CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-1 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-4" /> Hạn: {new Date(item.deadline).toLocaleString("vi-VN")}</span>{needsRevision ? <span className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300"><RotateCcw className="size-4" /> Reviewer đang yêu cầu bạn nộp Version {item.currentVersionNumber + 1}</span> : null}</div>
              <Button onClick={() => navigate(`/student/milestone-submissions/${item.id}`)}><Eye className="size-4" /> {needsRevision ? "Xem feedback" : item.currentVersionNumber > 1 ? `Xem ${item.currentVersionNumber} phiên bản` : "Xem bài nộp"}</Button>
            </CardContent>
          </Card>;
        })}</div>}
      {query.data && query.data.totalPages > 1 ? <div className="flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={!query.data.hasPrevious} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="size-4" /> Trước</Button><span className="text-sm">Trang {query.data.page + 1}/{query.data.totalPages}</span><Button size="sm" variant="outline" disabled={!query.data.hasNext} onClick={() => setPage((value) => value + 1)}>Sau <ChevronRight className="size-4" /></Button></div> : null}
    </main>
  </MainLayout>;
}
