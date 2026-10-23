import { studentScoreApi } from "@/api/features/demo/student_score.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentScoreColumnDTO, StudentScoreDTO } from "@/types/features/demo/student_score";
import { useQuery } from "@tanstack/react-query";

const toColumns = (score: StudentScoreDTO): StudentScoreColumnDTO[] => {
  if (score.scoreColumns?.length) return score.scoreColumns;
  if (Array.isArray(score.scores)) return score.scores;
  return Object.entries(score.scores ?? {}).map(([key, value]) => ({ key, label: key, value }));
};

export default function MyScoresPage() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["my-scores"],
    queryFn: studentScoreApi.getMine,
  });

  return (
    <MainLayout pathName={{ "my-scores": "My Scores" }}>
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold">My Scores</h1>
        {isLoading && <p className="text-muted-foreground">Loading...</p>}
        {isError && <p className="text-destructive">Could not load scores.</p>}
        {!isLoading && !isError && data.length === 0 && (
          <p className="text-muted-foreground">No released scores yet.</p>
        )}
        {data.map((score) => (
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
      </div>
    </MainLayout>
  );
}
