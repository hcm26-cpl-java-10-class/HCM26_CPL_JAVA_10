import { invalidateAssessmentViews } from "@/utils/assessment-queries";
import { ApiErrorState } from "@/components/exam/ApiErrorState";
import { assessmentCourseReturnPath } from "@/utils/assessment-navigation";
import { examApi, examTemplateApi } from "@/api";
import HeaderRight from "@/components/layout/HeaderRight";
import { EmbeddedLayoutContext } from "@/components/layout/embedded-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ExamDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Archive, BookmarkPlus, BookOpen, CheckCircle2, ClipboardCheck, Copy, Lock, Mail, Pencil, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getErrorMessage } from "./examConfig";
import { ExamEditPanel } from "./ExamEditPanel";
import { ExamQuestionsPanel, type ExamQuestionsPreview } from "./ExamQuestionsPanel";
import ResultStatisticsPage from "./ResultStatisticsPage";
import InvitationsPage from "./invitation";

type TabKey = "questions" | "grading" | "invitations" | "statistics" | "edit";

/** Each tab has its own URL, so a tab can be bookmarked and the browser Back button works. */
const TABS: { key: TabKey; label: string; segment: string; icon: typeof BookOpen }[] = [
  { key: "questions", label: "Questions", segment: "questions", icon: BookOpen },
  { key: "grading", label: "Grading", segment: "grading", icon: ClipboardCheck },
  { key: "invitations", label: "Invitations", segment: "invitations", icon: Mail },
  { key: "statistics", label: "Statistics", segment: "result-statistics", icon: BarChart3 },
  { key: "edit", label: "Edit", segment: "edit", icon: Pencil },
];

function tabFromPath(pathname: string, examId: string): TabKey {
  const rest = pathname.split(`/exams/${examId}`)[1] ?? "";
  const segment = rest.split("/").filter(Boolean)[0] ?? "";
  if (!segment) return "questions";
  return TABS.find((tab) => tab.segment === segment)?.key ?? "questions";
}

