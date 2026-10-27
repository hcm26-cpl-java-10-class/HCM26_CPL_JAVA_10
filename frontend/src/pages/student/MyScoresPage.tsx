import { examApi, type PublishedExamScore } from "@/api/features/exam.api";
import { studentScoreApi } from "@/api/features/demo/student_score.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentScoreColumnDTO, StudentScoreDTO } from "@/types/features/demo/student_score";
import { formatScore } from "@/utils/examScore";
import { useQuery } from "@tanstack/react-query";

const toColumns = (score: StudentScoreDTO): StudentScoreColumnDTO[] => {
  if (score.scoreColumns?.length) return score.scoreColumns;
  if (Array.isArray(score.scores)) return score.scores;
  return Object.entries(score.scores ?? {}).map(([key, value]) => ({ key, label: key, value }));
};

function formatSubmittedAt(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function ExamScoreCard({ score }: { score: PublishedExamScore }) {
  const isFinalized = score.finalScore != null;
  const displayScore = isFinalized ? score.finalScore : score.objectiveScore;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{score.examTitle || `Exam #${score.examId}`}</CardTitle>
        <Badge variant={isFinalized ? "default" : "secondary"}>
          {isFinalized ? "Graded" : "Pending grade"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between border-b pb-2 text-base font-semibold">
          <span>{isFinalized ? "Score" : "Provisional score"}</span>
          <span>
            {formatScore(displayScore ?? 0)}/{formatScore(score.maxScore ?? 10)}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Attempt</span>
          <span>{score.attemptNumber}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Submitted at</span>
          <span>{formatSubmittedAt(score.submittedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyScoresPage() {
  const {
    data: examScores = [],
    isLoading: isExamScoresLoading,
    isError: isExamScoresError,
  } = useQuery({
    queryKey: ["my-exam-scores"],
    queryFn: examApi.getMyPublishedExamScores,
  });

  const {
    data: courseScores = [],
    isLoading: isCourseScoresLoading,
    isError: isCourseScoresError,
  } = useQuery({
    queryKey: ["my-scores"],
    queryFn: studentScoreApi.getMine,
  });

  return (
    <MainLayout pathName={{ "my-scores": "My Scores" }}>
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold">My Scores</h1>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Exam Scores</h2>
          {isExamScoresLoading && <p className="text-muted-foreground">Loading...</p>}
          {isExamScoresError && (
            <p className="text-destructive">Could not load exam scores.</p>
          )}
          {!isExamScoresLoading && !isExamScoresError && examScores.length === 0 && (
            <p className="text-muted-foreground">No graded exam attempts yet.</p>
          )}
          {examScores.map((score) => (
            <ExamScoreCard key={`${score.examId}-${score.attemptNumber}`} score={score} />
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Course Scores</h2>
          {isCourseScoresLoading && <p className="text-muted-foreground">Loading...</p>}
          {isCourseScoresError && (
            <p className="text-destructive">Could not load scores.</p>
          )}
          {!isCourseScoresLoading && !isCourseScoresError && courseScores.length === 0 && (
            <p className="text-muted-foreground">No released scores yet.</p>
          )}
          {courseScores.map((score) => (
            <Card key={score.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{score.className || score.studentCode}</CardTitle>
                <Badge variant={score.status === "ADJUSTED" ? "secondary" : "default"}>
                  {score.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {toColumns(score).map((c, i) => (
                  <div key={c.key ?? i} className="flex justify-between">
                    <span>{c.label ?? c.name ?? c.key}</span>
                    <span>{c.value ?? "-"}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Overall</span>
                  <span>{score.overallScore ?? "-"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </MainLayout>
  );
}
