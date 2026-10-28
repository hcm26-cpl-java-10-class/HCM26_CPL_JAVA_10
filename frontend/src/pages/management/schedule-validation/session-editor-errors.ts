import { isAxiosError } from "axios";

export interface SessionEditorError {
    message: string;
    fields: Record<string, string[]>;
}

export function sessionFieldLabel(field: string): string {
    const labels: Record<string, string> = {
        teachingAssignmentId: "Teaching assignment", classId: "Class", topicId: "Topic", trainerId: "Trainer",
        roomId: "Room", location: "Location / Room", meetingUrl: "Meeting URL", title: "Session title",
        startTime: "Start time", endTime: "End time", isActive: "Active status", status: "Session status", note: "Note",
    };
    return labels[field] ?? field;
}

export function sessionEditorError(error: unknown, operation: "save" | "validate" = "save"): SessionEditorError {
    const fields: Record<string, string[]> = {};
    const body = isAxiosError<{ message?: unknown; errors?: unknown }>(error) ? error.response?.data : undefined;
    if (body?.errors && typeof body.errors === "object" && !Array.isArray(body.errors)) {
        for (const [field, value] of Object.entries(body.errors)) {
            const messages = (Array.isArray(value) ? value : [value])
                .filter((message): message is string => typeof message === "string" && !!message.trim());
            if (messages.length) fields[field] = messages;
        }
    }
    const backendMessage = typeof body?.message === "string" ? body.message.trim() : "";
    const fallback = operation === "save" ? "Session could not be saved. Please try again." : "Unable to validate this session. Please try again.";
    const generic = /^(business )?validation failed\.?$/i.test(backendMessage);
    return {
        message: Object.keys(fields).length && (!backendMessage || generic)
            ? operation === "save" ? "Session could not be saved. Review the field errors below." : "Review the field errors below before validating again."
            : backendMessage || fallback,
        fields,
    };
}
