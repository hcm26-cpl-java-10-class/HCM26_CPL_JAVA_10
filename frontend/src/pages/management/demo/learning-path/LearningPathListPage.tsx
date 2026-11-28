import { learningPathApi } from "@/api";
import { learningPathKeys } from "@/api/features/demo/learning-path.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/hooks/usePermissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Route } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function LearningPathListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("COURSE_CREATE");
  const [name, setName] = useState("");

  const pathsQuery = useQuery({ queryKey: learningPathKeys.all, queryFn: learningPathApi.list });

  const create = useMutation({
    mutationFn: () => learningPathApi.create({ name: name.trim() }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: learningPathKeys.all });
      toast.success("Learning path created. Add its courses next.");
      navigate(`/learning-paths/${created.id}`);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? "Could not create the learning path."),
  });

  const paths = pathsQuery.data ?? [];

  return (
    <MainLayout pathName={{ "learning-paths": "Learning paths" }}>
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">Learning paths</h1>
          <p className="text-muted-foreground">
            Follow a sequence of courses toward one goal. Finish every course to earn a path completion.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/courses">Browse all courses</Link>
          </Button>
        </header>

        {canCreate && (
          <form
            className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <Input
              className="max-w-sm"
              value={name}
              maxLength={150}
              placeholder="New learning path name"
              onChange={(e: any) => setName(e.target.value)}
            />
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create path"}
            </Button>
          </form>
        )}

        {pathsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {pathsQuery.isError && <p className="text-sm text-destructive">Could not load learning paths.</p>}
        {pathsQuery.isSuccess && paths.length === 0 && (
          <p className="rounded-xl border p-6 text-center text-muted-foreground">No learning paths yet.</p>
        )}

        <ul className="grid gap-4 sm:grid-cols-2">
          {paths.map((p) => (
            <li key={p.id}>
              <Link
                to={`/learning-paths/${p.id}`}
                className="block h-full rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Route className="size-4 text-primary" /> {p.name}
                  </h2>
                  {p.completed && <CheckCircle2 className="size-5 text-emerald-600" aria-label="Completed" />}
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                )}
                <div className="mt-3 space-y-1">
                  <Progress value={p.progressPercent} />
                  <p className="text-xs text-muted-foreground">
                    {p.completedCount} of {p.courseCount} courses completed
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </MainLayout>
  );
}
