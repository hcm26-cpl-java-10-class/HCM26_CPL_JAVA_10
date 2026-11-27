import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  learningLevelLabels,
  learningRoadmapApi,
  learningRoadmapKey,
  roadmapErrorStatus,
  useLearningRoadmap,
  type LearningLevel,
  type RoadmapGoal,
} from "@/api/features/learning-roadmap.api";

const initialGoal: RoadmapGoal = {
  careerGoal: "",
  currentLevel: "BEGINNER",
  hoursPerWeek: 8,
  durationMonths: 3,
  durationWeeks: 12,
};

export function LearningGoalCard({ account, onSaved }: { account: string; onSaved?: () => void }) {
  const [draft, setDraft] = useState<RoadmapGoal | null>(null);
  const { hash } = useLocation();
  const client = useQueryClient();
  const query = useLearningRoadmap(account);
  const save = useMutation({
    mutationFn: ({ goal, revision }: { goal: RoadmapGoal; revision: number | null }) =>
      learningRoadmapApi.saveGoal(goal, revision),
    onSuccess: async (updated) => {
      const queryKey = learningRoadmapKey(account);
      await client.cancelQueries({ queryKey, exact: true });
      if (client.getQueryState(queryKey)) client.setQueryData(queryKey, updated);
      setDraft(null);
      onSaved?.();
    },
  });

  useEffect(() => {
    if (hash === "#learning-goal") document.getElementById("learning-goal")?.scrollIntoView();
  }, [hash]);

  const goal = draft ?? query.data?.goal ?? initialGoal;
  const update = (change: Partial<RoadmapGoal>) => {
    if (save.isSuccess) save.reset();
    setDraft({ ...goal, ...change });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.data || !goal.careerGoal.trim()) return;
    save.mutate({ goal: { ...goal, careerGoal: goal.careerGoal.trim() }, revision: query.data.revision });
  };

  return (
    <section id="learning-goal" aria-label="Personal learning goal" className={onSaved ? "space-y-4" : "scroll-mt-4 space-y-4 rounded-xl border bg-card p-5"}>
      {!onSaved && <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="learning-goal-heading" className="text-lg font-semibold">Personal learning goal</h2>
        <Link to="/my-learning" className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline">
          View AI roadmap
        </Link>
      </div>}
      {query.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Loading your learning goal…</p>
      ) : query.isError ? (
        <div role="alert" className="space-y-2 text-sm">
          <p className="text-destructive">Your learning goal could not be loaded.</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Career goal
              <Input required pattern=".*\S.*" maxLength={150} value={goal.careerGoal}
                aria-describedby="career-goal-example"
                onChange={(event) => update({ careerGoal: event.target.value })} />
              <span id="career-goal-example" className="text-xs font-normal text-muted-foreground">
                Example: Java Backend Developer
              </span>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Current level
              <select value={goal.currentLevel}
                onChange={(event) => update({ currentLevel: event.target.value as LearningLevel })}
                className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
                {Object.entries(learningLevelLabels).map(([level, label]) => <option key={level} value={level}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Study hours per week
              <Input required type="number" min={1} max={40} step={1}
                value={Number.isNaN(goal.hoursPerWeek) ? "" : goal.hoursPerWeek}
                onChange={(event) => update({ hoursPerWeek: event.target.valueAsNumber })} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Target duration in weeks
              <Input required type="number" min={1} max={48} step={1}
                value={Number.isNaN(goal.durationWeeks) ? "" : (goal.durationWeeks ?? goal.durationMonths * 4)}
                onChange={(event) => update({ durationWeeks: event.target.valueAsNumber })} />
            </label>
          </fieldset>
          {query.data.generatedAt && draft && (
            <p className="text-sm text-muted-foreground">Your saved roadmap will remain visible until you generate a replacement.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save learning goal"}
            </Button>
            {save.isSuccess && <p role="status" className="text-sm text-muted-foreground">Goal saved.</p>}
          </div>
          {save.isError && (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              {roadmapErrorStatus(save.error) === 409 ? (
                <>
                  <p>Your goal changed in another session. Reload it before saving again.</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => {
                    save.reset();
                    setDraft(null);
                    void query.refetch();
                  }}>Reload goal</Button>
                </>
              ) : <p>Could not save your learning goal. Check your inputs and try again.</p>}
            </div>
          )}
        </form>
      )}
    </section>
  );
}
