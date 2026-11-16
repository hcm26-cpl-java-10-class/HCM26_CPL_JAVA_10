import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp, pageOf, type RecordedCall } from "@/test/fake-http";
import { trainerApi } from "./features/trainer.api";
vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
beforeEach(() => fakeHttp.reset());
it("reads all option pages and verifies the internal source without using the external mock", async () => {
    fakeHttp.on("get", "/trainers/options", (call: RecordedCall) => pageOf([{ id: Number((call.params as { page: number }).page) + 1, fullName: "Same Name", status: "ACTIVE", source: "INTERNAL" }], { totalPages: 2 }));
    fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: false });
    const result = await trainerApi.verifiedOptions(); expect(result.map(t => t.id)).toEqual([1, 2]);
    expect(fakeHttp.calls.some(c => c.url.startsWith("/external"))).toBe(false);
});
it.each([
    { source: "EXTERNAL", approved: true, sampleData: false },
    { source: "INTERNAL", approved: false, sampleData: false },
    { source: "INTERNAL", approved: true, sampleData: true },
    {},
])("blocks an unapproved/unverified source %j", async source => {
    fakeHttp.on("get", "/trainers/options", pageOf([])); fakeHttp.on("get", "/trainers/data-source", source);
    await expect(trainerApi.verifiedOptions()).rejects.toThrow("BLOCKED");
});
