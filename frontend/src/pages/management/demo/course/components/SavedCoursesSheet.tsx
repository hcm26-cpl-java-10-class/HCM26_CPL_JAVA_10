import { courseBookmarkApi } from "@/api/features/demo/course-bookmark.api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Eye, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCourseBookmarks } from "../hooks/useCourseBookmarks";
import { LEVEL_LABEL, formatTotalDuration } from "../utils/course.utils";

export function SavedCoursesTrigger() {
  const { canBookmark, savedCount } = useCourseBookmarks();
  const [open, setOpen] = useState(false);

  if (!canBookmark) return null;

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Bookmark className="mr-2 size-4" />
        Saved courses ({savedCount})
      </Button>
      <SavedCoursesSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CourseRowBookmarkAction({ row }: { row: any }) {
  const { canBookmark, savedCourseIds, togglingCourseId, toggleBookmark } = useCourseBookmarks();
  const courseId = Number(row?.id);

  if (!canBookmark || !Number.isInteger(courseId) || courseId <= 0) return null;
  if (row?.status !== "PUBLISHED" || row?.isActive === false) return null;

  const isSaved = savedCourseIds.has(courseId);
  const isSaving = togglingCourseId === courseId;

  return (
    <ActionButton
      onClick={() => toggleBookmark(courseId)}
      disabled={isSaving}
      tooltip={isSaved ? "Remove bookmark" : "Save for later"}
      icon={
        <Bookmark
          size={11}
          className={
            isSaved
              ? "fill-slate-900 text-slate-900 dark:fill-slate-100 dark:text-slate-100"
              : "text-slate-500"
          }
        />
      }
    />
  );
}

function SavedCoursesSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const { savedCourseIds, togglingCourseId, toggleBookmark } = useCourseBookmarks(open);

  const savedQuery = useQuery({
    queryKey: ["course-bookmarks", "sheet", user?.email, search.trim()],
    queryFn: () =>
      courseBookmarkApi.getSavedCourses({
        search: search.trim() || undefined,
        page: 0,
        size: 50,
        sort: "createdAt,desc",
      }),
    enabled: open && Boolean(user?.email),
  });

  const courses = savedQuery.data?.content ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bookmark className="size-5" />
            Saved courses ({savedCourseIds.size})
          </SheetTitle>
          <SheetDescription>
            Courses you bookmarked for quick access and review.
          </SheetDescription>
        </SheetHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search saved courses"
            placeholder="Search saved courses..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
          {savedQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading saved courses...</p>
          ) : savedQuery.isError ? (
            <div className="space-y-2 rounded-xl border border-destructive/30 p-3">
              <p className="text-sm text-destructive">Could not load saved courses.</p>
              <Button size="sm" variant="outline" onClick={() => void savedQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <Bookmark className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 font-medium">
                {search.trim() ? "No matching saved courses" : "No saved courses yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search.trim()
                  ? "Try a different keyword."
                  : "Use the bookmark button on any published course to save it here."}
              </p>
            </div>
          ) : (
            courses.map((course) => (
              <div
                key={course.id}
                className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {course.categoryName && (
                      <Badge variant="outline" className="text-[11px]">
                        {course.categoryName}
                      </Badge>
                    )}
                    {course.level && (
                      <Badge
                        variant="secondary"
                        className="bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {LEVEL_LABEL[course.level]}
                      </Badge>
                    )}
                  </div>
                  <Link
                    to={`/courses/${course.id}`}
                    onClick={() => onOpenChange(false)}
                    className="block truncate font-semibold hover:underline"
                  >
                    {course.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {course.instructor || "Course instructor"} · {course.lessonCount} lessons ·{" "}
                    {formatTotalDuration(course.totalDuration)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/courses/${course.id}`} onClick={() => onOpenChange(false)}>
                      <Eye className="size-3.5" />
                      Detail
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove bookmark for ${course.name}`}
                    disabled={togglingCourseId === course.id}
                    onClick={() => toggleBookmark(course.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
