import { sessionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SessionDTO } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clock, Save, Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ConflictWarningModal } from "../components/ConflictWarningModal";

// Sample trainer data for quick selection during demo
const DEMO_TRAINERS = [
  { id: 1, name: "Nguyen Minh (Trainer)" },
  { id: 2, name: "Tran Thi Lan (Trainer)" },
  { id: 3, name: "Le Hoang An (Trainer)" },
];

const DEMO_CLASSES = ["HCM26-FSJ-01", "HN26-QAA-02", "DN26-DATA-01"];
const DEMO_ROOMS = ["Room A-301", "Room B-202", "Room A-105", "Online - Microsoft Teams"];

// Default times: tomorrow 08:30 – 11:30
const getDefaultTimes = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const dd = String(tomorrow.getDate()).padStart(2, "0");

  return {
    start: `${yyyy}-${mm}-${dd}T08:30`,
    end: `${yyyy}-${mm}-${dd}T11:30`,
  };
};

const defaultTime = getDefaultTimes();

const initialFormState: SessionDTO = {
  classCode: DEMO_CLASSES[0],
  topicName: "Java Spring Framework",
  title: "RESTful API with Spring Boot",
  trainerId: DEMO_TRAINERS[0].id,
  trainerName: DEMO_TRAINERS[0].name,
  startTime: defaultTime.start,
  endTime: defaultTime.end,
  room: DEMO_ROOMS[0],
  meetingLink: "https://meet.google.com/demo-session",
  status: "SCHEDULED",
  notes: "Theory & hands-on lab session.",
  isActive: true,
};

