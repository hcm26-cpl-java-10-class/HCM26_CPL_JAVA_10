import axios from "@/api/axios";
import { categoryLabel, metadataLabel, LEVEL_BADGE_CLASS } from "@/integrations/courses/course-presentation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSelector, useStore } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Award, BarChart3, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { RootState } from "@/store/store";
import type { CourseDTO } from "@/types";
import { learningCatalogApi } from "../../learning/learning-catalog.api";
import { enrollCourse, personalEnrollmentKey } from "../../learning/learning-enrollment";
import { courseData, courseError } from "@/integrations/courses/course-data";
import { coursePageKey } from "@/integrations/courses/course-queries";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-neutral-900";
const inputClass = "h-10 min-w-0 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-sm text-slate-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// Course Management and Catalog share the backend adapter; enrollment remains account-scoped.
export default function CourseEnrollmentsPage() {
  const pageRoot=useRef<HTMLDivElement>(null);
  const {pathname}=useLocation();
  useLayoutEffect(()=>{const main=pageRoot.current?.closest("main");if(main)main.scrollTop=0;},[pathname]);
  const { email, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const authStore = useStore<RootState>();
  const { hasPermission, hasAllPermissions } = usePermissions();
  const canRead = hasPermission("COURSE_READ");
  const canLearn = hasAllPermissions(["LEARNER_ACCESS", "LEARNING_SELF_READ"]);
  const canEnroll = canLearn && hasPermission("ENROLLMENT_CREATE");
  const canReport = hasPermission("ADMIN_ACCESS");
  const canReadLessons = hasPermission("LESSON_READ");
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("id,desc");
  const [page, setPage] = useState(0);
  const [reportPage, setReportPage] = useState(0);
  const [reportSearch, setReportSearch] = useState("");
  const [reportSize, setReportSize] = useState(20);
  const [exporting, setExporting] = useState(false);
  const [department,setDepartment]=useState(""); const [startDate,setStartDate]=useState(""); const [endDate,setEndDate]=useState("");
  const [category,setCategory]=useState(""); const [level,setLevel]=useState("");
  const [reportCategory,setReportCategory]=useState(""); const [reportLevel,setReportLevel]=useState(""); const [reportInstructor,setReportInstructor]=useState(""); const [reportStatus,setReportStatus]=useState("");
  const metadata=useQuery({queryKey:["course-data",email,"metadata"],queryFn:()=>courseData.all(),enabled:isAuthenticated&&canRead,retry:false});
  const optionsFor=(field:"category"|"courseLevel"|"instructor"|"publicationStatus")=>Array.from(new Set((metadata.data||[]).flatMap(c=>field==="category"?(c.category||"").split(/[,;|]/).map(s=>s.trim()):[c[field]||""]).filter(Boolean))).sort();

  const overview = useQuery({
    queryKey: coursePageKey(email, { page: 0, size: 1, sort: "id,asc" }),
    queryFn: ({ signal }) => learningCatalogApi.courses(0, 1, "", "id,asc", false, signal),
    enabled: isAuthenticated && canRead,
    retry: false,
  });
  const catalog = useQuery({
    queryKey: coursePageKey(email, { page, size: 12, search, sort, isActive: true, category, courseLevel:level }),
    queryFn: ({ signal }) => courseData.page({page,size:12,search,sort,isActive:true,category,courseLevel:level},signal),
    enabled: isAuthenticated && canRead,
    retry: false,
  });
  const statistics = useQuery<{courseId:number;learnerCount:number;averageProgress:number;completedLearners:number;certificates:number;learners:{userId:number;department?:string;name:string;email:string;progress:number;completed:boolean;active:boolean;enrolledAt:string}[]}[]>(
    { queryKey:["admin-learning",email,"course-enrollments"], queryFn:async()=> (await axios.get("/course-enrollments")).data, enabled:isAuthenticated && canRead && canReport, retry:false });
  const distinctLearners = statistics.data ? new Set(statistics.data.flatMap(row=>row.learners.map(l=>l.userId))).size : undefined;
  const completedTotal = statistics.data?.reduce((sum,row)=>sum+row.completedLearners,0);
  const enrollmentTotal = statistics.data?.reduce((sum,row)=>sum+row.learnerCount,0);
  const mine = useQuery({
    queryKey: personalEnrollmentKey(email),
    queryFn: ({ signal }) => learningCatalogApi.mine(signal),
    enabled: isAuthenticated && canLearn,
    retry: false,
  });
  const filteredStats=(statistics.data||[]).map(r=>{const learners=r.learners.filter(l=>(!department||l.department===department)&&(!startDate||l.enrolledAt?.slice(0,10)>=startDate)&&(!endDate||l.enrolledAt?.slice(0,10)<=endDate));return {...r,learners,learnerCount:learners.length,completedLearners:learners.filter(l=>l.completed).length,averageProgress:learners.length?Math.round(learners.reduce((sum,l)=>sum+l.progress,0)/learners.length):0};});
  const reportRows=(metadata.data||[]).filter(c=>{
    const stats=filteredStats.find(r=>r.courseId===c.id);
    const term=reportSearch.toLowerCase().trim();
    return (!reportCategory||(c.category||"").split(/[,;|]/).map(s=>s.trim()).includes(reportCategory))&&(!reportLevel||c.courseLevel===reportLevel)&&(!reportInstructor||c.instructor===reportInstructor)&&(!reportStatus||c.publicationStatus===reportStatus)&&(!(department||startDate||endDate)||!!stats?.learners.length)&&(!term||[c.name,c.description,c.instructor,categoryLabel(c.category),...(stats?.learners.map(l=>`${l.name} ${l.email}`)||[])].join(" ").toLowerCase().includes(term));
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const report={isPending:metadata.isPending||statistics.isPending,isError:metadata.isError||statistics.isError,refetch:()=>Promise.all([metadata.refetch(),statistics.refetch()]),data:{content:reportRows.slice(reportPage*reportSize,(reportPage+1)*reportSize),totalElements:reportRows.length,totalPages:Math.ceil(reportRows.length/reportSize)}};
  useEffect(() => { setPage(0); setReportPage(0); }, [email]);

  const enrollment = useMutation({
    mutationFn: (courseId: number) => enrollCourse(client, email, courseId, () => {
      const auth = authStore.getState().auth;
      return auth.isAuthenticated && auth.email === email &&
        ["LEARNER_ACCESS", "LEARNING_SELF_READ", "ENROLLMENT_CREATE"].every(p => auth.permissions.includes(p));
    }),
    onSuccess: (result, courseId) => {
      const auth = authStore.getState().auth;
      if (!result || !auth.isAuthenticated || auth.email !== email) return;
      const options = { id: `enrollment-${email}-${courseId}` };
      if (result.created) toast.success("You are enrolled in this course.", options);
      else toast.info("You are already enrolled in this course.", options);
    },
    onError: () => {
      if (authStore.getState().auth.email === email && authStore.getState().auth.isAuthenticated) {
        toast.error("Could not enroll in this course. Check your connection and learning permissions, then try again.");
      }
    },
  });

  const exportReport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const courses = reportRows;
      const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows = [["Course", "Instructor", "Active", "Category / Level", "Publication status", "Average progress", "Learners"],
        ...courses.map(c => [c.name, c.instructor, c.isActive, `${categoryLabel(c.category)} / ${c.courseLevel||""}`, c.publicationStatus, filteredStats.find(r=>r.courseId===c.id)?.averageProgress,filteredStats.find(r=>r.courseId===c.id)?.learnerCount])];
      const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = "course-enrollments.csv"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(courseError(error)); }
    finally { setExporting(false); }
  };

  return <MainLayout pathName={{ "course-enrollments": "Enrollments", enrollments: "Enrollments", courses: "Courses" }}>
    <div ref={pageRoot} className="w-full shrink-0 min-w-0 space-y-6 text-slate-900 dark:text-zinc-100">
      <section aria-labelledby="enrollment-overview" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-blue-600 dark:text-blue-500">COURSE OVERVIEW</p>
            <h1 id="enrollment-overview" className="text-3xl font-bold tracking-tight">Enrollments</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canLearn && <Button asChild variant="outline" size="sm"><Link to="/my-learning">My Learning</Link></Button>}
            {canReport && <>
              <select aria-label="Department" value={department} onChange={e=>{setDepartment(e.target.value);setReportPage(0);}} className={inputClass}><option value="">Department</option>{Array.from(new Set(statistics.data?.flatMap(r=>r.learners.map(l=>l.department).filter((v):v is string=>!!v))||[])).sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
              <Button variant="outline" size="sm" disabled={!canRead || exporting} onClick={() => void exportReport()}><Download className="size-4" />{exporting ? "Exporting..." : "Export CSV"}</Button>
            </>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Courses" value={overview.data?.totalElements} icon={BookOpen} />
          {canReport ? <Metric label="Learners" value={distinctLearners} icon={Users} /> : canLearn && <Metric label="My enrollments" value={mine.data?.length} icon={Users} />}
          <Metric label="Average progress" value={statistics.data ? (enrollmentTotal ? Math.round(statistics.data.reduce((sum,r)=>sum+r.averageProgress*r.learnerCount,0)/enrollmentTotal) : 0) : undefined} percent icon={BarChart3} />
          <Metric label="Completed learners" value={completedTotal} icon={CheckCircle2} />
          <Metric label="Active learners" value={statistics.data ? new Set(statistics.data.flatMap(r=>r.learners.filter(l=>l.active).map(l=>l.userId))).size : undefined} icon={Activity} />
          <Metric label="Completion rate" value={statistics.data ? (enrollmentTotal ? Math.round((completedTotal || 0)*100/enrollmentTotal) : 0) : undefined} percent icon={BarChart3} />
          <Metric label="Certificates issued" value={statistics.data?.reduce((sum,r)=>sum+r.certificates,0)} icon={Award} />
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="catalog-heading">
        <p className="mb-2 text-xs font-semibold text-blue-600 dark:text-blue-500">COURSE CATALOG</p>
        <h2 id="catalog-heading" className="mb-4 text-xl font-semibold tracking-tight">Courses available</h2>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_170px_170px]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input aria-label="Search courses" placeholder="Search by name, description or instructor" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }} className={`${inputClass} w-full pl-9`} />
          </div>
          <select aria-label="Category filter" value={category} onChange={e=>{setCategory(e.target.value);setPage(0);}} className={inputClass}><option value="">All categories</option>{optionsFor("category").map(v=><option key={v} value={v}>{categoryLabel(v)}</option>)}</select>
          <select aria-label="Level filter" value={level} onChange={e=>{setLevel(e.target.value);setPage(0);}} className={inputClass}><option value="">All levels</option>{optionsFor("courseLevel").map(v=><option key={v} value={v}>{metadataLabel(v)}</option>)}</select>
          <select aria-label="Sort courses" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }} className={inputClass}>
            <option value="id,desc">Newest</option><option value="id,asc">Oldest</option>
            <option value="name,asc">Title A–Z</option><option value="name,desc">Title Z–A</option>
          </select>
        </div>
        {!canRead ? <p role="alert">You do not have permission to view the Course Catalog.</p>
          : catalog.isPending ? <p role="status">Loading courses...</p>
          : catalog.isError ? <LoadError message="Courses could not be loaded." retry={() => void catalog.refetch()} />
          : <>
            <p className="mb-6 text-sm text-muted-foreground">{catalog.data.totalElements} courses found</p>
            {canLearn && (mine.isError ? <LoadError message="Your enrollments could not be loaded. Reload them before enrolling." retry={() => void mine.refetch()} />
              : mine.isPending ? <p role="status" className="mb-4">Loading your enrollments...</p> : null)}
            {catalog.data.content.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              {search.trim() ? "No courses match your search." : "No active courses are available."}
            </p> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {catalog.data.content.map(course => {
                const id = course.id;
                const enrolled = mine.isSuccess && mine.data.some(e => e.courseId === id);
                const isPending = enrollment.isPending && enrollment.variables === id;
                return <article key={id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-neutral-900">
                  <div className="relative">
                    <CourseThumbnail src={course.thumbnailUrl} />
                    <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs text-slate-600" title="Category from saved Course metadata.">{categoryLabel(course.categoryName || course.category)}</span>
                    {enrolled && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                      <CheckCircle2 aria-hidden="true" className="size-3.5" />Enrolled
                    </span>}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="min-h-12 break-words text-lg font-semibold leading-6">{course.name}</h3>
                    <p className="mb-3 text-sm text-muted-foreground">{course.instructor || "Instructor not available"}</p>
                    <p className="mb-6 min-h-14 flex-1 break-words text-sm leading-6 text-muted-foreground">{course.description || "No description available."}</p>
                    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span className={`rounded-full px-2.5 py-1 ${LEVEL_BADGE_CLASS[course.courseLevel?.toUpperCase() as keyof typeof LEVEL_BADGE_CLASS] || "bg-slate-100 dark:bg-neutral-800"}`}>{metadataLabel(course.courseLevel)}</span>
                      <LessonSummary courseId={id} enabled={canReadLessons} />
                    </div>
                    {enrolled ? <Button asChild className="h-10 w-full rounded-lg"><Link to="/my-learning"><BookOpen className="size-4" />Continue learning</Link></Button>
                      : canLearn ? <Button className="h-10 w-full rounded-lg" disabled={!canEnroll || !mine.isSuccess || enrollment.isPending || !id}
                        aria-busy={isPending} onClick={() => { if (id && !enrollment.isPending) enrollment.mutate(id); }}>
                        {isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}{isPending ? "Enrolling..." : "Enroll"}
                      </Button> : <p className="text-sm text-muted-foreground">Learning access is required to enroll.</p>}
                    {canLearn && !canEnroll && !enrolled && <p className="mt-2 text-sm text-muted-foreground">You do not have permission to enroll.</p>}
                  </div>
                </article>;
              })}
            </div>}
            <Pagination page={page} pages={catalog.data.totalPages} onChange={setPage} label="Catalog" />
          </>}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Active courses are listed here. Missing metadata is shown as Not available.</p>
      </section>

      {canReport && <section aria-labelledby="progress-heading" className="space-y-6">
        <h2 id="progress-heading" className="sr-only">Learning Progress</h2>
        <div className={`${sectionClass} grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
          <div className="relative sm:col-span-2">
            <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input aria-label="Search Learning Progress courses" placeholder="Search courses, instructors, categories, or learners..." value={reportSearch}
              onChange={e => { setReportSearch(e.target.value); setReportPage(0); }} className={`${inputClass} w-full pl-9`} />
          </div>
          <select aria-label="Instructor report filter" value={reportInstructor} onChange={e=>{setReportInstructor(e.target.value);setReportPage(0);}} className={inputClass}><option value="">All instructors</option>{optionsFor("instructor").map(v=><option key={v} value={v}>{v}</option>)}</select>
          <select aria-label="Category report filter" value={reportCategory} onChange={e=>{setReportCategory(e.target.value);setReportPage(0);}} className={inputClass}><option value="">All categories</option>{optionsFor("category").map(v=><option key={v} value={v}>{categoryLabel(v)}</option>)}</select>
          <select aria-label="Level report filter" value={reportLevel} onChange={e=>{setReportLevel(e.target.value);setReportPage(0);}} className={inputClass}><option value="">All levels</option>{optionsFor("courseLevel").map(v=><option key={v} value={v}>{metadataLabel(v)}</option>)}</select>
          <select aria-label="Publication status report filter" value={reportStatus} onChange={e=>{setReportStatus(e.target.value);setReportPage(0);}} className={inputClass}><option value="">All statuses</option>{optionsFor("publicationStatus").map(v=><option key={v} value={v}>{metadataLabel(v)}</option>)}</select>
          <input type="date" aria-label="Enrollment start date" value={startDate} onChange={e=>{setStartDate(e.target.value);setReportPage(0);}} className={`${inputClass} w-full disabled:text-muted-foreground`} />
          <input type="date" aria-label="Enrollment end date" value={endDate} min={startDate} onChange={e=>{setEndDate(e.target.value);setReportPage(0);}} className={`${inputClass} w-full disabled:text-muted-foreground`} />
        </div>
        {!canRead ? <p role="alert">You do not have permission to view courses.</p>
          : report.isPending ? <p role="status">Loading Learning Progress courses...</p>
          : report.isError ? <LoadError message="Learning Progress courses could not be loaded." retry={() => void report.refetch()} />
          : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-zinc-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] table-fixed text-left text-xs">
                <colgroup><col className="w-[27%]" /><col className="w-[11%]" /><col className="w-[20%]" /><col className="w-[11%]" /><col className="w-[17%]" /><col className="w-[14%]" /></colgroup>
                <thead className="bg-slate-100 text-muted-foreground dark:bg-neutral-800"><tr>{["Course", "Instructor", "Category / Level", "Status", "Average progress", "Learners"].map(label => <th key={label} scope="col" className="px-4 py-3.5 font-semibold">{label}</th>)}</tr></thead>
                <tbody>{report.data.content.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No courses found.</td></tr>
                  : report.data.content.map(course => <tr key={course.id} className="border-t border-slate-200 dark:border-zinc-800">
                    <td className="px-4 py-4 font-semibold">{course.name}</td><td className="px-4 py-4">{course.instructor || "Not available"}</td>
                    <td className="px-4 py-4 text-muted-foreground">{categoryLabel(course.categoryName || course.category)}<span className="mt-1 block text-xs">{course.courseLevel || "Not available"}</span></td>
                    <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-muted-foreground dark:bg-neutral-800" title="Saved publication status; blank values are unavailable.">{course.publicationStatus?.toUpperCase() || "Not available"}</span></td>
                    <td className="px-4 py-4 text-muted-foreground"><div className="flex justify-between gap-2"><span>{filteredStats.find(r=>r.courseId===course.id)?.averageProgress ?? "—"}%</span><span>{filteredStats.find(r=>r.courseId===course.id)?.completedLearners ?? "—"} completed</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700"><div className="h-full bg-blue-600" style={{width:`${filteredStats.find(r=>r.courseId===course.id)?.averageProgress ?? 0}%`}} /></div></td>
                    <td className="px-4 py-4 text-muted-foreground">{statistics.data ? (filteredStats.find(r=>r.courseId===course.id)?.learnerCount ? `${filteredStats.find(r=>r.courseId===course.id)?.learnerCount} learners enrolled` : "No learners enrolled") : "Not available"}</td>
                  </tr>)}</tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-4 py-4 text-sm text-muted-foreground dark:border-zinc-800">
              <span>{report.data.totalElements} courses</span>
              <label className="flex items-center gap-2">Rows per page <select aria-label="Rows per page" value={reportSize} onChange={e => { setReportSize(Number(e.target.value)); setReportPage(0); }} className={inputClass}>
                <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
              </select></label>
              <Pagination page={reportPage} pages={report.data.totalPages} onChange={setReportPage} label="Learning Progress" />
            </div>
          </div>}
        <p className="text-xs leading-5 text-muted-foreground">Enrollment counts and progress are calculated from backend records. Progress reflects recorded lesson completions.</p>
      </section>}
    </div>
  </MainLayout>;
}

function Metric({ label, value, percent, icon: Icon }: { label: string; value?: number; percent?: boolean; icon: typeof BookOpen }) {
  return <div className="flex min-h-[112px] flex-col justify-between rounded-xl border bg-card p-4">
    <div className="flex items-start justify-between gap-2 text-muted-foreground"><span className="text-xs sm:text-sm">{label}</span><Icon aria-hidden="true" className="size-4 shrink-0" /></div>
    <span className={`mt-3 font-semibold tabular-nums ${value === undefined ? "text-base sm:text-xl" : "text-3xl"}`}>{value === undefined ? "Not available" : `${value}${percent ? "%" : ""}`}</span>
  </div>;
}
function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="mb-4 space-y-3 rounded-lg border border-destructive/30 p-4"><p>{message}</p><Button variant="outline" onClick={retry}>Try again</Button></div>;
}
function Pagination({ page, pages, onChange, label }: { page: number; pages: number; onChange: (page: number) => void; label: string }) {
  const last = Math.max(1, pages);
  const numbers = Array.from(new Set([0, page - 1, page, page + 1, last - 1].filter(n => n >= 0 && n < last))).sort((a, b) => a - b);
  return <nav aria-label={`${label} pagination`} className="my-1 flex flex-wrap items-center justify-center gap-1.5 text-sm">
    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft className="size-4" />Prev</Button>
    {numbers.map((number, index) => <span key={number} className="inline-flex items-center gap-1.5">
      {index > 0 && number > numbers[index - 1] + 1 && <span aria-hidden="true" className="px-1">…</span>}
      <Button size="sm" variant={page === number ? "default" : "outline"} aria-label={`${label} page ${number + 1}`} aria-current={page === number ? "page" : undefined} onClick={() => onChange(number)} className="w-9 px-0">{number + 1}</Button>
    </span>)}
    <span className="sr-only">Page {page + 1} of {last}</span>
    <Button size="sm" variant="outline" disabled={page + 1 >= last} onClick={() => onChange(page + 1)}>Next<ChevronRight className="size-4" /></Button>
  </nav>;
}
function LessonSummary({ courseId, enabled }: { courseId: CourseDTO["id"]; enabled: boolean }) {
  const { email } = useSelector((state: RootState) => state.auth);
  const summary = useQuery({
    queryKey: ["learning-lesson-summary", email, courseId],
    queryFn: ({ signal }) => learningCatalogApi.lessons(courseId!, signal),
    enabled: enabled && !!courseId,
    retry: false,
  });
  return <span className="contents">
    {summary.isSuccess ? <><span className="inline-flex items-center gap-1.5"><BookOpen aria-hidden="true" className="size-3.5" />{summary.data.count} lessons</span>
      <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-3.5" />{summary.data.minutes === null ? "Duration not available" : `${Math.round(summary.data.minutes)}m`}</span></>
      : <span>{enabled && summary.isPending ? "Loading lessons..." : "Lesson count and duration not available"}</span>}
  </span>;
}
