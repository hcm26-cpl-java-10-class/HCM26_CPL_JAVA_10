import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scoreAppealApi } from "@/api/features/score-appeal.api";
import {
  SCORE_APPEAL_STATUS_LABEL_EN,
  type ScoreAppealDTO,
  type ScoreAppealStatus,
} from "@/types/features/score-appeal";
import { formatScore } from "@/utils/examScore";
import AppealReviewDialog from "./AppealReviewDialog";

const STATUS_OPTIONS: { value: ScoreAppealStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function statusVariant(status: ScoreAppealStatus) {
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

export default function ScoreAppealsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ScoreAppealStatus | "ALL">("ALL");
  const [examFilter, setExamFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedAppeal, setSelectedAppeal] = useState<ScoreAppealDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const appealsQuery = useQuery({
    queryKey: ["score-appeals"],
    queryFn: scoreAppealApi.getAll,
  });

  const appeals = appealsQuery.data ?? [];

  const examOptions = useMemo(() => {
    const map = new Map<number, string>();
    appeals.forEach((a) => {
      if (a.examId != null) {
        map.set(a.examId, a.examTitle || `Exam #${a.examId}`);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [appeals]);

  const filtered = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return appeals.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (examFilter !== "all" && String(a.examId) !== examFilter) return false;
      if (keyword) {
        const haystack = `${a.studentName ?? ""} ${a.examTitle ?? ""} ${a.reason ?? ""}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }, [appeals, statusFilter, examFilter, searchText]);

  const pendingCount = appeals.filter((a) => a.status === "PENDING").length;

  return (
    <MainLayout pathName={{ exams: "Exam Management", appeals: "Score Appeals" }}>
      <div className="space-y-5 p-4">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-semibold">Score Appeals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {appeals.length} appeal{appeals.length === 1 ? "" : "s"} · {pendingCount} pending review
            </p>
          </div>
          <Button variant="outline" onClick={() => void queryClient.invalidateQueries({ queryKey: ["score-appeals"] })}>
            Refresh
          </Button>
        </header>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <label className="mb-1.5 block text-sm font-medium">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ScoreAppealStatus | "ALL")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-64">
            <label className="mb-1.5 block text-sm font-medium">Exam</label>
            <Select value={examFilter} onValueChange={setExamFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All exams</SelectItem>
                {examOptions.map((opt) => (
                  <SelectItem key={opt.id} value={String(opt.id)}>
                    {opt.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-56">
            <label className="mb-1.5 block text-sm font-medium">Search by name / reason</label>
            <Input
              placeholder="Enter a keyword..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {appealsQuery.isLoading && (
              <p className="p-4 text-sm text-muted-foreground">Loading appeals...</p>
            )}
            {appealsQuery.isError && (
              <p className="p-4 text-sm text-destructive">Could not load the appeal list.</p>
            )}
            {!appealsQuery.isLoading && !appealsQuery.isError && filtered.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No appeals found.</p>
            )}

            {filtered.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Current Score</TableHead>
                    <TableHead>Requested Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((appeal) => (
                    <TableRow key={appeal.id}>
                      <TableCell className="font-medium">
                        {appeal.examTitle || `Exam #${appeal.examId}`}
                        <p className="text-xs text-muted-foreground">Attempt #{appeal.attemptNumber}</p>
                      </TableCell>
                      <TableCell>{appeal.studentName || "-"}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate" title={appeal.reason}>
                          {appeal.reason}
                        </p>
                      </TableCell>
                      <TableCell>{formatScore(appeal.oldScore)}</TableCell>
                      <TableCell>
                        {appeal.requestedScore != null ? formatScore(appeal.requestedScore) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(appeal.status)}>
                          {SCORE_APPEAL_STATUS_LABEL_EN[appeal.status]}
                        </Badge>
                        {appeal.newScore != null && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            → {formatScore(appeal.newScore)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(appeal.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAppeal(appeal);
                            setDialogOpen(true);
                          }}
                        >
                          {appeal.status === "PENDING" ? "Review" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AppealReviewDialog
        appeal={selectedAppeal}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onReviewed={() => {
          void queryClient.invalidateQueries({ queryKey: ["score-appeals"] });
        }}
      />
    </MainLayout>
  );
}
