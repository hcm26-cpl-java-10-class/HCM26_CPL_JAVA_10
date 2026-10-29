
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    keepPreviousData,
    useQuery,
} from "@tanstack/react-query";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    BookOpenText,
    FileText,
    Layers3,
    Search,
    SearchX,
    X,
} from "lucide-react";

import {
    studentSyllabusApi,
    type StudentSyllabusItem,
} from "@/api/features/demo/student-syllabus.api";

import { useDebouncedValue } from
        "@/pages/management/demo/course/hooks/useDebouncedValue";

import { CatalogPagination } from
        "@/pages/management/demo/course/components/CatalogPagination";

const ALL = "all";
const DEFAULT_SORT = "name";

const validFields = ["all", "code", "name"];
const validSorts = ["name", "code"];

function validOption(
    value: string | null,
    options: string[],
    fallback: string
) {
    return value && options.includes(value)
        ? value
        : fallback;
}

// Match the Course Catalog card structure.
function SyllabusCard({
                          syllabus,
                      }: {
    syllabus: StudentSyllabusItem;
}) {
    const detailPath =
        `/student/syllabuses/${syllabus.id}`;

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
            {/* CARD COVER */}
            <Link
                to={detailPath}
                className="block"
                aria-label={`View ${syllabus.name}`}
            >
                <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
                    <BookOpenText
                        className="size-14 text-blue-900/25 transition-transform duration-300 group-hover:scale-105"
                        aria-hidden="true"
                    />

                    <Badge className="absolute left-3 top-3 max-w-[75%] truncate bg-white/95 font-mono text-slate-800 hover:bg-white">
                        {syllabus.code}
                    </Badge>

                    <Badge className="absolute right-3 bottom-3 bg-emerald-600 text-white hover:bg-emerald-600">
                        Published
                    </Badge>
                </div>
            </Link>

            {/* CARD CONTENT */}
            <div className="flex flex-1 flex-col gap-3 p-5">
                <Link
                    to={detailPath}
                    className="hover:underline"
                >
                    <h3 className="line-clamp-2 min-h-12 text-lg font-semibold leading-6">
                        {syllabus.name}
                    </h3>
                </Link>

                <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-muted-foreground">
                    {syllabus.description?.trim() ||
                        "Explore the course outline, learning outcomes and study materials."}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Layers3 className="size-3.5" />
              {syllabus.sectionCount} sections
          </span>

                    <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5" />
            Course syllabus
          </span>
                </div>

                <div className="mt-auto pt-2">
                    <Button
                        asChild
                        variant="outline"
                        className="w-full"
                    >
                        <Link to={detailPath}>
                            View details
                        </Link>
                    </Button>
                </div>
            </div>
        </article>
    );
}

// Match CourseCardSkeleton dimensions.
function SyllabusCardSkeleton() {
    return (
        <div
            className="overflow-hidden rounded-2xl border bg-card shadow-sm"
            aria-hidden="true"
        >
            <div className="h-44 animate-pulse bg-muted" />

            <div className="space-y-3 p-5">
                <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-14 animate-pulse rounded bg-muted" />
                <div className="h-9 animate-pulse rounded bg-muted" />
            </div>
        </div>
    );
}

