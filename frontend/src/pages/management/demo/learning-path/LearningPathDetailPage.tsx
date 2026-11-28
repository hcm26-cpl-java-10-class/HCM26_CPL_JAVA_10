import { courseApi, learningPathApi } from "@/api";
import { learningPathKeys } from "@/api/features/demo/learning-path.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/hooks/usePermissions";
import type { PathCourseStatus } from "@/types/features/demo/learning-path";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Award, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useDebouncedValue } from "../course/hooks/useDebouncedValue";

const STATUS_LABEL: Record<PathCourseStatus, string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  AVAILABLE: "Ready to start",
  LOCKED: "Locked",
};

const STATUS_STYLE: Record<PathCourseStatus, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  AVAILABLE: "bg-muted text-foreground",
  LOCKED: "bg-amber-100 text-amber-900",
};

function errorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

export default function LearningPathDetailPage() {
  const { id } = useParams();
  const pathId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("COURSE_UPDATE");
  const canDelete = hasPermission("COURSE_DELETE");

  const detailQuery = useQuery({
    queryKey: learningPathKeys.detail(pathId),
    queryFn: () => learningPathApi.get(pathId),
    enabled: Number.isFinite(pathId),
  });
  const detail = detailQuery.data;

  const remove = useMutation({
    mutationFn: () => learningPathApi.remove(pathId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: learningPathKeys.all });
      toast.success("Learning path deleted.");
      navigate("/learning-paths");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not delete the learning path.")),
  });

  return (
    <MainLayout pathName={{ "learning-paths": "Learning paths" }}>
      <div className="mx-auto max-w-4xl space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/learning-paths">← All learning paths</Link>
        </Button>

        {detailQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {detailQuery.isError && <p className="text-sm text-destructive">Could not load this learning path.</p>}

        {detail && (
          <>
            <header className="space-y-2">
              <h1 className="text-3xl font-bold">{detail.name}</h1>
              {detail.description && <p className="text-muted-foreground">{detail.description}</p>}
              <Progress value={detail.progressPercent} />
              <p className="text-sm text-muted-foreground">
                {detail.completedCount} of {detail.courses.length} courses completed ({detail.progressPercent}%)
              </p>
            </header>

            {detail.completed && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900" role="status">
                <Award className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">You completed this learning path!</p>
                  {detail.completionCode && (
                    <p className="text-sm">
                      Completion code: <span className="font-mono font-semibold">{detail.completionCode}</span>
                      {detail.completedAt && <> · {new Date(detail.completedAt).toLocaleDateString()}</>}
                    </p>
                  )}
                </div>
              </div>
            )}

            {detail.courses.length === 0 && (
              <p className="rounded-xl border p-6 text-center text-muted-foreground">
                This path has no courses yet.
              </p>
            )}

            <ol className="space-y-2">
              {detail.courses.map((course) => (
                <li key={course.courseId} className="rounded-xl border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {course.position}
                      </span>
                      <Link to={`/courses/${course.courseId}`} className="font-medium hover:underline">
                        {course.courseName}
                      </Link>
                    </div>
                    <Badge className={STATUS_STYLE[course.status]}>
                      {course.status === "LOCKED" && <Lock className="mr-1 size-3" />}
                      {STATUS_LABEL[course.status]}
                    </Badge>
                  </div>
                  {course.status === "LOCKED" && course.missingPrerequisites.length > 0 && (
                    <p className="mt-1 pl-10 text-sm text-amber-800">
                      Complete first: {course.missingPrerequisites.join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>

            {canEdit && (
              <PathEditor
                key={`${detail.id}-${detail.courses.map((c) => c.courseId).join(",")}`}
                pathId={pathId}
                initialName={detail.name}
                initialDescription={detail.description ?? ""}
                initialCourses={detail.courses.map((c) => ({ id: c.courseId, name: c.courseName }))}
              />
            )}

            {canDelete && (
              <Button
                variant="outline"
                className="text-destructive"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm("Delete this learning path? Completions already earned are kept.")) {
                    remove.mutate();
                  }
                }}
              >
                Delete learning path
              </Button>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

interface EditableCourse {
  id: number;
  name: string;
}

const MAX_COURSES = 12; // keep in sync with PathProgressLogic.MAX_COURSES on the backend

function PathEditor(props: {
  pathId: number;
  initialName: string;
  initialDescription: string;
  initialCourses: EditableCourse[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(props.initialName);
  const [description, setDescription] = useState(props.initialDescription);
  const [courses, setCourses] = useState<EditableCourse[]>(props.initialCourses);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);

  useEffect(() => {
    setName(props.initialName);
    setDescription(props.initialDescription);
    setCourses(props.initialCourses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pathId]);

  const candidates = useQuery({
    queryKey: ["learning-path-candidates", debounced],
    queryFn: () => courseApi.getPage({ page: 0, size: 8 }, debounced),
    enabled: debounced.trim().length >= 2,
  });
  const chosen = new Set(courses.map((c) => c.id));
  const results = (candidates.data?.content ?? candidates.data?.items ?? []).filter(
    (c) => c.id !== undefined && !chosen.has(c.id),
  );

  const save = useMutation({
    mutationFn: async () => {
      await learningPathApi.update(props.pathId, { name: name.trim(), description: description.trim() });
      await learningPathApi.setCourses(props.pathId, courses.map((c) => c.id));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: learningPathKeys.all });
      toast.success("Learning path saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save the learning path.")),
  });

  const move = (index: number, delta: number) =>
    setCourses((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const canSave = name.trim().length > 0 && courses.length > 0 && !save.isPending;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Edit learning path">
      <h2 className="text-lg font-semibold">Edit learning path</h2>
      <Input value={name} maxLength={150} placeholder="Name" onChange={(e: any) => setName(e.target.value)} />
      <textarea
        className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={description}
        maxLength={2000}
        placeholder="Description (optional)"
        onChange={(e) => setDescription(e.target.value)}
      />

      <div>
        <p className="mb-1 text-sm font-medium">Courses in order ({courses.length}/{MAX_COURSES})</p>
        <ul className="space-y-1.5">
          {courses.map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
              <span>
                {i + 1}. {c.name}
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${c.name} down`}
                  disabled={i === courses.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => setCourses((prev) => prev.filter((x) => x.id !== c.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {courses.length < MAX_COURSES && (
        <div>
          <Input
            value={search}
            placeholder="Search a course to add (min. 2 letters)…"
            onChange={(e: any) => setSearch(e.target.value)}
          />
          <ul className="mt-2 space-y-1">
            {results.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                <span>{c.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCourses((prev) => [...prev, { id: c.id!, name: c.name ?? `Course ${c.id}` }]);
                    setSearch("");
                  }}
                >
                  <Plus className="mr-1 size-4" /> Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {courses.length === 0 && <p className="text-xs text-destructive">Add at least one course before saving.</p>}
      <Button onClick={() => save.mutate()} disabled={!canSave}>
        {save.isPending ? "Saving…" : "Save changes"}
      </Button>
    </section>
  );
}
