import { courseApi } from "@/api";
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
  COURSE_LEVEL_OPTIONS,
  type CatalogSort,
  type CategoryTreeDTO,
  type CourseLevel,
} from "@/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { GraduationCap, Search, SearchX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCourseEnrollment } from "../hooks/useCourseEnrollment.ts";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";
import { CatalogPagination } from "./CatalogPagination.tsx";
import { CourseCard, CourseCardSkeleton } from "./CourseCard.tsx";

const PAGE_SIZE = 12;
const ALL = "all";

const SORT_OPTIONS: { label: string; value: CatalogSort }[] = [
  { label: "Newest", value: "createdAt,desc" },
  { label: "Name (A–Z)", value: "name,asc" },
  { label: "Name (Z–A)", value: "name,desc" },
];

const isLevel = (value: string | null): value is CourseLevel =>
  COURSE_LEVEL_OPTIONS.some((option) => option.value === value);

const isSort = (value: string | null): value is CatalogSort =>
  SORT_OPTIONS.some((option) => option.value === value);

interface CategoryOption {
  id: number;
  label: string;
}

/** Cây danh mục -> danh sách phẳng, thụt đầu dòng theo cấp, kèm số khóa học. */
function flattenCategories(nodes: CategoryTreeDTO[], depth = 0): CategoryOption[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      label: `${"— ".repeat(depth)}${node.name}${
        node.totalCourseCount != null ? ` (${node.totalCourseCount})` : ""
      }`,
    },
    ...flattenCategories(node.children ?? [], depth + 1),
  ]);
}

/**
 * Trang Catalog cho người học. Bộ lọc/phân trang được lưu trên URL (?q=&category=&level=&sort=&page=)
 * nên quay lại từ trang chi tiết vẫn giữ nguyên kết quả đang xem.
 */
export function CourseCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get("q") ?? "";
  const categoryParam = Number(searchParams.get("category"));
  const categoryId = Number.isInteger(categoryParam) && categoryParam > 0 ? categoryParam : undefined;
  const levelParam = searchParams.get("level");
  const level = isLevel(levelParam) ? levelParam : undefined;
  const sortParam = searchParams.get("sort");
  const sort: CatalogSort = isSort(sortParam) ? sortParam : "createdAt,desc";
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam - 1 : 0; // URL 1-based, API 0-based

  const updateParams = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });
          if (resetPage) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Ô tìm kiếm: giữ state cục bộ để gõ mượt, debounce rồi mới đẩy lên URL/gọi API.
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);

  useEffect(() => {
    if (debouncedSearch !== urlSearch.trim()) {
      updateParams({ q: debouncedSearch || undefined });
    }
    // chỉ phản ứng khi giá trị debounce đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Back/forward hoặc "Clear filters" đổi URL từ bên ngoài -> đồng bộ lại ô input.
  // URL vừa được chính debounce ở trên ghi (urlSearch === debouncedSearch) thì bỏ qua,
  // tránh ghi đè chữ người dùng đang gõ tiếp.
  useEffect(() => {
    if (urlSearch.trim() !== debouncedSearch) {
      setSearchInput(urlSearch);
    }
    // chỉ phản ứng khi URL đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  const categoriesQuery = useQuery({
    queryKey: ["course-catalog-categories"],
    queryFn: courseApi.getCatalogCategories,
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = useMemo(
    () => flattenCategories(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  const coursesQuery = useQuery({
    queryKey: ["course-catalog", { search: urlSearch.trim(), categoryId, level, sort, page }],
    queryFn: () =>
      courseApi.searchCatalog({
        search: urlSearch.trim() || undefined,
        categoryId,
        level,
        sort,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const { canEnroll, enrollmentsQuery, enrollmentByCourseId, enrollMutation } = useCourseEnrollment();

  const courses = coursesQuery.data?.content ?? [];
  const totalElements = coursesQuery.data?.totalElements ?? 0;
  const totalPages = coursesQuery.data?.totalPages ?? 0;

  // Trang trong URL vượt quá số trang hiện có (vd: sau khi đổi bộ lọc) -> về trang cuối.
  useEffect(() => {
    if (!coursesQuery.isPlaceholderData && totalPages > 0 && page > totalPages - 1) {
      updateParams({ page: String(totalPages) }, false);
    }
  }, [coursesQuery.isPlaceholderData, totalPages, page, updateParams]);

  const hasFilters = Boolean(urlSearch.trim() || categoryId || level);
  const clearFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const changePage = (nextPage: number) => {
    updateParams({ page: nextPage > 0 ? String(nextPage + 1) : undefined }, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showSkeleton = coursesQuery.isLoading;
  const enrollingCourseId = enrollMutation.isPending ? enrollMutation.variables : undefined;

  return (
    <MainLayout pathName={{ courses: "Courses" }}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/3 size-72 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <Badge className="mb-4 border border-white/20 bg-white/10 text-blue-100 hover:bg-white/10">
              COURSE CATALOG
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Build skills that move you forward.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Browse published courses, filter by topic and level, then enroll to start learning.
            </p>
          </div>
          <GraduationCap className="absolute bottom-6 right-10 hidden size-28 text-white/10 sm:block" />
        </section>

        <section className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_170px_170px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search courses"
                className="pl-9 pr-9"
                placeholder="Search by name, description or instructor"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchInput("")}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <Select
              value={categoryId ? String(categoryId) : ALL}
              onValueChange={(value) => updateParams({ category: value === ALL ? undefined : value })}
            >
              <SelectTrigger aria-label="Filter by category" className="w-full">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={level ?? ALL}
              onValueChange={(value) => updateParams({ level: value === ALL ? undefined : value })}
            >
              <SelectTrigger aria-label="Filter by level" className="w-full">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All levels</SelectItem>
                {COURSE_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sort}
              onValueChange={(value) => updateParams({ sort: value === "createdAt,desc" ? undefined : value })}
            >
              <SelectTrigger aria-label="Sort courses" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p role="status" aria-live="polite">
              {showSkeleton
                ? "Loading courses..."
                : coursesQuery.isError
                  ? ""
                  : `${totalElements} ${totalElements === 1 ? "course" : "courses"} found`}
            </p>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4" /> Clear filters
              </Button>
            )}
          </div>

          {coursesQuery.isError ? (
            <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-6">
              <p className="text-sm text-destructive">
                Could not load the course catalog. Please check your connection and try again.
              </p>
              <Button variant="outline" onClick={() => void coursesQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : showSkeleton ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              {hasFilters ? (
                <SearchX className="mx-auto size-9 text-muted-foreground" />
              ) : (
                <GraduationCap className="mx-auto size-9 text-muted-foreground" />
              )}
              <h3 className="mt-3 font-semibold">No courses found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters
                  ? "Try a different keyword or clear some filters."
                  : "No courses have been published yet."}
              </p>
              {hasFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div
              className={`grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
                coursesQuery.isPlaceholderData ? "opacity-60" : ""
              }`}
              aria-busy={coursesQuery.isPlaceholderData}
            >
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  enrollmentId={enrollmentByCourseId.get(course.id)?.id}
                  canEnroll={canEnroll}
                  isEnrolling={enrollingCourseId === course.id}
                  onEnroll={(courseId) => enrollMutation.mutate(courseId)}
                />
              ))}
            </div>
          )}

          <CatalogPagination page={page} totalPages={totalPages} onPageChange={changePage} />

          {enrollmentsQuery.isError && (
            <p className="text-center text-xs text-muted-foreground">
              Could not load your enrollments, so “Continue learning” shortcuts may be missing.
            </p>
          )}
        </section>
      </div>
    </MainLayout>
  );
}