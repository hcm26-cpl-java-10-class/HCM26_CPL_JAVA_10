
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
    ArrowLeft,
    BookOpenText,
    Check,
    ChevronDown,
    Copy,
    ExternalLink,
    FileText,
    Layers3,
    ListChecks,
    Search,
    X,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

type Section = StudentSyllabusDetail["sections"][number];
type Topic = Section["topics"][number];
type Material = StudentSyllabusDetail["materials"][number];

const textOrDash = (
    value: string | number | null | undefined
) =>
    value == null || String(value).trim() === ""
        ? "Not provided"
        : String(value);

function sectionName(section: Section): string {
    const name = section.title
        .replace(/^\s*Section\s+\d+\s*[:.\-–]\s*/i, "")
        .trim();

    return `Section ${section.orderIndex}: ${
        name || section.title
    }`;
}

function topicName(topic: Topic): string {
    const name = topic.title
        .replace(
            /^\s*(?:Topic\s+)?\d+\s*[:.)\-–]\s+/i,
            ""
        )
        .trim();

    return `${topic.orderIndex}. ${
        name || topic.title
    }`;
}

function httpUrl(
    value: string | null | undefined
): string | null {
    if (!value) return null;

    try {
        const url = new URL(value.trim());

        return url.protocol === "https:" ||
        url.protocol === "http:"
            ? url.href
            : null;
    } catch {
        return null;
    }
}

function InfoField({
                       label,
                       value,
                   }: {
    label: string;
    value: string | number | null | undefined;
}) {
    return (
        <div className="border-b pb-4 last:border-b-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>

            <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">
                {textOrDash(value)}
            </dd>
        </div>
    );
}

function MaterialList({
                          items,
                      }: {
    items: Material[];
}) {
    if (!items.length) {
        return (
            <p className="text-sm text-muted-foreground">
                No learning materials attached.
            </p>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {items.map((material) => {
                const link = httpUrl(material.url);

                return (
                    <article
                        key={material.id}
                        className="min-w-0 rounded-xl border bg-card p-4 shadow-sm"
                    >
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

                        <h4 className="mt-3 break-words text-sm font-semibold">
                            {material.title}
                        </h4>

                        {(material.author || material.publisher) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {[
                                    material.author,
                                    material.publisher,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        )}

                        {material.note && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                {material.note}
                            </p>
                        )}

                        {link ? (
                            <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="mt-3 gap-2"
                            >
                                <a
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open resource
                                    <ExternalLink className="size-3.5" />
                                </a>
                            </Button>
                        ) : (
                            <p className="mt-3 text-xs text-muted-foreground">
                                Resource link unavailable.
                            </p>
                        )}
                    </article>
                );
            })}
        </div>
    );
}

function DetailLoading() {
    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5">
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-72 rounded-2xl" />
            </div>

            <Skeleton className="h-56 rounded-2xl" />
        </div>
    );
}