type PreviewDetail = ExamQuestionsPreview & { onBack: () => void };
export default function ExamDetailPage({ preview }: { preview?: PreviewDetail } = {}) {
  const { examId = "" } = useParams<{ examId: string }>();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const id = Number(examId);
  const active = preview ? "questions" : tabFromPath(pathname, examId);

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

  const queryClient = useQueryClient();
  const examQuery = useQuery({
    queryKey: preview ? ["exam-preview-disabled", "page"] : ["exam-detail", id],
    queryFn: () => examApi.getById(examId),
    enabled: !preview && Number.isFinite(id) && id > 0,
  });
  const returnTo = assessmentCourseReturnPath(new URLSearchParams(search).get("returnTo"), examQuery.data?.courseId);
  const returnQuery = returnTo === "/exams" ? "" : "?returnTo=" + encodeURIComponent(returnTo);
  const [editDirty, setEditDirty] = useState(false);
  const leave = (path: string) => {
    if (!editDirty || window.confirm("Discard unsaved assessment changes?")) navigate(path);
  };
  const examStatus = examQuery.data?.status ?? "PUBLISHED";

  const lifecycleMutation = useMutation({
    mutationFn: async (action: "publish" | "close" | "archive" | "duplicate") => {
      if (action === "publish") return { action, exam: await examApi.publish(id) };
      if (action === "close") return { action, exam: await examApi.close(id) };
      if (action === "archive") return { action, exam: await examApi.archive(id) };
      return { action, exam: await examApi.duplicate(id) };
    },
    onSuccess: ({ action, exam }) => {
      void queryClient.invalidateQueries({ queryKey: ["exam-detail", id] });
      void invalidateAssessmentViews(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      if (action === "duplicate" && exam?.id) {
        toast.success("Exam duplicated", { duration: 3000 });
        navigate(`/exams/${exam.id}/questions${returnQuery}`);
      } else {
        toast.success(`Assessment ${action}d successfully`, { duration: 3000 });
      }
    },
    onError: (err) => toast.error(getErrorMessage(err, "Action failed")),
  });

  const [examToSaveAsTemplate, setExamToSaveAsTemplate] = useState<ExamDTO | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  const saveExamAsTemplateMutation = useMutation({
    mutationFn: () => {
      if (!examToSaveAsTemplate?.id) {
        throw new Error("Select an exam before saving it as a template.");
      }
      const name = templateName.trim();
      if (!name) {
        throw new Error("Template name is required.");
      }
      return examTemplateApi.saveFromExam(examToSaveAsTemplate.id, {
        name,
        description: templateDescription.trim() || undefined,
      });
    },
    onSuccess: () => {
      setExamToSaveAsTemplate(null);
      setTemplateName("");
      setTemplateDescription("");
      toast.success("Exam saved as template successfully");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Failed to save exam as template")),
  });

  const openSaveAsTemplate = (target: ExamDTO) => {
    setExamToSaveAsTemplate(target);
    setTemplateName(`${target.title} - Template`);
    setTemplateDescription("");
  };

  const title = preview?.exam.title ?? examQuery.data?.title;
  const counts: Partial<Record<TabKey, { value: number; warn?: boolean }>> = {
    questions: { value: preview?.selected.length ?? examQuery.data?.questionIds?.length ?? examQuery.data?.questions?.length ?? 0 },
    ...((examQuery.data?.invitationCount ?? 0) > 0
        ? { invitations: { value: examQuery.data?.invitationCount ?? 0 } }
        : {}),
    ...((examQuery.data?.pendingGradingCount ?? 0) > 0
        ? { grading: { value: examQuery.data?.pendingGradingCount ?? 0, warn: true } }
        : {}),
  };

  return (
      // Full-screen page: no sidebar, so the tabs and their content can use the whole window.
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-3 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="min-w-0 truncate text-base font-semibold" title={title ?? undefined}>{title ?? "Loading..."}</h1>
            {preview && <span className="hidden max-w-[40ch] truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground md:inline">{preview.exam.courseName}</span>}
            {!preview && examQuery.data && (examQuery.data.courseName ? (
                <span
                    className="hidden max-w-[40ch] truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground md:inline"
                    title={[examQuery.data.courseName, examQuery.data.sectionTitle, examQuery.data.lessonTitle].filter(Boolean).join(" › ")}
                >
              {[examQuery.data.courseName, examQuery.data.sectionTitle, examQuery.data.lessonTitle].filter(Boolean).join(" › ")}
            </span>
            ) : (
                <button
                    type="button"
                    onClick={() => navigate(`/exams/${examId}/edit${returnQuery}`)}
                    className="hidden shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100 md:inline dark:bg-amber-950/50 dark:text-amber-300"
                    title="This exam is not linked to any course. Open the Edit tab to link it."
                >
                  Not linked to a course
                </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {preview && <><span className="text-xs text-muted-foreground">PREVIEW</span><Button size="sm" variant="outline" onClick={preview.onBack}>Back to Course Preview</Button></>}
            {!preview && examQuery.data && (
                <div className="hidden items-center gap-1.5 sm:flex">
              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                {examStatus}
              </span>
                  {(examStatus === "DRAFT" || examStatus === "CLOSED") && (
                      <Button
                          size="sm"
                          variant="outline"
                          disabled={lifecycleMutation.isPending}
                          onClick={() => lifecycleMutation.mutate("publish")}
                      >
                        <CheckCircle2 className="mr-1 size-3.5" />
                        Publish
                      </Button>
                  )}
                  {examStatus === "PUBLISHED" && (
                      <Button
                          size="sm"
                          variant="outline"
                          disabled={lifecycleMutation.isPending}
                          onClick={() => lifecycleMutation.mutate("close")}
                      >
                        <Lock className="mr-1 size-3.5" />
                        Close
                      </Button>
                  )}
                  {examStatus !== "ARCHIVED" && (
                      <Button
                          size="sm"
                          variant="outline"
                          disabled={lifecycleMutation.isPending}
                          onClick={() => lifecycleMutation.mutate("archive")}
                      >
                        <Archive className="mr-1 size-3.5" />
                        Archive
                      </Button>
                  )}
                  <Button
                      size="sm"
                      variant="outline"
                      disabled={lifecycleMutation.isPending}
                      onClick={() => lifecycleMutation.mutate("duplicate")}
                  >
                    <Copy className="mr-1 size-3.5" />
                    {lifecycleMutation.isPending && lifecycleMutation.variables === "duplicate" ? "Duplicating..." : "Duplicate"}
                  </Button>
                  <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSaveAsTemplate(examQuery.data!)}
                  >
                    <BookmarkPlus className="mr-1 size-3.5" />
                    Save as Template
                  </Button>
                </div>
            )}
            <HeaderRight />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-6">
          <div><Button variant="outline" size="sm" onClick={() => leave(returnTo)}>
            <ArrowLeft className="size-4" />
            {returnTo === "/exams" ? "Back to assessments" : returnTo.startsWith("/exams/curriculum") ? "Back to assessment links" : "Back to course detail"}
          </Button></div>
          {examQuery.isError ? (
              <ApiErrorState error={examQuery.error} onRetry={() => void examQuery.refetch()} onBack={() => navigate(returnTo)} />
          ) : (<>
            <div className={`grid gap-1 rounded-lg border bg-muted/40 p-1 ${preview ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-5"}`} role="tablist" aria-label="Assessment sections">
              {TABS.filter(tab => !preview || tab.key === "questions").map(({ key, label, segment, icon: Icon }) => (
                  <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active === key}
                      onClick={() => leave(`/exams/${examId}/${segment}${returnQuery}`)}
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
              {active === "questions" && (preview ? <ExamQuestionsPanel preview={preview} /> : <ExamQuestionsPanel examId={id} />)}
              <EmbeddedLayoutContext.Provider value>
                {active === "grading" && <ResultStatisticsPage mode="attempts" />}
                {active === "invitations" && <InvitationsPage />}
                {active === "statistics" && <ResultStatisticsPage />}
              </EmbeddedLayoutContext.Provider>
              {active === "edit" && <ExamEditPanel examId={id} onDirtyChange={setEditDirty} />}
            </div>
          </>)}
        </main>

        <Dialog
          open={Boolean(examToSaveAsTemplate)}
          onOpenChange={(open) => {
            if (!open && !saveExamAsTemplateMutation.isPending) {
              setExamToSaveAsTemplate(null);
              setTemplateName("");
              setTemplateDescription("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!templateName.trim()) {
                  toast.error("Template name is required.");
                  return;
                }
                saveExamAsTemplateMutation.mutate();
              }}
            >
              <DialogHeader>
                <DialogTitle>Save Exam as Template</DialogTitle>
                <DialogDescription>
                  Save the configuration, questions, and answer options from
                  <strong className="text-foreground"> {examToSaveAsTemplate?.title}</strong>
                  {" "}as a reusable template. The original exam will not be changed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-5">
                <label className="grid gap-2 text-sm font-medium">
                  Template Name
                  <Input
                    required
                    maxLength={200}
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Enter template name"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Description (optional)
                  <textarea
                    className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    maxLength={1000}
                    value={templateDescription}
                    onChange={(event) => setTemplateDescription(event.target.value)}
                    placeholder="Describe when this template should be reused"
                  />
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saveExamAsTemplateMutation.isPending}
                  onClick={() => {
                    setExamToSaveAsTemplate(null);
                    setTemplateName("");
                    setTemplateDescription("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveExamAsTemplateMutation.isPending || !templateName.trim()}
                >
                  {saveExamAsTemplateMutation.isPending ? "Saving..." : "Save Template"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
  );
}