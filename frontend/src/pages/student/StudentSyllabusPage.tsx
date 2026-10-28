
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
    syllabusApi,
    type SyllabusMaterial,
} from "@/api/features/demo/syllabus.api";

function show(value: string | number | null | undefined) {
    if (value === null || value === undefined) return "Not provided";
    return String(value).trim() || "Not provided";
}

function MaterialList({
                          materials,
                      }: {
    materials: SyllabusMaterial[];
}) {
    if (materials.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className="space-y-3">
            {materials.map((material) => (
                <div key={material.id} className="space-y-1">
                    <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 break-all text-primary hover:underline"
                    >
                        {material.title}
                        <ExternalLink className="mt-1 size-3 shrink-0" />
                    </a>

                    <div className="text-xs text-muted-foreground">
                        {material.type}
                        {material.mainMaterial ? " · Main Material" : ""}
                    </div>

                    {material.note && (
                        <p className="whitespace-pre-wrap text-xs">
                            {material.note}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function StudentSyllabusPage() {
    const { id } = useParams();
    const syllabusId = Number(id);
    const validId = Number.isSafeInteger(syllabusId) && syllabusId > 0;

    const query = useQuery({
        queryKey: ["syllabus-student-preview", syllabusId],
        enabled: validId,
        queryFn: async () => {
            const [syllabus, information, clos, materials] =
                await Promise.all([
                    syllabusApi.get(syllabusId),
                    syllabusApi.getInformation(syllabusId),
                    syllabusApi.listClos(syllabusId),
                    syllabusApi.listMaterials(syllabusId),
                ]);

            return { syllabus, information, clos, materials };
        },
    });

    const data = query.data;

    const informationRows = data
        ? [
            ["Syllabus Name", data.syllabus.name],
            ["Subject Code", data.syllabus.code],
            ["Description", data.information.description],
            ["Teaching Methods", data.information.teachingMethods],
            ["Degree Level", data.information.degreeLevel],
            ["Time Allocation", data.information.timeAllocation],
            [
                "Student Responsibilities",
                data.information.studentResponsibilities,
            ],
            ["Required Tools", data.information.requiredTools],
            ["Scoring Scale", data.information.scoringScale],
        ]
        : [];

    const sections = data
        ? [...data.syllabus.sections].sort(
            (a, b) => a.orderIndex - b.orderIndex
        )
        : [];

    const generalMaterials = data
        ? data.materials.filter((material) => material.topicId == null)
        : [];

    return (
        <MainLayout
            pathName={{
                syllabuses: "Syllabuses",
                preview: "Student Preview",
            }}
        >
            <div className="w-full space-y-6 pb-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button asChild variant="outline">
                        <Link to={`/syllabuses/${id}`}>
                            <ArrowLeft className="size-4" />
                            Back to Syllabus
                        </Link>
                    </Button>

                    <span className="rounded-full border px-3 py-1 text-xs">
            Student Preview · Read Only
          </span>
                </div>

                {!validId ? (
                    <p>Invalid Syllabus ID.</p>
                ) : query.isPending ? (
                    <p>Loading Syllabus...</p>
                ) : query.isError || !data ? (
                    <p className="text-destructive">
                        Cannot load Syllabus data.
                    </p>
                ) : (
                    <>
                        <header className="rounded-xl border bg-card p-6">
                            <h1 className="text-2xl font-bold">
                                {data.syllabus.name}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Code: {data.syllabus.code}
                            </p>
                        </header>

                        {/* GENERAL INFORMATION */}
                        <section className="rounded-xl border bg-card p-5">
                            <h2 className="mb-4 text-xl font-semibold">
                                General Information
                            </h2>

                            <div className="divide-y">
                                {informationRows.map(([label, value]) => (
                                    <div
                                        key={label}
                                        className="grid gap-2 py-3 sm:grid-cols-[240px_1fr]"
                                    >
                    <span className="text-sm font-medium">
                      {label}
                    </span>
                                        <span className="whitespace-pre-wrap text-sm">
                      {show(value)}
                    </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* CLO */}
                        <section className="rounded-xl border bg-card p-5">
                            <h2 className="mb-4 text-xl font-semibold">
                                Course Learning Outcomes
                            </h2>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="border-b text-left">
                                        <th className="w-28 p-3">CLO</th>
                                        <th className="p-3">Description</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {[...data.clos]
                                        .sort((a, b) => a.orderIndex - b.orderIndex)
                                        .map((clo) => (
                                            <tr key={clo.id} className="border-b">
                                                <td className="p-3 font-medium">
                                                    {clo.code}
                                                </td>
                                                <td className="whitespace-pre-wrap p-3">
                                                    {clo.details}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {data.clos.length === 0 && (
                                    <p className="p-3 text-sm text-muted-foreground">
                                        No CLOs available.
                                    </p>
                                )}
                            </div>
                        </section>

                        {/* LEARNING PLAN */}
                        <section className="rounded-xl border bg-card p-5">
                            <h2 className="mb-4 text-xl font-semibold">
                                Learning Plan
                            </h2>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[850px] text-sm">
                                    <thead>
                                    <tr className="border-b text-left">
                                        <th className="w-24 p-3">Session</th>
                                        <th className="w-1/4 p-3">Topic</th>
                                        <th className="w-1/3 p-3">Student Materials</th>
                                        <th className="p-3">Mission</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {sections.flatMap((section) => {
                                        const topics = [...section.topics].sort(
                                            (a, b) => a.orderIndex - b.orderIndex
                                        );

                                        return topics.map((topic, index) => (
                                            <tr
                                                key={topic.id}
                                                className="border-b align-top"
                                            >
                                                {index === 0 && (
                                                    <td
                                                        rowSpan={topics.length}
                                                        className="border-r p-3 font-medium"
                                                    >
                                                        {section.orderIndex}
                                                    </td>
                                                )}

                                                <td className="p-3">
                                                    {topic.title}
                                                </td>

                                                <td className="p-3">
                                                    <MaterialList
                                                        materials={data.materials.filter(
                                                            (material) =>
                                                                material.topicId === topic.id
                                                        )}
                                                    />
                                                </td>

                                                {index === 0 && (
                                                    <td
                                                        rowSpan={topics.length}
                                                        className="whitespace-pre-wrap border-l p-3"
                                                    >
                                                        {show(section.mission)}
                                                    </td>
                                                )}
                                            </tr>
                                        ));
                                    })}
                                    </tbody>
                                </table>

                                {sections.every(
                                    (section) => section.topics.length === 0
                                ) && (
                                    <p className="p-3 text-sm text-muted-foreground">
                                        No learning sessions available.
                                    </p>
                                )}
                            </div>
                        </section>

                        {/* GENERAL MATERIALS */}
                        <section className="rounded-xl border bg-card p-5">
                            <h2 className="mb-4 text-xl font-semibold">
                                General Learning Materials
                            </h2>

                            <MaterialList materials={generalMaterials} />
                        </section>
                    </>
                )}
            </div>
        </MainLayout>
    );
}
