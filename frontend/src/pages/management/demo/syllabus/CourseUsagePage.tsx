import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Eye, RefreshCcw } from "lucide-react";

import { syllabusExtrasApi } from "@/api/features/demo/syllabus-extras.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { SyllabusListFooter, SyllabusListToolbar, type SyllabusViewMode } from "./SyllabusListControls";
import { SyllabusStatFilterCard } from "./SyllabusStatFilterCard";

export default function CourseUsagePage() {
  const { hasPermission } = usePermissions();
  const canReadCourses = hasPermission("COURSE_READ");
  const [search, setSearch] = useState("");
  const [usage, setUsage] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState<SyllabusViewMode>("table");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const query = useQuery({
    queryKey: ["syllabus-course-usage"],
    queryFn: syllabusExtrasApi.courseUsage,
    enabled: canReadCourses,
  });
  const all = query.data ?? [];
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return all.filter((item) => {
      if (usage === "linked" && item.courseCount === 0) return false;
      if (usage === "unused" && item.courseCount > 0) return false;
      if (status !== "all" && item.syllabusStatus !== status) return false;
      if (!keyword) return true;
      return item.syllabusName.toLocaleLowerCase().includes(keyword) ||
        item.syllabusCode.toLocaleLowerCase().includes(keyword) ||
        item.courses.some((course) => course.name.toLocaleLowerCase().includes(keyword));
    }).sort((a, b) => sort === "usage"
      ? b.courseCount - a.courseCount || a.syllabusName.localeCompare(b.syllabusName)
      : sort === "code" ? a.syllabusCode.localeCompare(b.syllabusCode)
      : a.syllabusName.localeCompare(b.syllabusName));
  }, [all, search, usage, status, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * pageSize, (current + 1) * pageSize);
  const linked = all.filter((item) => item.courseCount > 0).length;
  const associations = all.reduce((total, item) => total + item.courseCount, 0);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(0);
  }

  return (
    <MainLayout pathName={{ syllabuses: "Syllabuses", "course-usage": "Course Usage" }}
      pathLinks={{ syllabuses: "/syllabuses" }}>
      <div className="flex w-full flex-col gap-4 pb-5 font-inter">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Course Usage</h1>
            <p className="text-sm text-muted-foreground">Track which Courses use each Syllabus.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/syllabuses"><BookOpen className="size-4" /> Syllabuses</Link></Button>
        </div>

        {canReadCourses && !query.isError && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Course usage overview">
            {([
              { label: "Total syllabuses", count: all.length, filter: "all", hint: "Show all Syllabuses" },
              { label: "Used by courses", count: linked, filter: "linked", hint: "Show Syllabuses linked to a Course" },
              { label: "Not used", count: all.length - linked, filter: "unused", hint: "Show Syllabuses not linked to any Course" },
              { label: "Course associations", count: associations, filter: "associations", hint: "Show linked Syllabuses, sorted by most used" },
            ] as const).map((item) => (
              <SyllabusStatFilterCard
                key={item.filter}
                label={item.label}
                value={query.isPending ? "—" : item.count}
                hint={item.hint}
                selected={usage === (item.filter === "associations" ? "linked" : item.filter) &&
                  (item.filter === "associations" ? sort === "usage" : sort !== "usage") &&
                  status === "all" && !search.trim()}
                onClick={() => {
                  setUsage(item.filter === "associations" ? "linked" : item.filter);
                  setSort(item.filter === "associations" ? "usage" : "name");
                  setStatus("all");
                  setSearch("");
                  setPage(0);
                }}
              />
            ))}
          </div>
        )}

        <SyllabusListToolbar
          search={search} searchLabel="Search Syllabus code, name or Course" view={view} onViewChange={setView}
          onSearchChange={(value) => updateFilter(setSearch, value)}
          filters={<>
            <Select value={usage} onValueChange={(value) => updateFilter(setUsage, value)}>
              <SelectTrigger aria-label="Filter by course usage" className="h-9 w-[155px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All usage</SelectItem>
                <SelectItem value="linked">Used by courses</SelectItem>
                <SelectItem value="unused">Not used</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => updateFilter(setStatus, value)}>
              <SelectTrigger aria-label="Filter Syllabus status" className="h-9 w-[135px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => updateFilter(setSort, value)}>
              <SelectTrigger aria-label="Sort Course usage" className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="code">Code (A–Z)</SelectItem>
                <SelectItem value="usage">Most used</SelectItem>
              </SelectContent>
            </Select>
          </>}
          actions={<Button variant="outline" size="sm" disabled={!canReadCourses || query.isFetching}
            onClick={() => void query.refetch()}><RefreshCcw className="size-4" /> Refresh</Button>}
        />

        {!canReadCourses ? (
          <div role="alert" className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">Course Usage requires COURSE_READ permission.</div>
        ) : query.isPending ? (
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">Loading course usage...</div>
        ) : query.isError ? (
          <div role="alert" className="rounded-md border bg-card p-8 text-center">
            <p className="text-sm text-destructive">Unable to load course usage.</p>
            <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Retry</Button>
          </div>
        ) : view === "table" ? (
          <div className="overflow-hidden rounded-md border bg-card">
            <Table className="min-w-[810px] table-fixed">
              <TableHeader className="bg-background">
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="w-40">Code</TableHead>
                  <TableHead className="w-[22%]">Syllabus Name</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-24 text-center">Courses</TableHead>
                  <TableHead>Used by</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item, idx) => (
                  <TableRow key={item.syllabusId} className="odd:bg-muted/20">
                    <TableCell className="text-center text-muted-foreground">{current * pageSize + idx + 1}</TableCell>
                    <TableCell className="truncate font-medium" title={item.syllabusCode}>{item.syllabusCode}</TableCell>
                    <TableCell className="truncate" title={item.syllabusName}>
                      <Link className="font-medium hover:underline" to={`/syllabuses/${item.syllabusId}`}>{item.syllabusName}</Link>
                    </TableCell>
                    <TableCell><Badge variant="outline">{item.syllabusStatus === "PUBLISHED" ? "Published" : "Draft"}</Badge>
                      {!item.syllabusActive && <span className="ml-1 text-xs text-muted-foreground">Inactive</span>}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{item.courseCount}</TableCell>
                    <TableCell className="whitespace-normal">
                      {item.courses.length ? <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {item.courses.map((course) => (
                          <Link key={course.id} to={`/courses/${course.id}`} title={`${course.status}${course.active ? "" : " · Inactive"}`}
                            className="inline-block max-w-48 truncate text-sm text-primary hover:underline">{course.name}</Link>
                        ))}
                      </div> : <span className="text-muted-foreground">Not linked</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="icon-sm" variant="outline" title="View Syllabus">
                        <Link to={`/syllabuses/${item.syllabusId}`} aria-label={`View ${item.syllabusName}`}><Eye className="size-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No Syllabuses match your filters.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((item, idx) => (
              <article key={item.syllabusId} className="flex min-h-56 flex-col gap-3 rounded-md border bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>#{current * pageSize + idx + 1}</span>
                  <Button asChild size="icon-sm" variant="outline" title="View Syllabus">
                    <Link to={`/syllabuses/${item.syllabusId}`} aria-label={`View ${item.syllabusName}`}><Eye className="size-4" /></Link>
                  </Button>
                </div>
                <dl className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">Code</dt><dd className="break-all font-medium">{item.syllabusCode}</dd>
                  <dt className="text-muted-foreground">Syllabus Name</dt><dd className="font-semibold">{item.syllabusName}</dd>
                  <dt className="text-muted-foreground">Status</dt><dd><Badge variant="outline">{item.syllabusStatus === "PUBLISHED" ? "Published" : "Draft"}</Badge>{!item.syllabusActive && " · Inactive"}</dd>
                  <dt className="text-muted-foreground">Courses</dt><dd>{item.courseCount}</dd>
                </dl>
                <div className="mt-auto border-t pt-3 text-xs">
                  <p className="mb-2 text-muted-foreground">Used by</p>
                  {item.courses.length ? <div className="flex flex-col gap-1">
                    {item.courses.map((course) => <Link key={course.id} className="truncate text-primary hover:underline" to={`/courses/${course.id}`}>{course.name} · {course.status === "PUBLISHED" ? "Published" : "Draft"}{!course.active ? " · Inactive" : ""}</Link>)}
                  </div> : <p className="text-muted-foreground">Not linked to a Course</p>}
                </div>
              </article>
            ))}
            {!rows.length && <div className="col-span-full rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">No Syllabuses match your filters.</div>}
          </div>
        )}
        {canReadCourses && !query.isPending && !query.isError && <SyllabusListFooter count={filtered.length} page={current} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={(size) => { setPage(0); setPageSize(size); }} />}
      </div>
    </MainLayout>
  );
}
