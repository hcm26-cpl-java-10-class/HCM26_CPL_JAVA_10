
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
    ArrowLeft,
    BookOpenText,
    Link2,
    Check,
    ChevronDown,
    Copy,
    LayoutGrid,
    Table2,
    Layers3,
    ListChecks,
    Search,
    X,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { SyllabusLanguageSwitcher, translatedSyllabusLink, useSyllabusLanguage } from "./SyllabusLanguageSwitcher";
import { syllabusLabel } from "./syllabusTranslationUi";
import { usePermissions } from "@/hooks/usePermissions";
import SyllabusLearningPlanTable from "./SyllabusLearningPlanTable";
import { StudentTopicCourseMaterials } from "./StudentTopicCourseMaterials";
import { courseApi } from "@/api";
import type { CourseDetail } from "@/types";
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

const textOrDash = (
    value: string | number | null | undefined,
    language: "en" | "vi" = "en",
) =>
    value == null || String(value).trim() === ""
        ? (language === "vi" ? "Chưa cung cấp" : "Not provided")
        : String(value);

function sectionName(section: Section, language: "en" | "vi" = "en"): string {
    const name = section.title
        .replace(/^\s*(?:Section|Chương)\s+\d+\s*[:.\-–]\s*/i, "")
        .trim();

    return `${language === "vi" ? "Chương" : "Section"} ${section.orderIndex}: ${
        name || section.title
    }`;
}

function topicName(topic: Topic): string {
    const name = topic.title
        .replace(
            /^\s*(?:(?:Topic|Chủ đề)\s+)?\d+\s*[:.)\-–]\s+/i,
            ""
        )
        .trim();

    return `${topic.orderIndex}. ${
        name || topic.title
    }`;
}