export default function StudentSyllabusListPage() {
    const [searchParams, setSearchParams] =
        useSearchParams();

    // URL is the source of truth, like Course Catalog.
    const urlSearch = searchParams.get("q") ?? "";

    const field = validOption(
        searchParams.get("field"),
        validFields,
        ALL
    );

    const sort = validOption(
        searchParams.get("sort"),
        validSorts,
        DEFAULT_SORT
    );

    // URL page is 1-based, API page is 0-based.
    const pageParam = Number(
        searchParams.get("page")
    );

    const page =
        Number.isSafeInteger(pageParam) &&
        pageParam > 1
            ? pageParam - 1
            : 0;

    const updateParams = useCallback(
        (
            changes: Record<
                string,
                string | undefined
            >,
            resetPage = true
        ) => {
            setSearchParams(
                (previous) => {
                    const next =
                        new URLSearchParams(previous);

                    Object.entries(changes).forEach(
                        ([key, value]) => {
                            if (value) {
                                next.set(key, value);
                            } else {
                                next.delete(key);
                            }
                        }
                    );

                    if (resetPage) {
                        next.delete("page");
                    }

                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    // Reuse the Course Catalog debounce hook.
    const [searchInput, setSearchInput] =
        useState(urlSearch);

    const debouncedSearch = useDebouncedValue(
        searchInput.trim(),
        400
    );

    useEffect(() => {
        if (
            debouncedSearch !== urlSearch.trim()
        ) {
            updateParams({
                q: debouncedSearch || undefined,
            });
        }
        // Same URL sync behavior as Course Catalog.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    // Restore the input on browser navigation.
    useEffect(() => {
        if (
            urlSearch.trim() !== debouncedSearch
        ) {
            setSearchInput(urlSearch);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlSearch]);

    const query = useQuery({
        queryKey: [
            "student-syllabuses",
            {
                search: urlSearch.trim(),
                field,
                sort,
                page,
            },
        ],
        queryFn: () =>
            studentSyllabusApi.list({
                search: urlSearch.trim(),
                searchBy: field,
                sortBy: sort,
                page,
            }),
        placeholderData: keepPreviousData,
    });

    const data = query.data;

    const syllabuses = data?.items ?? [];
    const totalElements =
        data?.totalElements ?? 0;
    const totalPages =
        data?.totalPages ?? 0;

    const hasFilters =
        Boolean(urlSearch.trim()) ||
        field !== ALL;

    const showSkeleton = query.isLoading;

    // Handle URLs pointing to a page that no longer exists.
    useEffect(() => {
        if (
            !query.isPlaceholderData &&
            data &&
            page > 0 &&
            (totalPages === 0 || page >= totalPages)
        ) {
            updateParams(
                {
                    page:
                        totalPages > 1
                            ? String(totalPages)
                            : undefined,
                },
                false
            );
        }
    }, [
        data,
        page,
        query.isPlaceholderData,
        totalPages,
        updateParams,
    ]);

    function clearFilters() {
        setSearchInput("");

        setSearchParams(
            new URLSearchParams(),
            { replace: true }
        );
    }

    function changePage(nextPage: number) {
        updateParams(
            {
                page:
                    nextPage > 0
                        ? String(nextPage + 1)
                        : undefined,
            },
            false
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    return (
        <MainLayout
            pathName={{
                syllabuses: "Syllabuses",
            }}
        >
            <div className="mx-auto w-full max-w-7xl space-y-8 pb-8">

                {/* HERO — MATCH COURSE CATALOG */}
                <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-12">
                    <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-blue-500/30 blur-3xl" />

                    <div className="pointer-events-none absolute -bottom-32 right-1/3 size-72 rounded-full bg-violet-500/20 blur-3xl" />

                    <div className="relative max-w-2xl">
                        <Badge className="mb-4 border border-white/20 bg-white/10 text-blue-100 hover:bg-white/10">
                            SYLLABUS LIBRARY
                        </Badge>

                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Explore your learning path.
                        </h1>

                        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                            Discover published syllabuses,
                            explore learning outcomes,
                            review course outlines and
                            access study materials.
                        </p>
                    </div>

                    <BookOpenText
                        aria-hidden="true"
                        className="absolute bottom-6 right-10 hidden size-28 text-white/10 sm:block"
                    />
                </section>

                {/* FILTERS + RESULTS */}
                <section className="space-y-5">

                    {/* FILTER BAR */}
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_170px]">

                        {/* SEARCH */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                            <Input
                                aria-label="Search syllabuses"
                                value={searchInput}
                                maxLength={100}
                                placeholder="Search by syllabus code or name..."
                                className="pl-9 pr-9"
                                onChange={(event) =>
                                    setSearchInput(
                                        event.target.value
                                    )
                                }
                            />

                            {searchInput && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                        setSearchInput("")
                                    }
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>

                        {/* SEARCH FIELD */}
                        <Select
                            value={field}
                            onValueChange={(value) =>
                                updateParams({
                                    field:
                                        value === ALL
                                            ? undefined
                                            : value,
                                })
                            }
                        >
                            <SelectTrigger
                                aria-label="Search field"
                                className="w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value={ALL}>
                                    Code or name
                                </SelectItem>

                                <SelectItem value="code">
                                    Code
                                </SelectItem>

                                <SelectItem value="name">
                                    Name
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {/* SORT */}
                        <Select
                            value={sort}
                            onValueChange={(value) =>
                                updateParams({
                                    sort:
                                        value === DEFAULT_SORT
                                            ? undefined
                                            : value,
                                })
                            }
                        >
                            <SelectTrigger
                                aria-label="Sort syllabuses"
                                className="w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="name">
                                    Name (A–Z)
                                </SelectItem>

                                <SelectItem value="code">
                                    Code (A–Z)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* RESULT COUNT */}
                    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                        <p
                            role="status"
                            aria-live="polite"
                        >
                            {showSkeleton
                                ? "Loading syllabuses..."
                                : query.isError
                                    ? ""
                                    : `${totalElements} ${
                                        totalElements === 1
                                            ? "syllabus"
                                            : "syllabuses"
                                    } found`}
                        </p>

                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                            >
                                <X className="size-4" />
                                Clear filters
                            </Button>
                        )}
                    </div>

                    {/* ERROR */}
                    {query.isError ? (
                        <div
                            role="alert"
                            className="space-y-3 rounded-2xl border border-destructive/30 p-6"
                        >
                            <p className="text-sm text-destructive">
                                Could not load the syllabus library.
                                Please check your connection
                                and try again.
                            </p>

                            <Button
                                variant="outline"
                                onClick={() =>
                                    void query.refetch()
                                }
                            >
                                Try again
                            </Button>
                        </div>
                    ) : showSkeleton ? (

                        /* LOADING */
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {Array.from(
                                { length: 6 },
                                (_, index) => (
                                    <SyllabusCardSkeleton
                                        key={index}
                                    />
                                )
                            )}
                        </div>
                    ) : syllabuses.length === 0 ? (

                        /* EMPTY STATE */
                        <div className="rounded-2xl border border-dashed p-10 text-center">
                            {hasFilters ? (
                                <SearchX className="mx-auto size-9 text-muted-foreground" />
                            ) : (
                                <BookOpenText className="mx-auto size-9 text-muted-foreground" />
                            )}

                            <h3 className="mt-3 font-semibold">
                                No syllabuses found
                            </h3>

                            <p className="mt-1 text-sm text-muted-foreground">
                                {hasFilters
                                    ? "Try another keyword or clear your search filters."
                                    : "No syllabuses have been published yet."}
                            </p>

                            {hasFilters && (
                                <Button
                                    variant="outline"
                                    className="mt-4"
                                    onClick={clearFilters}
                                >
                                    Clear filters
                                </Button>
                            )}
                        </div>
                    ) : (

                        /* RESULT CARDS */
                        <div
                            aria-busy={
                                query.isPlaceholderData
                            }
                            className={`grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
                                query.isPlaceholderData
                                    ? "opacity-60"
                                    : ""
                            }`}
                        >
                            {syllabuses.map((syllabus) => (
                                <SyllabusCard
                                    key={syllabus.id}
                                    syllabus={syllabus}
                                />
                            ))}
                        </div>
                    )}

                    {/* REUSE COURSE PAGINATION */}
                    <CatalogPagination
                        page={page}
                        totalPages={totalPages}
                        onPageChange={changePage}
                    />
                </section>
            </div>
        </MainLayout>
    );
}
