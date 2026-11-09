import { rubricApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, LockKeyhole } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { RubricStatusBadge } from "../components/RubricStatusBadge";
import { canUseRubricVersionInMilestone } from "../rubric-version-policy";

export function RubricDetailPage() {
  const { rubricId } = useParams<{ rubricId: string }>();
  const query = useQuery({ queryKey: ["rubrics", rubricId], queryFn: () => rubricApi.getDetail(rubricId!), enabled: Boolean(rubricId), retry: false });

  if (query.isLoading) return <MainLayout pathName={{ rubrics: "Rubrics", detail: "Detail" }}><div className="p-8 text-center">Loading rubric…</div></MainLayout>;
  if (query.isError || !query.data) return <MainLayout pathName={{ rubrics: "Rubrics", detail: "Detail" }}><Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load rubric</AlertTitle><AlertDescription><Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Try again</Button></AlertDescription></Alert></MainLayout>;
  const rubric = query.data;

  return (
    <MainLayout pathName={{ rubrics: "Rubrics", [rubric.id]: rubric.name }}>
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><Button variant="ghost" className="mb-2 -ml-3" asChild><Link to="/rubrics"><ArrowLeft /> Back to rubrics</Link></Button><h1 className="break-words text-2xl font-semibold [overflow-wrap:anywhere]">{rubric.name}</h1><p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">{rubric.description || "No description provided."}</p></div><div className="shrink-0 text-sm text-muted-foreground">{rubric.versions.length} version{rubric.versions.length === 1 ? "" : "s"}</div></div>
        {rubric.versions.map((version) => (
          <Card key={version.id} className="min-w-0">
            <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Version {version.versionNumber}</CardTitle>
                  <RubricStatusBadge status={version.status} />
                </div>
                <CardDescription className="mt-2">
                  {version.criteria.length} criteria · {version.totalMaxScore} maximum score · used by {version.milestoneUsageCount} milestone(s)
                </CardDescription>
                <p className={canUseRubricVersionInMilestone(version.status) ? "mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400" : "mt-2 text-xs text-amber-700 dark:text-amber-400"}>
                  {canUseRubricVersionInMilestone(version.status) ? <LockKeyhole className="size-3.5" /> : null}
                  {canUseRubricVersionInMilestone(version.status)
                    ? "Immutable and available to milestones"
                    : "Editable draft and not available to milestones"}
                </p>
              </div>
            </CardHeader>
            <CardContent className="min-w-0"><div className="min-w-0 overflow-x-auto rounded-md border"><Table className="min-w-[680px]"><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Code</TableHead><TableHead>Criterion and rating guidance</TableHead><TableHead className="text-right">Weight</TableHead><TableHead className="text-right">Max score</TableHead></TableRow></TableHeader><TableBody>{version.criteria.map((criterion, index) => <TableRow key={criterion.id}><TableCell>{index + 1}</TableCell><TableCell className="max-w-36 whitespace-normal font-mono text-xs [overflow-wrap:anywhere]">{criterion.code}</TableCell><TableCell className="min-w-0 whitespace-normal [overflow-wrap:anywhere]"><p className="whitespace-pre-wrap font-medium [overflow-wrap:anywhere]">{criterion.name}</p>{criterion.description ? <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground [overflow-wrap:anywhere]">{criterion.description}</p> : null}<div className="mt-3 grid min-w-0 gap-1 text-xs">{criterion.ratings?.map((rating) => <div key={rating.id || rating.level} className="min-w-0 rounded bg-muted/40 px-2 py-1 whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="font-medium">{rating.level.replace("_", " ")} ({rating.percentage}%):</span> <span className="text-muted-foreground">{rating.description}</span></div>)}</div></TableCell><TableCell className="text-right">{criterion.weight}%</TableCell><TableCell className="text-right">{criterion.maxScore}</TableCell></TableRow>)}</TableBody></Table></div></CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  );
}
