import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LessonDTO, SessionClassInfo, UserDTO } from "@/types";
import type { ReactNode } from "react";
import { getTrainerName, type SessionFormValues } from "./session-form.utils";
import { SessionDateTimePicker } from "./SessionDateTimePicker";

export function SessionFormField({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && (
        <p id={id + "-error"} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface SessionFormFieldsProps {
  form: SessionFormValues;
  errors: Record<string, string>;
  onChange: (field: keyof SessionFormValues, value: string) => void;
  topics: LessonDTO[];
  trainers: UserDTO[];
  classInfo?: SessionClassInfo;
  topicsLoading?: boolean;
  trainersLoading?: boolean;
}

export function SessionFormFields({
  form,
  errors,
  onChange,
  topics,
  trainers,
  classInfo,
  topicsLoading,
  trainersLoading,
}: SessionFormFieldsProps) {
  return (
    <>
      <SessionFormField id="session-title" label="Session Title" required error={errors.title}>
        <Input
          id="session-title"
          value={form.title}
          onChange={(event) => onChange("title", event.target.value)}
          maxLength={150}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "session-title-error" : undefined}
          placeholder="Enter session title"
        />
      </SessionFormField>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <SessionFormField
          id="topic-id"
          label="Topic"
          required
          error={errors.topicId || errors.topicName}
        >
          <Select
            value={topics.some((topic) => String(topic.id) === form.topicId) ? form.topicId : ""}
            onValueChange={(value) => {
              if (value) onChange("topicId", value);
            }}
            disabled={topicsLoading || !topics.length}
          >
            <SelectTrigger id="topic-id" className="w-full min-w-0" aria-invalid={!!errors.topicId}>
              <SelectValue placeholder={topicsLoading ? "Loading topics..." : "Select a topic"} />
            </SelectTrigger>
            <SelectContent>
              {topics.map((topic) => (
                <SelectItem key={topic.id} value={String(topic.id)}>
                  {topic.title || "Topic #" + topic.id}
                  {topic.courseName ? " · " + topic.courseName : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SessionFormField>
        <SessionFormField
          id="trainer-id"
          label="Trainer"
          required
          error={errors.trainerId || errors.trainerName}
        >
          <Select
            value={
              trainers.some((trainer) => String(trainer.id) === form.trainerId)
                ? form.trainerId
                : ""
            }
            onValueChange={(value) => {
              if (value) onChange("trainerId", value);
            }}
            disabled={trainersLoading || !trainers.length}
          >
            <SelectTrigger
              id="trainer-id"
              className="w-full min-w-0"
              aria-invalid={!!errors.trainerId}
            >
              <SelectValue
                placeholder={trainersLoading ? "Loading trainers..." : "Select a trainer"}
              />
            </SelectTrigger>
            <SelectContent>
              {trainers.map((trainer) => (
                <SelectItem key={trainer.id} value={String(trainer.id)}>
                  {getTrainerName(trainer)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SessionFormField>
      </div>
      <div className="grid min-w-0 gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
        <SessionFormField id="start-time" label="Start Time" required error={errors.startTime}>
          <SessionDateTimePicker
            id="start-time"
            label="Select start time"
            value={form.startTime}
            onChange={(value) => onChange("startTime", value)}
            min={classInfo?.startDate ? classInfo.startDate + "T00:00" : undefined}
            max={classInfo?.endDate ? classInfo.endDate + "T23:59" : undefined}
            invalid={!!errors.startTime}
          />
        </SessionFormField>
        <SessionFormField id="end-time" label="End Time" required error={errors.endTime}>
          <SessionDateTimePicker
            id="end-time"
            label="Select end time"
            value={form.endTime}
            onChange={(value) => onChange("endTime", value)}
            min={form.startTime || undefined}
            max={classInfo?.endDate ? classInfo.endDate + "T23:59" : undefined}
            invalid={!!errors.endTime}
          />
        </SessionFormField>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <SessionFormField id="room" label="Room" error={errors.room}>
          <Input
            id="room"
            value={form.room}
            onChange={(event) => onChange("room", event.target.value)}
            maxLength={80}
            placeholder="Enter room"
            aria-invalid={!!errors.room}
          />
        </SessionFormField>
        <SessionFormField id="meeting-link" label="Online Meeting Link" error={errors.meetingLink}>
          <Input
            id="meeting-link"
            type="url"
            value={form.meetingLink}
            onChange={(event) => onChange("meetingLink", event.target.value)}
            maxLength={255}
            placeholder="https://..."
            aria-invalid={!!errors.meetingLink}
          />
        </SessionFormField>
      </div>
      {errors.conflict && (
        <p role="alert" className="text-sm text-destructive">
          {errors.conflict}
        </p>
      )}
      {errors.overrideReason && (
        <p role="alert" className="text-sm text-destructive">
          {errors.overrideReason}
        </p>
      )}
    </>
  );
}
