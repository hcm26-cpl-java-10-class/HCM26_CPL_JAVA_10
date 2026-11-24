import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { learningApi, type LearningInsights } from "@/api/features/learning.api";

const formatScore = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const formatDate = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const summaryHeading = "learning-insights-heading";

function statusCode(error: unknown) {
  return isAxiosError(error) ? error.response?.status : undefined;
}

function LearningEvidence({ snapshot }: { snapshot: LearningInsights["snapshot"] }) {
  const { courseProgress, recentExamResults, canReadProgress, canReadExamResults } = snapshot;
  const completedLessons = courseProgress.reduce((total, course) => total + course.completedLessons, 0);
  const totalLessons = courseProgress.reduce((total, course) => total + course.totalLessons, 0);

  return (
    <>
      <dl className="grid gap-x-6 gap-y-3 border-y py-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Enrolled courses</dt>
          <dd className="font-semibold tabular-nums">{snapshot.enrolledCourses}</dd>
        </div>
        {canReadProgress && (
          <div>
            <dt className="text-sm text-muted-foreground">Lessons completed</dt>
            <dd className="font-semibold tabular-nums">
              {totalLessons > 0 ? `${completedLessons} / ${totalLessons}` : "No tracked lessons"}
            </dd>
          </div>
        )}
        {canReadExamResults && (
          <div>
            <dt className="text-sm text-muted-foreground">Recent published exam results</dt>
            <dd className="font-semibold tabular-nums">{recentExamResults.length}</dd>
          </div>
        )}
      </dl>
      {(courseProgress.length > 0 || recentExamResults.length > 0) && (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
            View progress and results
          </summary>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {courseProgress.length > 0 && (
              <section className="min-w-0">
                <h3 className="text-sm font-semibold">Course progress</h3>
                <ul className="mt-2 divide-y text-sm">
                  {courseProgress.map((course) => (
                    <li key={course.courseId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                      <span className="min-w-0 wrap-anywhere">{course.courseName}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {course.totalLessons > 0
                          ? `${course.completedLessons} / ${course.totalLessons} lessons`
                          : "No tracked lessons"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {recentExamResults.length > 0 && (
              <section className="min-w-0">
                <h3 className="text-sm font-semibold">Published exam results</h3>
                <ul className="mt-2 divide-y text-sm">
                  {recentExamResults.map((exam) => (
                    <li key={exam.examId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                      <div className="min-w-0 wrap-anywhere">
                        <p>{exam.examTitle}</p>
                        <time className="text-xs text-muted-foreground" dateTime={exam.submittedAt}>
                          {formatDate.format(new Date(exam.submittedAt))}
                        </time>
                      </div>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatScore.format(exam.score)} / {formatScore.format(exam.maxScore)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </details>
      )}
    </>
  );
}

export function LearningInsightsPanel({ account }: { account: string }) {
  const query = useQuery({
    queryKey: ["personal-learning-insights", account],
    queryFn: ({ signal }) => learningApi.insights(signal),
    gcTime: 0,
    retry: false,
  });
  const plan = useMutation({ mutationFn: learningApi.generatePlan, retry: false });
  const denied = [401, 403].includes(statusCode(query.error) ?? 0);

  return (
    <section aria-labelledby={summaryHeading} className="space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5">
      <h2 id={summaryHeading} className="text-lg font-semibold">AI Learning Insights</h2>
      {query.isPending ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading learning insights</span>
          <div aria-hidden="true" className="h-4 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
          <div aria-hidden="true" className="h-4 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
        </div>
      ) : query.isError ? (
        <div role="alert" className="space-y-3 text-sm">
          <p className="text-destructive">
            {denied ? "Your account does not have access to learning insights." : "Learning insights could not be loaded."}
          </p>
          {!denied && <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Try again</Button>}
        </div>
      ) : (
        <>
          <LearningEvidence snapshot={query.data.snapshot} />
          {query.data.hasEvidence ? (
            <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
              <div>
                <h3 className="font-semibold">Suggested next step</h3>
                <p className="mt-1 max-w-[70ch] wrap-anywhere">{query.data.nextStep}</p>
              </div>
              {query.data.aiAvailable ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={plan.isPending}
                    aria-describedby="learning-plan-data"
                    onClick={() => plan.mutate()}
                  >
                    <Sparkles aria-hidden="true" />
                    {plan.isPending ? "Generating study plan…" : plan.data ? "Generate new plan" : "Generate AI study plan"}
                  </Button>
                  <p id="learning-plan-data" className="max-w-[60ch] text-xs text-muted-foreground">
                    This shares course and exam titles, lesson counts, and published scores with the AI provider.
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">AI plan generation is unavailable.</p>
              )}
              <div aria-live="polite" aria-atomic="true" className="empty:hidden">
                {plan.isPending && <p className="sr-only">Generating your AI study plan.</p>}
                {plan.isError && (
                  <p className="text-destructive">
                    {statusCode(plan.error) === 429
                      ? "Please wait before generating another plan."
                      : "The AI study plan could not be generated. You can use the suggested next step or try again."}
                  </p>
                )}
                {plan.data && (
                  <div className="space-y-2 border-t pt-3 wrap-anywhere">
                    <h3 className="font-semibold">AI study plan</h3>
                    <p className="max-w-[70ch]">{plan.data.summary}</p>
                    <ol className="max-w-[70ch] list-decimal space-y-1 pl-5">
                      {plan.data.steps.map((step, index) => <li key={index}>{step}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A study plan becomes available when your account has tracked lessons or published exam results.
            </p>
          )}
        </>
      )}
    </section>
  );
}
