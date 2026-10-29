
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft,
    BookOpenText,
    Copy,
    ExternalLink,
    FileText,
    Layers3,
    ListChecks,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

import {
    studentSyllabusApi,
    type StudentSyllabusDetail,
} from "@/api/features/demo/student-syllabus.api";

type Material = StudentSyllabusDetail["materials"][number];
type Section = StudentSyllabusDetail["sections"][number];

function display(
    value: string | number | null | undefined
) {
    return value == null || String(value).trim() === ""
        ? "Not provided"
        : String(value);
}

// Prevent duplicated headings such as
// "Section 1: Section 1: Foundations".
function sectionLabel(section: Section) {
    const cleaned = section.title
        .replace(/^Section\s+\d+\s*[:.\-–]\s*/i, "")
        .trim();

    return `Section ${section.orderIndex}: ${
        cleaned || section.title
    }`;
}

function Field({
                   label,
                   value,
               }: {
    label: string;
    value: string | number | null | undefined;
}) {
    return (
        <div className="space-y-1.5 border-b pb-4 last:border-b-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>
            <dd className="whitespace-pre-wrap text-sm leading-6">
                {display(value)}
            </dd>
        </div>
    );
}

function MaterialCard({
                          material,
                      }: {
    material: Material;
}) {
    const safeUrl = /^https?:\/\//i.test(material.url ?? "")
        ? material.url
        : null;

    return (
        <div className="rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                    {material.type}
                </Badge>

                {material.mainMaterial && (
                    <Badge variant="outline">
                        Main material
                    </Badge>
                )}
            </div>

            <h4 className="mt-2 text-sm font-semibold">
                {material.title}
            </h4>

            {(material.author || material.publisher) && (
                <p className="mt-1 text-xs text-muted-foreground">
                    {[material.author, material.publisher]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
            )}

            {material.note && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {material.note}
                </p>
            )}

            {safeUrl && (
                <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-2"
                >
                    <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open resource
                        <ExternalLink className="size-3.5" />
                    </a>
                </Button>
            )}
        </div>
    );
}

function MaterialList({
                          materials,
                      }: {
    materials: Material[];
}) {
    if (materials.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No learning materials attached.
            </p>
        );
    }

    return (
        <div className="grid gap-3 md:grid-cols-2">
            {materials.map((material) => (
                <MaterialCard
                    key={material.id}
                    material={material}
                />
            ))}
        </div>
    );
}

