import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EXAM_CATEGORY_LABEL, EXAM_CATEGORY_SHOW_ANSWERS_DEFAULT, type ExamCategory, type ExamDTO, type ExamType, type ResultVisibility } from "@/types";
import type { Dispatch, SetStateAction } from "react";
import { ExamLinkFields } from "./ExamLinkFields";
import {
  EXAM_CATEGORY_OPTIONS,
  EXAM_TYPE_LABEL,
  getRequiredFieldErrors,
  RESULT_VISIBILITY_LABEL,
  type ExamConfigForm,
} from "./examConfig";

interface Props {
  title: string;
  setTitle: (value: string) => void;
  duration: string;
  setDuration: (value: string) => void;
  cfg: ExamConfigForm;
  setCfg: Dispatch<SetStateAction<ExamConfigForm>>;
  /** The exam being edited (null when creating). Kept for callers; no longer used by the form. */
  editingExam?: ExamDTO | null;
  /** Show red errors under required fields (set after a failed save attempt). */
  showErrors?: boolean;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">{children}</h3>
  );
}

/** All fields of the exam form (shared by the Create dialog and the Edit tab). */
export function ExamConfigFields({ title: newTitle, setTitle: setNewTitle, duration: newDuration, setDuration: setNewDuration, cfg, setCfg, editingExam, showErrors = false }: Props) {
  const locked = !!editingExam?.hasAttempts;
  const fieldErrors = showErrors ? getRequiredFieldErrors(cfg) : {};
  const invalidClass = "border-destructive focus:ring-destructive focus-visible:ring-destructive";
  // Timing is set when inviting students, so the exam itself has no start/end time or late-submission rules.

  return (
    <div className="grid min-w-0 max-w-full gap-4 sm:grid-cols-2">
      <SectionTitle>Basic</SectionTitle>
      <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium sm:col-span-2">
        Exam Title
        <Input required maxLength={200} className="w-full min-w-0 max-w-full" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
      </label>

      <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
        Duration (minutes)
        <Input required type="number" min={1} className="w-full min-w-0 max-w-full" value={newDuration} onChange={(event) => setNewDuration(event.target.value)} />
      </label>

      <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
        Exam Password / Access Code (leave blank if not required)
        <Input
          type="text"
          placeholder="e.g. EXAM2026"
          maxLength={100}
          className="w-full min-w-0 max-w-full"
          value={cfg.accessCode}
          onChange={(event) => setCfg((c) => ({ ...c, accessCode: event.target.value }))}
        />
      </label>

      <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
        Question Format
        <Select value={cfg.examType} onValueChange={(value) => { if (value) setCfg((c) => ({ ...c, examType: value as ExamType })); }}>
          <SelectTrigger aria-label="Exam type" aria-invalid={Boolean(fieldErrors.examType)} className={cn("w-full min-w-0 max-w-full", fieldErrors.examType && invalidClass)}>
            <SelectValue placeholder="Select question format" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map((key) => (
              <SelectItem key={key} value={key}>{EXAM_TYPE_LABEL[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.examType ? (
          <span className="text-xs font-normal text-destructive">{fieldErrors.examType}</span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">
            Only matching question types can be selected.
          </span>
        )}
      </label>

      <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
        Exam Category
        <Select value={cfg.category} onValueChange={(value) => {
          if (!value) return;
          const category = value as ExamCategory;
          setCfg((current) => ({
            ...current,
            category,
            showAnswersAfterExam: EXAM_CATEGORY_SHOW_ANSWERS_DEFAULT[category],
          }));
        }}>
          <SelectTrigger aria-label="Exam category" aria-invalid={Boolean(fieldErrors.category)} className={cn("w-full min-w-0 max-w-full", fieldErrors.category && invalidClass)}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {EXAM_CATEGORY_OPTIONS.map((category) => (
              <SelectItem key={category} value={category}>{EXAM_CATEGORY_LABEL[category]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.category ? (
          <span className="text-xs font-normal text-destructive">{fieldErrors.category}</span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">
            The category sets default for answer review.
          </span>
        )}
      </label>

      <ExamLinkFields cfg={cfg} setCfg={setCfg} />

      <div className="grid min-w-0 max-w-full gap-4 border-t pt-4 sm:col-span-2 sm:grid-cols-2">
        <SectionTitle>Attempts</SectionTitle>

        <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
          Maximum Attempts
          <Input
            type="number"
            min={1}
            step={1}
            placeholder="1"
            aria-invalid={Boolean(fieldErrors.maxAttempts)}
            className={cn("w-full min-w-0 max-w-full", fieldErrors.maxAttempts && invalidClass)}
            value={cfg.maxAttempts}
            onChange={(event) => setCfg((c) => ({ ...c, maxAttempts: event.target.value }))}
          />
          {fieldErrors.maxAttempts ? (
            <span className="text-xs font-normal text-destructive">{fieldErrors.maxAttempts}</span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">
              Number of times a student can take this exam. Leave blank = 1.
            </span>
          )}
        </label>

        <SectionTitle>Scoring</SectionTitle>
        <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
          Max Score
          <Input type="number" min={0.01} step="0.01" placeholder="10" className="w-full min-w-0 max-w-full" value={cfg.maxScore} onChange={(event) => setCfg((c) => ({ ...c, maxScore: event.target.value }))} />
          <span className="text-xs font-normal text-muted-foreground">
            Leave blank = 10. Question score = max score × question weight ÷ total weight.
          </span>
        </label>

        <label className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
          Passing Score
          <Input type="number" min={0} step="0.01" placeholder="5" className="w-full min-w-0 max-w-full" value={cfg.passScore} onChange={(event) => setCfg((c) => ({ ...c, passScore: event.target.value }))} />
          <span className="text-xs font-normal text-muted-foreground">
            Minimum score required to pass. Leave blank = 5.
          </span>
        </label>

        <SectionTitle>Results</SectionTitle>
        <div className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
          Result Visibility
          <Select value={cfg.resultVisibility} onValueChange={(value) => setCfg((c) => ({ ...c, resultVisibility: value as ResultVisibility }))}>
            <SelectTrigger aria-label="Result visibility" className="w-full min-w-0 max-w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(RESULT_VISIBILITY_LABEL) as ResultVisibility[]).filter((key) => key !== "AFTER_EXAM_CLOSED").map((key) => (
                <SelectItem key={key} value={key}>{RESULT_VISIBILITY_LABEL[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs font-normal text-muted-foreground">
            Choose when students can review their scores.
          </span>
        </div>

        <div className="grid min-w-0 max-w-full gap-2 text-sm font-medium">
          Show Answers After Exam
          <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background/50 px-3 py-1 cursor-pointer">
            <input
              type="checkbox"
              className="size-4 accent-primary cursor-pointer"
              checked={cfg.showAnswersAfterExam}
              onChange={(event) => setCfg((c) => ({ ...c, showAnswersAfterExam: event.target.checked }))}
            />
            <span className="text-xs font-normal text-muted-foreground select-none">
              Allow students to see answer keys
            </span>
          </label>
          <span className="text-xs font-normal text-muted-foreground">
            Only visible after score is published and no attempts left.
          </span>
        </div>
      </div>

      {/* NEW (anti-cheat): cau hinh chong gian lan theo tung de */}
      <div className="grid min-w-0 max-w-full gap-3 border-t pt-4 sm:col-span-2">
        <SectionTitle>Anti-cheat</SectionTitle>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" disabled={locked} className="size-4 accent-primary cursor-pointer" checked={cfg.antiCheatEnabled} onChange={(event) => setCfg((c) => ({ ...c, antiCheatEnabled: event.target.checked }))} />
          Anti-cheating monitoring (chống gian lận)
        </label>
        <p className="text-xs text-muted-foreground">
          Violations are only logged (the exam is never auto-submitted). View them in Result Statistics → Integrity Report.
        </p>
        {locked && (
          <p className="text-xs text-amber-700">Students have already started this assessment. Anti-cheat settings are disabled to protect student results.</p>
        )}
        {cfg.antiCheatEnabled && (
          <div className="grid min-w-0 max-w-full gap-6 sm:col-span-2 lg:grid-cols-2">
          <div className="grid min-w-0 max-w-full gap-3 pl-6 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" disabled={locked} className="size-4 accent-primary cursor-pointer" checked={cfg.detectTabSwitch} onChange={(event) => setCfg((c) => ({ ...c, detectTabSwitch: event.target.checked }))} />
              Count tab / window switches
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" disabled={locked} className="size-4 accent-primary cursor-pointer" checked={cfg.blockCopyPaste} onChange={(event) => setCfg((c) => ({ ...c, blockCopyPaste: event.target.checked }))} />
              Block copy / paste / right-click / dev shortcuts
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" disabled={locked} className="size-4 accent-primary cursor-pointer" checked={cfg.requireFullscreen} onChange={(event) => setCfg((c) => ({ ...c, requireFullscreen: event.target.checked }))} />
              Require fullscreen
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" disabled={locked} className="size-4 accent-primary cursor-pointer" checked={cfg.singleSession} onChange={(event) => setCfg((c) => ({ ...c, singleSession: event.target.checked }))} />
              Detect multiple tabs / devices
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" disabled={locked} className="size-4 accent-primary cursor-pointer" checked={cfg.cameraProctoring} onChange={(event) => setCfg((c) => ({ ...c, cameraProctoring: event.target.checked }))} />
              Camera proctoring (face photo at start, detect camera off / covered / away / extra person / head turned)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" disabled={locked} className="size-4 accent-primary cursor-pointer" checked={cfg.notifyOnViolation} onChange={(event) => setCfg((c) => ({ ...c, notifyOnViolation: event.target.checked }))} />
              Notify the examinee when a violation is detected
            </label>
          </div>
          <div className="h-fit w-full space-y-2 rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">
              Detection coefficients. Leave blank to keep the default.{" "}
              {locked ? "Students have already started this assessment, so these coefficients are locked to keep the statistics consistent." : "They can no longer be changed once a student starts the exam."}
            </p>
            <div className="grid w-full gap-4 sm:grid-cols-3">
              {([
                ["headTurnAngleDeg", "Head-turn angle (°)", "35", 10, 80],
                ["headTurnSeconds", "Head-turn time (seconds)", "2", 1, 30],
                ["fastSubmitPercent", "Fast-submit threshold (% of exam time)", "20", 1, 50],
              ] as const).map(([key, label, def, min, max]) => (
                <label key={key} className="space-y-1 text-xs font-medium">
                  {label}
                  <Input
                    type="number"
                    min={min}
                    max={max}
                    step={1}
                    placeholder={`Default ${def}`}
                    disabled={locked}
                    value={cfg[key]}
                    onChange={(event) => setCfg((c) => ({ ...c, [key]: event.target.value }))}
                  />
                  <span className="block text-[11px] font-normal text-muted-foreground">Allowed {min}–{max}</span>
                </label>
              ))}
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
