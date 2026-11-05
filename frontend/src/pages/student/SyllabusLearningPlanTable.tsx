import { Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentSyllabusDetail } from "@/api/features/demo/student-syllabus.api";

export type SyllabusMaterial = StudentSyllabusDetail["materials"][number];
export type SyllabusSection = StudentSyllabusDetail["sections"][number];
export type SyllabusClo = StudentSyllabusDetail["clos"][number];

export function localFileKey(url: string, syllabusId: number): string | null {
    try {
        const parsed = new URL(url);
        const prefix = `/api/student/syllabuses/${syllabusId}/material-files/`;
        if (!parsed.pathname.startsWith(prefix)) return null;
        const key = parsed.pathname.slice(prefix.length);
        return /^[a-f0-9-]{36}_[A-Za-z0-9._-]{1,100}$/.test(key) ? key : null;
    } catch {
        return null;
    }
}

export function ResourceAction({
    material, syllabusId, onDownload,
}: {
    material: SyllabusMaterial;
    syllabusId: number;
    onDownload: (fileKey: string, fileName: string) => Promise<void>;
}) {
    const fileKey = localFileKey(material.url, syllabusId);
    if (fileKey) {
        return (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5"
                onClick={() => void onDownload(fileKey, fileKey.substring(fileKey.indexOf("_") + 1))}>
                <Download className="size-3.5" /> Download file
            </Button>
        );
    }
    let link: string | null = null;
    try {
        const uri = new URL(material.url);
        if (["https:", "http:"].includes(uri.protocol)) link = uri.href;
    } catch { /* Not an external link. */ }
    return link ? (
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
            <a href={link} target="_blank" rel="noopener noreferrer">
                Open link <ExternalLink className="size-3.5" />
            </a>
        </Button>
    ) : <span className="text-xs text-muted-foreground">Unavailable</span>;
}

export default function SyllabusLearningPlanTable({
    sections, clos, materials, search, syllabusId, onDownload,
}: {
    sections: SyllabusSection[];
    clos: SyllabusClo[];
    materials: SyllabusMaterial[];
    search: string;
    syllabusId: number;
    onDownload: (fileKey: string, fileName: string) => Promise<void>;
}) {
    const cloMap = new Map(clos.map((clo) => [clo.id, clo]));
    const query = search.trim().toLocaleLowerCase();
    const firstTopicId = sections[0]?.topics[0]?.id;

    // Keep one table and one visible Section cell for every section.
    // The rowspan is calculated *after* search filtering so filtered
    // topics never leave an incorrectly sized or duplicated Section cell.
    const groups = sections.map((section, sectionIndex) => {
        const rows = section.topics.map((topic) => {
            const associated = (topic.cloIds || []).map((id) => cloMap.get(id)).filter(
                (clo): clo is SyllabusClo => Boolean(clo)
            );
            const resources = materials.filter((material) =>
                material.topicId === topic.id || (material.topicId == null && topic.id === firstTopicId)
            );
            const matches = !query || [
                section.title, section.mission || "", topic.title,
                ...associated.flatMap((clo) => [clo.code, clo.details]),
                ...resources.map((resource) => resource.title),
            ].some((value) => value.toLocaleLowerCase().includes(query));
            return { topic, associated, resources, matches };
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
                            <th className="p-3 font-medium">Section</th>
                            <th className="p-3 font-medium">Topic / Learning content</th>
                            <th className="p-3 font-medium">CLOs</th>
                            <th className="p-3 font-medium">Section mission</th>
                            <th className="p-3 font-medium">Student materials</th>
                        </tr>
                    </thead>
                    {groups.map(({ section, sectionIndex, rows }) => (
                        <tbody key={section.id} className="border-t-2 border-border first:border-t-0">
                            {rows.map(({ topic, associated, resources }, topicIndex) => (
                                <tr className="border-b align-top last:border-b-0 hover:bg-muted/10" key={topic.id}>
                                    {topicIndex === 0 && (
                                        <td rowSpan={rows.length} className="w-[130px] border-r bg-muted/10 p-3 font-medium align-top">
                                            Section {sectionIndex + 1}
                                            <p className="mt-1 font-normal text-xs text-muted-foreground">{section.title}</p>
                                            <p className="mt-2 font-normal text-[11px] text-muted-foreground">
                                                {rows.length} topic(s)
                                            </p>
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
                                        {resources.length ? <div className="space-y-3">
                                            {resources.map((material) => <div className="space-y-1.5" key={material.id}>
                                                <div className="break-words text-xs font-medium">{material.title}</div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="secondary">{material.type}</Badge>
                                                    <ResourceAction material={material} syllabusId={syllabusId} onDownload={onDownload} />
                                                </div>
                                            </div>)}
                                        </div> : <span className="text-xs text-muted-foreground">No materials</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
            </div>
            {!groups.length && <div className="p-8 text-center text-sm text-muted-foreground">
                {query ? "No matching learning topics." : "No learning topics available."}
            </div>}
            <div className="border-t px-4 py-3 text-xs text-muted-foreground">
                {visibleTopicCount} topic(s). Each Section and its mission occupy one spanning cell, regardless of topic count.
            </div>
        </section>
    );
}