export default function StudentSyllabusPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const fromCourse = Number(searchParams.get("fromCourse"));
    const validSource = Number.isSafeInteger(fromCourse) && fromCourse > 0;
    const backPath = validSource ? `/courses/${fromCourse}` : "/student/syllabuses";

    const syllabusId = Number(id);
    const validId =
        Number.isSafeInteger(syllabusId) &&
        syllabusId > 0;

    const [tab, setTab] = useState("overview");
    const [search, setSearch] = useState("");

    const [openById, setOpenById] = useState<
        Record<number, boolean>
    >({});

    const query = useQuery({
        queryKey: [
            "student-syllabus-detail",
            syllabusId,
        ],
        enabled: validId,
        queryFn: () =>
            studentSyllabusApi.detail(syllabusId),
        retry: (count, error) =>
            !(
                axios.isAxiosError(error) &&
                [403, 404].includes(
                    error.response?.status ?? 0
                )
            ) && count < 2,
    });

    const syllabus = query.data;

    const sections = [
        ...(syllabus?.sections ?? []),
    ].sort(
        (a, b) => a.orderIndex - b.orderIndex
    );

    const clos = [
        ...(syllabus?.clos ?? []),
    ].sort(
        (a, b) => a.orderIndex - b.orderIndex
    );

    const materials = syllabus?.materials ?? [];

    const generalMaterials = materials.filter(
        (m) => m.topicId == null
    );

    const searchText = search.trim().toLocaleLowerCase();

    const filteredSections = sections.filter(
        (section) =>
            !searchText ||
            sectionName(section)
                .toLocaleLowerCase()
                .includes(searchText) ||
            (section.mission ?? "")
                .toLocaleLowerCase()
                .includes(searchText) ||
            section.topics.some(
                (topic) =>
                    topicName(topic)
                        .toLocaleLowerCase()
                        .includes(searchText) ||
                    materials.some(
                        (material) =>
                            material.topicId === topic.id &&
                            material.title
                                .toLocaleLowerCase()
                                .includes(searchText)
                    )
            )
    );

    function expandAll(open: boolean) {
        setOpenById(
            Object.fromEntries(
                sections.map((section) => [
                    section.id,
                    open,
                ])
            )
        );
    }

    async function copyCode() {
        if (!syllabus) return;

        try {
            await navigator.clipboard.writeText(
                syllabus.code
            );

            toast.success("Syllabus code copied");
        } catch {
            toast.error("Unable to copy code");
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
                <Button
                    asChild
                    variant="ghost"
                    className="-ml-3 gap-2"
                >
                    <Link to={backPath}>
                        <ArrowLeft className="size-4" />
                        {validSource ? "Back to Course" : "Back to Syllabuses"}
                    </Link>
                </Button>

                {!validId ? (
                    <div className="rounded-2xl border bg-card p-8">
                        Invalid Syllabus ID.
                    </div>
                ) : query.isPending ? (
                    <DetailLoading />
                ) : query.isError || !syllabus ? (
                    <section
                        role="alert"
                        className="space-y-3 rounded-2xl border bg-card p-8"
                    >
                        <h1 className="text-lg font-semibold">
                            Syllabus unavailable
                        </h1>

                        <p className="text-sm text-muted-foreground">
                            This syllabus may be unpublished,
                            inactive, deleted or temporarily unavailable.
                        </p>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => void query.refetch()}
                            >
                                Retry
                            </Button>

                            <Button asChild>
                                <Link to="/student/syllabuses">
                                    Browse syllabuses
                                </Link>
                            </Button>
                        </div>
                    </section>
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="min-w-0 space-y-6">
                            {/* SYLLABUS HEADER */}
                            <header className="overflow-hidden rounded-2xl border bg-card">
                                <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
                                    <BookOpenText
                                        className="size-20 text-blue-900/25"
                                        aria-hidden="true"
                                    />
                                </div>

                                <div className="space-y-3 p-6">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            <Check className="mr-1 size-3" />
                                            Published
                                        </Badge>

                                        <Badge
                                            variant="outline"
                                            className="font-mono"
                                        >
                                            {syllabus.code}
                                        </Badge>

                                        <span className="text-xs text-muted-foreground">
                      Read only
                    </span>
                                    </div>

                                    <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
                                        {syllabus.name}
                                    </h1>

                                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                        {textOrDash(syllabus.description)}
                                    </p>
                                </div>
                            </header>

                            {/* CONTENT TABS */}
                            <Tabs
                                value={tab}
                                onValueChange={setTab}
                                className="w-full gap-4"
                            >
                                <TabsList className="h-auto flex-wrap justify-start">
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
                                    <section className="rounded-2xl border bg-card p-6">
                                        <h2 className="mb-5 text-lg font-semibold">
                                            General Information
                                        </h2>

                                        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                                            <InfoField
                                                label="Teaching Methods"
                                                value={syllabus.teachingMethods}
                                            />

                                            <InfoField
                                                label="Degree Level"
                                                value={syllabus.degreeLevel}
                                            />

                                            <InfoField
                                                label="Time Allocation"
                                                value={syllabus.timeAllocation}
                                            />

                                            <InfoField
                                                label="Scoring Scale"
                                                value={syllabus.scoringScale}
                                            />

                                            <InfoField
                                                label="Student Responsibilities"
                                                value={syllabus.studentResponsibilities}
                                            />

                                            <InfoField
                                                label="Required Tools"
                                                value={syllabus.requiredTools}
                                            />
                                        </dl>
                                    </section>

                                    <section className="rounded-2xl border bg-card p-6">
                                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                                            <ListChecks className="size-5" />
                                            Course Learning Outcomes
                                        </h2>

                                        {clos.length ? (
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
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No learning outcomes available.
                                            </p>
                                        )}
                                    </section>
                                </TabsContent>

                                {/* LEARNING PLAN */}
                                <TabsContent
                                    value="learning"
                                    className="space-y-4"
                                >
                                    <section className="rounded-2xl border bg-card p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <h2 className="text-lg font-semibold">
                                                    Learning Plan
                                                </h2>

                                                <p className="text-sm text-muted-foreground">
                                                    Browse sections, topics, missions
                                                    and learning materials.
                                                </p>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => expandAll(true)}
                                                >
                                                    Expand all
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => expandAll(false)}
                                                >
                                                    Collapse all
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="relative mt-4">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                                            <Input
                                                aria-label="Find section or topic"
                                                placeholder="Find a section, topic or resource..."
                                                className="pl-9 pr-9"
                                                value={search}
                                                onChange={(event) =>
                                                    setSearch(event.target.value)
                                                }
                                            />

                                            {search && (
                                                <button
                                                    type="button"
                                                    aria-label="Clear learning plan search"
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                    onClick={() => setSearch("")}
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    </section>

                                    {/* GENERAL MATERIALS */}
                                    {generalMaterials.length > 0 &&
                                        !searchText && (
                                            <section className="rounded-2xl border bg-card p-5">
                                                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                                                    <FileText className="size-4" />
                                                    General Learning Materials
                                                </h3>

                                                <MaterialList
                                                    items={generalMaterials}
                                                />
                                            </section>
                                        )}

                                    {/* SECTIONS */}
                                    {filteredSections.map((section) => {
                                        const index = sections.findIndex(
                                            (value) =>
                                                value.id === section.id
                                        );

                                        const opened = searchText
                                            ? true
                                            : (openById[section.id] ??
                                                index === 0);

                                        const sectionMatches =
                                            sectionName(section)
                                                .toLocaleLowerCase()
                                                .includes(searchText) ||
                                            (section.mission ?? "")
                                                .toLocaleLowerCase()
                                                .includes(searchText);

                                        const topics = [
                                            ...section.topics,
                                        ]
                                            .sort(
                                                (a, b) =>
                                                    a.orderIndex - b.orderIndex
                                            )
                                            .filter(
                                                (topic) =>
                                                    !searchText ||
                                                    sectionMatches ||
                                                    topicName(topic)
                                                        .toLocaleLowerCase()
                                                        .includes(searchText) ||
                                                    materials.some(
                                                        (m) =>
                                                            m.topicId === topic.id &&
                                                            m.title
                                                                .toLocaleLowerCase()
                                                                .includes(searchText)
                                                    )
                                            );

                                        return (
                                            <Collapsible
                                                key={section.id}
                                                open={opened}
                                                onOpenChange={(open) =>
                                                    setOpenById(
                                                        (previous) => ({
                                                            ...previous,
                                                            [section.id]: open,
                                                        })
                                                    )
                                                }
                                                className="overflow-hidden rounded-2xl border bg-card"
                                            >
                                                <CollapsibleTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-muted/30"
                                                    >
                            <span className="font-semibold">
                              {sectionName(section)}
                            </span>

                                                        <span className="flex shrink-0 items-center gap-2">
                              <Badge variant="secondary">
                                {section.topics.length} topics
                              </Badge>

                              <ChevronDown
                                  className={`size-4 transition-transform ${
                                      opened
                                          ? "rotate-180"
                                          : ""
                                  }`}
                              />
                            </span>
                                                    </button>
                                                </CollapsibleTrigger>

                                                <CollapsibleContent className="space-y-4 border-t p-5">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                            Mission
                                                        </p>

                                                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                                            {textOrDash(
                                                                section.mission
                                                            )}
                                                        </p>
                                                    </div>

                                                    {topics.map((topic) => (
                                                        <article
                                                            key={topic.id}
                                                            className="space-y-3 rounded-xl border bg-muted/10 p-4"
                                                        >
                                                            <h4 className="text-sm font-semibold">
                                                                {topicName(topic)}
                                                            </h4>

                                                            <MaterialList
                                                                items={materials.filter(
                                                                    (m) =>
                                                                        m.topicId ===
                                                                        topic.id
                                                                )}
                                                            />
                                                        </article>
                                                    ))}

                                                    {topics.length === 0 && (
                                                        <p className="text-sm text-muted-foreground">
                                                            No matching topics in this section.
                                                        </p>
                                                    )}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        );
                                    })}

                                    {!filteredSections.length && (
                                        <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                                            {searchText
                                                ? "No matching sections or topics."
                                                : "No sections available."}
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* COURSE-STYLE SIDEBAR */}
                        <aside className="space-y-4 lg:sticky lg:top-4">
                            <section className="rounded-2xl border bg-card p-5">
                                <h2 className="font-semibold">
                                    Syllabus at a glance
                                </h2>

                                <dl className="mt-4 divide-y text-sm">
                                    {(
                                        [
                                            ["Sections", sections.length],
                                            ["CLOs", clos.length],
                                            [
                                                "Topics",
                                                sections.reduce(
                                                    (count, section) =>
                                                        count +
                                                        section.topics.length,
                                                    0
                                                ),
                                            ],
                                            [
                                                "Materials",
                                                materials.length,
                                            ],
                                        ] as const
                                    ).map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="flex justify-between gap-3 py-3"
                                        >
                                            <dt className="text-muted-foreground">
                                                {label}
                                            </dt>

                                            <dd className="font-semibold">
                                                {value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-4 w-full gap-2"
                                    onClick={() => void copyCode()}
                                >
                                    <Copy className="size-4" />
                                    Copy syllabus code
                                </Button>
                            </section>

                            <section className="rounded-2xl border bg-card p-5">
                                <h2 className="font-semibold">
                                    Explore this syllabus
                                </h2>

                                <div className="mt-3 flex flex-col gap-2">
                                    <Button
                                        variant={
                                            tab === "overview"
                                                ? "secondary"
                                                : "ghost"
                                        }
                                        className="justify-start"
                                        onClick={() =>
                                            setTab("overview")
                                        }
                                    >
                                        <BookOpenText className="size-4" />
                                        Overview
                                    </Button>

                                    <Button
                                        variant={
                                            tab === "learning"
                                                ? "secondary"
                                                : "ghost"
                                        }
                                        className="justify-start"
                                        onClick={() =>
                                            setTab("learning")
                                        }
                                    >
                                        <Layers3 className="size-4" />
                                        Learning Plan
                                    </Button>
                                </div>
                            </section>
                        </aside>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