export default function StudentSyllabusPage() {
    const { id } = useParams();
    const syllabusId = Number(id);

    const validId =
        Number.isSafeInteger(syllabusId) &&
        syllabusId > 0;

    const [activeTab, setActiveTab] = useState("overview");

    const query = useQuery({
        queryKey: ["student-syllabus-detail", syllabusId],
        queryFn: () => studentSyllabusApi.detail(syllabusId),
        enabled: validId,
    });

    const syllabus = query.data;

    const sections = useMemo(
        () =>
            syllabus
                ? [...syllabus.sections].sort(
                    (a, b) => a.orderIndex - b.orderIndex
                )
                : [],
        [syllabus]
    );

    const clos = useMemo(
        () =>
            syllabus
                ? [...syllabus.clos].sort(
                    (a, b) => a.orderIndex - b.orderIndex
                )
                : [],
        [syllabus]
    );

    const materials = syllabus?.materials ?? [];

    const generalMaterials = materials.filter(
        (material) => material.topicId == null
    );

    async function copyCode() {
        if (!syllabus) return;

        try {
            await navigator.clipboard.writeText(syllabus.code);
            toast.success("Syllabus code copied");
        } catch {
            toast.error("Unable to copy syllabus code");
        }
    }

    return (
        <MainLayout
            pathName={{
                syllabuses: "Syllabuses",
                [String(id)]: syllabus?.name ?? "Details",
            }}
        >
            <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">

                {/* BACK */}
                <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="gap-2"
                >
                    <Link to="/student/syllabuses">
                        <ArrowLeft className="size-4" />
                        Back to Syllabuses
                    </Link>
                </Button>

                {!validId ? (
                    <div className="rounded-2xl border bg-card p-8">
                        Invalid Syllabus ID.
                    </div>
                ) : query.isPending ? (
                    <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
                        Loading Syllabus...
                    </div>
                ) : query.isError || !syllabus ? (
                    <div
                        role="alert"
                        className="space-y-3 rounded-2xl border bg-card p-8"
                    >
                        <h2 className="font-semibold">
                            Syllabus unavailable
                        </h2>

                        <p className="text-sm text-muted-foreground">
                            This syllabus may be Draft, inactive,
                            removed or temporarily unavailable.
                        </p>

                        <Button
                            variant="outline"
                            onClick={() => void query.refetch()}
                        >
                            Retry
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* HEADER */}
                        <header className="rounded-2xl border bg-card p-6 shadow-sm">
                            <div className="flex flex-wrap justify-between gap-5">
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">
                                            Published
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                      Student syllabus · Read only
                    </span>
                                    </div>

                                    <h1 className="break-words text-2xl font-bold tracking-tight">
                                        {syllabus.name}
                                    </h1>

                                    <p className="text-sm leading-6 text-muted-foreground">
                                        {display(syllabus.description)}
                                    </p>

                                    <div className="flex items-center gap-2 pt-2">
                                        <Badge
                                            variant="outline"
                                            className="font-mono"
                                        >
                                            {syllabus.code}
                                        </Badge>

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="gap-1.5"
                                            onClick={() => void copyCode()}
                                        >
                                            <Copy className="size-3.5" />
                                            Copy code
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        ["Sections", sections.length],
                                        ["CLOs", clos.length],
                                        ["Materials", materials.length],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="min-w-18 rounded-lg border bg-muted/20 p-3 text-center"
                                        >
                                            <div className="text-xl font-bold">
                                                {value}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </header>

                        {/* MAIN CONTENT */}
                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="w-full gap-4"
                        >
                            <TabsList className="h-auto max-w-full flex-wrap justify-start">
                                <TabsTrigger
                                    value="overview"
                                    className="gap-2"
                                >
                                    <BookOpenText className="size-4" />
                                    Overview
                                </TabsTrigger>

                                <TabsTrigger
                                    value="learning"
                                    className="gap-2"
                                >
                                    <Layers3 className="size-4" />
                                    Learning Plan
                                </TabsTrigger>
                            </TabsList>

                            {/* OVERVIEW */}
                            <TabsContent
                                value="overview"
                                className="space-y-4"
                            >
                                <section className="rounded-2xl border bg-card p-6 shadow-sm">
                                    <h2 className="mb-5 text-lg font-semibold">
                                        General Information
                                    </h2>

                                    <dl className="grid gap-4 md:grid-cols-2">
                                        <Field
                                            label="Teaching Methods"
                                            value={syllabus.teachingMethods}
                                        />
                                        <Field
                                            label="Degree Level"
                                            value={syllabus.degreeLevel}
                                        />
                                        <Field
                                            label="Time Allocation"
                                            value={syllabus.timeAllocation}
                                        />
                                        <Field
                                            label="Scoring Scale"
                                            value={syllabus.scoringScale}
                                        />
                                        <Field
                                            label="Student Responsibilities"
                                            value={syllabus.studentResponsibilities}
                                        />
                                        <Field
                                            label="Required Tools"
                                            value={syllabus.requiredTools}
                                        />
                                    </dl>
                                </section>

                                <section className="rounded-2xl border bg-card p-6 shadow-sm">
                                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                                        <ListChecks className="size-5" />
                                        Course Learning Outcomes
                                    </h2>

                                    {clos.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No CLOs available.
                                        </p>
                                    ) : (
                                        <div className="divide-y">
                                            {clos.map((clo) => (
                                                <div
                                                    key={clo.id}
                                                    className="flex gap-3 py-4 first:pt-0 last:pb-0"
                                                >
                                                    <Badge
                                                        variant="outline"
                                                        className="h-fit shrink-0"
                                                    >
                                                        {clo.code}
                                                    </Badge>

                                                    <p className="whitespace-pre-wrap text-sm leading-6">
                                                        {clo.details}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </TabsContent>

                            {/* LEARNING PLAN */}
                            <TabsContent
                                value="learning"
                                className="space-y-4"
                            >
                                <div className="rounded-2xl border bg-card p-5 shadow-sm">
                                    <h2 className="text-lg font-semibold">
                                        Learning Plan
                                    </h2>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Explore sections, topics, learning
                                        objectives and attached materials.
                                    </p>
                                </div>

                                {/* GENERAL MATERIALS */}
                                {generalMaterials.length > 0 && (
                                    <section className="rounded-2xl border bg-card p-5 shadow-sm">
                                        <h3 className="mb-4 flex items-center gap-2 font-semibold">
                                            <FileText className="size-4" />
                                            General Learning Materials
                                        </h3>

                                        <MaterialList
                                            materials={generalMaterials}
                                        />
                                    </section>
                                )}

                                {/* SECTIONS */}
                                {sections.map((section, index) => (
                                    <details
                                        key={section.id}
                                        open={index === 0}
                                        className="group overflow-hidden rounded-2xl border bg-card shadow-sm"
                                    >
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-semibold">
                      <span>
                        {sectionLabel(section)}
                      </span>

                                            <Badge variant="secondary">
                                                {section.topics.length} Topics
                                            </Badge>
                                        </summary>

                                        <div className="space-y-5 border-t p-5">
                                            {/* MISSION */}
                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Mission
                                                </p>

                                                <p className="whitespace-pre-wrap text-sm leading-6">
                                                    {display(section.mission)}
                                                </p>
                                            </div>

                                            {/* TOPICS */}
                                            <div className="space-y-3">
                                                {[...section.topics]
                                                    .sort(
                                                        (a, b) =>
                                                            a.orderIndex - b.orderIndex
                                                    )
                                                    .map((topic) => {
                                                        const topicMaterials =
                                                            materials.filter(
                                                                (material) =>
                                                                    material.topicId === topic.id
                                                            );

                                                        return (
                                                            <article
                                                                key={topic.id}
                                                                className="space-y-4 rounded-xl border bg-muted/10 p-4"
                                                            >
                                                                <h4 className="text-sm font-semibold">
                                                                    {topic.orderIndex}.{" "}
                                                                    {topic.title}
                                                                </h4>

                                                                {topicMaterials.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        <p className="text-xs font-medium text-muted-foreground">
                                                                            Learning Materials
                                                                        </p>

                                                                        <MaterialList
                                                                            materials={topicMaterials}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        No materials attached to this topic.
                                                                    </p>
                                                                )}
                                                            </article>
                                                        );
                                                    })}
                                            </div>

                                            {section.topics.length === 0 && (
                                                <p className="text-sm text-muted-foreground">
                                                    No topics available.
                                                </p>
                                            )}
                                        </div>
                                    </details>
                                ))}

                                {sections.length === 0 && (
                                    <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                                        No sections available.
                                    </p>
                                )}
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </div>
        </MainLayout>
    );
}
