import axios from "axios";
import type { CreateMilestoneRequest, MilestoneApiError } from "@/types";
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
  return error.response?.data ?? { message: error.message };
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
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
