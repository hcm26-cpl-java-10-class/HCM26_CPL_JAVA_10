import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Loader2, Search } from "lucide-react";

import { syllabusExtrasApi, type SyllabusCourseUsage } from "@/api/features/demo/syllabus-extras.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/pages/management/demo/course/hooks/useDebouncedValue";

type Props = {
  syllabus: SyllabusCourseUsage | null;
  onClose: () => void;
};

/** Selects only genuinely unlinked Courses. Existing Course data stays untouched. */
export function CourseUsageLinkDialog({ syllabus, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const queryClient = useQueryClient();
  const coursesQuery = useQuery({
    queryKey: ["syllabus-link-candidates", debounced],
    queryFn: () => syllabusExtrasApi.availableCourses(debounced),
    enabled: syllabus !== null && syllabus.syllabusStatus === "PUBLISHED" && syllabus.syllabusActive,
    retry: false,
  });
  const linkMutation = useMutation({
    mutationFn: (courseId: number) => syllabusExtrasApi.linkCourse(syllabus!.syllabusId, courseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["syllabus-course-usage"] });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-link-candidates"] });
      toast.success("Course linked to Syllabus.");
      setSearch("");
      setSelectedId(null);
      onClose();
    },
    onError: () => toast.error("Could not link Course. It may already be linked or the Syllabus may be unavailable."),
  });

  function close() {
    if (linkMutation.isPending) return;
    setSearch("");
    setSelectedId(null);
    onClose();
  }

  const eligible = syllabus?.syllabusStatus === "PUBLISHED" && syllabus.syllabusActive;
  const candidates = coursesQuery.data ?? [];

  return (
    <Dialog open={syllabus !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="w-[min(96vw,680px)] max-w-none gap-0 overflow-hidden p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-2"><Link2 className="size-4" /> Link Existing Course</DialogTitle>
          <DialogDescription>
            {syllabus?.syllabusCode} · {syllabus?.syllabusName}. Only published, active Syllabuses can receive links.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 p-5">
          {!eligible ? (
            <p role="alert" className="text-sm text-muted-foreground">Publish and activate this Syllabus before linking a Course.</p>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search unlinked Courses" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedId(null); }}
                  placeholder="Search by Course name..." className="pl-9" />
              </div>
              <p className="text-xs text-muted-foreground">Only Courses not linked to another Syllabus are shown (up to 40 results).</p>
              <div role="radiogroup" aria-label="Select unlinked Course" className="max-h-[min(42vh,340px)] space-y-2 overflow-y-auto rounded-lg border p-2">
                {coursesQuery.isPending && <p className="p-6 text-center text-sm text-muted-foreground">Loading unlinked Courses...</p>}
                {coursesQuery.isError && (
                  <div className="space-y-2 p-6 text-center text-sm" role="alert">
                    <p>Unable to load available Courses.</p>
                    <Button size="sm" variant="outline" onClick={() => void coursesQuery.refetch()}>Retry</Button>
                  </div>
                )}
                {coursesQuery.isSuccess && !candidates.length && <p className="p-6 text-center text-sm text-muted-foreground">No unlinked Courses match your search.</p>}
                {coursesQuery.isSuccess && candidates.map((course) => (
                  <label key={course.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/60 ${selectedId === course.id ? "border-foreground bg-muted" : "border-transparent"}`}>
                    <input type="radio" name="syllabus-link-course" value={course.id} checked={selectedId === course.id}
                      onChange={() => setSelectedId(course.id)} disabled={linkMutation.isPending} className="size-4 accent-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{course.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{course.status}{!course.active ? " · Inactive" : ""}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={linkMutation.isPending}>Cancel</Button>
          <Button disabled={!eligible || selectedId === null || linkMutation.isPending || coursesQuery.isFetching}
            onClick={() => { if (selectedId !== null) linkMutation.mutate(selectedId); }}>
            {linkMutation.isPending && <Loader2 className="size-4 animate-spin" />} Link Course
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
