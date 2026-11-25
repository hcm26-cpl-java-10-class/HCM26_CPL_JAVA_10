import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeSessionFilter, sessionApi } from "@/api/features/demo/session.api";
import { ALL_STATUSES, externalApi } from "@/api/features/external.api";
import { fakeHttp, pageOf, httpError } from "@/test/fake-http";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));

beforeEach(() => {
    fakeHttp.reset();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

it("never substitutes a sample calendar when the real calendar API fails outside tests", async () => {
    vi.stubEnv("VITEST", "");
    try {
        fakeHttp.on("get", "/classes/42/calendars", () => { throw httpError(503); });
        await expect(externalApi.getClassCalendars(42)).rejects.toBeDefined();
        expect(fakeHttp.callsTo("get", "/external/classes/42/calendars")).toHaveLength(0);
    } finally {
        vi.unstubAllEnvs();
    }
});

describe("session lifecycle calls", () => {
    it("cancels with the cancelReason field the backend requires (not 'reason')", async () => {
        fakeHttp.on("patch", "/sessions/5/cancel", { id: 5, status: "CANCELLED" });

        const result = await sessionApi.cancelSession(5, { cancelReason: "Trainer sick" });

        expect(fakeHttp.calls).toHaveLength(1);
        expect(fakeHttp.calls[0]).toMatchObject({ method: "patch", url: "/sessions/5/cancel", data: { cancelReason: "Trainer sick" } });
        expect(result.status).toBe("CANCELLED");
    });

    it("completes with a body-less PATCH", async () => {
        fakeHttp.on("patch", "/sessions/5/complete", { id: 5, status: "COMPLETED" });

        await sessionApi.completeSession("5");

        expect(fakeHttp.calls[0]).toMatchObject({ method: "patch", url: "/sessions/5/complete", data: undefined });
    });

    it("reschedules and duplicates with only the slot (and room)", async () => {
        fakeHttp.on("patch", "/sessions/5/reschedule", { id: 5 });
        fakeHttp.on("post", "/sessions/5/duplicate", { id: 6 });
        const slot = { startTime: "2030-03-04T09:00:00", endTime: "2030-03-04T11:00:00", location: "Room 2" };

        await sessionApi.rescheduleSession(5, slot);
        await sessionApi.duplicateSession(5, slot);

        expect(fakeHttp.calls[0]).toMatchObject({ method: "patch", url: "/sessions/5/reschedule", data: slot });
        expect(fakeHttp.calls[1]).toMatchObject({ method: "post", url: "/sessions/5/duplicate", data: slot });
    });
});

describe("getAllByClass", () => {
    it("asks for one class only, in chronological order, and follows every page", async () => {
        fakeHttp.on("get", "/sessions", ({ params }: { params: URLSearchParams }) => {
            const page = Number(params.get("page"));
            return pageOf([{ id: page * 2 + 1 }, { id: page * 2 + 2 }], { page, totalPages: 3 });
        });

        const sessions = await sessionApi.getAllByClass(42);

        expect(sessions.map((session) => session.id)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(fakeHttp.calls).toHaveLength(3);

        const first = fakeHttp.calls[0].params as URLSearchParams;
        expect(first.get("classId")).toBe("42");
        expect(first.get("size")).toBe("200");
        expect(first.getAll("sort")).toEqual(["startTime,asc", "id,asc"]);
        expect(fakeHttp.calls.map((call) => (call.params as URLSearchParams).get("page"))).toEqual(["0", "1", "2"]);
    });

    it("makes a single request when there are no sessions", async () => {
        fakeHttp.on("get", "/sessions", pageOf([], { totalPages: 0 }));

        await expect(sessionApi.getAllByClass(1)).resolves.toEqual([]);
        expect(fakeHttp.calls).toHaveLength(1);
    });

    it("lets a failing page reject, so the caller can show an error instead of a partial list", async () => {
        fakeHttp.on("get", "/sessions", ({ params }: { params: URLSearchParams }) => {
            if (params.get("page") === "1") throw new Error("boom");
            return pageOf([{ id: 1 }], { page: 0, totalPages: 2 });
        });

        await expect(sessionApi.getAllByClass(1)).rejects.toThrow("boom");
    });
});

describe("session table filters", () => {
    it("turns the table's date range into the fromDate / toDate parameters the backend filters on", () => {
        expect(normalizeSessionFilter({ startTime: { from: "2030-03-01", to: "2030-03-31" }, status: ["SCHEDULED"] })).toEqual({
            status: ["SCHEDULED"],
            fromDate: "2030-03-01T00:00:00",
            toDate: "2030-03-31T23:59:59",
        });
        expect(normalizeSessionFilter({ startTime: { from: "2030-03-01" } })).toEqual({ fromDate: "2030-03-01T00:00:00" });
        expect(normalizeSessionFilter(undefined)).toBeUndefined();
        expect(normalizeSessionFilter({ classId: "5" })).toEqual({ classId: "5" });
    });

    it("sends repeated parameters for multi-select filters and never the raw date-range object", async () => {
        fakeHttp.on("get", "/sessions", pageOf([]));

        await sessionApi.getPage(
            { page: 0, size: 10, sort: ["startTime,desc"] },
            "intro",
            { classId: ["1", "2"], status: ["SCHEDULED", "CANCELLED"], startTime: { from: "2030-03-01", to: "2030-03-31" } } as never,
        );

        const params = fakeHttp.calls[0].params as URLSearchParams;
        expect(params.getAll("classId")).toEqual(["1", "2"]);
        expect(params.getAll("status")).toEqual(["SCHEDULED", "CANCELLED"]);
        expect(params.get("fromDate")).toBe("2030-03-01T00:00:00");
        expect(params.get("toDate")).toBe("2030-03-31T23:59:59");
        expect(params.has("startTime")).toBe(false);
        expect(params.get("search")).toBe("intro");
        expect(params.getAll("sort")).toEqual(["startTime,desc"]);
    });
});

describe("externalApi", () => {
    it("lists classes of every status by default, so the Class List is not limited to active ones", async () => {
        fakeHttp.on("get", "/external/classes", []);

        await externalApi.getClasses();

        expect(ALL_STATUSES).toBe("all");
        expect(fakeHttp.calls[0]).toMatchObject({ url: "/external/classes", params: { status: "all" } });
    });

    it("reads one class, the assignable (active) trainers and the rooms", async () => {
        fakeHttp.on("get", "/external/classes/5", { id: 5 });
        fakeHttp.on("get", "/external/trainers", []);
        fakeHttp.on("get", "/external/rooms", []);

        await externalApi.getClassById(5);
        await externalApi.getTrainers("active");
        await externalApi.getRooms();

        expect(fakeHttp.calls.map((call) => [call.url, call.params])).toEqual([
            ["/external/classes/5", undefined],
            ["/external/trainers", { status: "active" }],
            ["/external/rooms", undefined],
        ]);
    });
});
