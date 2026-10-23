import axios from "axios";
import type {
  CreateMilestoneRequest,
  MilestoneApiError,
  MilestoneListItem,
  MilestoneStatus,
} from "@/types";
import type { MilestoneFormValues } from "./milestone-form.schema";

export function buildMilestonePayload(values: MilestoneFormValues): CreateMilestoneRequest {
  const base: CreateMilestoneRequest = {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    deadline: new Date(values.deadline).toISOString(),
    mandatory: values.mandatory,
    checklist: values.checklist.map((item, index) => ({
      content: item.content.trim(),
      mandatory: item.mandatory,
      orderIndex: index,
    })),
    rubricSnapshotId: values.rubricSnapshotId,
    reviewerId: values.reviewerId,
    latePolicy: { type: values.latePolicy.type },
  };

  if (values.latePolicy.type === "ALLOW_LATE") {
    base.latePolicy = {
      type: "ALLOW_LATE",
      lateUntil: values.latePolicy.lateUntil
        ? new Date(values.latePolicy.lateUntil).toISOString()
        : undefined,
      penaltyPercent: values.latePolicy.penaltyPercent,
    };
  }

  return base;
}

export function getMilestoneApiError(error: unknown): MilestoneApiError {
  if (!axios.isAxiosError<MilestoneApiError>(error)) {
    return { message: "Something went wrong. Please try again." };
  }
  const body = error.response?.data;
  return {
    ...body,
    status: body?.status ?? error.response?.status,
    message: body?.message ?? error.message,
    correlationId: body?.correlationId ?? error.response?.headers?.["x-correlation-id"],
  };
}

export function isNetworkOrTimeoutError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

export function toFormFieldPath(path: string): string {
  return path.replace(/\[(\d+)]/g, ".$1");
}

export function stablePayload(value: CreateMilestoneRequest): string {
  return JSON.stringify(value);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatTenantDateTime(value: string | null | undefined, timeZone: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
      timeZoneName: "shortOffset",
    }).format(date);
  } catch {
    return `${new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(date)} (tenant timezone unavailable)`;
  }
}

export function formatRelativeDeadline(value: string): string {
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return "";
  const difference = deadline.getTime() - Date.now();
  const absoluteMinutes = Math.round(Math.abs(difference) / 60_000);
  const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absoluteMinutes < 60) {
    return relative.format(difference < 0 ? -absoluteMinutes : absoluteMinutes, "minute");
  }
  const absoluteHours = Math.round(absoluteMinutes / 60);
  if (absoluteHours < 48) {
    return relative.format(difference < 0 ? -absoluteHours : absoluteHours, "hour");
  }
  const absoluteDays = Math.round(absoluteHours / 24);
  return relative.format(difference < 0 ? -absoluteDays : absoluteDays, "day");
}

export function isPastDeadline(milestone: MilestoneListItem): boolean {
  return !["CLOSED", "CANCELLED"].includes(milestone.status) &&
    new Date(milestone.deadline).getTime() < Date.now();
}

export function formatPenalty(value?: number | null): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)}%`;
}

export function formatMilestoneStatus(status: MilestoneStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
