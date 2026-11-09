import { milestoneSubmissionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmissionStatusBadge } from "@/pages/management/project/milestone-submission/components/SubmissionStatusBadge";
import type { SubmissionStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarClock, ChevronLeft, ChevronRight, Eye, FileCheck2, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const statuses: Array<{ label: string; value?: SubmissionStatus }> = [
  { label: "All submissions" },
  { label: "Changes requested", value: "CHANGES_REQUESTED" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Awaiting review", value: "SUBMITTED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
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

  return (
    <MainLayout pathName={{ student: "Student", "milestone-submissions": "My Submissions" }}>
      <main className="mx-auto grid w-full max-w-6xl gap-6">
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-50 via-background to-indigo-50 p-6 shadow-sm dark:from-sky-950/30 dark:to-indigo-950/20 sm:p-8">
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3 text-primary"><FileCheck2 className="size-6" /></div>
              <div>
                <p className="text-sm font-medium text-primary">Milestone work</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">My Submissions</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Track your submitted versions, review status, deadlines, and requested changes in one place.</p>
              </div>
            </div>
            <div className="rounded-xl border bg-background/80 px-4 py-3 text-sm shadow-sm">
              <p className="text-muted-foreground">Matching records</p>
              <p className="text-2xl font-semibold">{query.data?.totalElements ?? "—"}</p>
            </div>
          </div>
        </section>

        <Card className="shadow-sm">
          <CardContent className="grid gap-4 p-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter submissions by status">
                {statuses.map((item) => (
                  <Button key={item.label} size="sm" variant={status === item.value ? "default" : "outline"} onClick={() => { setStatus(item.value); setPage(0); }}>
                    {item.label}
                  </Button>
                ))}
              </div>
              <label className="relative block w-full lg:max-w-xs">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search milestone or team" />
              </label>
            </div>
          </CardContent>
        </Card>

        {query.isPending ? (
          <div className="grid gap-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40 rounded-2xl" />)}</div>
        ) : query.isError ? (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle />
            <AlertTitle>Could not load submissions</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>Check your connection and access, then try again.</span>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}><RotateCcw className="size-4" /> Try again</Button>
            </AlertDescription>
          </Alert>
        ) : query.data.content.length === 0 ? (
          <Card className="rounded-2xl border-dashed shadow-sm">
            <CardContent className="grid justify-items-center gap-3 px-6 py-14 text-center">
              <div className="rounded-full bg-muted p-4"><FileCheck2 className="size-7 text-muted-foreground" /></div>
              <div><h2 className="font-semibold">No matching submissions</h2><p className="mt-1 text-sm text-muted-foreground">Try another status or search term. Drafts appear here but are not official submissions until submitted.</p></div>
              {(status || search) && <Button variant="outline" size="sm" onClick={() => { setStatus(undefined); setSearch(""); setPage(0); }}>Clear filters</Button>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {query.data.content.map((item) => {
              const needsRevision = item.status === "CHANGES_REQUESTED";
              return (
                <Card key={item.id} className={`overflow-hidden rounded-2xl shadow-sm transition-shadow hover:shadow-md ${needsRevision ? "border-amber-300 dark:border-amber-700" : ""}`}>
                  {needsRevision && <div className="h-1 bg-amber-400" />}
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 p-5 pb-3">
                    <div className="min-w-0 space-y-1">
                      <CardDescription className="font-medium">{item.teamName}</CardDescription>
                      <CardTitle className="text-lg">{item.milestoneTitle}</CardTitle>
                      <p className="text-sm text-muted-foreground">Version {item.currentVersionNumber} <span className="px-1">·</span> {item.submissionAttempts} {item.submissionAttempts === 1 ? "attempt" : "attempts"}</p>
                    </div>
                    <SubmissionStatusBadge status={item.status} />
                  </CardHeader>
                  <CardContent className="flex flex-col justify-between gap-4 px-5 pb-5 sm:flex-row sm:items-end">
                    <div className="grid gap-2 text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-4" /> Due {new Date(item.deadline).toLocaleString()}</span>
                      {needsRevision && <span className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300"><RotateCcw className="size-4" /> Reviewer requested changes. Next version: {item.currentVersionNumber + 1}.</span>}
                    </div>
                    <Button onClick={() => navigate(`/student/milestone-submissions/${item.id}`)}>
                      <Eye className="size-4" /> {needsRevision ? "View feedback" : item.currentVersionNumber > 1 ? `View ${item.currentVersionNumber} versions` : "View submission"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {query.data && query.data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-3">
            <Button size="sm" variant="outline" disabled={!query.data.hasPrevious} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="size-4" /> Previous</Button>
            <span className="text-sm text-muted-foreground">Page {query.data.page + 1} of {query.data.totalPages}</span>
            <Button size="sm" variant="outline" disabled={!query.data.hasNext} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight className="size-4" /></Button>
          </div>
        )}
      </main>
    </MainLayout>
  );
}
