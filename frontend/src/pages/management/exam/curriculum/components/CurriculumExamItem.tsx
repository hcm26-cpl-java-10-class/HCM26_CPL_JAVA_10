import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { EXAM_CATEGORY_LABEL, type CourseExam } from "@/types";
import {
  Award,
  Clock,
  ExternalLink,
  FileCode2,
  HelpCircle,
  ListChecks,
  Trophy,
  Unlink,
} from "lucide-react";
import { useState } from "react";

interface CurriculumExamItemProps {
  exam: CourseExam;
  onUnlink: (exam: CourseExam) => void;
  compact?: boolean;
}

const CATEGORY_CONFIG: Record<
  string,
  {
    icon: typeof Award;
    cardBorder: string;
    cardBg: string;
    iconBg: string;
    badgeStyle: string;
  }
> = {
  QUIZ: {
    icon: HelpCircle,
    cardBorder: "border-purple-500/30 hover:border-purple-500/60",
    cardBg: "bg-purple-500/[0.04]",
    iconBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    badgeStyle: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
  },
  ASSIGNMENT: {
    icon: FileCode2,
    cardBorder: "border-emerald-500/30 hover:border-emerald-500/60",
    cardBg: "bg-emerald-500/[0.04]",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    badgeStyle: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  MIDTERM: {
    icon: Award,
    cardBorder: "border-sky-500/30 hover:border-sky-500/60",
    cardBg: "bg-sky-500/[0.04]",
    iconBg: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    badgeStyle: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
  },
  FINAL: {
    icon: Trophy,
    cardBorder: "border-amber-500/30 hover:border-amber-500/60",
    cardBg: "bg-amber-500/[0.04]",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    badgeStyle: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  },
};

export function CurriculumExamItem({ exam, onUnlink, compact = false }: CurriculumExamItemProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cfg = CATEGORY_CONFIG[exam.category] ?? CATEGORY_CONFIG.ASSIGNMENT;
  const CategoryIcon = cfg.icon;

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border transition-all ${cfg.cardBorder} ${cfg.cardBg} ${
          compact ? "p-2.5 text-xs" : "p-3.5 text-sm"
        } shadow-xs`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}>
            <CategoryIcon className="size-4" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/exams/${exam.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-sm flex items-center gap-1.5"
                title="Open assessment in new tab"
              >
                <span>{exam.title}</span>
                <ExternalLink className="size-3 text-muted-foreground shrink-0" />
              </a>

              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${cfg.badgeStyle}`}>
                {EXAM_CATEGORY_LABEL[exam.category] || exam.category}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1 text-foreground/80">
                <Clock className="size-3 text-sky-500" />
                <span>{exam.durationMinutes} mins</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-foreground/80">
                <ListChecks className="size-3 text-indigo-500" />
                <span>{exam.questionCount ?? 0} questions</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-foreground/80">
                <Trophy className="size-3 text-amber-500" />
                <span>Max: {exam.maxScore ?? 10} pts</span>
                <span>Weight: {exam.courseWeight != null ? `${exam.courseWeight}%` : "Not set"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all rounded-lg"
            onClick={() => setConfirmOpen(true)}
            title="Unlink assessment from this section/lesson"
          >
            <Unlink className="size-3.5" />
            <span className="hidden sm:inline">Unlink</span>
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Unlink Assessment"
        description={`Are you sure you want to detach assessment "${exam.title}" from this curriculum item? The assessment and its submissions will remain safe in Assessment Management.`}
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        onConfirm={() => {
          onUnlink(exam);
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
