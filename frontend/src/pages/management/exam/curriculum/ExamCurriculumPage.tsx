import { MainLayout } from "@/components/layout/MainLayout";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  Layers,
  Plus,
  Search,
  Unlink,
} from "lucide-react";

import { courseApi } from "@/api/features/demo/course.api";
import { sectionApi } from "@/api/features/demo/section.api";
import { lessonApi } from "@/api/features/demo/lesson.api";
import { examApi } from "@/api/features/exam.api";
import type { CourseDTO, CourseExam, LessonDTO, SectionDTO } from "@/types";
import { EXAM_CATEGORY_LABEL } from "@/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { CurriculumExamItem } from "./components/CurriculumExamItem";
import { LinkExamModal } from "./components/LinkExamModal";

function SectionLessonsList({
  sectionId,
  courseExams,
  onAttachExam,
  onUnlinkExam,
}: {
  sectionId: number;
  courseExams: CourseExam[];
  onAttachExam: (lesson: LessonDTO) => void;
  onUnlinkExam: (exam: CourseExam) => void;
}) {
  const lessonsQuery = useQuery({
    queryKey: ["section-lessons", sectionId],
    queryFn: () => lessonApi.getBySection(sectionId),
  });

  const lessons: LessonDTO[] = useMemo(() => {
    const raw = lessonsQuery.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any).content)) return (raw as any).content;
    if (Array.isArray((raw as any).items)) return (raw as any).items;
    return [];
  }, [lessonsQuery.data]);

  if (lessonsQuery.isLoading) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        Loading lessons...
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        No lessons configured in this section yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60 rounded-xl border bg-background/50 overflow-hidden">
      {lessons.map((lesson) => {
        const lessonExam = courseExams.find((e) => e.lessonId === lesson.id);

        return (
          <div
            key={lesson.id}
            className="flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/30"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-mono font-semibold text-muted-foreground">
                {lesson.orderIndex}
              </span>
              <div className="min-w-0">
                <span className="font-medium text-xs text-foreground truncate block max-w-md">
                  {lesson.title}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {lesson.contentType} · {lesson.duration ? `${lesson.duration}m` : "No duration"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {lessonExam ? (
                <div className="flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs">
                  <ClipboardCheck className="size-3.5 text-indigo-500 shrink-0" />
                  <a
                    href={`/exams/${lessonExam.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[180px]"
                    title={lessonExam.title}
                  >
                    {lessonExam.title}
                  </a>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-indigo-500/40 text-indigo-400">
                    {EXAM_CATEGORY_LABEL[lessonExam.category] || lessonExam.category}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 p-0 text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10"
                    title="Unlink assessment"
                    onClick={() => onUnlinkExam(lessonExam)}
                  >
                    <Unlink className="size-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-dashed text-muted-foreground hover:text-foreground"
                  onClick={() => onAttachExam(lesson)}
                >
                  <Plus className="size-3" />
                  Attach Assessment
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExamCurriculumPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const parsedCourseId = Number(searchParams.get("courseId"));
  const courseId = Number.isSafeInteger(parsedCourseId) && parsedCourseId > 0 ? parsedCourseId : 0;

  const [courseSearch, setCourseSearch] = useState("");
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<number>>(new Set());
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{
    type: "section" | "lesson";
    id: number;
    title: string;
  } | null>(null);

  const [unlinkTarget, setUnlinkTarget] = useState<CourseExam | null>(null);

  // Queries
  const coursesQuery = useQuery({
    queryKey: ["courses-for-curriculum"],
    queryFn: () => courseApi.getPage({ page: 0, size: 100 }),
  });
  const courses: CourseDTO[] =
    coursesQuery.data?.content ??
    (coursesQuery.data as any)?.data?.items ??
    (Array.isArray(coursesQuery.data) ? (coursesQuery.data as any) : []);

  const sectionsQuery = useQuery({
    queryKey: ["sections-for-curriculum", courseId],
    queryFn: () => sectionApi.getByCourse(courseId),
    enabled: courseId > 0,
  });
  const sections: SectionDTO[] = useMemo(() => {
    const raw = sectionsQuery.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any).content)) return (raw as any).content;
    if (Array.isArray((raw as any).items)) return (raw as any).items;
    if (Array.isArray((raw as any).data?.items)) return (raw as any).data.items;
    return [];
  }, [sectionsQuery.data]);

  const courseExamsQuery = useQuery({
    queryKey: ["course-exams", courseId],
    queryFn: () => examApi.listByCourse(courseId),
    enabled: courseId > 0,
  });
  const courseExams: CourseExam[] = useMemo(() => {
    const raw = courseExamsQuery.data;
    if (Array.isArray(raw)) return raw;
    return [];
  }, [courseExamsQuery.data]);

  // Mutations
  const unlinkExamMutation = useMutation({
    mutationFn: (exam: CourseExam) => examApi.unlinkFromCurriculum(courseId, exam.id, false),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["course-exams", courseId] });
      toast.success("Assessment unlinked successfully");
      setUnlinkTarget(null);
    },
    onError: () => {
      toast.error("Failed to unlink assessment");
    },
  });

  const selectedCourse = courses.find((c) => c.id === courseId);

  const filteredCourses = useMemo(() => {
    const s = courseSearch.trim().toLowerCase();
    if (!s) return courses;
    return courses.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(s) ||
        (c.code || "").toLowerCase().includes(s)
    );
  }, [courses, courseSearch]);

  const toggleSectionLessons = (secId: number) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(secId)) next.delete(secId);
      else next.add(secId);
      return next;
    });
  };

  const handleSelectCourse = (nextCourseId: number) => {
    const params = new URLSearchParams(searchParams);
    if (nextCourseId > 0) {
      params.set("courseId", String(nextCourseId));
    } else {
      params.delete("courseId");
    }
    setSearchParams(params);
    setExpandedSectionIds(new Set());
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-5">
      {/* ----------------- When NO course is selected: Course Hub Dashboard ----------------- */}
      {!courseId ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/[0.08] via-purple-500/[0.04] to-transparent p-6 shadow-xs">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <GraduationCap className="size-6 text-indigo-500" />
                <span>Curriculum Assessment Distribution</span>
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Select a course to organize quizzes, assignments, midterm and final exams across sections and lessons.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                className="pl-9 bg-background/80"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
              />
            </div>
          </div>

          {coursesQuery.isLoading ? (
            <div className="flex flex-1 min-h-[350px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/30 p-12 text-center">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Loading courses...</p>
            </div>
          ) : coursesQuery.isError ? (
            <div className="flex flex-1 min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/50 bg-destructive/5 p-12 text-center">
              <BookOpen className="size-8 text-destructive mb-3" />
              <h3 className="text-base font-semibold text-foreground">Failed to load courses</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Please make sure the backend server is running and you are logged in.</p>
              <Button variant="outline" size="sm" onClick={() => coursesQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="flex flex-1 min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 p-12 text-center">
              <BookOpen className="size-8 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold text-foreground">No Courses Found</h3>
              <p className="text-xs text-muted-foreground mt-1">No courses matched your search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => handleSelectCourse(course.id)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card/70 p-5 shadow-xs transition-all hover:border-indigo-500/50 hover:bg-card hover:shadow-md cursor-pointer"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                        <FolderOpen className="size-5" />
                      </div>
                      {course.code && (
                        <Badge variant="outline" className="font-mono text-xs bg-muted/60">
                          {course.code}
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                        {course.name}
                      </h3>
                      {course.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs text-indigo-500 font-medium group-hover:translate-x-0.5 transition-transform">
                    <span>Manage Curriculum & Assessments</span>
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ----------------- When Course IS Selected: Full Screen Section & Assessment View ----------------- */
        <div className="space-y-5">
          {/* Top Bar with Course Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/70 backdrop-blur-xs p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSelectCourse(0)}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8"
              >
                <ArrowLeft className="size-3.5" />
                All Courses
              </Button>

              <div className="h-4 w-px bg-border/70" />

              <div className="flex items-center gap-2">
                <FolderOpen className="size-4 text-indigo-500" />
                <span className="font-semibold text-sm text-foreground">
                  {selectedCourse?.name || `Course #${courseId}`}
                </span>
                <Badge variant="outline" className="text-xs bg-muted/60 font-mono">
                  {sections.length} sections
                </Badge>
                <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                  {courseExams.length} assessments linked
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Switch course:</span>
              <select
                className="rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                value={courseId}
                onChange={(e) => handleSelectCourse(Number(e.target.value))}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sections List */}
          <div className="space-y-4">
            {sectionsQuery.isLoading ? (
              <div className="flex flex-1 min-h-[350px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/30 p-12 text-center">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  Loading sections & curriculum...
                </p>
              </div>
            ) : sectionsQuery.isError ? (
              <div
                role="alert"
                className="flex flex-1 min-h-[350px] flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center"
              >
                <p className="mb-3 text-sm font-semibold text-destructive">
                  Failed to load sections for this course.
                </p>
                <Button variant="outline" size="sm" onClick={() => void sectionsQuery.refetch()}>
                  Try Again
                </Button>
              </div>
            ) : sections.length === 0 ? (
              <div className="flex flex-1 min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 p-12 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 mb-4 shadow-xs">
                  <BookOpen className="size-8" />
                </div>
                <h3 className="text-lg font-semibold text-foreground tracking-tight">
                  No Sections Found
                </h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                  This course does not currently have any curriculum sections configured.
                </p>
              </div>
            ) : (
              sections.map((section) => {
                const sectionExams = courseExams.filter((e) => e.sectionId === section.id && !e.lessonId);
                const isLessonsExpanded = expandedSectionIds.has(section.id);

                return (
                  <div
                    key={section.id}
                    className="space-y-4 rounded-2xl border border-border/80 bg-card/70 backdrop-blur-xs p-5 shadow-xs transition-all hover:border-primary/30"
                  >
                    {/* Section Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary font-mono shrink-0">
                          #{section.orderIndex}
                        </span>
                        <div>
                          <h3 className="text-base font-semibold text-foreground tracking-tight">
                            {section.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>Position {section.orderIndex}</span>
                            {sectionExams.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-indigo-500 dark:text-indigo-400">
                                  {sectionExams.length} section assessment{sectionExams.length > 1 ? "s" : ""}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 font-medium"
                          onClick={() => toggleSectionLessons(section.id)}
                        >
                          {isLessonsExpanded ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                          {isLessonsExpanded ? "Hide Lessons" : "View Lessons"}
                        </Button>
                      </div>
                    </div>

                    {/* Section Assessment Box */}
                    <div className="rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/[0.06] via-purple-500/[0.03] to-transparent p-4 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500 dark:text-indigo-400">
                            <ClipboardCheck className="size-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                                Section Assessment
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                  sectionExams.length > 0
                                    ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                                    : "bg-muted text-muted-foreground border-border/50"
                                }`}
                              >
                                {sectionExams.length}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Quizzes, assignments, and exams evaluating this whole section
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300 transition-all font-medium"
                          onClick={() => {
                            setLinkTarget({
                              type: "section",
                              id: section.id,
                              title: `Section: ${section.title}`,
                            });
                            setLinkModalOpen(true);
                          }}
                        >
                          <Plus className="size-3.5" />
                          Attach Assessment
                        </Button>
                      </div>

                      {sectionExams.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-background/30 p-4 text-center">
                          <p className="text-xs text-muted-foreground">
                            No assessments attached to this section yet. Click{" "}
                            <span className="font-semibold text-indigo-400">&quot;Attach Assessment&quot;</span> to link one.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {sectionExams.map((exam) => (
                            <CurriculumExamItem
                              key={exam.id}
                              exam={exam}
                              onUnlink={(ex) => setUnlinkTarget(ex)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Lessons list when expanded */}
                    {isLessonsExpanded && (
                      <div className="space-y-2 pt-2 border-t">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Lessons in this Section:
                        </span>
                        <SectionLessonsList
                          sectionId={section.id}
                          courseExams={courseExams}
                          onAttachExam={(lesson) => {
                            setLinkTarget({
                              type: "lesson",
                              id: lesson.id,
                              title: `Lesson: ${lesson.title}`,
                            });
                            setLinkModalOpen(true);
                          }}
                          onUnlinkExam={(ex) => setUnlinkTarget(ex)}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ATTACH ASSESSMENT MODAL */}
      <LinkExamModal
        courseId={courseId}
        target={linkTarget}
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["course-exams", courseId] });
        }}
      />

      {/* UNLINK CONFIRM DIALOG */}
      {unlinkTarget && (
        <ConfirmDialog
          open={unlinkTarget !== null}
          title="Unlink Assessment"
          description={`Are you sure you want to detach assessment "${unlinkTarget.title}"? The assessment itself will remain safely in Assessment Management.`}
          confirmLabel="Unlink"
          cancelLabel="Cancel"
          onConfirm={() => {
            unlinkExamMutation.mutate(unlinkTarget);
          }}
          onCancel={() => setUnlinkTarget(null)}
        />
      )}
        </div>
      </div>
    </MainLayout>
  );
}
