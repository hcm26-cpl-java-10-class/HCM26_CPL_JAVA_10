import { Badge } from "@/components/ui/badge";
import type { CourseDetail } from "@/types";
import type { StudentRelatedCourse, StudentSyllabusDetail } from "@/api/features/demo/student-syllabus.api";
import { StudentTopicCourseMaterials } from "./StudentTopicCourseMaterials";
import type { SyllabusLanguage } from "./SyllabusLanguageSwitcher";

type SyllabusSection = StudentSyllabusDetail["sections"][number];
type SyllabusClo = StudentSyllabusDetail["clos"][number];

export default function SyllabusLearningPlanTable({
    sections, originalSections, language, clos, search, courses, outlines, loadingCourses, coursesError, canReadCourses,
}: {
    sections: SyllabusSection[];
    originalSections: SyllabusSection[];
    language: SyllabusLanguage;
    clos: SyllabusClo[];
    search: string;
    courses: StudentRelatedCourse[];
    outlines: CourseDetail[];
    loadingCourses: boolean;
    coursesError: boolean;
    canReadCourses: boolean;
}) {
    const cloMap = new Map(clos.map((clo) => [clo.id, clo]));
    const sourceSectionMap = new Map<number, SyllabusSection>(originalSections.map(section => [section.id, section]));
    const query = search.trim().toLocaleLowerCase();

    // Calculate rowSpan AFTER filtering, keeping Section and mission together.
    const groups = sections.map((section, sectionIndex) => {
        const rows = section.topics.map((topic) => {
            const associated = (topic.cloIds || []).map((id) => cloMap.get(id)).filter(
                (clo): clo is SyllabusClo => Boolean(clo),
            );
            const matches = !query || [
                section.title, section.mission || "", topic.title,
                ...associated.flatMap((clo) => [clo.code, clo.details]),
            ].some((value) => value.toLocaleLowerCase().includes(query));
            return { topic, associated, matches };
        }).filter((row) => row.matches);
        return { section, sectionIndex, rows };
    }).filter((group) => group.rows.length > 0);
    const visibleTopicCount = groups.reduce((total, group) => total + group.rows.length, 0);

    return (
        <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[970px] border-collapse text-left text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr className="border-b">
                            <th className="p-3 font-medium">{language === "vi" ? "Chương" : "Section"}</th>
                            <th className="p-3 font-medium">{language === "vi" ? "Chủ đề / Nội dung học" : "Topic / Learning content"}</th>
                            <th className="p-3 font-medium">{language === "vi" ? "CLOs" : "CLOs"}</th>
                            <th className="p-3 font-medium">{language === "vi" ? "Mục tiêu chương" : "Section mission"}</th>
                            <th className="p-3 font-medium">{language === "vi" ? "Học liệu sinh viên" : "Student materials"}</th>
                        </tr>
                    </thead>
                    {groups.map(({ section, sectionIndex, rows }) => (
                        <tbody key={section.id} className="border-t-2 border-border first:border-t-0">
                            {rows.map(({ topic, associated }, topicIndex) => (
                                <tr className="border-b align-top last:border-b-0 hover:bg-muted/10" key={topic.id}>
                                    {topicIndex === 0 && (
                                        <td rowSpan={rows.length} className="w-[130px] border-r bg-muted/10 p-3 font-medium align-top">
                                            {language === "vi" ? "Chương" : "Section"} {sectionIndex + 1}
                                            <p className="mt-1 font-normal text-xs text-muted-foreground">{section.title}</p>
                                            <p className="mt-2 font-normal text-[11px] text-muted-foreground">{rows.length} {language === "vi" ? "chủ đề" : "topic(s)"}</p>
                                        </td>
                                    )}
                                    <td className="min-w-[175px] p-3">
                                        <span className="font-medium">{topic.orderIndex}. {topic.title}</span>
                                    </td>
                                    <td className="min-w-[120px] p-3">
                                        {associated.length ? (
                                            <div className="flex flex-wrap gap-1">
                                                {associated.map((clo) => (
                                                    <span title={clo.details} key={clo.id}>
                                                        <Badge variant="outline">{clo.code}</Badge>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span className="text-xs text-muted-foreground">Not linked</span>}
                                    </td>
                                    {topicIndex === 0 && (
                                        <td rowSpan={rows.length} className="min-w-[180px] whitespace-pre-wrap border-r bg-muted/5 p-3 align-top text-muted-foreground">
                                            {section.mission || "—"}
                                        </td>
                                    )}
                                    <td className="min-w-[230px] p-3">
                                        <StudentTopicCourseMaterials
                                            topicId={topic.id}
                                            topicTitle={sourceSectionMap.get(section.id)?.topics.find(original => original.id === topic.id)?.title ?? topic.title}
                                            sectionTitle={sourceSectionMap.get(section.id)?.title ?? section.title}
                                            courses={courses} outlines={outlines} loading={loadingCourses}
                                            error={coursesError} canReadCourses={canReadCourses} language={language} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
            </div>
            {!groups.length && <div className="p-8 text-center text-sm text-muted-foreground">
                {query ? (language === "vi" ? "Không tìm thấy chủ đề phù hợp." : "No matching learning topics.")
                    : (language === "vi" ? "Không có chủ đề học tập." : "No learning topics available.")}
            </div>}
            <div className="border-t px-4 py-3 text-xs text-muted-foreground">
                {language === "vi" ? `${visibleTopicCount} chủ đề. Mỗi Section và mục tiêu chỉ hiển thị một ô cho toàn bộ Topic.`
                    : `${visibleTopicCount} topic(s). Each Section and its mission occupy one spanning cell, regardless of topic count.`}
            </div>
        </section>
    );
}
