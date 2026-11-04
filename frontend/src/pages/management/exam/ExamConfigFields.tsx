import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXAM_CATEGORY_LABEL, EXAM_CATEGORY_SHOW_ANSWERS_DEFAULT, type ExamCategory, type ExamDTO, type ExamType, type LatePolicy, type ResultVisibility } from "@/types";
import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { CalendarClock } from "lucide-react";
import {
  EXAM_CATEGORY_OPTIONS,
  EXAM_TYPE_LABEL,
  getFutureDatetimeString,
  getLocalDatetimeString,
  LATE_POLICY_LABEL,
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
  /** The exam being edited (null when creating). */
  editingExam?: ExamDTO | null;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">{children}</h3>
  );
}

/** All fields of the exam form (shared by the Create dialog and the Edit tab). */
export function ExamConfigFields({ title: newTitle, setTitle: setNewTitle, duration: newDuration, setDuration: setNewDuration, cfg, setCfg, editingExam }: Props) {
  const hasSchedule = Boolean(cfg.startTime || cfg.endTime);
  const [scheduleEnabled, setScheduleEnabled] = useState(() => hasSchedule);

  useEffect(() => {
    if (hasSchedule && !scheduleEnabled) {
      setScheduleEnabled(true);
    }
  }, [hasSchedule]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SectionTitle>Basic</SectionTitle>
      <label className="grid gap-2 text-sm font-medium sm:col-span-2">
        Exam Title
        <Input required maxLength={200} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Duration (minutes)
        <Input required type="number" min={1} value={newDuration} onChange={(event) => setNewDuration(event.target.value)} />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Exam Password / Access Code (leave blank if not required)
        <Input
            type="text"
            placeholder="e.g. EXAM2026"
            maxLength={100}
            value={cfg.accessCode}
            onChange={(event) => setCfg((c) => ({ ...c, accessCode: event.target.value }))}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Question Format
        <Select value={cfg.examType} onValueChange={(value) => setCfg((c) => ({ ...c, examType: value as ExamType }))}>
          <SelectTrigger aria-label="Exam type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map((key) => (
                <SelectItem key={key} value={key}>{EXAM_TYPE_LABEL[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs font-normal text-muted-foreground">
          Only matching question types can be selected.
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Exam Category
        <Select value={cfg.category} onValueChange={(value) => {
          const category = value as ExamCategory;
          setCfg((current) => ({
            ...current,
            category,
            showAnswersAfterExam: EXAM_CATEGORY_SHOW_ANSWERS_DEFAULT[category],
          }));
        }}>
          <SelectTrigger aria-label="Exam category"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EXAM_CATEGORY_OPTIONS.map((category) => (
                <SelectItem key={category} value={category}>{EXAM_CATEGORY_LABEL[category]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs font-normal text-muted-foreground">
          The category sets default for answer review.
        </span>
      </label>

      <div className="grid gap-4 border-t pt-4 sm:col-span-2 sm:grid-cols-2">
        <SectionTitle>Schedule &amp; attempts</SectionTitle>

        {!scheduleEnabled ? (
          <div className="sm:col-span-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-emerald-500" />
                <span className="text-sm font-semibold">Exam Schedule</span>
                <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  No time limits (Mở tự do)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Exam has no fixed start or end deadline. Students can take it anytime once published, or you can set a schedule later.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-xs gap-1.5 h-8 font-medium hover:bg-background"
              onClick={() => {
                setScheduleEnabled(true);
                const durationMinutes = Number(newDuration) || 60;
                setCfg((c) => ({
                  ...c,
                  startTime: getFutureDatetimeString(2),
                  endTime: getFutureDatetimeString(2 + durationMinutes),
                }));
              }}
            >
              <CalendarClock className="size-3.5" />
              Set Schedule (Đặt lịch thi)
            </Button>
          </div>
        ) : (
          <>
            <div className="sm:col-span-2 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                <span className="text-sm font-semibold">Scheduled Window</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive h-7 px-2 font-normal"
                onClick={() => {
                  setScheduleEnabled(false);
                  setCfg((c) => ({ ...c, startTime: "", endTime: "" }));
                }}
              >
                Clear schedule (Hủy lịch, mở tự do)
              </Button>
            </div>

            <div className="grid gap-2 text-sm font-medium">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span>Start Time</span>
                <div className="flex items-center gap-1 font-normal">
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                    onClick={() => setCfg((c) => ({ ...c, startTime: getLocalDatetimeString() }))}
                  >
                    Now
                  </button>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                    onClick={() => setCfg((c) => ({ ...c, startTime: getFutureDatetimeString(15) }))}
                  >
                    +15m
                  </button>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                    onClick={() => setCfg((c) => ({ ...c, startTime: getFutureDatetimeString(60) }))}
                  >
                    +1h
                  </button>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                    onClick={() => setCfg((c) => ({ ...c, startTime: getFutureDatetimeString(1440) }))}
                  >
                    +1d
                  </button>
                  {cfg.startTime && (
                    <>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <button
                        type="button"
                        className="text-[11px] text-destructive hover:underline cursor-pointer"
                        onClick={() => setCfg((c) => ({ ...c, startTime: "" }))}
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
              <Input
                type="datetime-local"
                min={editingExam?.startTime && new Date(editingExam.startTime).getTime() < Date.now()
                  ? undefined
                  : getLocalDatetimeString()}
                value={cfg.startTime}
                onChange={(event) => setCfg((c) => ({ ...c, startTime: event.target.value }))}
              />
              <p className="text-[11px] font-normal text-muted-foreground">
                {cfg.startTime
                  ? "Must be current time or later (rec: at least 1–2 min ahead)."
                  : "Leave blank = no open limit (students can start anytime)."}
              </p>
            </div>

            <div className="grid gap-2 text-sm font-medium">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span>End Time</span>
                <div className="flex items-center gap-1 font-normal">
                  {cfg.startTime && (
                    <>
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                        onClick={() => {
                          const start = new Date(cfg.startTime).getTime();
                          const dur = (Number(newDuration) || 60) * 60000;
                          setCfg((c) => ({ ...c, endTime: getLocalDatetimeString(new Date(start + dur)) }));
                        }}
                      >
                        +{newDuration || "60"}m
                      </button>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                        onClick={() => {
                          const start = new Date(cfg.startTime).getTime();
                          setCfg((c) => ({ ...c, endTime: getLocalDatetimeString(new Date(start + 2 * 3600000)) }));
                        }}
                      >
                        +2h
                      </button>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                        onClick={() => {
                          const start = new Date(cfg.startTime).getTime();
                          setCfg((c) => ({ ...c, endTime: getLocalDatetimeString(new Date(start + 24 * 3600000)) }));
                        }}
                      >
                        +1d
                      </button>
                    </>
                  )}
                  {cfg.endTime && (
                    <>
                      {cfg.startTime && <span className="text-[10px] text-muted-foreground">·</span>}
                      <button
                        type="button"
                        className="text-[11px] text-destructive hover:underline cursor-pointer font-normal"
                        onClick={() => setCfg((c) => ({ ...c, endTime: "" }))}
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
              <Input
                type="datetime-local"
                min={cfg.startTime || (editingExam?.endTime && new Date(editingExam.endTime).getTime() < Date.now() ? undefined : getLocalDatetimeString())}
                value={cfg.endTime}
                onChange={(event) => setCfg((c) => ({ ...c, endTime: event.target.value }))}
              />
              <p className="text-[11px] font-normal text-muted-foreground">
                {cfg.endTime
                  ? "Exam will automatically close at this time."
                  : "Leave blank = no closing deadline."}
              </p>
            </div>
          </>
        )}

        <label className="grid gap-2 text-sm font-medium">
          Maximum Attempts
          <Input type="number" min={1} value={cfg.maxAttempts} onChange={(event) => setCfg((c) => ({ ...c, maxAttempts: event.target.value }))} />
          <span className="text-xs font-normal text-muted-foreground">
            Number of times a student can take this exam.
          </span>
        </label>

        <SectionTitle>Scoring</SectionTitle>
        <label className="grid gap-2 text-sm font-medium">
          Max Score (leave blank = 10)
          <Input type="number" min={0.01} step="0.01" placeholder="10" value={cfg.maxScore} onChange={(event) => setCfg((c) => ({ ...c, maxScore: event.target.value }))} />
          <span className="text-xs font-normal text-muted-foreground">
            Question score = max score × question weight ÷ total weight.
          </span>
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Passing Score (leave blank = no requirement)
          <Input type="number" min={0} step="0.01" value={cfg.passScore} onChange={(event) => setCfg((c) => ({ ...c, passScore: event.target.value }))} />
          <span className="text-xs font-normal text-muted-foreground">
            Minimum score required to pass (e.g. 5.0).
          </span>
        </label>

        <SectionTitle>Late submission</SectionTitle>
        <div className="grid gap-2 text-sm font-medium">
          Late Submission Policy
          <Select value={cfg.latePolicy} onValueChange={(value) => setCfg((c) => ({
            ...c,
            latePolicy: value as LatePolicy,
            lateGraceMinutes: value === "NOT_ALLOWED" ? "0" : c.lateGraceMinutes,
          }))}>
            <SelectTrigger aria-label="Late submission policy"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(LATE_POLICY_LABEL) as LatePolicy[]).map((key) => (
                  <SelectItem key={key} value={key}>{LATE_POLICY_LABEL[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs font-normal text-muted-foreground">
            Rules for submissions turned in after end time.
          </span>
        </div>

        {cfg.latePolicy === "ALLOWED_WITH_PENALTY" && (
          <>
            <label className="grid gap-2 text-sm font-medium">
              Late Penalty Percentage (1–100%)
              <Input type="number" min={1} max={100} value={cfg.latePenaltyPercent} onChange={(event) => setCfg((c) => ({ ...c, latePenaltyPercent: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Grace Period (minutes)
              <Input type="number" min={0} value={cfg.lateGraceMinutes} onChange={(event) => setCfg((c) => ({ ...c, lateGraceMinutes: event.target.value }))} />
            </label>
          </>
        )}
        {cfg.latePolicy === "ALLOWED" && (
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            Grace Period (minutes)
            <Input type="number" min={0} value={cfg.lateGraceMinutes} onChange={(event) => setCfg((c) => ({ ...c, lateGraceMinutes: event.target.value }))} />
          </label>
        )}

        <SectionTitle>Results</SectionTitle>
        <div className="grid gap-2 text-sm font-medium">
          Result Visibility
          <Select value={cfg.resultVisibility} onValueChange={(value) => setCfg((c) => ({ ...c, resultVisibility: value as ResultVisibility }))}>
            <SelectTrigger aria-label="Result visibility"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(RESULT_VISIBILITY_LABEL) as ResultVisibility[]).map((key) => (
                  <SelectItem key={key} value={key}>{RESULT_VISIBILITY_LABEL[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs font-normal text-muted-foreground">
            Choose when students can review their scores.
          </span>
        </div>

        <div className="grid gap-2 text-sm font-medium">
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
      <div className="grid gap-3 border-t pt-4 sm:col-span-2">
        <SectionTitle>Anti-cheat</SectionTitle>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" className="size-4 accent-primary cursor-pointer" checked={cfg.antiCheatEnabled} onChange={(event) => setCfg((c) => ({ ...c, antiCheatEnabled: event.target.checked }))} />
          Anti-cheating monitoring (chống gian lận)
        </label>
        <p className="text-xs text-muted-foreground">
          Violations are only logged (the exam is never auto-submitted). View them in Result Statistics → Integrity Report.
        </p>
        {cfg.antiCheatEnabled && (
            <div className="grid gap-3 pl-6 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="size-4 accent-primary cursor-pointer" checked={cfg.detectTabSwitch} onChange={(event) => setCfg((c) => ({ ...c, detectTabSwitch: event.target.checked }))} />
                Count tab / window switches
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="size-4 accent-primary cursor-pointer" checked={cfg.blockCopyPaste} onChange={(event) => setCfg((c) => ({ ...c, blockCopyPaste: event.target.checked }))} />
                Block copy / paste / right-click / dev shortcuts
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="size-4 accent-primary cursor-pointer" checked={cfg.requireFullscreen} onChange={(event) => setCfg((c) => ({ ...c, requireFullscreen: event.target.checked }))} />
                Require fullscreen
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="size-4 accent-primary cursor-pointer" checked={cfg.singleSession} onChange={(event) => setCfg((c) => ({ ...c, singleSession: event.target.checked }))} />
                Detect multiple tabs / devices
              </label>
            </div>
        )}
      </div>
    </div>
  );
}
