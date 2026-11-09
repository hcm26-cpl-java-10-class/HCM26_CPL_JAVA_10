import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { examApi } from "@/api";
import { useQuery } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
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

  return (
    <div className="grid gap-4 border-t pt-4 sm:col-span-2 sm:grid-cols-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-3">
        Course (optional)
      </h3>

      <label className="grid gap-2 text-sm font-medium">
        Course
        <Select
          value={cfg.courseId || NONE}
          onValueChange={(value) =>
            setCfg((c) => ({ ...c, courseId: !value || value === NONE ? "" : value, sectionId: "", lessonId: "" }))
          }
        >
          <SelectTrigger aria-label="Course">
            <SelectValue placeholder="Not linked to a course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not linked to a course</SelectItem>
            {courseOptions.map((course) => (
              <SelectItem key={course.id} value={String(course.id)}>{course.title}</SelectItem>
            ))}
            {/* Keep the current value visible even if it is not in the (filtered) list. */}
            {cfg.courseId && !courseOptions.some((course) => String(course.id) === cfg.courseId) && (
              <SelectItem value={cfg.courseId}>Course #{cfg.courseId}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <span className="text-xs font-normal text-muted-foreground">
          {courses.isError ? "Could not load courses." : "Only courses you teach are listed."}
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Section
        <Select
          value={cfg.sectionId || NONE}
          disabled={courseId == null}
          onValueChange={(value) =>
            setCfg((c) => ({ ...c, sectionId: !value || value === NONE ? "" : value, lessonId: "" }))
          }
        >
          <SelectTrigger aria-label="Section">
            <SelectValue placeholder="Whole course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Whole course</SelectItem>
            {sectionOptions.map((section) => (
              <SelectItem key={section.id} value={String(section.id)}>{section.title}</SelectItem>
            ))}
            {cfg.sectionId && !sectionOptions.some((section) => String(section.id) === cfg.sectionId) && (
              <SelectItem value={cfg.sectionId}>Section #{cfg.sectionId}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Lesson
        <Select
          value={cfg.lessonId || NONE}
          disabled={sectionId == null}
          onValueChange={(value) => setCfg((c) => ({ ...c, lessonId: !value || value === NONE ? "" : value }))}
        >
          <SelectTrigger aria-label="Lesson">
            <SelectValue placeholder="Whole section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Whole section</SelectItem>
            {lessonOptions.map((lesson) => (
              <SelectItem key={lesson.id} value={String(lesson.id)}>{lesson.title}</SelectItem>
            ))}
            {cfg.lessonId && !lessonOptions.some((lesson) => String(lesson.id) === cfg.lessonId) && (
              <SelectItem value={cfg.lessonId}>Lesson #{cfg.lessonId}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}
