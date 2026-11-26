import { scoreAppealApi } from "@/api/features/score-appeal.api";
import { examApi } from "@/api/features/exam.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SCORE_APPEAL_STATUS_LABEL, type ScoreAppealDTO } from "@/types/features/score-appeal";
import { formatScore } from "@/utils/examScore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

function statusVariant(status: ScoreAppealDTO["status"]) {
  if (status === "APPROVED") return "default" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function MyAppealsPage() {
  const queryClient = useQueryClient();
  const [attemptIdInput, setAttemptIdInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("attemptId") ?? "";
  });
  const [reason, setReason] = useState("");
  const [requestedScore, setRequestedScore] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState<ScoreAppealDTO | null>(null);

  const myAppealsQuery = useQuery({
    queryKey: ["my-appeals"],
    queryFn: scoreAppealApi.getMyAppeals,
  });

  const myScoresQuery = useQuery({
    queryKey: ["my-exam-scores-for-appeal"],
    queryFn: examApi.getMyPublishedExamScores,
  });

  const appealedAttemptIds = new Set(
    (myAppealsQuery.data ?? []).map((a) => a.attemptId).filter((v): v is number => v != null)
  );

  const appeals = myAppealsQuery.data ?? [];
  const scores = myScoresQuery.data ?? [];

  // Attempt co the lay tu query param ?attemptId= (nut "Khiếu nại điểm" ở trang điểm)
  const selectedScore = scores.find((s) => String(s.attemptId) === attemptIdInput);
  const selectedScoreNotPublished =
    attemptIdInput !== "" && selectedScore != null && !selectedScore.resultPublished;
  const selectedAlreadyAppealed = appealedAttemptIds.has(Number(attemptIdInput));

  const createMutation = useMutation({
    mutationFn: () => {
      const attemptId = Number(attemptIdInput);
      if (!Number.isFinite(attemptId) || attemptId <= 0) {
        throw new Error("Attempt ID không hợp lệ.");
      }
      if (!reason.trim()) {
        throw new Error("Vui lòng nhập lý do khiếu nại.");
      }
      if (selectedScore && !selectedScore.resultPublished) {
        throw new Error(
          "Kết quả bài thi chưa được giáo viên công bố. Bạn có thể khiếu nại sau khi kết quả được công bố.",
        );
      }
      if (selectedAlreadyAppealed) {
        throw new Error("Bạn đã gửi khiếu nại cho lần làm bài này rồi.");
      }
      return scoreAppealApi.create(attemptId, {
        reason: reason.trim(),
        requestedScore: requestedScore === "" ? undefined : Number(requestedScore),
      });
    },
    onSuccess: () => {
      setAttemptIdInput("");
      setReason("");
      setRequestedScore("");
      void queryClient.invalidateQueries({ queryKey: ["my-appeals"] });
      void queryClient.invalidateQueries({ queryKey: ["my-appeals-for-scores"] });
      void queryClient.invalidateQueries({ queryKey: ["my-exam-scores-for-appeal"] });
      void queryClient.invalidateQueries({ queryKey: ["my-exam-scores"] });
      toast.success("Đã gửi khiếu nại thành công");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err?.response?.data?.message || err?.message || "Gửi khiếu nại thất bại");
    },
  });

  const isLoading = myAppealsQuery.isLoading;

  return (
    <MainLayout pathName={{ "my-appeals": "Khiếu nại điểm" }}>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Khiếu nại điểm</h1>
          <p className="text-sm text-muted-foreground">
            Gửi khiếu nại điểm cho bài thi đã được công bố kết quả và theo dõi trạng thái xử lý.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gửi khiếu nại mới</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Attempt ID
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 12"
                  value={attemptIdInput}
                  onChange={(e) => setAttemptIdInput(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Điểm đề nghị (không bắt buộc)
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 8.5"
                  value={requestedScore}
                  onChange={(e) => setRequestedScore(e.target.value)}
                />
              </label>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={
                    createMutation.isPending ||
                    !attemptIdInput ||
                    !reason.trim() ||
                    selectedAlreadyAppealed
                  }
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending
                    ? "Đang gửi..."
                    : selectedAlreadyAppealed
                      ? "Đã khiếu nại lần này"
                      : "Gửi khiếu nại"}
                </Button>
              </div>
            </div>

            <label className="grid gap-1.5 text-sm font-medium">
              Lý do khiếu nại
              <Textarea
                rows={3}
                placeholder="Mô tả cụ thể vì sao bạn cho rằng điểm chưa đúng..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>

            {selectedScore && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bài thi</span>
                  <span className="font-medium">{selectedScore.examTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Điểm hiện tại</span>
                  <span className="font-medium">
                    {formatScore(selectedScore.finalScore ?? 0)}/{formatScore(selectedScore.maxScore ?? 10)}
                  </span>
                </div>
                {selectedScoreNotPublished && (
                  <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    Kết quả bài thi chưa được công bố. Bạn chỉ có thể khiếu nại sau khi giáo viên công bố kết quả.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Khiếu nại của tôi</h2>
          {isLoading && <p className="text-sm text-muted-foreground">Đang tải...</p>}
          {myAppealsQuery.isError && (
            <p className="text-sm text-destructive">Không thể tải danh sách khiếu nại.</p>
          )}
          {!isLoading && !myAppealsQuery.isError && appeals.length === 0 && (
            <p className="text-sm text-muted-foreground">Bạn chưa có khiếu nại nào.</p>
          )}

          {appeals.map((appeal) => (
            <Card key={appeal.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    {appeal.examTitle || `Exam #${appeal.examId}`}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Lần thi #{appeal.attemptNumber} · Gửi lúc {formatDate(appeal.createdAt)}
                  </p>
                </div>
                <Badge variant={statusVariant(appeal.status)}>
                  {SCORE_APPEAL_STATUS_LABEL[appeal.status]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Điểm khi khiếu nại</span>
                  <span>{formatScore(appeal.oldScore)}</span>
                </div>
                {appeal.requestedScore != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Điểm đề nghị</span>
                    <span>{formatScore(appeal.requestedScore)}</span>
                  </div>
                )}
                {appeal.newScore != null && (
                  <div className="flex justify-between font-medium">
                    <span>Điểm sau khi chấp nhận</span>
                    <span>{formatScore(appeal.newScore)}</span>
                  </div>
                )}
                <div className="rounded-md border bg-muted/40 p-2 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">Lý do</p>
                  <p className="mt-1 whitespace-pre-wrap">{appeal.reason}</p>
                </div>
                {appeal.resolutionNote && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-sm dark:border-blue-800 dark:bg-blue-950/40">
                    <p className="text-xs font-medium text-muted-foreground">
                      Phản hồi của giáo viên
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{appeal.resolutionNote}</p>
                  </div>
                )}
                {appeal.reviewedAt && (
                  <p className="text-xs text-muted-foreground">
                    Xử lý lúc {formatDate(appeal.reviewedAt)}
                    {appeal.reviewerName ? ` bởi ${appeal.reviewerName}` : ""}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedAppeal(appeal);
                    setDialogOpen(true);
                  }}
                >
                  Xem chi tiết
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết khiếu nại</DialogTitle>
            <DialogDescription>
              {selectedAppeal?.examTitle || `Exam #${selectedAppeal?.examId}`}
            </DialogDescription>
          </DialogHeader>

          {selectedAppeal && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <Badge variant={statusVariant(selectedAppeal.status)}>
                  {SCORE_APPEAL_STATUS_LABEL[selectedAppeal.status]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Điểm khi khiếu nại</span>
                <span>{formatScore(selectedAppeal.oldScore)}</span>
              </div>
              {selectedAppeal.requestedScore != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Điểm đề nghị</span>
                  <span>{formatScore(selectedAppeal.requestedScore)}</span>
                </div>
              )}
              {selectedAppeal.newScore != null && (
                <div className="flex justify-between font-medium">
                  <span>Điểm sau khi chấp nhận</span>
                  <span>{formatScore(selectedAppeal.newScore)}</span>
                </div>
              )}
              <div className="rounded-md border bg-muted/40 p-2">
                <p className="text-xs font-medium text-muted-foreground">Lý do khiếu nại</p>
                <p className="mt-1 whitespace-pre-wrap">{selectedAppeal.reason}</p>
              </div>
              {selectedAppeal.resolutionNote && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-950/40">
                  <p className="text-xs font-medium text-muted-foreground">Phản hồi của giáo viên</p>
                  <p className="mt-1 whitespace-pre-wrap">{selectedAppeal.resolutionNote}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Gửi lúc {formatDate(selectedAppeal.createdAt)}
                {selectedAppeal.reviewedAt ? ` · Xử lý lúc ${formatDate(selectedAppeal.reviewedAt)}` : ""}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
