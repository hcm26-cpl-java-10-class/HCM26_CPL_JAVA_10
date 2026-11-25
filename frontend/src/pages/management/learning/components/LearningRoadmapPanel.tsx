import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Settings2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useCourseEnrollment } from "@/pages/management/demo/course/hooks/useCourseEnrollment";
import { LearningGoalCard } from "@/pages/management/profile/components/LearningGoalCard";
import {
  learningLevelLabels, learningRoadmapApi, learningRoadmapKey, roadmapErrorMessage,
  roadmapErrorStatus, type LearningRoadmap, type RoadmapCourse,
} from "@/api/features/learning-roadmap.api";

const courseLabels = {
  COMPLETED: "Completed", IN_PROGRESS: "In progress", ENROLLED: "Enrolled",
  PLANNED: "Not started", UNAVAILABLE: "Unavailable",
};

function phaseComplete(phase: LearningRoadmap["phases"][number]) {
  return phase.courses.length > 0 && phase.courses.every(course => course.status === "COMPLETED");
}

function nextPhaseIndex(phases: LearningRoadmap["phases"]) {
  return phases.findIndex(phase => !phaseComplete(phase) && phase.courses.some(
    course => course.status !== "COMPLETED" && course.status !== "UNAVAILABLE",
  ));
}

