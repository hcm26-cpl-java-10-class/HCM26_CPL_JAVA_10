import { BookOpenText, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { CourseDetail } from "@/types";
import type { StudentRelatedCourse } from "@/api/features/demo/student-syllabus.api";

import { resolveTopicCourseReferences } from "./topicCourseMapping";
import type { SyllabusLanguage } from "./SyllabusLanguageSwitcher";

export function StudentTopicCourseMaterials({
    topicTitle, sectionTitle, courses, outlines, loading, error, canReadCourses, language = "en",
}: {
    topicTitle: string;
    sectionTitle: string;
    courses: StudentRelatedCourse[];
    outlines: CourseDetail[];
    loading: boolean;
    error: boolean;
    canReadCourses: boolean;
    language?: SyllabusLanguage;
}) {
    if (!canReadCourses) {
        return <span className="text-xs text-muted-foreground">Online</span>;
    }
    if (error) {
        return <span className="text-xs text-muted-foreground" role="status">{language === "vi" ? "Không thể tải đường dẫn khóa học" : "Course links unavailable"}</span>;
    }
    if (loading) {
        return <span className="text-xs text-muted-foreground" role="status">{language === "vi" ? "Đang tải các khóa học liên kết…" : "Loading linked courses…"}</span>;
    }
    if (!courses.length) {
        return <span className="inline-flex items-center gap-2"><Badge variant="outline">Online</Badge><span className="text-xs text-muted-foreground">{language === "vi" ? "Chưa có khóa học liên kết" : "No course linked yet"}</span></span>;
    }
    const references = resolveTopicCourseReferences(topicTitle, sectionTitle, courses, outlines);
    if (!references.length) {
        return <span className="inline-flex items-center gap-2"><Badge variant="outline">Online</Badge><span className="text-xs text-muted-foreground">{language === "vi" ? "Chưa có bài học cho chủ đề này" : "No linked lesson for this topic"}</span></span>;
    }
    return (
        <div className="space-y-2">
            {references.map((reference) => (
                <div key={reference.courseId} className="min-w-0 rounded-md border bg-background/40 p-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                        <BookOpenText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate" title={reference.courseName}>{reference.courseName}</span>
                    </div>
                    <Link className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                        to={`/courses/${reference.courseId}#lesson-${reference.lessonId}`}>
                        {language === "vi" ? "Xem bài học:" : "View lesson:"} {reference.lessonTitle} <ExternalLink className="size-3" />
                    </Link>
                </div>
            ))}
        </div>
    );
}