function InfoField({
                       label,
                       value, language = "en",
                   }: {
    label: string;
    value: string | number | null | undefined;
    language?: "en" | "vi";
}) {
    return (
        <div className="border-b pb-4 last:border-b-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>

            <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">
                {textOrDash(value, language)}
            </dd>
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
    const language = useSyllabusLanguage();
    const { hasPermission } = usePermissions();
    const canReadCourses = hasPermission("COURSE_READ");
    const [searchParams] = useSearchParams();
    const fromCourse = Number(searchParams.get("fromCourse"));
    const validSource = Number.isSafeInteger(fromCourse) && fromCourse > 0;
    const backPath = validSource ? `/courses/${fromCourse}` : translatedSyllabusLink("/student/syllabuses", language);

    const syllabusId = Number(id);
    const validId =
        Number.isSafeInteger(syllabusId) &&
        syllabusId > 0;

    const [tab, setTab] = useState("overview");
    const [search, setSearch] = useState("");
    const [planView, setPlanView] = useState<"cards" | "table">("cards");

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
    // Translate only the display copy. Keep the English source for stable Topic -> Lesson matching.
    const translationQuery = useQuery({
        queryKey: ["student-syllabus-translation", syllabusId, syllabus],
        queryFn: () => studentSyllabusApi.translateDetail(syllabusId),
        enabled: language === "vi" && validId && !!syllabus,
        staleTime: 30 * 60 * 1000,
        retry: false,
    });
    const displayedSyllabus = language === "vi" && translationQuery.isSuccess
        ? translationQuery.data : syllabus;
    const sourceSectionMap = new Map<number, Section>((syllabus?.sections ?? []).map(section => [section.id, section]));

    const relatedCoursesQuery = useQuery({
        queryKey: ["student-syllabus-related-courses", syllabusId],
        queryFn: () => studentSyllabusApi.relatedCourses(syllabusId),
        enabled: validId && !!syllabus && canReadCourses,
        retry: (count, error) =>
            !(axios.isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)) && count < 2,
    });

    // Read-only published Course outlines. Content URLs remain gated by the Course API.
    // On a failed detail request, show an error instead of falsely saying Online.
    const courseOutlinesQuery = useQuery({
        queryKey: ["student-syllabus-course-outlines", syllabusId,
            (relatedCoursesQuery.data ?? []).map((course) => course.id)],
        enabled: validId && canReadCourses && relatedCoursesQuery.isSuccess &&
            (relatedCoursesQuery.data?.length ?? 0) > 0,
        queryFn: async (): Promise<CourseDetail[]> => {
            return Promise.all(
                (relatedCoursesQuery.data ?? []).map((course) => courseApi.getCatalogDetail(course.id)),
            );
        },
        retry: false,
    });
    const linkedCourses = relatedCoursesQuery.data ?? [];
    const courseOutlines = courseOutlinesQuery.data ?? [];
    const errorCourseMaterials = relatedCoursesQuery.isError || courseOutlinesQuery.isError;
    const loadingCourseMaterials = canReadCourses &&
        (relatedCoursesQuery.isPending || (linkedCourses.length > 0 && courseOutlinesQuery.isPending));

    const sections = [
        ...(displayedSyllabus?.sections ?? []),
    ].sort(
        (a, b) => a.orderIndex - b.orderIndex
    );

    const clos = [
        ...(displayedSyllabus?.clos ?? []),
    ].sort(
        (a, b) => a.orderIndex - b.orderIndex
    );

    const cloById = new Map(clos.map((clo) => [clo.id, clo]));
    const searchText = search.trim().toLocaleLowerCase();
    const topicMatchesClo = (topic: Topic) => (topic.cloIds ?? []).some((cloId) => {
        const clo = cloById.get(cloId);
        return clo != null &&
            `${clo.code} ${clo.details}`.toLocaleLowerCase().includes(searchText);
    });

    const filteredSections = sections.filter(
        (section) =>
            !searchText ||
            sectionName(section, language)
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
                    topicMatchesClo(topic)
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
            headerActions={<SyllabusLanguageSwitcher loading={language === "vi" && translationQuery.isFetching} />}
            pathName={{
                syllabuses: language === "vi" ? "Đề cương" : "Syllabuses",
                [String(id)]: displayedSyllabus?.name ?? "Details",
            }}
            pathLinks={{ syllabuses: translatedSyllabusLink("/student/syllabuses", language) }}
        >
            <div className={`mx-auto w-full space-y-6 pb-10 ${tab === "learning" && planView === "table" ? "max-w-[1600px]" : "max-w-6xl"}`}>

                <Button
                    asChild
                    variant="ghost"
                    className="-ml-3 gap-2"
                >
                    <Link to={backPath}>
                        <ArrowLeft className="size-4" />
                        {validSource
                            ? syllabusLabel(language, "backToCourse", "Back to Course")
                            : syllabusLabel(language, "backToSyllabuses", "Back to Syllabuses")}
                    </Link>
                </Button>

                {language === "vi" && translationQuery.isError && (
                    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
                        {syllabusLabel(language, "translationError", "Translation unavailable. The original text is shown.")}
                        <Button size="sm" variant="outline" onClick={() => void translationQuery.refetch()}>
                            {syllabusLabel(language, "retry", "Retry")}
                        </Button>
                    </div>
                )}

                {!validId ? (
                    <div className="rounded-2xl border bg-card p-8">
                        {syllabusLabel(language, "invalid", "Invalid Syllabus ID.")}
                    </div>
                ) : query.isPending ? (
                    <DetailLoading />
                ) : query.isError || !syllabus ? (
                    <section
                        role="alert"
                        className="space-y-3 rounded-2xl border bg-card p-8"
                    >
                        <h1 className="text-lg font-semibold">
                            {syllabusLabel(language, "syllabusUnavailable", "Syllabus unavailable")}
                        </h1>

                        <p className="text-sm text-muted-foreground">
                            {syllabusLabel(language, "syllabusUnavailableHelp", "This syllabus may be unpublished, inactive, deleted or temporarily unavailable.")}
                        </p>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => void query.refetch()}
                            >
                                {syllabusLabel(language, "retry", "Retry")}
                            </Button>

                            <Button asChild>
                                <Link to={translatedSyllabusLink("/student/syllabuses", language)}>
                                    {syllabusLabel(language, "browseSyllabuses", "Browse syllabuses")}
                                </Link>
                            </Button>
                        </div>
                    </section>
                ) : (
                    <div className={tab === "learning" && planView === "table"
                        ? "grid items-start gap-6"
                        : "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"}>
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
                                            {syllabusLabel(language, "published", "Published")}
                                        </Badge>

                                        <Badge
                                            variant="outline"
                                            className="font-mono"
                                        >
                                            {syllabus.code}
                                        </Badge>

                                        <span className="text-xs text-muted-foreground">
                      {syllabusLabel(language, "readOnly", "Read only")}
                    </span>
                                    </div>

                                    <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
                                        {displayedSyllabus?.name}
                                    </h1>

                                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                        {textOrDash(displayedSyllabus?.description, language)}
                                    </p>
                                </div>
                            </header>

                            {/* Related Courses use explicit FK relations, never matching names. */}
                            {canReadCourses && (
                                <section className="rounded-2xl border bg-card p-5" aria-label="Related Courses">
                                    <div className="mb-3 flex items-center gap-2">
                                        <Link2 className="size-4 text-muted-foreground" />
                                        <h2 className="font-semibold">{syllabusLabel(language, "relatedCourses", "Related Courses")}</h2>
                                    </div>
                                    {relatedCoursesQuery.isPending ? (
                                        <p className="text-sm text-muted-foreground">{syllabusLabel(language, "loadingRelated", "Loading related Courses...")}</p>
                                    ) : relatedCoursesQuery.isError ? (
                                        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                            {syllabusLabel(language, "unavailableRelated", "Unable to load related Courses.")}
                                            <Button size="sm" variant="outline" onClick={() => void relatedCoursesQuery.refetch()}>{syllabusLabel(language, "retry", "Retry")}</Button>
                                        </div>
                                    ) : !relatedCoursesQuery.data?.length ? (
                                        <p className="text-sm text-muted-foreground">{syllabusLabel(language, "noneRelated", "No published Courses are currently linked to this Syllabus.")}</p>
                                    ) : (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {relatedCoursesQuery.data.map((course) => (
                                                <Link key={course.id} to={`/courses/${course.id}`}
                                                    className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted/50">
                                                    <BookOpenText className="size-4 shrink-0 text-muted-foreground" />
                                                    <span className="min-w-0 flex-1 truncate">{course.name}</span>
                                                    <span className="text-xs text-muted-foreground">{syllabusLabel(language, "viewCourse", "View Course")}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

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
                                        {syllabusLabel(language, "overview", "Overview")}
                                    </TabsTrigger>

                                    <TabsTrigger
                                        value="learning"
                                        className="gap-2"
                                    >
                                        <Layers3 className="size-4" />
                                        {syllabusLabel(language, "learningPlan", "Learning Plan")}
                                    </TabsTrigger>
                                </TabsList>

                                {/* OVERVIEW */}
                                <TabsContent
                                    value="overview"
                                    className="space-y-4"
                                >
                                    <section className="rounded-2xl border bg-card p-6">
                                        <h2 className="mb-5 text-lg font-semibold">
                                            {syllabusLabel(language, "generalInformation", "General Information")}
                                        </h2>

                                        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                                            <InfoField
                                                label={syllabusLabel(language, "teachingMethods", "Teaching Methods")}
                                                value={displayedSyllabus?.teachingMethods}
                                                language={language}
                                            />

                                            <InfoField
                                                label={syllabusLabel(language, "degreeLevel", "Degree Level")}
                                                value={displayedSyllabus?.degreeLevel}
                                                language={language}
                                            />

                                            <InfoField
                                                label={syllabusLabel(language, "timeAllocation", "Time Allocation")}
                                                value={displayedSyllabus?.timeAllocation}
                                                language={language}
                                            />

                                            <InfoField
                                                label={syllabusLabel(language, "scoringScale", "Scoring Scale")}
                                                value={displayedSyllabus?.scoringScale}
                                                language={language}
                                            />

                                            <InfoField
                                                label={syllabusLabel(language, "responsibilities", "Student Responsibilities")}
                                                value={displayedSyllabus?.studentResponsibilities}
                                                language={language}
                                            />

                                            <InfoField
                                                label={syllabusLabel(language, "requiredTools", "Required Tools")}
                                                value={displayedSyllabus?.requiredTools}
                                                language={language}
                                            />
                                        </dl>
                                    </section>

                                    <section className="rounded-2xl border bg-card p-6">
                                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                                            <ListChecks className="size-5" />
                                            {syllabusLabel(language, "outcomes", "Course Learning Outcomes")}
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
                                                {syllabusLabel(language, "noOutcomes", "No learning outcomes available.")}
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
                                                    {syllabusLabel(language, "learningPlan", "Learning Plan")}
                                                </h2>

                                                <p className="text-sm text-muted-foreground">
                                                    {syllabusLabel(language, "learningDescription", "Links appear only when a published Course contains the matching Section and Topic as a Lesson.")}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex items-center rounded-md border bg-background p-0.5" aria-label="Learning plan view mode">
                                                    <Button size="sm" variant={planView === "cards" ? "secondary" : "ghost"}
                                                        onClick={() => setPlanView("cards")} aria-pressed={planView === "cards"} className="gap-1.5">
                                                        <LayoutGrid className="size-4" /> {syllabusLabel(language, "cards", "Cards")}
                                                    </Button>
                                                    <Button size="sm" variant={planView === "table" ? "secondary" : "ghost"}
                                                        onClick={() => setPlanView("table")} aria-pressed={planView === "table"} className="gap-1.5">
                                                        <Table2 className="size-4" /> {syllabusLabel(language, "table", "Table")}
                                                    </Button>
                                                </div>
                                                {planView === "cards" && <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => expandAll(true)}
                                                >
                                                    {syllabusLabel(language, "expandAll", "Expand all")}
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => expandAll(false)}
                                                >
                                                    {syllabusLabel(language, "collapseAll", "Collapse all")}
                                                </Button>
                                                </>}
                                            </div>
                                        </div>

                                        <p className="mt-3 text-xs text-muted-foreground">
                                            {syllabusLabel(language, "learningNote", "Only the Sections and Topics implemented by a published Course show View lesson. Other topics display Online.")}
                                        </p>
                                        <div className="relative mt-4">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                                            <Input
                                                aria-label="Find section or topic"
                                                placeholder={syllabusLabel(language, "findTopic", "Find a section, topic or resource...")}
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

                                    {planView === "table" ? (
                                        <SyllabusLearningPlanTable sections={sections} clos={clos} search={search}
                                            originalSections={syllabus?.sections ?? []} language={language}
                                            courses={linkedCourses} outlines={courseOutlines}
                                            loadingCourses={loadingCourseMaterials} coursesError={errorCourseMaterials}
                                            canReadCourses={canReadCourses} />
                                    ) : <>
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
                                            sectionName(section, language)
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
                                                    topicMatchesClo(topic)
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
                              {sectionName(section, language)}
                            </span>

                                                        <span className="flex shrink-0 items-center gap-2">
                              <Badge variant="secondary">
                                {section.topics.length} {syllabusLabel(language, "topics", "topics")}
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
                                                            {syllabusLabel(language, "mission", "Mission")}
                                                        </p>

                                                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                                            {textOrDash(
                                                                section.mission, language
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

                                                            {(topic.cloIds ?? []).some((cloId) => cloById.has(cloId)) && (
                                                                <div className="space-y-2 rounded-lg border bg-card/60 p-3">
                                                                    <p className="text-xs font-medium text-muted-foreground">
                                                                        {syllabusLabel(language, "learningOutcomes", "Learning outcomes")}
                                                                    </p>
                                                                    {(topic.cloIds ?? []).map((cloId) => {
                                                                        const clo = cloById.get(cloId);
                                                                        return clo ? (
                                                                            <div key={clo.id} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                                                                                <Badge variant="outline" className="shrink-0">
                                                                                    {clo.code}
                                                                                </Badge>
                                                                                <p className="min-w-0 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                                                                                    {clo.details}
                                                                                </p>
                                                                            </div>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                            )}

                                                            <div className="space-y-2">
                                                                <p className="text-xs font-semibold text-muted-foreground">{syllabusLabel(language, "studentMaterials", "Student materials")}</p>
                                                                <StudentTopicCourseMaterials topicId={topic.id} topicTitle={sourceSectionMap.get(section.id)?.topics.find(sourceTopic => sourceTopic.id === topic.id)?.title ?? topic.title}
                                                                    sectionTitle={sourceSectionMap.get(section.id)?.title ?? section.title} courses={linkedCourses}
                                                                    outlines={courseOutlines} loading={loadingCourseMaterials}
                                                                    error={errorCourseMaterials} canReadCourses={canReadCourses} language={language} />
                                                            </div>
                                                        </article>
                                                    ))}

                                                    {topics.length === 0 && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {syllabusLabel(language, "noTopicMatches", "No matching topics in this section.")}
                                                        </p>
                                                    )}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        );
                                    })}

                                    {!filteredSections.length && (
                                        <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                                            {searchText
                                                ? (language === "vi" ? "Không có Section hoặc Topic phù hợp." : "No matching sections or topics.")
                                                : syllabusLabel(language, "noSections", "No sections available.")}
                                        </div>
                                    )}
                                    </>}
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* COURSE-STYLE SIDEBAR */}
                        <aside className={tab === "learning" && planView === "table" ? "hidden" : "space-y-4 lg:sticky lg:top-4"}>
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
                                    {syllabusLabel(language, "copyCode", "Copy syllabus code")}
                                </Button>
                            </section>

                            <section className="rounded-2xl border bg-card p-5">
                                <h2 className="font-semibold">
                                    {syllabusLabel(language, "exploreSyllabus", "Explore this syllabus")}
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
                                        {syllabusLabel(language, "overview", "Overview")}
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
                                        {syllabusLabel(language, "learningPlan", "Learning Plan")}
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
