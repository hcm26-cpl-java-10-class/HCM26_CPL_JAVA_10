import { useState } from "react";
import type { GitPullRequestReview, GitTaskLink } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { GitListPagination } from "./GitListPagination";

function submittedDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

export function GitTaskBadges({ tasks }: { tasks: GitTaskLink[] }) {
  if (!tasks.length) return <>—</>;
  return <div className="min-w-0 space-y-1" title={tasks.map(task => `TASK-${task.taskId}: ${task.title}`).join("; ")}>
    <Badge variant="outline" className="block max-w-full truncate">{tasks[0].title}</Badge>
    {tasks.length > 1 && <span className="block text-xs text-muted-foreground">+{tasks.length - 1} Tasks</span>}
  </div>;
}

export function GitLinkedTasks({ tasks }: { tasks: GitTaskLink[] }) {
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(tasks.length / 5) - 1));
  if (!tasks.length) return <p className="text-sm text-muted-foreground">No Task is linked to this activity.</p>;
  return <div className="space-y-2">
    {tasks.slice(current * 5, current * 5 + 5).map(task => <div key={task.taskId} className="rounded-md border p-2 text-sm">
      {task.title} <span className="text-muted-foreground">· TASK-{task.taskId} · {task.source}</span>
    </div>)}
    {tasks.length > 5 && <GitListPagination page={current} total={tasks.length} pageSize={5} onChange={setPage} label="linked Tasks" />}
  </div>;
}

export function GitSubmittedReviews({ reviews }: { reviews: GitPullRequestReview[] }) {
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(reviews.length / 5) - 1));
  if (!reviews.length) return <p className="text-sm text-muted-foreground">No submitted reviews are available.</p>;
  return <div className="space-y-2">
    {reviews.slice(current * 5, current * 5 + 5).map(review => <div key={review.id}
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
      <div>{review.reviewerName}{review.reviewerLogin && <span className="text-muted-foreground"> (@{review.reviewerLogin})</span>}
        {review.selfReview && <Badge className="ml-2" variant="outline">Self review</Badge>}</div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={review.state === "APPROVED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800" : review.state === "CHANGES_REQUESTED"
          ? "border-rose-200 bg-rose-50 text-rose-800" : "border-sky-200 bg-sky-50 text-sky-800"}>
        {review.state.replaceAll("_", " ")}</Badge>
        <span className="text-xs text-muted-foreground">{submittedDate(review.submittedAt)}</span></div>
    </div>)}
    {reviews.length > 5 && <GitListPagination page={current} total={reviews.length} pageSize={5} onChange={setPage} label="submitted reviews" />}
  </div>;
}
