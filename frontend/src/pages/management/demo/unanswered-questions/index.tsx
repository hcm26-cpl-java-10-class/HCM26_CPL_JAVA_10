import { qnaApi } from "@/api";
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
import { useDebouncedValue } from "@/pages/management/demo/course/hooks/useDebouncedValue";
import type { UnansweredQuestion } from "@/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock, MessageSquare, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 10;
const ALL_COURSES = "ALL";
const URGENT_AFTER_DAYS = 2;

/** "5 minutes", "3 hours", "4 days" - how long the question has been waiting. */
function waitingTime(value?: string | null): { label: string; urgent: boolean } | null {
  if (!value) return null;
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60_000));
  if (minutes < 60) {
    return { label: `${Math.max(minutes, 1)} min`, urgent: false };
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { label: `${hours} hour${hours === 1 ? "" : "s"}`, urgent: false };
  }
  const days = Math.floor(hours / 24);
  return { label: `${days} day${days === 1 ? "" : "s"}`, urgent: days >= URGENT_AFTER_DAYS };
}

/** Opens the curriculum page on the question's lesson, scrolled to the question. */
function questionLink(question: UnansweredQuestion): string {
  const params = new URLSearchParams({
    courseId: String(question.courseId),
    sectionId: String(question.sectionId),
    lessonId: String(question.lessonId),
    questionId: String(question.id),
  });
  return `/curriculum?${params.toString()}`;
}

export default function UnansweredQuestionsPage() {
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [courseFilter, setCourseFilter] = useState(ALL_COURSES);
  const courseId = courseFilter === ALL_COURSES ? undefined : Number(courseFilter);

  useEffect(() => {
    setPage(0);
  }, [search, courseFilter]);

  const countsQuery = useQuery({
    queryKey: ["unanswered-courses"],
    queryFn: qnaApi.unansweredCourseCounts,
  });
  const courseCounts = countsQuery.data ?? [];
  const totalWaiting = courseCounts.reduce((sum, course) => sum + course.count, 0);

  const listQuery = useQuery({
    queryKey: ["unanswered-questions", { page, search, courseId }],
    queryFn: () => qnaApi.listUnanswered({ page, size: PAGE_SIZE, courseId, search }),
    placeholderData: keepPreviousData,
  });

  const questions = listQuery.data?.content ?? [];
  const totalElements = listQuery.data?.totalElements ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 0;
  const filtering = Boolean(search) || courseId !== undefined;

  return (
    <MainLayout pathName={{ "unanswered-questions": "Unanswered Questions" }}>
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-700">Q&amp;A</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Unanswered questions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Questions awaiting an answer in the courses you teach. The longest-waiting come first.
            </p>
          </div>
          {!countsQuery.isLoading && (
            <Badge variant={totalWaiting > 0 ? "default" : "secondary"} className="text-sm">
              {totalWaiting} waiting
            </Badge>
          )}
        </div>

        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search unanswered questions"
                value={searchInput}
                maxLength={100}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by question, lesson or student..."
                className="pl-9"
              />
            </div>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-full md:w-[280px]" aria-label="Filter by course">
                <SelectValue placeholder="All courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COURSES}>All courses ({totalWaiting})</SelectItem>
                {courseCounts.map((course) => (
                  <SelectItem key={course.courseId} value={String(course.courseId)}>
                    {course.courseName} ({course.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {listQuery.isLoading ? (
          <p role="status" className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
            Loading questions...
          </p>
        ) : listQuery.isError ? (
          <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-6">
            <p className="text-sm text-destructive">Could not load unanswered questions.</p>
            <Button variant="outline" onClick={() => void listQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <CheckCircle2 className="mx-auto size-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">
              {filtering ? "No questions match your filters" : "All caught up"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtering
                ? "Try a different search or choose another course."
                : "No student question is waiting for an answer."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-busy={listQuery.isPlaceholderData}>
            {questions.map((question) => {
              const waiting = waitingTime(question.createdAt);
              return (
                <li key={question.id}>
                  <Link
                    to={questionLink(question)}
                    className="group block rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{question.courseName}</Badge>
                      <span className="min-w-0 truncate">
                        {question.sectionTitle} &rsaquo; {question.lessonTitle}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                      {question.content}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="size-3.5" />
                          {question.authorName}
                        </span>
                        {waiting && (
                          <span
                            className={`inline-flex items-center gap-1 ${
                              waiting.urgent ? "font-medium text-amber-600" : ""
                            }`}
                          >
                            <Clock className="size-3.5" />
                            Waiting {waiting.label}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Answer <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages} &middot; {totalElements} question
              {totalElements === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </MainLayout>
  );
}
