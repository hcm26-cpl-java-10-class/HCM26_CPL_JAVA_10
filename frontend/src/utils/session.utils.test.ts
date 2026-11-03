import { describe, expect, it } from "vitest";
import {
    addDays,
    compareSessions,
    formatDate,
    formatTime,
    formatWeekday,
    getSessionStatusMeta,
    isOpenSession,
    joinLocalDateTime,
    parseLocalDateTime,
    splitLocalDateTime,
    trainerLabel,
    validateSlot,
} from "./session.utils";

describe("local date-time handling", () => {
    it("reads a zone-less LocalDateTime as local time, exactly as the backend stored it", () => {
        const parsed = parseLocalDateTime("2030-03-04T09:30:00");
        expect(parsed?.getFullYear()).toBe(2030);
        expect(parsed?.getMonth()).toBe(2);
        expect(parsed?.getDate()).toBe(4);
        expect(parsed?.getHours()).toBe(9);
        expect(parsed?.getMinutes()).toBe(30);
    });

    it("reads a bare date as that calendar day, not as UTC midnight shifted by the time zone", () => {
        const parsed = parseLocalDateTime("2030-03-04");
        expect(parsed?.getDate()).toBe(4);
        expect(parsed?.getHours()).toBe(0);
    });

    it("returns null for missing or unreadable values", () => {
        expect(parseLocalDateTime(undefined)).toBeNull();
        expect(parseLocalDateTime("")).toBeNull();
        expect(parseLocalDateTime("not a date")).toBeNull();
    });

    it("formats date, time and weekday", () => {
        expect(formatDate("2030-03-04T09:30:00")).toBe("04-Mar-2030");
        expect(formatTime("2030-03-04T09:05:00")).toBe("09:05");
        expect(formatWeekday("2030-03-04T09:30:00")).toBe("Mon");
    });

    it("shows a dash for nothing and the raw text for something it cannot read", () => {
        expect(formatDate(undefined)).toBe("—");
        expect(formatTime(null)).toBe("—");
        expect(formatWeekday("")).toBe("—");
        expect(formatDate("soon")).toBe("soon");
    });

    it("splits into the date / time inputs and joins them back in the format the API binds", () => {
        expect(splitLocalDateTime("2030-03-04T09:30:00")).toEqual({ date: "2030-03-04", time: "09:30" });
        expect(splitLocalDateTime(undefined)).toEqual({ date: "", time: "" });
        expect(joinLocalDateTime("2030-03-04", "09:30")).toBe("2030-03-04T09:30:00");
        expect(joinLocalDateTime("2030-03-04", "09:30:15")).toBe("2030-03-04T09:30:15");
    });

    it("adds days across month and year boundaries", () => {
        expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
        expect(addDays("2030-12-31", 1)).toBe("2031-01-01");
        expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
    });
});

describe("validateSlot", () => {
    it("accepts a slot that ends after it starts", () => {
        expect(validateSlot({ date: "2030-03-04", start: "09:00", end: "11:00" })).toEqual({});
    });

    it("requires every part", () => {
        expect(validateSlot({ date: "", start: "", end: "" })).toEqual({
            date: "Date is required",
            start: "Start time is required",
            end: "End time is required",
        });
    });

    it("rejects an end that is not after the start (including equal)", () => {
        expect(validateSlot({ date: "2030-03-04", start: "11:00", end: "09:00" }).end).toBe("End time must be after start time");
        expect(validateSlot({ date: "2030-03-04", start: "09:00", end: "09:00" }).end).toBe("End time must be after start time");
    });
});

describe("session helpers", () => {
    it("orders sessions by start, then id", () => {
        const sessions = [
            { id: 3, startTime: "2030-03-05T09:00:00" },
            { id: 2, startTime: "2030-03-04T09:00:00" },
            { id: 1, startTime: "2030-03-04T09:00:00" },
        ];
        expect([...sessions].sort(compareSessions).map((s) => s.id)).toEqual([1, 2, 3]);
    });

    it("describes statuses, falling back for unknown ones", () => {
        expect(getSessionStatusMeta("SCHEDULED").label).toBe("Scheduled");
        expect(getSessionStatusMeta("COMPLETED").label).toBe("Completed");
        expect(getSessionStatusMeta("CANCELLED").label).toBe("Cancelled");
        expect(getSessionStatusMeta("ARCHIVED").label).toBe("ARCHIVED");
        expect(getSessionStatusMeta(undefined).label).toBe("Unknown");
    });

    it("treats only SCHEDULED sessions as open for changes", () => {
        expect(isOpenSession({ status: "SCHEDULED" })).toBe(true);
        expect(isOpenSession({ status: "COMPLETED" })).toBe(false);
        expect(isOpenSession({ status: "CANCELLED" })).toBe(false);
        expect(isOpenSession({})).toBe(false);
    });

    it("names a trainer, falling back to the id", () => {
        const trainers = [{ id: 7, name: "Nguyen A" }];
        expect(trainerLabel(trainers, 7)).toBe("Nguyen A");
        expect(trainerLabel(trainers, 8)).toBe("Trainer #8");
        expect(trainerLabel(undefined, 8)).toBe("Trainer #8");
        expect(trainerLabel(trainers, undefined)).toBe("—");
    });
});
