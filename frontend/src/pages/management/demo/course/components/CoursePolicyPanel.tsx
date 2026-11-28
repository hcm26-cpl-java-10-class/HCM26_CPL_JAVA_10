import { courseApi, coursePolicyApi } from "@/api";
import { prerequisitesQueryKey } from "@/api/features/demo/course-policy.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePermissions } from "@/hooks/usePermissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function errorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

/** Shared by the panel and the Enroll button so both read one cached request. */
export function usePrerequisites(courseId: number, enabled = true) {
  return useQuery({
    queryKey: prerequisitesQueryKey(courseId),
    queryFn: () => coursePolicyApi.getPrerequisites(courseId),
    enabled,
  });
}

/**
 * Completion rule + prerequisites of a course.
 * Everyone sees what is required; users with COURSE_UPDATE can edit it.
 */
export function CoursePolicyPanel({ courseId }: { courseId: number }) {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("COURSE_UPDATE");

  return (
    <section className="mt-4 space-y-5 rounded-xl border bg-card p-4 shadow-sm" aria-label="Course requirements">
      <CompletionRuleSection courseId={courseId} canEdit={canEdit} />
      <PrerequisiteSection courseId={courseId} canEdit={canEdit} />
    </section>
  );
}

function CompletionRuleSection({ courseId, canEdit }: { courseId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const ruleQuery = useQuery({
    queryKey: ["course-completion-rule", courseId],
    queryFn: () => coursePolicyApi.getCompletionRule(courseId),
  });
  const [percent, setPercent] = useState(100);
  const [requirePass, setRequirePass] = useState(true);

  useEffect(() => {
    if (ruleQuery.data) {
      setPercent(ruleQuery.data.minLessonPercent);
      setRequirePass(ruleQuery.data.requireAssessmentsPass);
    }
  }, [ruleQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      coursePolicyApi.saveCompletionRule(courseId, { minLessonPercent: percent, requireAssessmentsPass: requirePass }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["course-completion-rule", courseId] });
      toast.success("Completion rule saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save the completion rule.")),
  });

  const valid = Number.isInteger(percent) && percent >= 1 && percent <= 100;
  const rule = ruleQuery.data;

  return (
    <div>
      <h2 className="text-base font-semibold">How to complete this course</h2>
      {ruleQuery.isLoading && <p className="mt-1 text-sm text-muted-foreground">Loading…</p>}
      {ruleQuery.isError && <p className="mt-1 text-sm text-destructive">Could not load the completion rule.</p>}

      {rule && !canEdit && (
        <p className="mt-1 text-sm text-muted-foreground">
          Finish at least {rule.minLessonPercent}% of the lessons
          {rule.requireAssessmentsPass ? " and pass the graded assessments" : ""} to earn your certificate.
        </p>
      )}

      {rule && canEdit && (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor={`min-percent-${courseId}`}>Minimum lessons completed (%)</label>
            <Input
              id={`min-percent-${courseId}`}
              type="number"
              min={1}
              max={100}
              className="w-24"
              value={Number.isNaN(percent) ? "" : percent}
              onChange={(e: any) => setPercent(e.target.value === "" ? NaN : Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requirePass} onChange={(e) => setRequirePass(e.target.checked)} />
            Learner must also pass the graded assessments
          </label>
          {!valid && <p className="text-xs text-destructive">Enter a whole number from 1 to 100.</p>}
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
              {save.isPending ? "Saving…" : "Save rule"}
            </Button>
            {!rule.customized && (
              <span className="text-xs text-muted-foreground">Default: 100% of lessons and pass assessments.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PrerequisiteSection({ courseId, canEdit }: { courseId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const prerequisitesQuery = usePrerequisites(courseId);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);

  const candidates = useQuery({
    queryKey: ["prerequisite-candidates", debounced],
    queryFn: () => courseApi.getPage({ page: 0, size: 8 }, debounced || undefined),
    enabled: canEdit && debounced.trim().length >= 2,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: prerequisitesQueryKey(courseId) });

  const add = useMutation({
    mutationFn: (prerequisiteId: number) => coursePolicyApi.addPrerequisite(courseId, prerequisiteId),
    onSuccess: async () => {
      await refresh();
      setSearch("");
      toast.success("Prerequisite added.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not add the prerequisite.")),
  });

  const remove = useMutation({
    mutationFn: (prerequisiteId: number) => coursePolicyApi.removePrerequisite(courseId, prerequisiteId),
    onSuccess: async () => {
      await refresh();
      toast.success("Prerequisite removed.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not remove the prerequisite.")),
  });

  const items = prerequisitesQuery.data ?? [];
  const existingIds = new Set(items.map((item) => item.courseId));
  const results = (candidates.data?.content ?? candidates.data?.items ?? []).filter(
    (c) => c.id !== undefined && c.id !== courseId && !existingIds.has(c.id),
  );

  return (
    <div>
      <h2 className="text-base font-semibold">Prerequisites</h2>
      {prerequisitesQuery.isLoading && <p className="mt-1 text-sm text-muted-foreground">Loading…</p>}
      {prerequisitesQuery.isError && <p className="mt-1 text-sm text-destructive">Could not load prerequisites.</p>}
      {prerequisitesQuery.isSuccess && items.length === 0 && (
        <p className="mt-1 text-sm text-muted-foreground">No prerequisites. Anyone can enroll.</p>
      )}

      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.courseId} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              {item.met ? (
                <CheckCircle2 className="size-4 text-emerald-600" aria-label="Completed" />
              ) : (
                <Circle className="size-4 text-muted-foreground" aria-label="Not completed" />
              )}
              {item.courseName}
            </span>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${item.courseName}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(item.courseId)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-3">
          <Input
            value={search}
            placeholder="Search a course to add as prerequisite (min. 2 letters)…"
            onChange={(e: any) => setSearch(e.target.value)}
          />
          {debounced.trim().length >= 2 && candidates.isSuccess && results.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">No matching courses.</p>
          )}
          <ul className="mt-2 space-y-1">
            {results.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                <span>{c.name}</span>
                <Button size="sm" variant="outline" disabled={add.isPending} onClick={() => add.mutate(c.id!)}>
                  <Plus className="mr-1 size-4" /> Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Short notice shown next to the Enroll button when prerequisites are missing. */
export function PrerequisiteNotice({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <span>Complete these courses first: {missing.join(", ")}</span>
    </div>
  );
}
