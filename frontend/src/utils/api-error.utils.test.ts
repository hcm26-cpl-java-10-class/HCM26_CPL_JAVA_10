import { describe, expect, it } from "vitest";
import { httpError, networkError } from "@/test/fake-http";
import { describeApiError } from "./api-error.utils";

describe("describeApiError", () => {
    it("reads field errors from a 400 and keeps the backend's message", () => {
        const info = describeApiError(httpError(400, { message: "Validation failed", errors: { title: ["Title is required"], endTime: ["End time must be after start time"] } }));

        expect(info.kind).toBe("validation");
        expect(info.status).toBe(400);
        expect(info.message).toBe("Validation failed");
        expect(info.fieldErrors).toEqual({ title: ["Title is required"], endTime: ["End time must be after start time"] });
    });

    it("tells 401 (sign in again) from 403 (not allowed)", () => {
        expect(describeApiError(httpError(401)).kind).toBe("unauthorized");
        expect(describeApiError(httpError(401)).message).toMatch(/sign in again/i);
        expect(describeApiError(httpError(403)).kind).toBe("forbidden");
        expect(describeApiError(httpError(403)).message).toMatch(/permission/i);
    });

    it("reports 404 as a missing record", () => {
        const info = describeApiError(httpError(404, { message: "Entity not found" }));
        expect(info.kind).toBe("notFound");
        expect(info.message).toMatch(/no longer exists/i);
    });

    it("surfaces the backend's explanation of a 409 conflict", () => {
        const info = describeApiError(httpError(409, { status: 409, message: "Schedule conflict: Trainer #7 is already assigned to 'Intro'" }));
        expect(info.kind).toBe("conflict");
        expect(info.message).toBe("Schedule conflict: Trainer #7 is already assigned to 'Intro'");
    });

    it("explains that nothing was saved when the master training system is unreachable (502 / 503)", () => {
        expect(describeApiError(httpError(503)).kind).toBe("upstream");
        expect(describeApiError(httpError(502)).kind).toBe("upstream");
        expect(describeApiError(httpError(503)).message).toMatch(/nothing was changed/i);
    });

    it("reports other 5xx as a server problem without leaking the response body", () => {
        const info = describeApiError(httpError(500, { message: "java.lang.NullPointerException at com.example..." }));
        expect(info.kind).toBe("server");
        expect(info.message).not.toMatch(/NullPointer/);
        expect(info.message).toMatch(/500/);
    });

    it("recognises a request that never got an answer", () => {
        expect(describeApiError(networkError()).kind).toBe("network");
    });

    it("never throws on things that are not axios errors, nor on odd bodies", () => {
        expect(describeApiError(new Error("boom")).message).toBe("boom");
        expect(describeApiError("weird").kind).toBe("unknown");
        expect(describeApiError(httpError(400, "plain text body")).fieldErrors).toEqual({});
        expect(describeApiError(httpError(400, { errors: { title: "not-an-array" } })).fieldErrors).toEqual({ title: [] });
    });
});
