import type { SessionDTO } from "@/types";
import { joinLocalDateTime, splitLocalDateTime, validateSlot } from "@/utils/session.utils";

export const TITLE_MAX = 150;
export const LOCATION_MAX = 150;
export const CANCEL_REASON_MAX = 255;

export type SessionFormMode = "create" | "edit";

export interface SessionFormValues {
    classId: string;
    title: string;
    topicId: string;
    trainerId: string;
    date: string;
    start: string;
    end: string;
    location: string;
    note: string;
}

export type SessionFormField = keyof SessionFormValues;
export type SessionFormErrors = Partial<Record<SessionFormField, string>>;

export function buildInitialValues(session?: SessionDTO, classId?: number): SessionFormValues {
    const start = splitLocalDateTime(session?.startTime);
    const end = splitLocalDateTime(session?.endTime);

    return {
        classId: String(session?.classId ?? classId ?? ""),
        title: session?.title ?? "",
        topicId: session?.topicId != null ? String(session.topicId) : "",
        trainerId: session?.trainerId != null ? String(session.trainerId) : "",
        date: start.date,
        start: start.time,
        end: end.time,
        location: session?.location ?? "",
        note: session?.note ?? "",
    };
}

export function validateSessionForm(values: SessionFormValues, mode: SessionFormMode): SessionFormErrors {
    const errors: SessionFormErrors = {};

    // Class and topic are fixed when a session is created and never edited afterwards
    if (mode === "create") {
        if (!values.classId) errors.classId = "Class is required";
        if (!/^[1-9]\d{0,14}$/.test(values.topicId.trim())) errors.topicId = "Topic ID must be a positive whole number";
    }

    const title = values.title.trim();
    if (!title) errors.title = "Title is required";
    else if (title.length > TITLE_MAX) errors.title = `Title must not exceed ${TITLE_MAX} characters`;

    if (!values.trainerId) errors.trainerId = "Trainer is required";

    if (values.location.trim().length > LOCATION_MAX) {
        errors.location = `Room must not exceed ${LOCATION_MAX} characters`;
    }

    const slot = validateSlot({ date: values.date, start: values.start, end: values.end });
    if (slot.date) errors.date = slot.date;
    if (slot.start) errors.start = slot.start;
    if (slot.end) errors.end = slot.end;

    return errors;
}

export function buildCreatePayload(values: SessionFormValues): SessionDTO {
    return {
        classId: Number(values.classId),
        topicId: Number(values.topicId.trim()),
        trainerId: Number(values.trainerId),
        title: values.title.trim(),
        startTime: joinLocalDateTime(values.date, values.start),
        endTime: joinLocalDateTime(values.date, values.end),
        location: values.location.trim() || undefined,
        note: values.note.trim() || undefined,
        isActive: true,
    };
}

/**
 * Class and topic are deliberately absent: an edit can never move a session to another class or topic.
 * The time slot is only sent when it was changed, so editing e.g. the title of a session that spans several days
 * (possible through the file import) cannot silently rewrite its end date.
 */
export function buildUpdatePayload(values: SessionFormValues, initial: SessionFormValues): SessionDTO {
    const slotChanged = values.date !== initial.date || values.start !== initial.start || values.end !== initial.end;

    return {
        trainerId: Number(values.trainerId),
        title: values.title.trim(),
        ...(slotChanged
            ? {
                  startTime: joinLocalDateTime(values.date, values.start),
                  endTime: joinLocalDateTime(values.date, values.end),
              }
            : {}),
        // empty strings (not undefined) so that clearing the room or the note is really saved
        location: values.location.trim(),
        note: values.note.trim(),
    };
}

/** Backend field names -> form field names. */
const SERVER_FIELD_TO_FORM_FIELD: Record<string, SessionFormField> = {
    classId: "classId",
    topicId: "topicId",
    trainerId: "trainerId",
    title: "title",
    startTime: "start",
    endTime: "end",
    location: "location",
    note: "note",
};

export function mapServerFieldErrors(fieldErrors: Record<string, string[]>): SessionFormErrors {
    const mapped: SessionFormErrors = {};

    for (const [serverField, messages] of Object.entries(fieldErrors)) {
        const field = SERVER_FIELD_TO_FORM_FIELD[serverField];
        if (field && messages.length) mapped[field] = messages[0];
    }

    return mapped;
}