function GoalEditor({ account, hasGoal }: { account: string; hasGoal: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><Settings2 aria-hidden="true" />{hasGoal ? "Edit learning goal" : "Set learning goal"}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{hasGoal ? "Edit learning goal" : "Set learning goal"}</DialogTitle>
          <DialogDescription>Set your career target and the time you have to study.</DialogDescription>
        </DialogHeader>
        <LearningGoalCard account={account} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RoadmapSource({ roadmap }: { roadmap: LearningRoadmap }) {
  return (
    <>
      {(roadmap.source === "RULE_BASED" || roadmap.source === "RULE_BASED_WITH_AI_ADVICE")
        && <Badge variant="secondary">Catalog-based roadmap</Badge>}
      {roadmap.source === "RULE_BASED_WITH_AI_ADVICE" && <Badge variant="outline">AI study advice added</Badge>}
      {roadmap.outdated && <Badge variant="outline">Goal changed · regenerate to update</Badge>}
    </>
  );
}

function CourseLink({ course }: { course: RoadmapCourse }) {
  const { effectivePermissions } = usePermissions();
  if (course.status === "UNAVAILABLE") return null;
  const canContinue = course.enrollmentId != null && effectivePermissions.includes("LESSON_PROGRESS_READ");
  const label = course.status === "COMPLETED" ? "Review course" : canContinue ? "Continue learning" : "View course";
  const to = canContinue ? `/enrollments/${course.enrollmentId}/learn` : `/courses/${course.id}`;
  return <Button asChild size="sm" variant="outline"><Link to={to}>{label}<ArrowRight aria-hidden="true" /></Link></Button>;
}

export function LearningRoadmapSummary({ roadmap, account, loading, onView }: {
  roadmap?: LearningRoadmap; account: string; loading: boolean; onView: () => void;
}) {
  const phases = roadmap?.phases ?? [];
  const active = nextPhaseIndex(phases);
  const current = phases[active];
  const course = current?.courses.find(item => item.status === "IN_PROGRESS")
    ?? current?.courses.find(item => item.status === "ENROLLED" || item.status === "PLANNED");
  const goal = roadmap?.goal;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="roadmap-summary-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold" id="roadmap-summary-heading">
          <Sparkles aria-hidden="true" className="size-5 text-primary" /> Your Learning Roadmap
        </h2>
        {roadmap && <GoalEditor account={account} hasGoal={!!goal} />}
      </div>
      {goal ? (
        <>
          <div>
            <p className="text-lg font-semibold wrap-anywhere">{goal.careerGoal}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {learningLevelLabels[goal.currentLevel]} · {goal.hoursPerWeek} hours/week · {roadmap.targetWeeks} weeks
            </p>
          </div>
          <div className="flex flex-wrap gap-2 empty:hidden"><RoadmapSource roadmap={roadmap} /></div>
          {phases.length > 0 ? (
            <>
              <ol aria-label="Roadmap phases" className="flex flex-wrap gap-x-1.5 gap-y-3">
                {phases.map((phase, index) => {
                  const completed = phaseComplete(phase);
                  return (
                    <li key={phase.startWeek} aria-current={index === active ? "step" : undefined} className="min-w-20 flex-1">
                      <div aria-hidden="true" className={cn("h-2 rounded-full", completed ? "bg-emerald-600" : index === active ? "bg-primary" : "bg-muted")} />
                      <p className="mt-1 text-xs wrap-anywhere text-muted-foreground">
                        <span className="sr-only">{completed ? "Completed: " : index === active ? "Current: " : "Upcoming: "}</span>
                        {phase.title}
                      </p>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current phase</p>
                  <p className="mt-1 font-semibold">{current?.title ?? (phases.every(phaseComplete) ? "Roadmap completed" : "No available next phase")}</p>
                  {course && <p className="text-sm text-muted-foreground">{course.title}</p>}
                </div>
                {course && <CourseLink course={course} />}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Open My Roadmap to generate a plan for this goal.</p>}
        </>
      ) : <p className="text-sm text-muted-foreground" role={loading ? "status" : undefined}>
        {roadmap ? "Set a learning goal to get a personalized roadmap." : loading ? "Loading your roadmap…" : "Open My Roadmap to retry loading your saved plan."}
      </p>}
      <Button variant="outline" size="sm" className="w-full" onClick={onView}>View full roadmap <ArrowRight aria-hidden="true" /></Button>
    </section>
  );
}

function Timeline({ phases }: { phases: LearningRoadmap["phases"] }) {
  const active = nextPhaseIndex(phases);
  const { canEnroll, enrollMutation } = useCourseEnrollment();
  return (
    <section aria-labelledby="timeline-heading" className="space-y-4">
      <h3 id="timeline-heading" className="text-lg font-semibold">Learning timeline</h3>
      <ol className="ml-3 space-y-4 border-l">
        {phases.map((phase, index) => {
          const completed = phaseComplete(phase);
          const current = index === active;
          const status = completed ? "Completed" : current ? "Current phase"
            : phase.courses.every(course => course.status === "UNAVAILABLE") ? "Unavailable" : "Upcoming";
          return (
            <li key={phase.startWeek} className="relative pl-6 sm:pl-8" aria-current={current ? "step" : undefined}>
              <span aria-hidden="true" className={cn("absolute -left-3 top-4 grid size-6 place-items-center rounded-full text-xs font-semibold",
                completed ? "bg-emerald-700 text-white" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{index + 1}</span>
              <div className={cn("rounded-xl border bg-card p-4", completed && "border-emerald-600/40", current && "border-primary/40")}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      Phase {index + 1} · {phase.startWeek === phase.endWeek ? `Week ${phase.startWeek}` : `Weeks ${phase.startWeek}–${phase.endWeek}`}
                    </p>
                    <h4 className="mt-1 font-semibold wrap-anywhere">{phase.title}</h4>
                  </div>
                  <Badge variant={current ? "default" : "secondary"} className={cn("self-start", completed && "bg-emerald-700 text-white")}>{status}</Badge>
                </div>
                {phase.objective && <p className="mt-2 text-sm text-muted-foreground">{phase.objective}</p>}
                <ul className="mt-3 divide-y border-t">
                  {phase.courses.map(course => (
                    <li key={course.id} className="space-y-2 py-3 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold wrap-anywhere">{course.title}</p>
                        <Badge variant="outline">{courseLabels[course.status]}</Badge>
                      </div>
                      {phase.reasons?.[course.id] && <p className="text-sm text-muted-foreground">{phase.reasons[course.id]}</p>}
                      {course.status !== "UNAVAILABLE" && (
                        <p className="text-xs text-muted-foreground">{course.durationMinutes == null ? "Workload unknown" : `${course.durationMinutes} min of course content`}</p>
                      )}
                      {course.progressPercent != null && (
                        <div className="flex items-center gap-2">
                          <Progress value={course.progressPercent} aria-label={`${course.title} progress`} />
                          <span className="text-xs tabular-nums">{course.progressPercent}%</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 empty:hidden">
                        <CourseLink course={course} />
                        {canEnroll && course.status === "PLANNED" && (
                          <Button size="sm" disabled={enrollMutation.isPending} onClick={() => enrollMutation.mutate(course.id)}>Enroll</Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function LearningRoadmapPanel({ account, roadmap, loading, error, reload }: {
  account: string; roadmap?: LearningRoadmap; loading: boolean; error: boolean; reload: () => void;
}) {
  const client = useQueryClient();
  const updateSavedRoadmap = async (updated: LearningRoadmap) => {
    const queryKey = learningRoadmapKey(account);
    await client.cancelQueries({ queryKey, exact: true });
    if (client.getQueryState(queryKey)) client.setQueryData(queryKey, updated);
  };
  const generation = useMutation({
    mutationFn: (revision: number) => learningRoadmapApi.generate(revision, true),
    onSuccess: updateSavedRoadmap,
  });
  const advice = useMutation({
    mutationFn: learningRoadmapApi.advise,
    onSuccess: updateSavedRoadmap,
  });
  const status = roadmapErrorStatus(generation.error);
  const phases = roadmap?.phases ?? [];
  const courses = phases.flatMap(phase => phase.courses);
  const completedCourses = courses.filter(course => course.status === "COMPLETED").length;
  const completion = courses.length > 0 ? Math.round(completedCourses * 100 / courses.length) : null;
  const goal = roadmap?.goal;
  const generate = () => {
    advice.reset();
    if (roadmap?.revision != null) generation.mutate(roadmap.revision);
  };

  return (
    <section className="space-y-5" aria-labelledby="learning-roadmap-heading">
      <div>
        <h2 id="learning-roadmap-heading" className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles aria-hidden="true" className="size-5 text-primary" /> Your Learning Roadmap
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">A personalized learning path based on your goal and the course catalog.</p>
      </div>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading your roadmap…</p>
        : error && !roadmap ? (
          <div role="alert" className="space-y-2 text-sm"><p>Could not load your roadmap.</p><Button size="sm" variant="outline" onClick={reload}>Try again</Button></div>
        ) : !goal || !roadmap ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Set your career goal and study schedule to begin.</p><GoalEditor account={account} hasGoal={false} />
          </div>
        ) : (
          <>
            <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Career goal</p>
                  <h3 className="mt-0.5 text-lg font-semibold wrap-anywhere">{goal.careerGoal}</h3>
                </div>
                <GoalEditor account={account} hasGoal />
              </div>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Skill level</dt><dd className="font-medium">{learningLevelLabels[goal.currentLevel]}</dd></div>
                <div><dt className="text-muted-foreground">Weekly commitment</dt><dd className="font-medium">{goal.hoursPerWeek} hours</dd></div>
                <div><dt className="text-muted-foreground">Target duration</dt><dd className="font-medium">{roadmap.targetWeeks} weeks</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2 empty:hidden"><RoadmapSource roadmap={roadmap} /></div>
              {roadmap.generatedAt && <p className="text-xs text-muted-foreground">Last updated {new Date(roadmap.generatedAt).toLocaleString()}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" disabled={generation.isPending || advice.isPending} onClick={generate}>
                  {generation.isPending ? "Building roadmap…" : phases.length ? "Update roadmap" : "Create roadmap"}
                </Button>
                <p className="max-w-[65ch] text-xs text-muted-foreground">
                  Courses and weeks are selected from the LMS catalog using your goal, level and study budget.
                </p>
              </div>
              {generation.isSuccess && <p role="status" className="text-sm">Roadmap saved.</p>}
              {generation.isError && (
                <div role="alert" className="space-y-2 text-sm text-destructive">
                  <p>{roadmapErrorMessage(generation.error) ?? (status === 409 ? "Your goal changed in another session." :
                    status === 429 ? "Wait a moment before generating again." :
                    "Could not create a roadmap. Try again later.")}</p>
                  {status === 409 && <Button size="sm" variant="outline" onClick={() => { generation.reset(); reload(); }}>Reload roadmap</Button>}
                </div>
              )}
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Roadmap progress</dt>
                <dd className="text-xl font-semibold tabular-nums">{completion == null ? "—" : `${completion}%`}</dd>
                <Progress value={completion} aria-label="Roadmap progress" />
                <p className="text-xs text-muted-foreground">Completed courses ÷ all courses in this roadmap.</p>
              </div>
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Completed phases</dt>
                <dd className="text-xl font-semibold tabular-nums">{phases.filter(phaseComplete).length} / {phases.length}</dd>
              </div>
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Study budget</dt>
                <dd className="text-xl font-semibold tabular-nums">{goal.hoursPerWeek * (roadmap.targetWeeks ?? 0)} hours</dd>
                <p className="text-xs text-muted-foreground">Weekly commitment × target weeks.</p>
              </div>
            </dl>
            {phases.length > 0 ? (
              <>
                {(roadmap.title || roadmap.summary) && <div>{roadmap.title && <h3 className="font-semibold">{roadmap.title}</h3>}
                  {roadmap.summary && <p className="text-sm text-muted-foreground">{roadmap.summary}</p>}</div>}
                <Timeline phases={phases} />
              </>
            ) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Generate a roadmap to see courses arranged by week.</p>}
            {phases.length > 0 && (
              <section className="space-y-2 rounded-xl border bg-card p-4">
                <h3 className="font-semibold">AI learning advice</h3>
                <p className="text-sm text-muted-foreground">Get study suggestions for the courses in your saved roadmap.</p>
                <Button size="sm" variant="outline" disabled={!roadmap.aiAvailable || roadmap.outdated || advice.isPending || generation.isPending}
                  onClick={() => {
                    if (roadmap.revision != null) advice.mutate(roadmap.revision);
                  }}>
                  <Sparkles aria-hidden="true" />{advice.isPending ? "Getting advice…" : roadmap.advice?.length ? "Refresh AI advice" : "Get AI advice"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {roadmap.outdated ? "Update the roadmap for your current goal before requesting advice."
                    : !roadmap.aiAvailable ? "AI advice is unavailable. Your saved roadmap is ready to use."
                    : "Requesting advice shares your goal, selected course titles and completion status with the AI provider."}
                </p>
                {roadmap.advice?.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {roadmap.advice.map((tip, index) => <li key={index}>{tip}</li>)}
                </ul>}
                {advice.isSuccess && <p role="status" className="text-sm">Study advice saved.</p>}
                {advice.isError && <div role="status" className="space-y-2 text-sm text-muted-foreground">
                  <p>{roadmapErrorStatus(advice.error) === 503 ? "AI study advice is temporarily unavailable. Try again later."
                    : roadmapErrorMessage(advice.error) ?? (roadmapErrorStatus(advice.error) === 409
                    ? "Your goal or roadmap changed. Reload before requesting advice."
                    : roadmapErrorStatus(advice.error) === 429 ? "Wait a moment before requesting advice again."
                    : "AI advice could not be loaded. You can keep learning with the saved roadmap.")}</p>
                  {roadmapErrorStatus(advice.error) === 409 && <Button variant="outline" size="sm"
                    onClick={() => { advice.reset(); reload(); }}>Reload roadmap</Button>}
                  <p className="text-muted-foreground">Your saved courses and weekly schedule are available.</p>
                </div>}
              </section>
            )}
          </>
        )}
    </section>
  );
}