export function SessionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<SessionDTO>(initialFormState);

  // Conflict warning modal state (FR-CAL-03)
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");
  const [conflictingSessions] = useState<SessionDTO[]>([]);

  const createMutation = useMutation({
    mutationFn: (payload: SessionDTO) => sessionApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      if (data.isOverridden) {
        toast.warning(
          `Session created with Override permission (BR-10): ${data.overrideReason}`
        );
      } else {
        toast.success("Session created successfully!");
      }
      navigate("/sessions");
    },
    onError: (error: any) => {
      const errorData = error?.response?.data;
      const validationErrors = errorData?.errors;

      // Check if the error is due to a schedule conflict (FR-CAL-03)
      if (validationErrors?.conflict && validationErrors.conflict.length > 0) {
        const msg = validationErrors.conflict[0];
        setConflictMessage(msg);
        setConflictModalOpen(true);
        toast.error("Schedule conflict detected!");
        return;
      }

      if (validationErrors?.endTime && validationErrors.endTime.length > 0) {
        toast.error(validationErrors.endTime[0]);
        return;
      }

      const fallbackMsg = errorData?.message || "Failed to create session.";
      toast.error(fallbackMsg);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.classCode || !form.title || !form.startTime || !form.endTime) {
      toast.error("Please fill in all required fields (*).");
      return;
    }

    // Format ISO string compatible with Jackson LocalDateTime
    const formatTime = (t: string) => (t.length === 16 ? `${t}:00` : t);

    createMutation.mutate({
      ...form,
      startTime: formatTime(form.startTime),
      endTime: formatTime(form.endTime),
      forceOverride: false,
    });
  };

  // User confirms Override from Modal (BR-10)
  const handleConfirmOverride = (reason: string) => {
    const formatTime = (t: string) => (t.length === 16 ? `${t}:00` : t);

    createMutation.mutate(
      {
        ...form,
        startTime: formatTime(form.startTime),
        endTime: formatTime(form.endTime),
        forceOverride: true,
        overrideReason: reason,
      },
      {
        onSettled: () => {
          setConflictModalOpen(false);
        },
      }
    );
  };

  return (
    <MainLayout pathName={{ sessions: "Schedules", create: "Create Session" }}>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Conflict testing guide banner (AT-04) */}
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 flex items-start gap-3">
          <Calendar className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">
              Conflict Detection Test Guide (AT-04 &amp; FR-CAL-03):
            </span>
            <p>
              • Default seed data: <strong>Trainer Nguyen Minh</strong> is booked at <strong>Room A-301</strong> from <strong>08:30 to 11:30 tomorrow</strong>.
            </p>
            <p>
              • If you keep the same time or choose the same Trainer/Room for tomorrow morning and click Save, the system will <strong>automatically detect the conflict and block it</strong>.
            </p>
            <p>
              • You can then choose <strong>"Edit Time"</strong> (e.g. change to 14:00) or use the <strong>"Override Schedule"</strong> option with a reason (BR-10).
            </p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Create Session</CardTitle>
                <CardDescription>
                  Schedule a new session with real-time conflict detection.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate("/sessions/bulk-generate")}
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                Bulk Generator (F16)
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <form id="session-form" className="grid gap-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Class code */}
                <div className="grid gap-2">
                  <Label htmlFor="class-code">Class Code <span className="text-red-500">*</span></Label>
                  <Input
                    id="class-code"
                    value={form.classCode}
                    onChange={(e) => setForm((p) => ({ ...p, classCode: e.target.value }))}
                    placeholder="e.g. HCM26-FSJ-01"
                    required
                  />
                  <div className="flex gap-2">
                    {DEMO_CLASSES.map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, classCode: cls }))}
                        className="text-[11px] text-sky-700 bg-sky-100 hover:bg-sky-200 rounded px-2 py-0.5"
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic */}
                <div className="grid gap-2">
                  <Label htmlFor="topic-name">Training Topic</Label>
                  <Input
                    id="topic-name"
                    value={form.topicName ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, topicName: e.target.value }))}
                    placeholder="e.g. Java Spring Framework"
                  />
                </div>
              </div>

              {/* Session title */}
              <div className="grid gap-2">
                <Label htmlFor="session-title">Session Title <span className="text-red-500">*</span></Label>
                <Input
                  id="session-title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Session 1: Spring Boot Overview & Dependency Injection"
                  required
                />
              </div>

              {/* Trainer & Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="trainer-select">Trainer <span className="text-red-500">*</span></Label>
                  <select
                    id="trainer-select"
                    value={form.trainerId}
                    onChange={(e) => {
                      const selectedId = Number(e.target.value);
                      const t = DEMO_TRAINERS.find((item) => item.id === selectedId);
                      setForm((p) => ({
                        ...p,
                        trainerId: selectedId,
                        trainerName: t?.name ?? "Trainer",
                      }));
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {DEMO_TRAINERS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (ID: {t.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room */}
                <div className="grid gap-2">
                  <Label htmlFor="room">Room (Offline)</Label>
                  <Input
                    id="room"
                    value={form.room ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))}
                    placeholder="e.g. Room A-301"
                  />
                  <div className="flex gap-2">
                    {DEMO_ROOMS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, room: r }))}
                        className="text-[11px] text-slate-700 bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Time range: Start & End */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <div className="grid gap-2">
                  <Label htmlFor="start-time" className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    Start Time <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="start-time"
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="end-time" className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Clock className="h-4 w-4 text-rose-600" />
                    End Time <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="end-time"
                    type="datetime-local"
                    value={form.endTime}
                    onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Meeting link & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="meeting-link">Meeting Link (Online)</Label>
                  <Input
                    id="meeting-link"
                    value={form.meetingLink ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, meetingLink: e.target.value }))}
                    placeholder="https://meet.google.com/..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Session Notes</Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Reminders, assignments, etc."
                  />
                </div>
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/sessions")}
              disabled={createMutation.isPending}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to List
            </Button>

            <Button
              type="submit"
              form="session-form"
              disabled={createMutation.isPending}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Save className="mr-1.5 h-4 w-4" />
              {createMutation.isPending ? "Validating & Saving..." : "Save Session"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Schedule Conflict Warning Modal (FR-CAL-03) */}
      <ConflictWarningModal
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        conflictMessage={conflictMessage}
        conflictingSessions={conflictingSessions}
        onConfirmOverride={handleConfirmOverride}
        isSubmitting={createMutation.isPending}
      />
    </MainLayout>
  );
}
