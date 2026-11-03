import { examApi } from "@/api";
import HeaderRight from "@/components/layout/HeaderRight";
import { EmbeddedLayoutContext } from "@/components/layout/embedded-layout";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ClipboardCheck, Mail, Pencil, BarChart3 } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ExamEditPanel } from "./ExamEditPanel";
import { ExamQuestionsPanel } from "./ExamQuestionsPanel";
import ResultStatisticsPage from "./ResultStatisticsPage";
import EssayAttemptListPage from "./grading/EssayAttemptListPage";
import InvitationsPage from "./invitation";

type TabKey = "edit" | "questions" | "grading" | "invitations" | "statistics";

/** Each tab has its own URL, so a tab can be bookmarked and the browser Back button works. */
const TABS: { key: TabKey; label: string; segment: string; icon: typeof Pencil }[] = [
  { key: "edit", label: "Edit", segment: "", icon: Pencil },
  { key: "questions", label: "Questions", segment: "questions", icon: BookOpen },
  { key: "grading", label: "Grading", segment: "grading", icon: ClipboardCheck },
  { key: "invitations", label: "Invitations", segment: "invitations", icon: Mail },
  { key: "statistics", label: "Statistics", segment: "result-statistics", icon: BarChart3 },
];

function tabFromPath(pathname: string, examId: string): TabKey {
  const rest = pathname.split(`/exams/${examId}`)[1] ?? "";
  const segment = rest.split("/").filter(Boolean)[0] ?? "";
  return TABS.find((tab) => tab.segment === segment)?.key ?? "edit";
}

export default function ExamDetailPage() {
  const { examId = "" } = useParams<{ examId: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const id = Number(examId);
  const active = tabFromPath(pathname, examId);

  // This page fills the window and scrolls inside, so the browser page itself must not scroll
  // (otherwise two scrollbars appear).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous[0];
      body.style.overflow = previous[1];
    };
  }, []);

  const examQuery = useQuery({
    queryKey: ["exam-detail", id],
    queryFn: () => examApi.getById(examId),
    enabled: Number.isFinite(id) && id > 0,
  });
  const title = examQuery.data?.title;
  const counts: Partial<Record<TabKey, { value: number; warn?: boolean }>> = {
    questions: { value: examQuery.data?.questionIds?.length ?? examQuery.data?.questions?.length ?? 0 },
    ...((examQuery.data?.pendingGradingCount ?? 0) > 0
      ? { grading: { value: examQuery.data?.pendingGradingCount ?? 0, warn: true } }
      : {}),
  };

  return (
    // Full-screen page: no sidebar, so the tabs and their content can use the whole window.
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/exams")}>
            <ArrowLeft className="mr-1 size-4" />
            Exam Management
          </Button>
          <span className="text-muted-foreground">/</span>
          <h1 className="truncate text-base font-semibold">{title ?? "Loading..."}</h1>
        </div>
        <HeaderRight />
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1 sm:grid-cols-5" role="tablist" aria-label="Exam sections">
          {TABS.map(({ key, label, segment, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              onClick={() => navigate(`/exams/${examId}${segment ? `/${segment}` : ""}`)}
              className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
              {counts[key] && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                    counts[key]?.warn
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                  title={counts[key]?.warn ? "Submissions waiting to be graded" : undefined}
                >
                  {counts[key]?.value}
                </span>
              )}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {active === "edit" && <ExamEditPanel examId={id} />}
          {active === "questions" && <ExamQuestionsPanel examId={id} />}
          {/* These pages draw their own layout; inside a tab they must not draw the sidebar again. */}
          <EmbeddedLayoutContext.Provider value>
            {active === "grading" && <EssayAttemptListPage />}
            {active === "invitations" && <InvitationsPage />}
            {active === "statistics" && <ResultStatisticsPage />}
          </EmbeddedLayoutContext.Provider>
        </div>
      </main>
    </div>
  );
}
