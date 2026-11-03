import { describe, expect, it } from "vitest";
import type { SessionDTO } from "@/types";
import {
    buildCreatePayload,
    buildInitialValues,
    buildUpdatePayload,
    mapServerFieldErrors,
    validateSessionForm,
    type SessionFormValues,
} from "./session-form";

const filled: SessionFormValues = {
    classId: "5",
    title: "  Intro to Spring  ",
    topicId: "500",
    trainerId: "7",
    date: "2030-03-04",
    start: "09:00",
    end: "11:00",
    location: " Room 101 ",
    note: " bring laptops ",
};

const existing: SessionDTO = {
    id: 9,
    classId: 5,
    topicId: 500,
    trainerId: 7,
    title: "Intro to Spring",
    startTime: "2030-03-04T09:00:00",
    endTime: "2030-03-04T11:00:00",
    location: "Room 101",
    note: "bring laptops",
    status: "SCHEDULED",
};

describe("buildInitialValues", () => {
    it("starts a new session empty except for the class it was started from", () => {
        expect(buildInitialValues(undefined, 5)).toEqual({
            classId: "5",
            title: "",
            topicId: "",
            trainerId: "",
            date: "",
            start: "",
            end: "",
            location: "",
            note: "",
        });
    });

    it("splits an existing session into the date and time inputs", () => {
        expect(buildInitialValues(existing)).toMatchObject({ classId: "5", topicId: "500", trainerId: "7", date: "2030-03-04", start: "09:00", end: "11:00" });
    });
});

describe("validateSessionForm", () => {
    it("accepts a complete form", () => {
        expect(validateSessionForm(filled, "create")).toEqual({});
        expect(validateSessionForm(filled, "edit")).toEqual({});
    });

    it("lists what a new session is missing", () => {
        const errors = validateSessionForm(buildInitialValues(), "create");
        expect(Object.keys(errors).sort()).toEqual(["classId", "date", "end", "start", "title", "topicId", "trainerId"]);
    });

    it("does not ask for class or topic when editing, because they can never change", () => {
        const errors = validateSessionForm({ ...filled, classId: "", topicId: "" }, "edit");
        expect(errors.classId).toBeUndefined();
        expect(errors.topicId).toBeUndefined();
    });

    it.each(["abc", "0", "-3", "1.5", "12e3", " "])("rejects %j as a topic id", (topicId) => {
        expect(validateSessionForm({ ...filled, topicId }, "create").topicId).toBeDefined();
    });

    it("limits the title and room to 150 characters (after trimming) like the database column", () => {
        expect(validateSessionForm({ ...filled, title: "x".repeat(151) }, "create").title).toMatch(/150/);
        expect(validateSessionForm({ ...filled, title: `  ${"x".repeat(150)}  ` }, "create").title).toBeUndefined();
        expect(validateSessionForm({ ...filled, location: "r".repeat(151) }, "create").location).toMatch(/150/);
    });

    it("rejects a whitespace-only title and an end that is not after the start", () => {
        expect(validateSessionForm({ ...filled, title: "   " }, "create").title).toBe("Title is required");
        expect(validateSessionForm({ ...filled, start: "11:00", end: "10:00" }, "create").end).toBe("End time must be after start time");
    });
});

describe("buildCreatePayload", () => {
    it("builds the API body with numbers, trimmed text and a joined date-time", () => {
        expect(buildCreatePayload(filled)).toEqual({
            classId: 5,
            topicId: 500,
            trainerId: 7,
            title: "Intro to Spring",
            startTime: "2030-03-04T09:00:00",
            endTime: "2030-03-04T11:00:00",
            location: "Room 101",
            note: "bring laptops",
            isActive: true,
        });
    });

    it("leaves out an empty room and note instead of sending empty strings", () => {
        const payload = buildCreatePayload({ ...filled, location: "  ", note: "" });
        expect(payload.location).toBeUndefined();
        expect(payload.note).toBeUndefined();
    });
});

describe("buildUpdatePayload", () => {
    const initial = buildInitialValues(existing);

    it("never carries class or topic: an edit cannot move a session elsewhere", () => {
        const payload = buildUpdatePayload({ ...initial, title: "Renamed", classId: "99", topicId: "98" }, initial);

        expect(payload).not.toHaveProperty("classId");
        expect(payload).not.toHaveProperty("topicId");
        expect(payload.title).toBe("Renamed");
    });

    it("does not resend the time slot when it was not touched (keeps a multi-day session intact)", () => {
        const payload = buildUpdatePayload({ ...initial, title: "Renamed" }, initial);

        expect(payload).not.toHaveProperty("startTime");
        expect(payload).not.toHaveProperty("endTime");
    });

    it("sends the slot when any part of it changed", () => {
        const payload = buildUpdatePayload({ ...initial, date: "2030-03-05", end: "12:00" }, initial);

        expect(payload.startTime).toBe("2030-03-05T09:00:00");
        expect(payload.endTime).toBe("2030-03-05T12:00:00");
    });

    it("sends empty strings for a cleared room / note so that clearing is really saved", () => {
        const payload = buildUpdatePayload({ ...initial, location: "", note: "" }, initial);

        expect(payload.location).toBe("");
        expect(payload.note).toBe("");
    });
});

describe("mapServerFieldErrors", () => {
    it("maps backend field names onto the form's and keeps the first message", () => {
        expect(
            mapServerFieldErrors({
                startTime: ["Start time is required", "later message"],
                endTime: ["End time must be after start time"],
                trainerId: ["Trainer #9 is not an active trainer in the master training system"],
                classId: ["Class #3 does not exist in the master training system"],
                somethingElse: ["ignored"],
                title: [],
            }),
        ).toEqual({
            start: "Start time is required",
            end: "End time must be after start time",
            trainerId: "Trainer #9 is not an active trainer in the master training system",
            classId: "Class #3 does not exist in the master training system",
        });
    });
});
