import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { examApi } from "@/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { ExamConfigForm } from "./examConfig";

const NONE = "none";

interface Props {
  cfg: ExamConfigForm;
  setCfg: Dispatch<SetStateAction<ExamConfigForm>>;
}

/**
 * Optional course -> section -> lesson pickers. Choosing a lesson or a section without the level above is
 * impossible (each list depends on the previous choice), so the saved link is always consistent.
 * The course list only contains the courses the current user may attach exams to.
 */
export function ExamLinkFields({ cfg, setCfg }: Props) {
  const courseId = cfg.courseId ? Number(cfg.courseId) : null;
  const sectionId = cfg.sectionId ? Number(cfg.sectionId) : null;

  const courses = useQuery({
    queryKey: ["exam-link-courses"],
    queryFn: () => examApi.getLinkCourses(),
    staleTime: 60_000,
  });
  const sections = useQuery({
    queryKey: ["exam-link-sections", courseId],
    queryFn: () => examApi.getLinkSections(courseId as number),
    enabled: courseId != null,
    staleTime: 60_000,
  });
  const lessons = useQuery({
    queryKey: ["exam-link-lessons", sectionId],
    queryFn: () => examApi.getLinkLessons(sectionId as number),
    enabled: sectionId != null,
    staleTime: 60_000,
  });

  const courseOptions = courses.data ?? [];
  const sectionOptions = courseId != null ? sections.data ?? [] : [];
  const lessonOptions = sectionId != null ? lessons.data ?? [] : [];

  const selectedCourseTitle = useMemo(() => {
    if (!cfg.courseId) return undefined;
    const found = courseOptions.find((c) => String(c.id) === cfg.courseId);
    return found?.title || cfg.courseName || `Course #${cfg.courseId}`;
  }, [cfg.courseId, cfg.courseName, courseOptions]);

  const selectedSectionTitle = useMemo(() => {
    if (!cfg.sectionId) return undefined;
    const found = sectionOptions.find((s) => String(s.id) === cfg.sectionId);
    return found?.title || cfg.sectionTitle || `Section #${cfg.sectionId}`;
  }, [cfg.sectionId, cfg.sectionTitle, sectionOptions]);

  const selectedLessonTitle = useMemo(() => {
    if (!cfg.lessonId) return undefined;
    const found = lessonOptions.find((l) => String(l.id) === cfg.lessonId);
    return found?.title || cfg.lessonTitle || `Lesson #${cfg.lessonId}`;
  }, [cfg.lessonId, cfg.lessonTitle, lessonOptions]);

  return (
    <div className="grid min-w-0 max-w-full gap-4 border-t pt-4 sm:col-span-2 sm:grid-cols-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-3">
        Course (optional)
      </h3>

      <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
        <span className="truncate">Course</span>
        <Select
          value={cfg.courseId || NONE}
          onValueChange={(value) => {
            const next = !value || value === NONE ? "" : value;
            if (next !== cfg.courseId) {
              const selected = courseOptions.find((c) => String(c.id) === next);
              setCfg((c) => ({
                ...c,
                courseId: next,
                courseName: selected?.title ?? "",
                sectionId: "",
                sectionTitle: "",
                lessonId: "",
                lessonTitle: "",
              }));
            }
          }}
        >
          <SelectTrigger aria-label="Course" className="w-full min-w-0 max-w-full">
            <SelectValue placeholder="Not linked to a course">
              {selectedCourseTitle}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-w-[90vw]">
            <SelectItem value={NONE}>Not linked to a course</SelectItem>
            {courseOptions.map((course) => (
              <SelectItem key={course.id} value={String(course.id)} className="break-words">
                {course.title}
              </SelectItem>
            ))}
            {/* Keep the current value visible even if it is not in the (filtered) list. */}
            {cfg.courseId && !courseOptions.some((course) => String(course.id) === cfg.courseId) && (
              <SelectItem value={cfg.courseId} className="break-words">
                {cfg.courseName || `Course #${cfg.courseId}`}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <span className="truncate text-xs font-normal text-muted-foreground">
          {courses.isError ? "Could not load courses." : "Only courses you teach are listed."}
        </span>
      </label>

      <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
        <span className="truncate">Section</span>
        <Select
          value={cfg.sectionId || NONE}
          disabled={courseId == null}
          onValueChange={(value) => {
            const next = !value || value === NONE ? "" : value;
            if (next !== cfg.sectionId) {
              const selected = sectionOptions.find((s) => String(s.id) === next);
              setCfg((c) => ({
                ...c,
                sectionId: next,
                sectionTitle: selected?.title ?? "",
                lessonId: "",
                lessonTitle: "",
              }));
            }
          }}
        >
          <SelectTrigger aria-label="Section" className="w-full min-w-0 max-w-full">
            <SelectValue placeholder="Whole course">
              {selectedSectionTitle}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-w-[90vw]">
            <SelectItem value={NONE}>Whole course</SelectItem>
            {sectionOptions.map((section) => (
              <SelectItem key={section.id} value={String(section.id)} className="break-words">
                {section.title}
              </SelectItem>
            ))}
            {cfg.sectionId && !sectionOptions.some((section) => String(section.id) === cfg.sectionId) && (
              <SelectItem value={cfg.sectionId} className="break-words">
                {cfg.sectionTitle || `Section #${cfg.sectionId}`}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </label>

      <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
        <span className="truncate">Lesson</span>
        <Select
          value={cfg.lessonId || NONE}
          disabled={sectionId == null}
          onValueChange={(value) => {
            const next = !value || value === NONE ? "" : value;
            if (next !== cfg.lessonId) {
              const selected = lessonOptions.find((l) => String(l.id) === next);
              setCfg((c) => ({
                ...c,
                lessonId: next,
                lessonTitle: selected?.title ?? "",
              }));
            }
          }}
        >
          <SelectTrigger aria-label="Lesson" className="w-full min-w-0 max-w-full">
            <SelectValue placeholder="Whole section">
              {selectedLessonTitle}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-w-[90vw]">
            <SelectItem value={NONE}>Whole section</SelectItem>
            {lessonOptions.map((lesson) => (
              <SelectItem key={lesson.id} value={String(lesson.id)} className="break-words">
                {lesson.title}
              </SelectItem>
            ))}
            {cfg.lessonId && !lessonOptions.some((lesson) => String(lesson.id) === cfg.lessonId) && (
              <SelectItem value={cfg.lessonId} className="break-words">
                {cfg.lessonTitle || `Lesson #${cfg.lessonId}`}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}
